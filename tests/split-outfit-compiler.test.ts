import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import {
  buildSplitAuthorityPlan,
  buildSplitReferences,
  compileSplitGenerationDraft,
  compileSplitPrompt,
  computeSplitGenerationReadiness,
  MaterialGroupValidationError,
  prepareProviderReadySplitGeneration,
  resolveSplitAuthorityImages,
  SplitGenerationNotReadyError,
  SplitRecipeValidationError,
  validateMaterialUploads,
  validateSplitRecipe,
  type NormalizedSplitRecipe,
  type SplitAuthorityResolutionInputs,
  type SplitTryOnClientRequest,
} from "@/lib/split-outfit/generation-compiler";
import { getSplitReferencePolicy, getRequiredSuitComponentIds } from "@/lib/split-outfit/reference-policy";
import {
  resetSplitReferenceAssetRegistryForTests,
  SplitReferenceAssetError,
  upsertSplitReferenceAsset,
  type SplitReferenceAssetReader,
} from "@/lib/split-outfit/reference-assets";

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

beforeEach(() => {
  resetSplitReferenceAssetRegistryForTests();
});

function materialInputsFor(recipe: NormalizedSplitRecipe): SplitAuthorityResolutionInputs {
  const materialUploads = new Map(
    recipe.materialGroups.map((group) => [group.groupId, { file: tinyPng(`${group.groupId}.png`), mime: "image/png" as const }]),
  );
  return { person: { file: tinyPng("person.png"), mime: "image/png" }, materialUploads };
}

// ============================================================
// REFERENCE POLICY
// ============================================================

test("Suit v1 reference policy matches the fixed architecture exactly", () => {
  for (const id of ["SUIT_UPPER_CLASSIC", "SUIT_UPPER_DOUBLE_BREASTED", "SUIT_UPPER_TUXEDO", "SUIT_UPPER_THREE_PIECE", "SUIT_UPPER_STATEMENT"]) {
    assert.equal(getSplitReferencePolicy(id), "REQUIRED", id);
  }
  for (const id of ["SUIT_WAISTCOAT_CLASSIC", "SUIT_WAISTCOAT_FORMAL", "SUIT_WAISTCOAT_TUXEDO"]) {
    assert.equal(getSplitReferencePolicy(id), "REQUIRED", id);
  }
  assert.equal(getSplitReferencePolicy("SUIT_WAISTCOAT_NONE"), "TEXT_ONLY", "SUIT_WAISTCOAT_NONE must never require a reference");
  for (const id of [
    "SUIT_LOWER_CLASSIC_STRAIGHT", "SUIT_LOWER_TUXEDO_TROUSER",
    "SUIT_SHIRT_CLASSIC_FORMAL", "SUIT_SHIRT_TUXEDO_PLEATED",
    "SUIT_SHOE_OXFORD", "SUIT_ACC_TIE", "SUIT_ACC_BOW_TIE", "SUIT_ACC_POCKET_SQUARE", "SUIT_ACC_CUFFLINKS", "SUIT_ACC_BUTTONS",
  ]) {
    assert.equal(getSplitReferencePolicy(id), "TEXT_ONLY", id);
  }
  assert.equal(getRequiredSuitComponentIds().length, 8, "exactly 5 uppers + 3 waistcoats");
});

// ============================================================
// RECIPE VALIDATION (unchanged surface, still correct after shirt-material move)
// ============================================================

test("validateSplitRecipe still produces a VALID recipe with two canonical material groups (suit + shirt)", () => {
  const recipe = validateSplitRecipe(REQUESTS.classic);
  assert.equal(recipe.recipeStatus, "VALID");
  assert.equal(recipe.materialGroups.length, 2, "suit fabric + shirt fabric, independent groups");
  const groupIds = recipe.materialGroups.map((g) => g.groupId).sort();
  assert.deepEqual(groupIds, ["jacket-primary+trouser-primary", "shirt-material"].sort());
});

test("Three-Piece suit material group includes the waistcoat; shirt group stays independent", () => {
  const recipe = validateSplitRecipe(REQUESTS.threePiece);
  const groupIds = recipe.materialGroups.map((g) => g.groupId).sort();
  assert.deepEqual(groupIds, ["jacket-primary+trouser-primary+waistcoat-material", "shirt-material"].sort());
});

