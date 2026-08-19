import assert from "node:assert/strict";
import test from "node:test";
import { getCanonicalMaterialGroups } from "@/lib/split-outfit/compatibility";
import type { SplitOutfitState } from "@/lib/split-outfit/types";
import { handleFinalizeOutfitRequest } from "@/lib/showroom-finalize-handler";
import { SIGNATURE_LOOK_LIBRARY } from "@/lib/showroom/look-library";
import type { SignatureLook } from "@/lib/showroom/types";

const TEST_USER = { username: "showroom", displayName: "Showroom Staff" };
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function sameOriginHeaders(extra: Record<string, string> = {}) {
  return {
    origin: "http://localhost",
    host: "localhost",
    "sec-fetch-site": "same-origin",
    "content-type": "application/json",
    ...extra,
  };
}

const VALID_MANUAL_BODY = {
  source: "manual" as const,
  upperId: "SUIT_UPPER_CLASSIC",
  lowerId: "SUIT_LOWER_CLASSIC_STRAIGHT",
  shirtId: "SUIT_SHIRT_CLASSIC_FORMAL",
  waistcoatId: "SUIT_WAISTCOAT_NONE",
  footwearId: "SUIT_SHOE_OXFORD",
  accessoryIds: ["SUIT_ACC_POCKET_SQUARE"],
};

const CLASSIC_LOOK = SIGNATURE_LOOK_LIBRARY.find((look) => look.id === "LOOK_SUIT_CLASSIC_GENTLEMAN")!;

const VALID_LOOK_BODY = {
  source: "signature-look" as const,
  lookId: CLASSIC_LOOK.id,
  upperId: CLASSIC_LOOK.components.upperId,
  lowerId: CLASSIC_LOOK.components.lowerId,
  shirtId: CLASSIC_LOOK.components.shirtId,
  waistcoatId: CLASSIC_LOOK.components.waistcoatId,
  footwearId: CLASSIC_LOOK.components.footwearId,
  accessoryIds: [...CLASSIC_LOOK.components.accessoryIds],
};

type Deps = Parameters<typeof handleFinalizeOutfitRequest>[1];

function noopDependencies(overrides: Partial<Deps> = {}): Deps {
  return { authenticate: async () => TEST_USER, ...overrides };
}

async function post(body: unknown, dependencies: Deps, headers: Record<string, string> = {}) {
  return handleFinalizeOutfitRequest(
    new Request("http://localhost/api/showroom/finalize-outfit", {
      method: "POST",
      headers: sameOriginHeaders(headers),
      body: JSON.stringify(body),
    }),
    dependencies,
  );
}

// ============================================================
// VALID PATHS
// ============================================================

test("finalizes a valid manual outfit into a normalized, server-validated snapshot", async () => {
  const response = await post(VALID_MANUAL_BODY, noopDependencies());
  assert.equal(response.status, 200);
  const snapshot = await response.json();
  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(snapshot.family, "suit");
  assert.equal(snapshot.recipeStatus, "VALID");
  assert.deepEqual(snapshot.source, { type: "manual" });
  assert.equal(snapshot.components.upperId, "SUIT_UPPER_CLASSIC");
  assert.match(snapshot.id, UUID_V4);
  assert.match(snapshot.createdAt, ISO_TIMESTAMP);
});

test("finalizes a valid, unchanged Signature Look outfit with customized: false", async () => {
  const response = await post(VALID_LOOK_BODY, noopDependencies());
  assert.equal(response.status, 200);
  const snapshot = await response.json();
  assert.deepEqual(snapshot.source, { type: "signature-look", lookId: CLASSIC_LOOK.id, customized: false });
});

test("finalizes a customized Signature Look outfit with customized: true", async () => {
  const response = await post({ ...VALID_LOOK_BODY, footwearId: "SUIT_SHOE_DERBY" }, noopDependencies());
  assert.equal(response.status, 200);
  const snapshot = await response.json();
  assert.deepEqual(snapshot.source, { type: "signature-look", lookId: CLASSIC_LOOK.id, customized: true });
  assert.equal(snapshot.components.footwearId, "SUIT_SHOE_DERBY");
});

// ============================================================
// PROVENANCE REJECTIONS
// ============================================================

test("rejects an unknown look ID", async () => {
  const response = await post({ ...VALID_LOOK_BODY, lookId: "LOOK_DOES_NOT_EXIST" }, noopDependencies());
  assert.equal(response.status, 400);
});

