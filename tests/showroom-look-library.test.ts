import assert from "node:assert/strict";
import test from "node:test";
import { findSplitOption } from "@/lib/split-outfit/compatibility";
import { SIGNATURE_LOOK_LIBRARY } from "@/lib/showroom/look-library";
import { getActiveValidatedSignatureLooks, validateSignatureLook } from "@/lib/showroom/look-validation";
import type { SignatureLook } from "@/lib/showroom/types";

const FORBIDDEN_KEYS = new Set([
  "blobPath",
  "privatePath",
  "prompt",
  "model",
  "provider",
  "checksum",
  "referenceUrl",
  "assetId",
  "openaiApiKey",
  "apiKey",
  "customerName",
  "customerEmail",
  "customerPhone",
]);

function collectKeysRecursively(value: unknown, keys: Set<string>) {
  if (Array.isArray(value)) {
    for (const entry of value) collectKeysRecursively(entry, keys);
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      keys.add(key);
      collectKeysRecursively(nested, keys);
    }
  }
}

test("every Signature Look ID is unique", () => {
  const ids = SIGNATURE_LOOK_LIBRARY.map((look) => look.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("every Signature Look declares a known family", () => {
  for (const look of SIGNATURE_LOOK_LIBRARY) {
    assert.equal(look.family, "suit", `${look.id} must be a Suit-family look in this milestone`);
  }
});

test("the library seeds exactly five active Suit looks, one per implemented upper identity", () => {
  const active = SIGNATURE_LOOK_LIBRARY.filter((look) => look.status === "active");
  assert.equal(active.length, 5);
  const upperIds = active.map((look) => look.components.upperId);
  assert.deepEqual(
    [...upperIds].sort(),
    [
      "SUIT_UPPER_CLASSIC",
      "SUIT_UPPER_DOUBLE_BREASTED",
      "SUIT_UPPER_STATEMENT",
      "SUIT_UPPER_THREE_PIECE",
      "SUIT_UPPER_TUXEDO",
    ].sort(),
  );
});

test("every active Suit look references only real, existing catalogue component IDs", () => {
  for (const look of SIGNATURE_LOOK_LIBRARY.filter((entry) => entry.status === "active")) {
    const { upperId, lowerId, shirtId, waistcoatId, footwearId, accessoryIds } = look.components;
    assert.ok(findSplitOption(look.family, upperId), `${look.id}: unknown upperId ${upperId}`);
    assert.ok(findSplitOption(look.family, lowerId), `${look.id}: unknown lowerId ${lowerId}`);
    assert.ok(findSplitOption(look.family, shirtId), `${look.id}: unknown shirtId ${shirtId}`);
    assert.ok(findSplitOption(look.family, waistcoatId), `${look.id}: unknown waistcoatId ${waistcoatId}`);
    assert.ok(findSplitOption(look.family, footwearId), `${look.id}: unknown footwearId ${footwearId}`);
    for (const accessoryId of accessoryIds) {
      assert.ok(findSplitOption(look.family, accessoryId), `${look.id}: unknown accessoryId ${accessoryId}`);
    }
  }
});

test("every active Suit look independently validates against the real compatibility engine", () => {
  for (const look of SIGNATURE_LOOK_LIBRARY.filter((entry) => entry.status === "active")) {
    const result = validateSignatureLook(look);
    assert.equal(result.valid, true, `${look.id} failed validation: ${result.valid ? "" : result.reason}`);
  }
});

test("no active Suit look contains a duplicate accessory ID", () => {
  for (const look of SIGNATURE_LOOK_LIBRARY.filter((entry) => entry.status === "active")) {
    const ids = look.components.accessoryIds;
    assert.equal(new Set(ids).size, ids.length, `${look.id} has duplicate accessory IDs`);
  }
});

test("no Signature Look (recursively) carries a private path, prompt, model, provider, checksum, or customer field", () => {
  const keys = new Set<string>();
  collectKeysRecursively(SIGNATURE_LOOK_LIBRARY, keys);
  for (const forbidden of FORBIDDEN_KEYS) {
    assert.ok(!keys.has(forbidden), `Signature Look library unexpectedly contains a "${forbidden}" field`);
  }
});

test("a malformed/incompatible look fails validation (fails closed) and is excluded from the active set even when marked active", () => {
  const brokenLook: SignatureLook = {
    id: "LOOK_TEST_BROKEN_UNKNOWN_COMPONENT",
    name: "Broken Test Look",
    shortDescription: "test fixture",
    family: "suit",
    status: "active",
    occasions: ["business"],
    stylePersonality: "classic",
    formality: 3,
    components: {
      upperId: "SUIT_UPPER_CLASSIC",
      lowerId: "SUIT_LOWER_DOES_NOT_EXIST",
      shirtId: "SUIT_SHIRT_CLASSIC_FORMAL",
      waistcoatId: "SUIT_WAISTCOAT_NONE",
      footwearId: "SUIT_SHOE_OXFORD",
      accessoryIds: [],
    },
    rankPriority: 99,
  };

  const validation = validateSignatureLook(brokenLook);
  assert.equal(validation.valid, false);
  assert.equal(validation.valid ? undefined : validation.code, "unknown_component");

  const active = getActiveValidatedSignatureLooks([...SIGNATURE_LOOK_LIBRARY, brokenLook]);
  assert.ok(!active.some((look) => look.id === brokenLook.id), "a broken look must never surface as active/validated");
});

test("an incompatible (CONFLICT) look fails validation", () => {
  const conflictLook: SignatureLook = {
    id: "LOOK_TEST_CONFLICT",
    name: "Conflict Test Look",
    shortDescription: "test fixture",
    family: "suit",
    status: "active",
    occasions: ["black-tie"],
    stylePersonality: "black-tie",
    formality: 5,
    components: {
      // Tuxedo only allows the tuxedo trouser/shirt — pairing it with the
      // classic trouser must be rejected as CONFLICT, never silently accepted.
      upperId: "SUIT_UPPER_TUXEDO",
      lowerId: "SUIT_LOWER_CLASSIC_STRAIGHT",
      shirtId: "SUIT_SHIRT_TUXEDO_PLEATED",
      waistcoatId: "SUIT_WAISTCOAT_TUXEDO",
      footwearId: "SUIT_SHOE_PATENT_OXFORD",
      accessoryIds: [],
    },
    rankPriority: 99,
  };

  const validation = validateSignatureLook(conflictLook);
  assert.equal(validation.valid, false);
  assert.equal(validation.valid ? undefined : validation.code, "recipe_conflict");
});

test("a look that selects a required-waistcoat upper without a real waistcoat fails validation", () => {
  const incompleteLook: SignatureLook = {
    id: "LOOK_TEST_MISSING_REQUIRED_WAISTCOAT",
    name: "Missing Required Waistcoat Test Look",
    shortDescription: "test fixture",
    family: "suit",
    status: "active",
    occasions: ["wedding"],
    stylePersonality: "classic",
    formality: 4,
    components: {
      // Three-Piece REQUIRES a real waistcoat — the explicit "None" sentinel
      // is not in its allowed set, so this must be rejected. (A Look always
      // declares a real component ID for every slot, so the genuinely
      // "missing selection" INCOMPLETE status is structurally unreachable
      // from a Look — this is the CONFLICT path instead.)
      upperId: "SUIT_UPPER_THREE_PIECE",
      lowerId: "SUIT_LOWER_CLASSIC_STRAIGHT",
      shirtId: "SUIT_SHIRT_CLASSIC_FORMAL",
      waistcoatId: "SUIT_WAISTCOAT_NONE",
      footwearId: "SUIT_SHOE_OXFORD",
      accessoryIds: [],
    },
    rankPriority: 99,
  };

  const validation = validateSignatureLook(incompleteLook);
  assert.equal(validation.valid, false);
  assert.equal(validation.valid ? undefined : validation.code, "recipe_conflict");
});

test("a duplicate-accessory look fails validation", () => {
  const duplicateLook: SignatureLook = {
    id: "LOOK_TEST_DUPLICATE_ACCESSORY",
    name: "Duplicate Accessory Test Look",
    shortDescription: "test fixture",
    family: "suit",
    status: "active",
    occasions: ["business"],
    stylePersonality: "classic",
    formality: 3,
    components: {
      upperId: "SUIT_UPPER_CLASSIC",
      lowerId: "SUIT_LOWER_CLASSIC_STRAIGHT",
      shirtId: "SUIT_SHIRT_CLASSIC_FORMAL",
      waistcoatId: "SUIT_WAISTCOAT_NONE",
      footwearId: "SUIT_SHOE_OXFORD",
      accessoryIds: ["SUIT_ACC_TIE", "SUIT_ACC_TIE"],
    },
    rankPriority: 99,
  };

  const validation = validateSignatureLook(duplicateLook);
  assert.equal(validation.valid, false);
  assert.equal(validation.valid ? undefined : validation.code, "duplicate_accessory");
});

test("an inactive (draft) look is excluded from the active/validated set", () => {
  const draftLook: SignatureLook = {
    ...SIGNATURE_LOOK_LIBRARY[0],
    id: "LOOK_TEST_DRAFT",
    status: "draft",
  };

  const active = getActiveValidatedSignatureLooks([...SIGNATURE_LOOK_LIBRARY, draftLook]);
  assert.ok(!active.some((look) => look.id === draftLook.id), "a draft look must never be treated as active");
});