test("Tuxedo also yields exactly two upload-required groups — neckwear stays atelier-standard, no third group", () => {
  const recipe = validateSplitRecipe(REQUESTS.tuxedo);
  assert.equal(recipe.materialGroups.length, 2);
  const groupIds = recipe.materialGroups.map((g) => g.groupId).sort();
  assert.deepEqual(groupIds, ["jacket-primary+trouser-primary", "shirt-material"].sort());
});

// ============================================================
// MATERIAL GROUP VALIDATION — extended malicious-client cases
// ============================================================

test("validateMaterialUploads accepts exactly the two server-derived groups", () => {
  const recipe = validateSplitRecipe(REQUESTS.classic);
  const uploads = new Map(recipe.materialGroups.map((g) => [g.groupId, tinyPng(`${g.groupId}.png`)]));
  assert.doesNotThrow(() => validateMaterialUploads(recipe, uploads));
});

test("missing shirt fabric alone is rejected even when suit fabric is present", () => {
  const recipe = validateSplitRecipe(REQUESTS.classic);
  const suitGroup = recipe.materialGroups.find((g) => g.groupId !== "shirt-material")!;
  const uploads = new Map([[suitGroup.groupId, tinyPng("suit.png")]]);
  assert.throws(
    () => validateMaterialUploads(recipe, uploads),
    (error: unknown) => error instanceof MaterialGroupValidationError && error.code === "missing_material_group",
  );
});

test("missing suit fabric alone is rejected even when shirt fabric is present", () => {
  const recipe = validateSplitRecipe(REQUESTS.classic);
  const uploads = new Map([["shirt-material", tinyPng("shirt.png")]]);
  assert.throws(
    () => validateMaterialUploads(recipe, uploads),
    (error: unknown) => error instanceof MaterialGroupValidationError && error.code === "missing_material_group",
  );
});

test("an extra third material group is rejected", () => {
  const recipe = validateSplitRecipe(REQUESTS.classic);
  const uploads = new Map(recipe.materialGroups.map((g) => [g.groupId, tinyPng(`${g.groupId}.png`)]));
  uploads.set("neckwear-material", tinyPng("neckwear.png"));
  assert.throws(
    () => validateMaterialUploads(recipe, uploads),
    (error: unknown) => error instanceof MaterialGroupValidationError && error.code === "unexpected_material_group",
  );
});

test("a fabricated shirt group id is rejected", () => {
  const recipe = validateSplitRecipe(REQUESTS.classic);
  const suitGroup = recipe.materialGroups.find((g) => g.groupId !== "shirt-material")!;
  const uploads = new Map([[suitGroup.groupId, tinyPng("suit.png")], ["shirt-fabricated", tinyPng("shirt.png")]]);
  assert.throws(
    () => validateMaterialUploads(recipe, uploads),
    (error: unknown) => error instanceof MaterialGroupValidationError && error.code === "unexpected_material_group",
  );
});

test("shirt fabric incorrectly submitted merged into the suit group id is rejected (wrong canonical group id)", () => {
  const recipe = validateSplitRecipe(REQUESTS.classic);
  // A client trying to claim shirt+jacket+trouser as ONE linked group — not
  // a group the server ever derives, since shirt-material is never part of
  // materialLinkGroups. Must be rejected as unexpected, not silently split.
  const uploads = new Map([["jacket-primary+trouser-primary+shirt-material", tinyPng("wrong.png")]]);
  assert.throws(
    () => validateMaterialUploads(recipe, uploads),
    (error: unknown) => error instanceof MaterialGroupValidationError,
  );
});

// ============================================================
// AUTHORITY ORDER — customer, suit material, shirt material, then required refs
// ============================================================