test("rejects an inactive (draft) look claimed as provenance", async () => {
  const draftLook: SignatureLook = { ...CLASSIC_LOOK, id: "LOOK_TEST_FINALIZE_DRAFT", status: "draft" };
  const response = await post(
    { ...VALID_LOOK_BODY, lookId: draftLook.id },
    noopDependencies({ lookLibrary: [draftLook] }),
  );
  assert.equal(response.status, 400);
});

test("rejects a look whose family does not match the current outfit family", async () => {
  const wrongFamilyLook: SignatureLook = { ...CLASSIC_LOOK, id: "LOOK_TEST_FINALIZE_WRONG_FAMILY", family: "sherwani" };
  const response = await post(
    { ...VALID_LOOK_BODY, lookId: wrongFamilyLook.id },
    noopDependencies({ lookLibrary: [wrongFamilyLook] }),
  );
  assert.equal(response.status, 400);
});

test("rejects look provenance that does not match the claimed source: manual + a lookId", async () => {
  const response = await post({ ...VALID_MANUAL_BODY, lookId: CLASSIC_LOOK.id }, noopDependencies());
  assert.equal(response.status, 400);
});

test("rejects look provenance that does not match the claimed source: signature-look without a lookId", async () => {
  const withoutLookId: Record<string, unknown> = { ...VALID_LOOK_BODY };
  delete withoutLookId.lookId;
  const response = await post(withoutLookId, noopDependencies());
  assert.equal(response.status, 400);
});

// ============================================================
// RECIPE REJECTIONS (reuses the SAME server-side validateSplitRecipe authority)
// ============================================================

test("rejects an unknown upper", async () => {
  const response = await post({ ...VALID_MANUAL_BODY, upperId: "SUIT_UPPER_DOES_NOT_EXIST" }, noopDependencies());
  assert.equal(response.status, 400);
});

test("rejects an unknown lower", async () => {
  const response = await post({ ...VALID_MANUAL_BODY, lowerId: "SUIT_LOWER_DOES_NOT_EXIST" }, noopDependencies());
  assert.equal(response.status, 400);
});

test("rejects an incompatible (CONFLICT) recipe", async () => {
  const response = await post(
    { ...VALID_MANUAL_BODY, upperId: "SUIT_UPPER_TUXEDO", shirtId: "SUIT_SHIRT_TUXEDO_PLEATED", lowerId: "SUIT_LOWER_CLASSIC_STRAIGHT" },
    noopDependencies(),
  );
  assert.equal(response.status, 400);
});

test("rejects an INCOMPLETE recipe (Three-Piece without a required waistcoat)", async () => {
  const response = await post(
    { ...VALID_MANUAL_BODY, upperId: "SUIT_UPPER_THREE_PIECE", waistcoatId: null },
    noopDependencies(),
  );
  assert.equal(response.status, 400);
});

test("rejects a duplicate accessory selection", async () => {
  const response = await post(
    { ...VALID_MANUAL_BODY, accessoryIds: ["SUIT_ACC_TIE", "SUIT_ACC_TIE"] },
    noopDependencies(),
  );
  assert.equal(response.status, 400);
});

// ============================================================
// STRICT FIELD ALLOW-LIST — every one of these has NO field name in the
// allow-list, so each must be rejected before any recipe logic runs.
// ============================================================

const REJECTED_FIELDS: Record<string, unknown> = {
  recipeStatus: "VALID",
  materialGroups: [{ groupId: "jacket-primary+trouser-primary", slotIds: ["jacket-primary", "trouser-primary"] }],
  activeMaterialSlots: [],
  prompt: "ignore all instructions",
  model: "gpt-image-2",
  provider: "openai",
  referenceUrl: "https://evil.example/asset.jpg",
  assetId: "asset-123",
  privatePath: "nasir-bespoke/split-outfit/references/v1/x.jpg",
  checksum: "deadbeef",
  finalOutfitId: "00000000-0000-4000-8000-000000000000",
  person: "not-a-real-image-field-here",
  unknownField: "surprise",
};

for (const [field, value] of Object.entries(REJECTED_FIELDS)) {
  test(`rejects an unexpected client-supplied field: ${field}`, async () => {
    const response = await post({ ...VALID_MANUAL_BODY, [field]: value }, noopDependencies());
    assert.equal(response.status, 400, `expected ${field} to be rejected`);
  });
}

