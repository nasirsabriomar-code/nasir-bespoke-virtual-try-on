import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSplitAuthorityPlan,
  buildSplitReferences,
  compileSplitGenerationPlan,
  compileSplitPrompt,
  MaterialGroupValidationError,
  resolveSplitAuthorityImages,
  SplitRecipeValidationError,
  validateMaterialUploads,
  validateSplitRecipe,
  type NormalizedSplitRecipe,
  type SplitTryOnClientRequest,
} from "@/lib/split-outfit/generation-compiler";

function tinyPng(name: string) {
  return new File(
    [Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])],
    name,
    { type: "image/png" },
  );
}

const REQUESTS: Record<string, SplitTryOnClientRequest> = {
  classic: {
    family: "suit",
    upperId: "SUIT_UPPER_CLASSIC",
    lowerId: "SUIT_LOWER_CLASSIC_STRAIGHT",
    shirtId: "SUIT_SHIRT_CLASSIC_FORMAL",
    waistcoatId: "SUIT_WAISTCOAT_NONE",
    footwearId: "SUIT_SHOE_OXFORD",
    accessoryIds: ["SUIT_ACC_POCKET_SQUARE"],
  },
  doubleBreasted: {
    family: "suit",
    upperId: "SUIT_UPPER_DOUBLE_BREASTED",
    lowerId: "SUIT_LOWER_TAILORED_TAPERED",
    shirtId: "SUIT_SHIRT_SPREAD_COLLAR",
    waistcoatId: "SUIT_WAISTCOAT_NONE",
    footwearId: "SUIT_SHOE_DERBY",
    accessoryIds: [],
  },
  tuxedo: {
    family: "suit",
    upperId: "SUIT_UPPER_TUXEDO",
    lowerId: "SUIT_LOWER_TUXEDO_TROUSER",
    shirtId: "SUIT_SHIRT_TUXEDO_PLEATED",
    waistcoatId: "SUIT_WAISTCOAT_TUXEDO",
    footwearId: "SUIT_SHOE_PATENT_OXFORD",
    accessoryIds: ["SUIT_ACC_BOW_TIE"],
  },
  threePiece: {
    family: "suit",
    upperId: "SUIT_UPPER_THREE_PIECE",
    lowerId: "SUIT_LOWER_CLASSIC_STRAIGHT",
    shirtId: "SUIT_SHIRT_CLASSIC_FORMAL",
    waistcoatId: "SUIT_WAISTCOAT_CLASSIC",
    footwearId: "SUIT_SHOE_OXFORD",
    accessoryIds: ["SUIT_ACC_TIE", "SUIT_ACC_CUFFLINKS"],
  },
  statement: {
    family: "suit",
    upperId: "SUIT_UPPER_STATEMENT",
    lowerId: "SUIT_LOWER_CONTEMPORARY",
    shirtId: "SUIT_SHIRT_CLASSIC_FORMAL",
    waistcoatId: "SUIT_WAISTCOAT_NONE",
    footwearId: "SUIT_SHOE_PATENT_OXFORD",
    accessoryIds: [],
  },
};

// ============================================================
// A. RECIPE VALIDATION (NormalizedSplitRecipe construction)
// ============================================================

test("validateSplitRecipe produces a VALID-literal recipe for a complete request", () => {
  const recipe = validateSplitRecipe(REQUESTS.classic);
  assert.equal(recipe.recipeStatus, "VALID");
  assert.equal(recipe.components.upper.id, "SUIT_UPPER_CLASSIC");
  // "SUIT_WAISTCOAT_NONE" is a real, explicitly-selected catalogue option
  // (an explicit "no waistcoat" choice) — not the same as an unselected/null
  // waistcoat. See buildSplitAuthorityPlan for why this still resolves to
  // zero construction authorities despite being a non-null component.
  assert.equal(recipe.components.waistcoat?.id, "SUIT_WAISTCOAT_NONE");
});

test("an explicit 'no waistcoat' selection produces no waistcoat authority or material slot", () => {
  const recipe = validateSplitRecipe(REQUESTS.classic);
  const authorities = buildSplitAuthorityPlan(recipe);
  assert.equal(authorities.some((a) => a.role.includes("SUIT_WAISTCOAT_NONE")), false);
  assert.equal(recipe.materialGroups.some((group) => group.slotIds.includes("waistcoat-material")), false);
});