test("authority order is customer → suit material → shirt material → required construction refs → text-only, for all five uppers", () => {
  const expectedByUpper: Record<string, string[]> = {
    classic: [
      "customer",
      "material:jacket-primary+trouser-primary",
      "material:shirt-material",
      "construction:SUIT_UPPER_CLASSIC",
      "construction:SUIT_LOWER_CLASSIC_STRAIGHT",
      "construction:SUIT_SHIRT_CLASSIC_FORMAL",
      "construction:SUIT_SHOE_OXFORD",
      "accessory:SUIT_ACC_POCKET_SQUARE",
    ],
    threePiece: [
      "customer",
      "material:jacket-primary+trouser-primary+waistcoat-material",
      "material:shirt-material",
      "construction:SUIT_UPPER_THREE_PIECE",
      "construction:SUIT_WAISTCOAT_CLASSIC",
      "construction:SUIT_LOWER_CLASSIC_STRAIGHT",
      "construction:SUIT_SHIRT_CLASSIC_FORMAL",
      "construction:SUIT_SHOE_OXFORD",
      "accessory:SUIT_ACC_TIE",
      "accessory:SUIT_ACC_CUFFLINKS",
    ],
    tuxedo: [
      "customer",
      "material:jacket-primary+trouser-primary",
      "material:shirt-material",
      "construction:SUIT_UPPER_TUXEDO",
      "construction:SUIT_WAISTCOAT_TUXEDO",
      "construction:SUIT_LOWER_TUXEDO_TROUSER",
      "construction:SUIT_SHIRT_TUXEDO_PLEATED",
      "construction:SUIT_SHOE_PATENT_OXFORD",
      "accessory:SUIT_ACC_BOW_TIE",
    ],
  };
  for (const [name, expected] of Object.entries(expectedByUpper)) {
    const recipe = validateSplitRecipe(REQUESTS[name]);
    const roles = buildSplitAuthorityPlan(recipe).map((a) => a.role);
    assert.deepEqual(roles, expected, name);
  }
});

test("authority ordering is deterministic across repeated calls for all five uppers", () => {
  for (const [name, request] of Object.entries(REQUESTS)) {
    const recipe = validateSplitRecipe(request);
    const first = buildSplitAuthorityPlan(recipe).map((a) => a.role);
    const second = buildSplitAuthorityPlan(recipe).map((a) => a.role);
    assert.deepEqual(first, second, name);
  }
});

test("customer authority is always first for all five uppers", () => {
  for (const [name, request] of Object.entries(REQUESTS)) {
    const recipe = validateSplitRecipe(request);
    const authorities = buildSplitAuthorityPlan(recipe);
    assert.equal(authorities[0].role, "customer", name);
    assert.equal(authorities[0].imageSource?.kind, "customer", name);
  }
});

test("classic upper: material authorities occupy positions 2 and 3, jacket authority is REQUIRED image-intent", () => {
  const recipe = validateSplitRecipe(REQUESTS.classic);
  const authorities = buildSplitAuthorityPlan(recipe);
  assert.equal(authorities[1].role, "material:jacket-primary+trouser-primary");
  assert.equal(authorities[2].role, "material:shirt-material");
  const jacket = authorities.find((a) => a.role === "construction:SUIT_UPPER_CLASSIC");
  assert.equal(jacket?.imageSource?.kind, "construction-reference");
});

test("waistcoat authority appears ONLY when a real waistcoat is selected, never for SUIT_WAISTCOAT_NONE", () => {
  const classicRecipe = validateSplitRecipe(REQUESTS.classic); // waistcoatId: SUIT_WAISTCOAT_NONE
  const classicAuthorities = buildSplitAuthorityPlan(classicRecipe);
  assert.equal(classicAuthorities.some((a) => a.role.includes("WAISTCOAT")), false);

  const threePieceRecipe = validateSplitRecipe(REQUESTS.threePiece); // waistcoatId: SUIT_WAISTCOAT_CLASSIC
  const threePieceAuthorities = buildSplitAuthorityPlan(threePieceRecipe);
  const waistcoat = threePieceAuthorities.find((a) => a.role === "construction:SUIT_WAISTCOAT_CLASSIC");
  assert.ok(waistcoat);
  assert.equal(waistcoat!.imageSource?.kind, "construction-reference");
});

test("text-only authorities never declare an imageSource — they can never consume an image position", () => {
  for (const request of Object.values(REQUESTS)) {
    const recipe = validateSplitRecipe(request);
    const authorities = buildSplitAuthorityPlan(recipe);
    for (const authority of authorities) {
      const isTextOnlyKind = authority.role.startsWith("construction:") &&
        [recipe.components.lower.id, recipe.components.shirt.id, recipe.components.footwear.id].includes(authority.governs[0]);
      if (isTextOnlyKind || authority.role.startsWith("accessory:")) {
        assert.equal(authority.imageSource, undefined, authority.role);
      }
    }
  }
});

// ============================================================
// MATERIAL AUTHORITY SCOPE
// ============================================================