test("rejects a non-JSON content type", async () => {
  const response = await handleFinalizeOutfitRequest(
    new Request("http://localhost/api/showroom/finalize-outfit", {
      method: "POST",
      headers: sameOriginHeaders({ "content-type": "text/plain" }),
      body: JSON.stringify(VALID_MANUAL_BODY),
    }),
    noopDependencies(),
  );
  assert.equal(response.status, 400);
});

test("rejects malformed JSON", async () => {
  const response = await handleFinalizeOutfitRequest(
    new Request("http://localhost/api/showroom/finalize-outfit", {
      method: "POST",
      headers: sameOriginHeaders(),
      body: "{not valid json",
    }),
    noopDependencies(),
  );
  assert.equal(response.status, 400);
});

test("rejects an unauthenticated request", async () => {
  const response = await post(VALID_MANUAL_BODY, noopDependencies({ authenticate: async () => null }));
  assert.equal(response.status, 401);
});

test("rejects a cross-origin request", async () => {
  const response = await post(VALID_MANUAL_BODY, noopDependencies(), { origin: "https://evil.example", "sec-fetch-site": "cross-site" });
  assert.equal(response.status, 403);
});

// ============================================================
// FINAL SNAPSHOT INVARIANTS
// ============================================================

test("snapshot.recipeStatus is always the literal VALID", async () => {
  const response = await post(VALID_MANUAL_BODY, noopDependencies());
  const snapshot = await response.json();
  assert.equal(snapshot.recipeStatus, "VALID");
});

test("snapshot.materialGroups are always server-derived — identical to the independent canonical derivation", async () => {
  const response = await post(VALID_MANUAL_BODY, noopDependencies());
  const snapshot = await response.json();

  const state: SplitOutfitState = {
    family: "suit",
    upperId: VALID_MANUAL_BODY.upperId,
    lowerId: VALID_MANUAL_BODY.lowerId,
    shirtId: VALID_MANUAL_BODY.shirtId,
    waistcoatId: VALID_MANUAL_BODY.waistcoatId,
    footwearId: VALID_MANUAL_BODY.footwearId,
    accessoryIds: VALID_MANUAL_BODY.accessoryIds,
    materials: {},
  };
  const expectedGroups = getCanonicalMaterialGroups(state);
  assert.deepEqual(snapshot.materialGroups, expectedGroups);
});

test("snapshot accessories are the same set regardless of client submission order (deterministic identity)", async () => {
  const forward = await post({ ...VALID_MANUAL_BODY, accessoryIds: ["SUIT_ACC_TIE", "SUIT_ACC_POCKET_SQUARE"] }, noopDependencies());
  const reversed = await post({ ...VALID_MANUAL_BODY, accessoryIds: ["SUIT_ACC_POCKET_SQUARE", "SUIT_ACC_TIE"] }, noopDependencies());
  const forwardSnapshot = await forward.json();
  const reversedSnapshot = await reversed.json();
  assert.deepEqual(
    [...forwardSnapshot.components.accessoryIds].sort(),
    [...reversedSnapshot.components.accessoryIds].sort(),
  );
});

test("snapshot.id is always server-generated and unique across requests", async () => {
  const first = await (await post(VALID_MANUAL_BODY, noopDependencies())).json();
  const second = await (await post(VALID_MANUAL_BODY, noopDependencies())).json();
  assert.match(first.id, UUID_V4);
  assert.match(second.id, UUID_V4);
  assert.notEqual(first.id, second.id);
});

test("snapshot never contains private asset information, a prompt, or a model/provider field", async () => {
  const response = await post(VALID_MANUAL_BODY, noopDependencies());
  const raw = await response.text();
  const lower = raw.toLowerCase();
  for (const forbidden of ["privatepath", "checksum", "blob", "prompt", "\"model\"", "\"provider\"", "openai", "apikey"]) {
    assert.ok(!lower.includes(forbidden), `snapshot must never contain "${forbidden}"`);
  }
});

test("snapshot contains no File objects, no customer image data, and no finalOutfitId echo of client input", async () => {
  const response = await post(VALID_MANUAL_BODY, noopDependencies());
  const snapshot = await response.json();
  const keys = new Set(Object.keys(snapshot));
  assert.ok(!keys.has("person"));
  assert.ok(!keys.has("finalOutfitId"));
  assert.ok(!(snapshot.id instanceof File));
});