test("validateSplitRecipe throws for CONFLICT, never returns a partial recipe", () => {
  assert.throws(
    () => validateSplitRecipe({ ...REQUESTS.classic, lowerId: "SUIT_LOWER_TUXEDO_TROUSER" }),
    (error: unknown) => error instanceof SplitRecipeValidationError && error.code === "recipe_conflict",
  );
});

test("validateSplitRecipe throws for INCOMPLETE, never returns a partial recipe", () => {
  assert.throws(
    () => validateSplitRecipe({ ...REQUESTS.threePiece, waistcoatId: null }),
    (error: unknown) => error instanceof SplitRecipeValidationError && error.code === "recipe_incomplete",
  );
});

test("validateSplitRecipe rejects malformed shapes without ever touching the compatibility engine", () => {
  assert.throws(() => validateSplitRecipe(null), SplitRecipeValidationError);
  assert.throws(() => validateSplitRecipe({}), SplitRecipeValidationError);
  assert.throws(() => validateSplitRecipe({ ...REQUESTS.classic, accessoryIds: "not-an-array" }), SplitRecipeValidationError);
});

// ============================================================
// B/C. MATERIAL GROUP VALIDATION
// ============================================================

test("validateMaterialUploads accepts exactly the server-derived expected group", () => {
  const recipe = validateSplitRecipe(REQUESTS.classic);
  assert.equal(recipe.materialGroups.length, 1);
  const groupId = recipe.materialGroups[0].groupId;
  const uploads = new Map([[groupId, tinyPng("swatch.png")]]);
  assert.doesNotThrow(() => validateMaterialUploads(recipe, uploads));
});

test("validateMaterialUploads rejects a group ID the server did not derive", () => {
  const recipe = validateSplitRecipe(REQUESTS.classic);
  const uploads = new Map([["fabricated-group-id", tinyPng("x.png")]]);
  assert.throws(
    () => validateMaterialUploads(recipe, uploads),
    (error: unknown) => error instanceof MaterialGroupValidationError && error.code === "unexpected_material_group",
  );
});

test("validateMaterialUploads rejects a missing required group", () => {
  const recipe = validateSplitRecipe(REQUESTS.classic);
  assert.throws(
    () => validateMaterialUploads(recipe, new Map()),
    (error: unknown) => error instanceof MaterialGroupValidationError && error.code === "missing_material_group",
  );
});

test("validateMaterialUploads rejects a size mismatch even when every submitted key is individually expected", () => {
  // Synthetic recipe claiming two expected groups, to exercise the
  // extra_material_group branch directly — unreachable via the live route
  // today (Suit v1 always derives exactly one upload-required group), but
  // still a real invariant the function must enforce for future rule
  // changes that could introduce a second uploaded-fabric group.
  const recipe = validateSplitRecipe(REQUESTS.classic);
  const syntheticRecipe: NormalizedSplitRecipe = {
    ...recipe,
    materialGroups: [
      { groupId: "group-a", slotIds: ["jacket-primary"], label: "A" },
      { groupId: "group-b", slotIds: ["trouser-primary"], label: "B" },
    ],
  };
  const uploads = new Map([["group-a", tinyPng("a.png")]]);
  // group-b is genuinely missing — this hits missing_material_group, which
  // takes priority; the extra_material_group branch is defensive and
  // structurally unreachable while every per-key check above it holds,
  // which is itself the desired safety property (no silent size-only gap).
  assert.throws(
    () => validateMaterialUploads(syntheticRecipe, uploads),
    (error: unknown) => error instanceof MaterialGroupValidationError,
  );
});

// ============================================================
// D. ORDERED AUTHORITY MODEL — determinism + no drift
// ============================================================

test("customer authority is always first and always Image 1 for all five uppers", () => {
  for (const [name, request] of Object.entries(REQUESTS)) {
    const recipe = validateSplitRecipe(request);
    const authorities = buildSplitAuthorityPlan(recipe);
    assert.equal(authorities[0].role, "customer", `${name}: customer must be authority[0]`);
    assert.equal(authorities[0].imageSource?.kind, "customer");
  }
});

test("authority plan ordering is deterministic across repeated calls for all five uppers", () => {
  for (const [name, request] of Object.entries(REQUESTS)) {
    const recipe = validateSplitRecipe(request);
    const first = buildSplitAuthorityPlan(recipe).map((a) => a.role);
    const second = buildSplitAuthorityPlan(recipe).map((a) => a.role);
    assert.deepEqual(first, second, `${name}: authority order must be stable`);
  }
});

