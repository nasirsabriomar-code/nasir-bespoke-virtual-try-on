import assert from "node:assert/strict";
import test from "node:test";
import { getSplitOutfitRecipeStatus, sanitizeSplitOutfitState } from "@/lib/split-outfit/compatibility";
import type { SplitOutfitState } from "@/lib/split-outfit/types";
import { applySignatureLook, deriveCustomizedFromLook, isRecipeIdenticalToLook } from "@/lib/showroom/look-application";
import { SIGNATURE_LOOK_LIBRARY } from "@/lib/showroom/look-library";
import type { SignatureLook, SignatureLookProvenance } from "@/lib/showroom/types";

test("applying each of the five active Suit looks produces a VALID Split recipe", () => {
  for (const look of SIGNATURE_LOOK_LIBRARY.filter((entry) => entry.status === "active")) {
    const result = applySignatureLook(look, "suit");
    assert.equal(result.applied, true, `${look.id} failed to apply`);
    if (result.applied) {
      assert.equal(getSplitOutfitRecipeStatus(result.state), "VALID");
    }
  }
});

test("applying a look never removes any of the look's required component selections through sanitization", () => {
  for (const look of SIGNATURE_LOOK_LIBRARY.filter((entry) => entry.status === "active")) {
    const result = applySignatureLook(look, "suit");
    assert.equal(result.applied, true);
    if (!result.applied) continue;
    assert.equal(result.state.upperId, look.components.upperId);
    assert.equal(result.state.lowerId, look.components.lowerId);
    assert.equal(result.state.shirtId, look.components.shirtId);
    assert.equal(result.state.waistcoatId, look.components.waistcoatId);
    assert.equal(result.state.footwearId, look.components.footwearId);
    assert.deepEqual([...result.state.accessoryIds].sort(), [...look.components.accessoryIds].sort());
  }
});

test("applying a look produces a recipe that is, at that instant, canonically identical to the look", () => {
  for (const look of SIGNATURE_LOOK_LIBRARY.filter((entry) => entry.status === "active")) {
    const result = applySignatureLook(look, "suit");
    assert.equal(result.applied, true);
    if (result.applied) {
      assert.equal(isRecipeIdenticalToLook(result.state, look), true);
    }
  }
});

test("customizing a component after applying a look flips customizedFromLook to true", () => {
  const look = SIGNATURE_LOOK_LIBRARY.find((entry) => entry.id === "LOOK_SUIT_CLASSIC_GENTLEMAN")!;
  const applied = applySignatureLook(look, "suit");
  assert.equal(applied.applied, true);
  if (!applied.applied) return;

  const provenance: SignatureLookProvenance = { type: "signature-look", lookId: look.id, lookName: look.name };
  assert.equal(deriveCustomizedFromLook(applied.state, provenance, SIGNATURE_LOOK_LIBRARY), false);

  // Customize: swap footwear (Classic allows Oxford, Derby, Loafer — Derby differs from the look's Oxford).
  const customized: SplitOutfitState = sanitizeSplitOutfitState({ ...applied.state, footwearId: "SUIT_SHOE_DERBY" });
  assert.equal(deriveCustomizedFromLook(customized, provenance, SIGNATURE_LOOK_LIBRARY), true);
});

test("restoring the exact original selections returns customizedFromLook to false", () => {
  const look = SIGNATURE_LOOK_LIBRARY.find((entry) => entry.id === "LOOK_SUIT_CLASSIC_GENTLEMAN")!;
  const applied = applySignatureLook(look, "suit");
  assert.equal(applied.applied, true);
  if (!applied.applied) return;

  const provenance: SignatureLookProvenance = { type: "signature-look", lookId: look.id, lookName: look.name };
  const customized: SplitOutfitState = sanitizeSplitOutfitState({ ...applied.state, footwearId: "SUIT_SHOE_DERBY" });
  assert.equal(deriveCustomizedFromLook(customized, provenance, SIGNATURE_LOOK_LIBRARY), true);

  const restored: SplitOutfitState = sanitizeSplitOutfitState({ ...customized, footwearId: look.components.footwearId });
  assert.equal(deriveCustomizedFromLook(restored, provenance, SIGNATURE_LOOK_LIBRARY), false);
});