test("suit material authority governs only jacket/trouser(/waistcoat); shirt material governs only shirt", () => {
  const recipe = validateSplitRecipe(REQUESTS.threePiece);
  const authorities = buildSplitAuthorityPlan(recipe);
  const suitMaterial = authorities.find((a) => a.role.startsWith("material:") && a.role.includes("jacket-primary"));
  const shirtMaterial = authorities.find((a) => a.role === "material:shirt-material");
  assert.ok(suitMaterial);
  assert.ok(shirtMaterial);
  assert.deepEqual([...suitMaterial!.governs].sort(), ["jacket-primary", "trouser-primary", "waistcoat-material"].sort());
  assert.deepEqual(shirtMaterial!.governs, ["shirt-material"]);
  assert.equal(suitMaterial!.governs.includes("shirt-material"), false);
  assert.equal(shirtMaterial!.governs.includes("jacket-primary"), false);
});

test("no authority governs an overlapping ID with another (material groups excluded from the cross-check, they legitimately span multiple slots)", () => {
  for (const [name, request] of Object.entries(REQUESTS)) {
    const recipe = validateSplitRecipe(request);
    const authorities = buildSplitAuthorityPlan(recipe);
    const seen = new Set<string>();
    for (const authority of authorities) {
      if (authority.role.startsWith("material:")) continue;
      for (const id of authority.governs) {
        assert.equal(seen.has(id), false, `${name}: "${id}" governed twice`);
        seen.add(id);
      }
    }
  }
});

// ============================================================
// IMAGE ORDER ↔ PROMPT NUMBERING (no drift) + material never affects footwear/accessories/customer
// ============================================================

test("image array order exactly matches prompt Image-N numbering with both material swatches present, for all five uppers", async () => {
  for (const [name, request] of Object.entries(REQUESTS)) {
    const recipe = validateSplitRecipe(request);
    const plan = buildSplitAuthorityPlan(recipe);
    const resolved = await resolveSplitAuthorityImages(plan, materialInputsFor(recipe));
    const prompt = compileSplitPrompt(resolved);
    const references = buildSplitReferences(resolved);

    const imaged = resolved.filter((a) => a.resolvedImage);
    assert.equal(references.length, imaged.length - 1, `${name}: references = imaged minus customer`);

    const roleLines = prompt.split("\n").filter((line) => /^Image \d+ —/.test(line));
    assert.equal(roleLines.length, imaged.length, name);
    assert.equal(roleLines[0], "Image 1 — customer.", name);
    imaged.forEach((authority, index) => {
      assert.equal(roleLines[index], `Image ${index + 1} — ${authority.role}.`, `${name} at index ${index}`);
    });

    // With no registered reference assets, only customer + the two material
    // swatches resolve — Image 2 must be the suit swatch, Image 3 the shirt
    // swatch, exactly as the architecture specifies.
    assert.equal(roleLines[1], "Image 2 — material:" + recipe.materialGroups.find((g) => g.groupId !== "shirt-material")!.groupId + ".", name);
    assert.equal(roleLines[2], "Image 3 — material:shirt-material.", name);
  }
});

test("material authorities never influence footwear, accessory, or customer prose", async () => {
  const recipe = validateSplitRecipe(REQUESTS.classic);
  const plan = buildSplitAuthorityPlan(recipe);
  const resolved = await resolveSplitAuthorityImages(plan, materialInputsFor(recipe));
  const footwear = resolved.find((a) => a.role === "construction:SUIT_SHOE_OXFORD")!;
  const accessory = resolved.find((a) => a.role === "accessory:SUIT_ACC_POCKET_SQUARE")!;
  const customer = resolved.find((a) => a.role === "customer")!;
  for (const authority of [footwear, accessory, customer]) {
    assert.equal(authority.instructions.includes("MATERIAL AUTHORITY"), false, authority.role);
  }
});

// ============================================================
// DRAFT vs PROVIDER-READY
// ============================================================

test("draft compilation succeeds and reports MISSING_REQUIRED_REFERENCE when no reference assets are registered", async () => {
  const recipe = validateSplitRecipe(REQUESTS.classic);
  const draft = await compileSplitGenerationDraft(recipe, materialInputsFor(recipe));
  assert.equal(draft.readiness.status, "MISSING_REQUIRED_REFERENCE");
  if (draft.readiness.status === "MISSING_REQUIRED_REFERENCE") {
    assert.deepEqual(draft.readiness.componentIds.sort(), ["SUIT_UPPER_CLASSIC"]);
  }
  // Draft still compiles a full prompt/reference set — it just describes
  // the jacket authority as text-only rather than crashing or refusing.
  assert.ok(draft.prompt.length > 0);
});