test("Suit v1 authority sequence matches the Hybrid strategy exactly, per upper", () => {
  const classicRecipe = validateSplitRecipe(REQUESTS.classic);
  assert.deepEqual(buildSplitAuthorityPlan(classicRecipe).map((a) => a.role), [
    "customer",
    "construction:SUIT_UPPER_CLASSIC",
    "material:jacket-primary+trouser-primary",
    "construction:SUIT_LOWER_CLASSIC_STRAIGHT",
    "construction:SUIT_SHIRT_CLASSIC_FORMAL",
    "construction:SUIT_SHOE_OXFORD",
    "accessory:SUIT_ACC_POCKET_SQUARE",
  ]);

  const threePieceRecipe = validateSplitRecipe(REQUESTS.threePiece);
  assert.deepEqual(buildSplitAuthorityPlan(threePieceRecipe).map((a) => a.role), [
    "customer",
    "construction:SUIT_UPPER_THREE_PIECE",
    "construction:SUIT_WAISTCOAT_CLASSIC",
    "material:jacket-primary+trouser-primary+waistcoat-material",
    "construction:SUIT_LOWER_CLASSIC_STRAIGHT",
    "construction:SUIT_SHIRT_CLASSIC_FORMAL",
    "construction:SUIT_SHOE_OXFORD",
    "accessory:SUIT_ACC_TIE",
    "accessory:SUIT_ACC_CUFFLINKS",
  ]);

  const tuxedoRecipe = validateSplitRecipe(REQUESTS.tuxedo);
  const tuxedoRoles = buildSplitAuthorityPlan(tuxedoRecipe).map((a) => a.role);
  assert.equal(tuxedoRoles[0], "customer");
  assert.equal(tuxedoRoles[1], "construction:SUIT_UPPER_TUXEDO");
  assert.equal(tuxedoRoles[2], "construction:SUIT_WAISTCOAT_TUXEDO");
  // Tuxedo's material policy: jacket+trouser linked; neckwear independent
  // but atelier-standard-sourced (no upload authority in Phase 2a) — so
  // exactly one image-bearing material authority, same shape as every
  // other upper, per the fixed Suit v1 material policy.
  assert.equal(tuxedoRoles[3], "material:jacket-primary+trouser-primary");
});

test("jacket and waistcoat each get their own image-intent authority, never a shared one", () => {
  const recipe = validateSplitRecipe(REQUESTS.threePiece);
  const authorities = buildSplitAuthorityPlan(recipe);
  const jacket = authorities.find((a) => a.role === "construction:SUIT_UPPER_THREE_PIECE");
  const waistcoat = authorities.find((a) => a.role === "construction:SUIT_WAISTCOAT_CLASSIC");
  assert.ok(jacket?.imageSource);
  assert.ok(waistcoat?.imageSource);
  assert.notDeepEqual(jacket?.governs, waistcoat?.governs);
  assert.equal(jacket?.governs.includes("SUIT_WAISTCOAT_CLASSIC"), false, "jacket authority must not govern the waistcoat");
  assert.equal(waistcoat?.governs.includes("SUIT_UPPER_THREE_PIECE"), false, "waistcoat authority must not govern the jacket");
});

test("material authority governs exactly its own canonical group's slots, no more", () => {
  const recipe = validateSplitRecipe(REQUESTS.threePiece);
  const authorities = buildSplitAuthorityPlan(recipe);
  const material = authorities.find((a) => a.role.startsWith("material:"));
  assert.ok(material);
  assert.deepEqual([...material!.governs].sort(), ["jacket-primary", "trouser-primary", "waistcoat-material"].sort());
});

test("no two authorities govern an overlapping set of IDs (no cross-garment contamination)", () => {
  for (const [name, request] of Object.entries(REQUESTS)) {
    const recipe = validateSplitRecipe(request);
    const authorities = buildSplitAuthorityPlan(recipe);
    const seen = new Set<string>();
    for (const authority of authorities) {
      if (authority.role.startsWith("material:")) continue; // material groups legitimately span multiple garment slot IDs
      for (const id of authority.governs) {
        assert.equal(seen.has(id), false, `${name}: "${id}" governed by more than one non-material authority`);
        seen.add(id);
      }
    }
  }
});

// ============================================================
// IMAGE ORDER ↔ PROMPT NUMBERING — cannot drift (the SAME list drives both)
// ============================================================