test("a manual provenance never reports customizedFromLook — there is no Look to diverge from", () => {
  const look = SIGNATURE_LOOK_LIBRARY.find((entry) => entry.id === "LOOK_SUIT_STATEMENT_EVENING")!;
  const applied = applySignatureLook(look, "suit");
  assert.equal(applied.applied, true);
  if (!applied.applied) return;

  const manualProvenance: SignatureLookProvenance = { type: "manual" };
  assert.equal(deriveCustomizedFromLook(applied.state, manualProvenance, SIGNATURE_LOOK_LIBRARY), false);
});

test("customizedFromLook is derived purely from canonical identity comparison, never a stored flag that can drift", () => {
  // Accessory order must not matter — only set membership.
  const look = SIGNATURE_LOOK_LIBRARY.find((entry) => entry.id === "LOOK_SUIT_CLASSIC_GENTLEMAN")!;
  const reordered: SplitOutfitState = {
    family: look.family,
    upperId: look.components.upperId,
    lowerId: look.components.lowerId,
    shirtId: look.components.shirtId,
    waistcoatId: look.components.waistcoatId,
    footwearId: look.components.footwearId,
    accessoryIds: [...look.components.accessoryIds].reverse(),
    materials: {},
  };
  const provenance: SignatureLookProvenance = { type: "signature-look", lookId: look.id, lookName: look.name };
  assert.equal(deriveCustomizedFromLook(reordered, provenance, SIGNATURE_LOOK_LIBRARY), false);
});

test("look application is atomic: an inactive look is rejected and applies nothing", () => {
  const draftLook: SignatureLook = {
    ...SIGNATURE_LOOK_LIBRARY[0],
    id: "LOOK_TEST_INACTIVE_APPLY",
    status: "draft",
  };
  const result = applySignatureLook(draftLook, "suit");
  assert.equal(result.applied, false);
  if (!result.applied) assert.equal(result.code, "look_inactive");
});

test("look application is atomic: a wrong-family look is rejected and applies nothing", () => {
  const wrongFamilyLook: SignatureLook = {
    ...SIGNATURE_LOOK_LIBRARY[0],
    id: "LOOK_TEST_WRONG_FAMILY_APPLY",
    family: "sherwani",
  };
  const result = applySignatureLook(wrongFamilyLook, "suit");
  assert.equal(result.applied, false);
  if (!result.applied) assert.equal(result.code, "wrong_family");
});

test("look application is atomic: an invalid (unknown component) look is rejected and applies nothing", () => {
  const brokenLook: SignatureLook = {
    ...SIGNATURE_LOOK_LIBRARY[0],
    id: "LOOK_TEST_BROKEN_APPLY",
    components: { ...SIGNATURE_LOOK_LIBRARY[0].components, lowerId: "SUIT_LOWER_DOES_NOT_EXIST" },
  };
  const result = applySignatureLook(brokenLook, "suit");
  assert.equal(result.applied, false);
  if (!result.applied) assert.equal(result.code, "invalid_look");
});

test("look application is atomic: an incompatible (CONFLICT) look is rejected and applies nothing", () => {
  const conflictLook: SignatureLook = {
    ...SIGNATURE_LOOK_LIBRARY[0],
    id: "LOOK_TEST_CONFLICT_APPLY",
    components: {
      upperId: "SUIT_UPPER_TUXEDO",
      lowerId: "SUIT_LOWER_CLASSIC_STRAIGHT",
      shirtId: "SUIT_SHIRT_TUXEDO_PLEATED",
      waistcoatId: "SUIT_WAISTCOAT_TUXEDO",
      footwearId: "SUIT_SHOE_PATENT_OXFORD",
      accessoryIds: [],
    },
  };
  const result = applySignatureLook(conflictLook, "suit");
  assert.equal(result.applied, false);
  if (!result.applied) assert.equal(result.code, "invalid_look");
});