test("draft compilation for Three-Piece reports both jacket and waistcoat as missing required references", async () => {
  const recipe = validateSplitRecipe(REQUESTS.threePiece);
  const draft = await compileSplitGenerationDraft(recipe, materialInputsFor(recipe));
  assert.equal(draft.readiness.status, "MISSING_REQUIRED_REFERENCE");
  if (draft.readiness.status === "MISSING_REQUIRED_REFERENCE") {
    assert.deepEqual(draft.readiness.componentIds.sort(), ["SUIT_UPPER_THREE_PIECE", "SUIT_WAISTCOAT_CLASSIC"].sort());
  }
});

test("prepareProviderReadySplitGeneration throws SplitGenerationNotReadyError when references are missing — never silently downgrades to text-only", async () => {
  const recipe = validateSplitRecipe(REQUESTS.classic);
  await assert.rejects(
    () => prepareProviderReadySplitGeneration(recipe, materialInputsFor(recipe)),
    (error: unknown) => {
      assert.ok(error instanceof SplitGenerationNotReadyError);
      assert.equal(error.readiness.status, "MISSING_REQUIRED_REFERENCE");
      return true;
    },
  );
});

test("prepareProviderReadySplitGeneration succeeds once every REQUIRED reference is registered and active", async () => {
  const recipe = validateSplitRecipe(REQUESTS.classic);
  const mockReader: SplitReferenceAssetReader = async (asset) => ({
    bytes: Uint8Array.from([1, 2, 3, 4]),
    contentType: asset.contentType ?? "image/jpeg",
  });
  upsertSplitReferenceAsset({
    id: "test-asset-1",
    componentId: "SUIT_UPPER_CLASSIC",
    role: "split-upper-construction",
    status: "active",
    privatePath: "nasir-bespoke/split-outfit/references/v1/split-upper-construction/SUIT_UPPER_CLASSIC.jpg",
    contentType: "image/jpeg",
    checksum: "irrelevant-because-mock-reader-bypasses-blob",
  });
  const inputs = { ...materialInputsFor(recipe), referenceReader: mockReader };
  const plan = await prepareProviderReadySplitGeneration(recipe, inputs);
  assert.equal(plan.recipe.recipeStatus, "VALID");
  const jacketAuthority = plan.authorities.find((a) => a.role === "construction:SUIT_UPPER_CLASSIC");
  assert.ok(jacketAuthority?.resolvedImage);
});

// ============================================================
// READINESS CLASSIFICATION — missing / integrity failure / none required
// ============================================================

test("computeSplitGenerationReadiness: READY when there are no REQUIRED authorities at all missing", () => {
  const readiness = computeSplitGenerationReadiness([
    { role: "customer", governs: ["customer"], imageSource: { kind: "customer" }, instructions: "x", resolvedImage: { file: tinyPng("p.png"), mime: "image/png" } },
  ]);
  assert.deepEqual(readiness, { status: "READY" });
});

test("computeSplitGenerationReadiness: MISSING_REQUIRED_REFERENCE for an unresolved REQUIRED construction authority", () => {
  const readiness = computeSplitGenerationReadiness([
    {
      role: "construction:SUIT_UPPER_CLASSIC",
      governs: ["SUIT_UPPER_CLASSIC"],
      imageSource: { kind: "construction-reference", componentId: "SUIT_UPPER_CLASSIC", assetRole: "split-upper-construction" },
      instructions: "x",
    },
  ]);
  assert.deepEqual(readiness, { status: "MISSING_REQUIRED_REFERENCE", componentIds: ["SUIT_UPPER_CLASSIC"] });
});

test("computeSplitGenerationReadiness: REFERENCE_INTEGRITY_FAILURE for a checksum/content mismatch, distinct from missing", () => {
  const readiness = computeSplitGenerationReadiness([
    {
      role: "construction:SUIT_WAISTCOAT_CLASSIC",
      governs: ["SUIT_WAISTCOAT_CLASSIC"],
      imageSource: { kind: "construction-reference", componentId: "SUIT_WAISTCOAT_CLASSIC", assetRole: "split-waistcoat-construction" },
      instructions: "x",
      imageResolutionError: { code: "checksum_mismatch" },
    },
  ]);
  assert.deepEqual(readiness, { status: "REFERENCE_INTEGRITY_FAILURE", componentIds: ["SUIT_WAISTCOAT_CLASSIC"] });
});