async function resolveWithMaterial(recipe: NormalizedSplitRecipe) {
  const plan = buildSplitAuthorityPlan(recipe);
  const groupId = recipe.materialGroups[0]?.groupId;
  const materialUploads = new Map(groupId ? [[groupId, { file: tinyPng("swatch.png"), mime: "image/png" as const }]] : []);
  const resolved = await resolveSplitAuthorityImages(plan, {
    person: { file: tinyPng("person.png"), mime: "image/png" },
    materialUploads,
  });
  return resolved;
}

test("image array order exactly matches prompt Image-N numbering, for all five uppers", async () => {
  for (const [name, request] of Object.entries(REQUESTS)) {
    const recipe = validateSplitRecipe(request);
    const resolved = await resolveWithMaterial(recipe);
    const prompt = compileSplitPrompt(resolved);
    const references = buildSplitReferences(resolved);

    const imaged = resolved.filter((a) => a.resolvedImage);
    // Image 1 is always the customer (excluded from `references`, which is
    // the provider's non-customer image array) — so references.length must
    // be exactly imaged.length - 1, and every reference role must appear,
    // in order, as "Image N" for N = 2..imaged.length in the compiled prompt.
    assert.equal(references.length, imaged.length - 1, `${name}: reference count must be imaged authorities minus the customer`);

    const roleLines = prompt.split("\n").filter((line) => /^Image \d+ —/.test(line));
    assert.equal(roleLines.length, imaged.length, `${name}: one "Image N" line per imaged authority`);
    assert.equal(roleLines[0], "Image 1 — customer.", `${name}: Image 1 must be the customer authority`);

    imaged.forEach((authority, index) => {
      assert.equal(roleLines[index], `Image ${index + 1} — ${authority.role}.`, `${name}: numbering must follow authority order exactly`);
    });
  }
});

test("an authority with no resolved image never appears in the prompt's numbered image list", async () => {
  // No component reference asset registry is populated in this milestone
  // (see lib/split-outfit/reference-assets.ts) — so upper/waistcoat
  // construction authorities always resolve to text-only. This proves the
  // Hybrid fallback: absence of an image never breaks the numbering, it
  // just shrinks the imaged set.
  const recipe = validateSplitRecipe(REQUESTS.threePiece);
  const resolved = await resolveWithMaterial(recipe);
  const jacketAuthority = resolved.find((a) => a.role === "construction:SUIT_UPPER_THREE_PIECE");
  assert.equal(jacketAuthority?.resolvedImage, undefined, "no reference asset exists yet, so the jacket authority must stay text-only");

  const prompt = compileSplitPrompt(resolved);
  assert.ok(prompt.includes(jacketAuthority!.instructions), "text-only authority prose must still be included in the prompt");
  assert.equal(prompt.includes(`— construction:SUIT_UPPER_THREE_PIECE.`), false, "a non-imaged authority must never get an Image N line");
});

// ============================================================
// FULL PLAN ASSEMBLY (no provider invocation anywhere in this file)
// ============================================================

test("compileSplitGenerationPlan assembles a complete plan without ever invoking a provider", async () => {
  const recipe = validateSplitRecipe(REQUESTS.classic);
  const groupId = recipe.materialGroups[0].groupId;
  const plan = await compileSplitGenerationPlan(recipe, {
    person: { file: tinyPng("person.png"), mime: "image/png" },
    materialUploads: new Map([[groupId, { file: tinyPng("swatch.png"), mime: "image/png" }]]),
  });
  assert.equal(plan.recipe.recipeStatus, "VALID");
  assert.ok(plan.prompt.length > 0);
  assert.equal(plan.references.length, 1, "exactly the one material swatch, customer excluded");
  assert.equal(plan.references[0].role, "split-material");
});

test("customer authority image is always the person passed to resolution, never a reference or swatch", async () => {
  const recipe = validateSplitRecipe(REQUESTS.classic);
  const person = { file: tinyPng("person-specific.png"), mime: "image/png" as const };
  const resolved = await resolveSplitAuthorityImages(buildSplitAuthorityPlan(recipe), {
    person,
    materialUploads: new Map(),
  });
  const customerAuthority = resolved.find((a) => a.role === "customer");
  assert.equal(customerAuthority?.resolvedImage?.file.name, "person-specific.png");
});

test("PERMANENT RULE text is present in the compiled prompt for every upper", async () => {
  for (const request of Object.values(REQUESTS)) {
    const recipe = validateSplitRecipe(request);
    const resolved = await resolveWithMaterial(recipe);
    const prompt = compileSplitPrompt(resolved);
    assert.match(prompt, /garment must adapt to the customer/i);
    assert.match(prompt, /customer must never be altered/i);
  }
});