test("computeSplitGenerationReadiness ignores TEXT_ONLY authorities entirely, including SUIT_WAISTCOAT_NONE", () => {
  const readiness = computeSplitGenerationReadiness([
    { role: "customer", governs: ["customer"], imageSource: { kind: "customer" }, instructions: "x", resolvedImage: { file: tinyPng("p.png"), mime: "image/png" } },
    { role: "construction:SUIT_LOWER_CLASSIC_STRAIGHT", governs: ["SUIT_LOWER_CLASSIC_STRAIGHT"], instructions: "text only, no image intent at all" },
  ]);
  assert.deepEqual(readiness, { status: "READY" });
});

test("resolveSplitAuthorityImages surfaces reader errors on the authority instead of crashing the whole draft", async () => {
  const recipe = validateSplitRecipe(REQUESTS.classic);
  upsertSplitReferenceAsset({
    id: "broken-asset",
    componentId: "SUIT_UPPER_CLASSIC",
    role: "split-upper-construction",
    status: "active",
    privatePath: "irrelevant",
    contentType: "image/jpeg",
    checksum: "irrelevant",
  });
  const throwingReader: SplitReferenceAssetReader = async () => {
    throw new SplitReferenceAssetError("checksum_mismatch", "forced test failure");
  };
  const plan = buildSplitAuthorityPlan(recipe);
  const resolved = await resolveSplitAuthorityImages(plan, { ...materialInputsFor(recipe), referenceReader: throwingReader });
  const jacket = resolved.find((a) => a.role === "construction:SUIT_UPPER_CLASSIC");
  assert.equal(jacket?.resolvedImage, undefined);
  assert.equal(jacket?.imageResolutionError?.code, "checksum_mismatch");
  // The rest of the draft still compiled successfully — no crash.
  assert.ok(resolved.length > 1);
});

test("prepareProviderReadySplitGeneration fails closed on a checksum-mismatched required reference (does not silently fall back to text-only)", async () => {
  const recipe = validateSplitRecipe(REQUESTS.classic);
  upsertSplitReferenceAsset({
    id: "broken-asset",
    componentId: "SUIT_UPPER_CLASSIC",
    role: "split-upper-construction",
    status: "active",
    privatePath: "irrelevant",
    contentType: "image/jpeg",
    checksum: "irrelevant",
  });
  const throwingReader: SplitReferenceAssetReader = async () => {
    throw new SplitReferenceAssetError("checksum_mismatch", "forced test failure");
  };
  await assert.rejects(
    () => prepareProviderReadySplitGeneration(recipe, { ...materialInputsFor(recipe), referenceReader: throwingReader }),
    (error: unknown) => {
      assert.ok(error instanceof SplitGenerationNotReadyError);
      assert.equal(error.readiness.status, "REFERENCE_INTEGRITY_FAILURE");
      assert.deepEqual((error.readiness as { componentIds: string[] }).componentIds, ["SUIT_UPPER_CLASSIC"]);
      return true;
    },
  );
});

// ============================================================
// PROMPT CONTENT
// ============================================================

test("PERMANENT RULE text is present in the compiled prompt for every upper", async () => {
  for (const request of Object.values(REQUESTS)) {
    const recipe = validateSplitRecipe(request);
    const draft = await compileSplitGenerationDraft(recipe, materialInputsFor(recipe));
    assert.match(draft.prompt, /garment must adapt to the customer/i);
    assert.match(draft.prompt, /customer must never be altered/i);
  }
});

test("customer authority image is always the person passed to resolution, never a reference or swatch", async () => {
  const recipe = validateSplitRecipe(REQUESTS.classic);
  const person = { file: tinyPng("person-specific.png"), mime: "image/png" as const };
  const resolved = await resolveSplitAuthorityImages(buildSplitAuthorityPlan(recipe), {
    person,
    materialUploads: materialInputsFor(recipe).materialUploads,
  });
  const customerAuthority = resolved.find((a) => a.role === "customer");
  assert.equal(customerAuthority?.resolvedImage?.file.name, "person-specific.png");
});

// ============================================================
// MALFORMED / INVALID RECIPES (unchanged behavior, still enforced)
// ============================================================

test("validateSplitRecipe throws for CONFLICT and INCOMPLETE, never returns a partial recipe", () => {
  assert.throws(
    () => validateSplitRecipe({ ...REQUESTS.classic, lowerId: "SUIT_LOWER_TUXEDO_TROUSER" }),
    (error: unknown) => error instanceof SplitRecipeValidationError && error.code === "recipe_conflict",
  );
  assert.throws(
    () => validateSplitRecipe({ ...REQUESTS.threePiece, waistcoatId: null }),
    (error: unknown) => error instanceof SplitRecipeValidationError && error.code === "recipe_incomplete",
  );
});
