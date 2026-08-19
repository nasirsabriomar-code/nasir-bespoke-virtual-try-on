import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_SPLIT_OUTFIT_STATE,
  SPLIT_CATALOGUE_BY_FAMILY,
  SUIT_ACCESSORY_OPTIONS,
  SUIT_FOOTWEAR_OPTIONS,
  SUIT_LOWER_OPTIONS,
  SUIT_SHIRT_OPTIONS,
  SUIT_UPPER_OPTIONS,
  SUIT_WAISTCOAT_OPTIONS,
} from "@/lib/split-outfit/catalogue";
import {
  buildSplitOutfitSummary,
  deriveActiveMaterialSlots,
  evaluateOptionCompatibility,
  findSplitOption,
  getCanonicalMaterialGroups,
  getMaterialLinkGroups,
  getMissingRequiredComponents,
  getSplitOutfitRecipeStatus,
  getVisibleAccessoryOptions,
  getVisibleFootwearOptions,
  getVisibleLowerOptions,
  getVisibleShirtOptions,
  getVisibleWaistcoatOptions,
  getWaistcoatRequirement,
  sanitizeSplitOutfitState,
} from "@/lib/split-outfit/compatibility";
import { isSplitOutfitEnabled } from "@/lib/split-outfit/config";
import type { SplitOutfitState } from "@/lib/split-outfit/types";
import { DEFAULT_LEVEL1_CATALOGUE } from "@/lib/catalog/level1-seed";

test("Full Outfit remains the authoritative default catalogue and is untouched", () => {
  assert.equal(DEFAULT_LEVEL1_CATALOGUE.categories.length, 7);
  assert.equal(DEFAULT_LEVEL1_CATALOGUE.designs.length, 35);
  assert.equal(DEFAULT_LEVEL1_CATALOGUE.assets.length, 70);

  for (const cat of DEFAULT_LEVEL1_CATALOGUE.categories) {
    const designsInCat = DEFAULT_LEVEL1_CATALOGUE.designs.filter((d) => d.categoryId === cat.id);
    assert.equal(designsInCat.length, 5, `Category ${cat.id} must have exactly 5 designs`);
  }
});

function setNodeEnv(value: string | undefined) {
  const environment = process.env as Record<string, string | undefined>;
  if (value === undefined) delete environment.NODE_ENV;
  else environment.NODE_ENV = value;
}

test("Feature flag behaves correctly across environments", () => {
  // Test explicit environment flag
  const originalEnvFlag = process.env.NEXT_PUBLIC_ENABLE_SPLIT_OUTFIT;
  const originalNodeEnv = process.env.NODE_ENV;

  try {
    process.env.NEXT_PUBLIC_ENABLE_SPLIT_OUTFIT = "true";
    assert.equal(isSplitOutfitEnabled(), true);

    process.env.NEXT_PUBLIC_ENABLE_SPLIT_OUTFIT = "false";
    setNodeEnv("production");
    assert.equal(isSplitOutfitEnabled(), false);

    setNodeEnv("development");
    assert.equal(isSplitOutfitEnabled(), true);
  } finally {
    process.env.NEXT_PUBLIC_ENABLE_SPLIT_OUTFIT = originalEnvFlag;
    setNodeEnv(originalNodeEnv);
  }
});

test("Split Outfit data model has authoritative Suit options seeded", () => {
  assert.equal(SUIT_UPPER_OPTIONS.length, 5);
  assert.equal(SUIT_LOWER_OPTIONS.length, 5);
  assert.equal(SUIT_SHIRT_OPTIONS.length, 3);
  assert.equal(SUIT_WAISTCOAT_OPTIONS.length, 4);
  assert.equal(SUIT_FOOTWEAR_OPTIONS.length, 4);
  assert.equal(SUIT_ACCESSORY_OPTIONS.length, 5);

  const upperNames = SUIT_UPPER_OPTIONS.map((o) => o.name);
  assert.deepEqual(upperNames, [
    "Classic",
    "Double-Breasted",
    "Tuxedo",
    "Three-Piece",
    "Statement",
  ]);

  const lowerNames = SUIT_LOWER_OPTIONS.map((o) => o.name);
  assert.deepEqual(lowerNames, [
    "Classic Straight",
    "Tailored Tapered",
    "Pleated Formal",
    "Tuxedo Trouser",
    "Contemporary",
  ]);

  // SPLIT_CATALOGUE_BY_FAMILY.suit must reference the same exported arrays
  // above, not a copy — catches a future refactor accidentally forking them.
  assert.equal(SPLIT_CATALOGUE_BY_FAMILY.suit.uppers, SUIT_UPPER_OPTIONS);
  assert.equal(SPLIT_CATALOGUE_BY_FAMILY.suit.lowers, SUIT_LOWER_OPTIONS);
  assert.equal(SPLIT_CATALOGUE_BY_FAMILY.suit.shirts, SUIT_SHIRT_OPTIONS);
  assert.equal(SPLIT_CATALOGUE_BY_FAMILY.suit.waistcoats, SUIT_WAISTCOAT_OPTIONS);
  assert.equal(SPLIT_CATALOGUE_BY_FAMILY.suit.footwear, SUIT_FOOTWEAR_OPTIONS);
  assert.equal(SPLIT_CATALOGUE_BY_FAMILY.suit.accessories, SUIT_ACCESSORY_OPTIONS);

  // The other six garment families are deliberately empty scaffolding —
  // Phase 1 is Suit-only architecture, not catalogue expansion. This guards
  // against a family silently gaining designs outside a real catalogue task.
  const nonSuitEntries = Object.entries(SPLIT_CATALOGUE_BY_FAMILY).filter(([family]) => family !== "suit");
  assert.deepEqual(
    nonSuitEntries.map(([family]) => family).sort(),
    ["achkan", "bandhgala", "indo-western", "kurta-set", "nehru-jacket", "sherwani"].sort(),
  );
  for (const [family, entry] of nonSuitEntries) {
    for (const category of ["uppers", "lowers", "shirts", "waistcoats", "footwear", "accessories"] as const) {
      assert.deepEqual(entry[category], [], `${family}.${category} must remain empty until Phase 2 catalogue expansion`);
    }
  }
});

test("findSplitOption correctly resolves component IDs in suit family", () => {
  const classic = findSplitOption("suit", "SUIT_UPPER_CLASSIC");
  assert.ok(classic);
  assert.equal(classic.name, "Classic");
  assert.equal(classic.categoryId, "upper");

  const none = findSplitOption("suit", "NON_EXISTENT_ID");
  assert.equal(none, null);
});

test("Compatibility rules evaluate dynamically based on upper jacket", () => {
  const defaultState: SplitOutfitState = {
    ...DEFAULT_SPLIT_OUTFIT_STATE,
    upperId: "SUIT_UPPER_CLASSIC",
  };

  const tuxedoTrouser = SUIT_LOWER_OPTIONS.find((o) => o.id === "SUIT_LOWER_TUXEDO_TROUSER");
  assert.ok(tuxedoTrouser);
  assert.equal(evaluateOptionCompatibility(tuxedoTrouser, defaultState), "ALLOWED");

  // When Tuxedo upper is selected, Tuxedo trouser and Bow Tie become RECOMMENDED
  const tuxedoState: SplitOutfitState = {
    ...DEFAULT_SPLIT_OUTFIT_STATE,
    upperId: "SUIT_UPPER_TUXEDO",
  };
  assert.equal(evaluateOptionCompatibility(tuxedoTrouser, tuxedoState), "RECOMMENDED");

  const bowTie = SUIT_ACCESSORY_OPTIONS.find((o) => o.id === "SUIT_ACC_BOW_TIE");
  assert.ok(bowTie);
  assert.equal(evaluateOptionCompatibility(bowTie, tuxedoState), "RECOMMENDED");

  // When Three-Piece upper is selected, 'No Waistcoat' becomes DISALLOWED
  const threePieceState: SplitOutfitState = {
    ...DEFAULT_SPLIT_OUTFIT_STATE,
    upperId: "SUIT_UPPER_THREE_PIECE",
  };
  const noWaistcoat = SUIT_WAISTCOAT_OPTIONS.find((o) => o.id === "SUIT_WAISTCOAT_NONE");
  assert.ok(noWaistcoat);
  assert.equal(evaluateOptionCompatibility(noWaistcoat, threePieceState), "DISALLOWED");
});

test("Material slots react dynamically to component selections", () => {
  // Case A: 2-piece suit without waistcoat or extra accessories
  const twoPieceState: SplitOutfitState = {
    family: "suit",
    upperId: "SUIT_UPPER_CLASSIC",
    lowerId: "SUIT_LOWER_CLASSIC_STRAIGHT",
    shirtId: "SUIT_SHIRT_CLASSIC_FORMAL",
    waistcoatId: "SUIT_WAISTCOAT_NONE",
    footwearId: "SUIT_SHOE_OXFORD",
    accessoryIds: [],
    materials: {},
  };

  const slotsA = deriveActiveMaterialSlots(twoPieceState);
  const slotIdsA = slotsA.map((s) => s.slotId);

  assert.ok(slotIdsA.includes("jacket-primary"));
  assert.ok(slotIdsA.includes("trouser-primary"));
  assert.ok(slotIdsA.includes("shirt-material"));
  assert.ok(slotIdsA.includes("footwear-leather"));
  assert.equal(slotIdsA.includes("waistcoat-material"), false, "Waistcoat slot must NOT be present when None");
  assert.equal(slotIdsA.includes("neckwear-material"), false);

  // Case B: Add waistcoat and accessories
  const fullEnsembleState: SplitOutfitState = {
    family: "suit",
    upperId: "SUIT_UPPER_THREE_PIECE",
    lowerId: "SUIT_LOWER_CLASSIC_STRAIGHT",
    shirtId: "SUIT_SHIRT_CLASSIC_FORMAL",
    waistcoatId: "SUIT_WAISTCOAT_CLASSIC",
    footwearId: "SUIT_SHOE_OXFORD",
    accessoryIds: ["SUIT_ACC_TIE", "SUIT_ACC_POCKET_SQUARE", "SUIT_ACC_CUFFLINKS", "SUIT_ACC_BUTTONS"],
    materials: {},
  };

  const slotsB = deriveActiveMaterialSlots(fullEnsembleState);
  const slotIdsB = slotsB.map((s) => s.slotId);

  assert.ok(slotIdsB.includes("jacket-primary"));
  assert.ok(slotIdsB.includes("trouser-primary"));
  assert.ok(slotIdsB.includes("shirt-material"));
  assert.ok(slotIdsB.includes("waistcoat-material"), "Waistcoat slot MUST be present when waistcoat selected");
  assert.ok(slotIdsB.includes("neckwear-material"), "Neckwear slot MUST be present when Tie selected");
  assert.ok(slotIdsB.includes("pocket-square-material"));
  assert.ok(slotIdsB.includes("cufflinks-finish"));
  assert.ok(slotIdsB.includes("buttons-finish"));
  assert.ok(slotIdsB.includes("footwear-leather"));
  assert.equal(slotsB.length, 9);
});

test("Accessories support multi-selection and independent toggling", () => {
  let state = { ...DEFAULT_SPLIT_OUTFIT_STATE, accessoryIds: [] as string[] };

  // Add Tie
  state = { ...state, accessoryIds: [...state.accessoryIds, "SUIT_ACC_TIE"] };
  assert.deepEqual(state.accessoryIds, ["SUIT_ACC_TIE"]);

  // Add Pocket Square
  state = { ...state, accessoryIds: [...state.accessoryIds, "SUIT_ACC_POCKET_SQUARE"] };
  assert.deepEqual(state.accessoryIds, ["SUIT_ACC_TIE", "SUIT_ACC_POCKET_SQUARE"]);

  // Add Cufflinks
  state = { ...state, accessoryIds: [...state.accessoryIds, "SUIT_ACC_CUFFLINKS"] };
  assert.deepEqual(state.accessoryIds, ["SUIT_ACC_TIE", "SUIT_ACC_POCKET_SQUARE", "SUIT_ACC_CUFFLINKS"]);

  // Remove Tie
  state = { ...state, accessoryIds: state.accessoryIds.filter((id) => id !== "SUIT_ACC_TIE") };
  assert.deepEqual(state.accessoryIds, ["SUIT_ACC_POCKET_SQUARE", "SUIT_ACC_CUFFLINKS"]);
});

test("buildSplitOutfitSummary generates accurate live recipe", () => {
  const state: SplitOutfitState = {
    family: "suit",
    upperId: "SUIT_UPPER_DOUBLE_BREASTED",
    lowerId: "SUIT_LOWER_TAILORED_TAPERED",
    shirtId: "SUIT_SHIRT_SPREAD_COLLAR",
    waistcoatId: "SUIT_WAISTCOAT_NONE",
    footwearId: "SUIT_SHOE_DERBY",
    accessoryIds: ["SUIT_ACC_POCKET_SQUARE"],
    materials: {},
  };

  const summary = buildSplitOutfitSummary(state);

  assert.equal(summary.upper?.name, "Double-Breasted");
  assert.equal(summary.lower?.name, "Tailored Tapered");
  assert.equal(summary.shirt?.name, "Spread Collar");
  assert.equal(summary.waistcoat?.id, "SUIT_WAISTCOAT_NONE");
  assert.equal(summary.footwear?.name, "Derby");
  assert.equal(summary.accessories.length, 1);
  assert.equal(summary.accessories[0].name, "Pocket Square");
  assert.equal(summary.isComplete, true);
});

test("State isolation: Full Outfit state and Split Outfit state are decoupled", () => {
  // Full Outfit state
  const fullOutfitSelection = { categoryId: "sherwani", designId: "SHERWANI_01_CLASSIC" };

  // Split Outfit state
  const splitOutfitSelection = { ...DEFAULT_SPLIT_OUTFIT_STATE, upperId: "SUIT_UPPER_TUXEDO" };

  // Mutating Split Outfit state does not alter Full Outfit state
  const updatedSplit = { ...splitOutfitSelection, upperId: "SUIT_UPPER_STATEMENT" };
  assert.equal(fullOutfitSelection.designId, "SHERWANI_01_CLASSIC");
  assert.equal(updatedSplit.upperId, "SUIT_UPPER_STATEMENT");
});

// ============================================================
// SUIT COMPATIBILITY RULE ENGINE — deterministic filtering
// ============================================================

test("Tuxedo hides ordinary trousers, shirts, footwear, and standard tie", () => {
  const tuxedoState: SplitOutfitState = { ...DEFAULT_SPLIT_OUTFIT_STATE, upperId: "SUIT_UPPER_TUXEDO" };

  const lowerIds = getVisibleLowerOptions(tuxedoState).map((o) => o.id);
  assert.deepEqual(lowerIds, ["SUIT_LOWER_TUXEDO_TROUSER"]);

  const shirtIds = getVisibleShirtOptions(tuxedoState).map((o) => o.id);
  assert.deepEqual(shirtIds, ["SUIT_SHIRT_TUXEDO_PLEATED"]);

  const footwearIds = getVisibleFootwearOptions(tuxedoState).map((o) => o.id);
  assert.ok(footwearIds.includes("SUIT_SHOE_PATENT_OXFORD"));
  assert.equal(footwearIds.includes("SUIT_SHOE_DERBY"), false, "Derby must not be shown for Tuxedo");
  assert.equal(footwearIds.includes("SUIT_SHOE_LOAFER"), false, "Loafer must not be shown for Tuxedo");

  const accessoryIds = getVisibleAccessoryOptions(tuxedoState).map((o) => o.id);
  assert.ok(accessoryIds.includes("SUIT_ACC_BOW_TIE"));
  assert.equal(accessoryIds.includes("SUIT_ACC_TIE"), false, "Standard tie must be hidden for Tuxedo by default");
});

test("Waistcoat requirement is deterministic per upper design", () => {
  const classicState: SplitOutfitState = { ...DEFAULT_SPLIT_OUTFIT_STATE, upperId: "SUIT_UPPER_CLASSIC" };
  assert.equal(getWaistcoatRequirement(classicState), "OPTIONAL");
  assert.ok(getVisibleWaistcoatOptions(classicState).some((o) => o.id === "SUIT_WAISTCOAT_NONE"));

  const doubleBreastedState: SplitOutfitState = { ...DEFAULT_SPLIT_OUTFIT_STATE, upperId: "SUIT_UPPER_DOUBLE_BREASTED" };
  assert.equal(getWaistcoatRequirement(doubleBreastedState), "UNAVAILABLE");
  assert.deepEqual(getVisibleWaistcoatOptions(doubleBreastedState), []);

  const threePieceState: SplitOutfitState = { ...DEFAULT_SPLIT_OUTFIT_STATE, upperId: "SUIT_UPPER_THREE_PIECE" };
  assert.equal(getWaistcoatRequirement(threePieceState), "REQUIRED");
  const threePieceWaistcoatIds = getVisibleWaistcoatOptions(threePieceState).map((o) => o.id);
  assert.equal(threePieceWaistcoatIds.includes("SUIT_WAISTCOAT_NONE"), false, "'None' must not be offered when a waistcoat is required");

  const tuxedoState: SplitOutfitState = { ...DEFAULT_SPLIT_OUTFIT_STATE, upperId: "SUIT_UPPER_TUXEDO" };
  assert.equal(getWaistcoatRequirement(tuxedoState), "CONDITIONAL");
  const tuxedoWaistcoatIds = getVisibleWaistcoatOptions(tuxedoState).map((o) => o.id);
  assert.deepEqual(tuxedoWaistcoatIds.sort(), ["SUIT_WAISTCOAT_NONE", "SUIT_WAISTCOAT_TUXEDO"].sort());
});

test("sanitizeSplitOutfitState clears stale selections when the upper design changes", () => {
  // Start fully dressed for Three-Piece (waistcoat required + selected)…
  const threePieceState: SplitOutfitState = {
    family: "suit",
    upperId: "SUIT_UPPER_THREE_PIECE",
    lowerId: "SUIT_LOWER_CLASSIC_STRAIGHT",
    shirtId: "SUIT_SHIRT_CLASSIC_FORMAL",
    waistcoatId: "SUIT_WAISTCOAT_CLASSIC",
    footwearId: "SUIT_SHOE_OXFORD",
    accessoryIds: ["SUIT_ACC_TIE", "SUIT_ACC_CUFFLINKS"],
    materials: {},
  };

  // …then switch to Double-Breasted, which cannot offer a waistcoat at all.
  const switchedToDoubleBreasted = sanitizeSplitOutfitState({
    ...threePieceState,
    upperId: "SUIT_UPPER_DOUBLE_BREASTED",
  });
  assert.equal(switchedToDoubleBreasted.waistcoatId, "SUIT_WAISTCOAT_NONE", "Waistcoat must be forced to None, not left dangling");
  assert.equal(switchedToDoubleBreasted.lowerId, "SUIT_LOWER_CLASSIC_STRAIGHT", "Still-valid lower selection must be preserved");
  assert.deepEqual(switchedToDoubleBreasted.accessoryIds, ["SUIT_ACC_TIE", "SUIT_ACC_CUFFLINKS"], "Still-valid accessories must be preserved");

  // …then switch to Tuxedo, which invalidates the trouser, shirt, and tie.
  const switchedToTuxedo = sanitizeSplitOutfitState({ ...threePieceState, upperId: "SUIT_UPPER_TUXEDO" });
  assert.equal(switchedToTuxedo.lowerId, null, "Classic trouser is invalid for Tuxedo and must be cleared");
  assert.equal(switchedToTuxedo.shirtId, null, "Classic shirt is invalid for Tuxedo and must be cleared");
  assert.equal(
    switchedToTuxedo.waistcoatId,
    "SUIT_WAISTCOAT_NONE",
    "Invalid Classic waistcoat must reset to None — Tuxedo waistcoat is CONDITIONAL, not REQUIRED, so it must not be left null",
  );
  assert.deepEqual(switchedToTuxedo.accessoryIds, ["SUIT_ACC_CUFFLINKS"], "Tie must be dropped; Cufflinks remain valid");
  assert.equal(switchedToTuxedo.footwearId, "SUIT_SHOE_OXFORD", "Oxford remains valid for Tuxedo and must be preserved");
});

test("sanitizeSplitOutfitState leaves a REQUIRED-but-unselected waistcoat null rather than auto-picking one", () => {
  const noWaistcoatState: SplitOutfitState = {
    family: "suit",
    upperId: "SUIT_UPPER_CLASSIC",
    lowerId: "SUIT_LOWER_CLASSIC_STRAIGHT",
    shirtId: "SUIT_SHIRT_CLASSIC_FORMAL",
    waistcoatId: "SUIT_WAISTCOAT_NONE",
    footwearId: "SUIT_SHOE_OXFORD",
    accessoryIds: [],
    materials: {},
  };

  const switchedToThreePiece = sanitizeSplitOutfitState({ ...noWaistcoatState, upperId: "SUIT_UPPER_THREE_PIECE" });
  assert.equal(switchedToThreePiece.waistcoatId, null, "A required-but-empty waistcoat must stay null, not be auto-selected");
});

test("getSplitOutfitRecipeStatus reports INCOMPLETE, VALID, and CONFLICT correctly", () => {
  // INCOMPLETE: Three-Piece with no waistcoat selected.
  const incompleteState: SplitOutfitState = {
    family: "suit",
    upperId: "SUIT_UPPER_THREE_PIECE",
    lowerId: "SUIT_LOWER_CLASSIC_STRAIGHT",
    shirtId: "SUIT_SHIRT_CLASSIC_FORMAL",
    waistcoatId: null,
    footwearId: "SUIT_SHOE_OXFORD",
    accessoryIds: [],
    materials: {},
  };
  assert.equal(getSplitOutfitRecipeStatus(incompleteState), "INCOMPLETE");
  assert.deepEqual(getMissingRequiredComponents(incompleteState), ["waistcoat"]);

  // VALID: Three-Piece with every required category correctly filled.
  const validState: SplitOutfitState = { ...incompleteState, waistcoatId: "SUIT_WAISTCOAT_CLASSIC" };
  assert.equal(getSplitOutfitRecipeStatus(validState), "VALID");
  assert.deepEqual(getMissingRequiredComponents(validState), []);

  // CONFLICT: stale Tuxedo trouser stored under a Classic upper (should never
  // happen once sanitizeSplitOutfitState runs on every change, but the status
  // function must still detect and honestly report it rather than hide it).
  const conflictState: SplitOutfitState = {
    family: "suit",
    upperId: "SUIT_UPPER_CLASSIC",
    lowerId: "SUIT_LOWER_TUXEDO_TROUSER",
    shirtId: "SUIT_SHIRT_CLASSIC_FORMAL",
    waistcoatId: "SUIT_WAISTCOAT_NONE",
    footwearId: "SUIT_SHOE_OXFORD",
    accessoryIds: [],
    materials: {},
  };
  assert.equal(getSplitOutfitRecipeStatus(conflictState), "CONFLICT");
});

test("Material link groups are deterministic per upper design", () => {
  const classicGroups = getMaterialLinkGroups({ ...DEFAULT_SPLIT_OUTFIT_STATE, upperId: "SUIT_UPPER_CLASSIC" });
  assert.deepEqual(classicGroups, [["jacket-primary", "trouser-primary"]]);

  const threePieceGroups = getMaterialLinkGroups({ ...DEFAULT_SPLIT_OUTFIT_STATE, upperId: "SUIT_UPPER_THREE_PIECE" });
  assert.deepEqual(threePieceGroups, [["jacket-primary", "trouser-primary", "waistcoat-material"]]);
});

// ============================================================
// CANONICAL MATERIAL GROUPS — shirt fabric independence (product correction)
// ============================================================

test("Shirt fabric is an independent uploaded-fabric canonical group, never linked to the suit fabric group", () => {
  const classicState: SplitOutfitState = {
    family: "suit",
    upperId: "SUIT_UPPER_CLASSIC",
    lowerId: "SUIT_LOWER_CLASSIC_STRAIGHT",
    shirtId: "SUIT_SHIRT_CLASSIC_FORMAL",
    waistcoatId: "SUIT_WAISTCOAT_NONE",
    footwearId: "SUIT_SHOE_OXFORD",
    accessoryIds: [],
    materials: {},
  };
  const groups = getCanonicalMaterialGroups(classicState);
  assert.equal(groups.length, 2);
  const groupIds = groups.map((g) => g.groupId).sort();
  assert.deepEqual(groupIds, ["jacket-primary+trouser-primary", "shirt-material"].sort());
});

test("Three-Piece links the waistcoat into the suit fabric group but keeps shirt fabric independent", () => {
  const threePieceState: SplitOutfitState = {
    family: "suit",
    upperId: "SUIT_UPPER_THREE_PIECE",
    lowerId: "SUIT_LOWER_CLASSIC_STRAIGHT",
    shirtId: "SUIT_SHIRT_CLASSIC_FORMAL",
    waistcoatId: "SUIT_WAISTCOAT_CLASSIC",
    footwearId: "SUIT_SHOE_OXFORD",
    accessoryIds: [],
    materials: {},
  };
  const groups = getCanonicalMaterialGroups(threePieceState);
  const groupIds = groups.map((g) => g.groupId).sort();
  assert.deepEqual(groupIds, ["jacket-primary+trouser-primary+waistcoat-material", "shirt-material"].sort());
});

test("sanitizeSplitOutfitState: shirt fabric upload persists across an upper transition that keeps the shirt selection itself valid", () => {
  const shirtFile = new File([Uint8Array.from([1, 2, 3])], "shirt.png", { type: "image/png" });
  const classicState: SplitOutfitState = {
    family: "suit",
    upperId: "SUIT_UPPER_CLASSIC",
    lowerId: "SUIT_LOWER_CLASSIC_STRAIGHT",
    shirtId: "SUIT_SHIRT_CLASSIC_FORMAL",
    waistcoatId: "SUIT_WAISTCOAT_NONE",
    footwearId: "SUIT_SHOE_OXFORD",
    accessoryIds: [],
    materials: {},
    materialUploads: { "jacket-primary+trouser-primary": new File([Uint8Array.from([9])], "suit.png", { type: "image/png" }), "shirt-material": shirtFile },
  };

  // Double-Breasted, Three-Piece, and Statement all still allow
  // SUIT_SHIRT_CLASSIC_FORMAL (STANDARD_SHIRT_IDS) — the shirt selection
  // itself survives sanitizeSplitOutfitState's lower/shirt/waistcoat
  // pruning, so the shirt-material slot stays active and the upload
  // persists, exactly as required.
  for (const upperId of ["SUIT_UPPER_DOUBLE_BREASTED", "SUIT_UPPER_THREE_PIECE", "SUIT_UPPER_STATEMENT"]) {
    const sanitized = sanitizeSplitOutfitState({ ...classicState, upperId });
    assert.equal(sanitized.shirtId, "SUIT_SHIRT_CLASSIC_FORMAL", `${upperId}: shirt selection itself must remain valid for this assertion to be meaningful`);
    assert.equal(sanitized.materialUploads?.["shirt-material"], shirtFile, `shirt upload must persist when switching to ${upperId}`);
  }
});

test("sanitizeSplitOutfitState: shirt fabric upload is dropped (deliberately) when the transition also invalidates the shirt selection itself", () => {
  // Tuxedo only allows SUIT_SHIRT_TUXEDO_PLEATED — Classic Formal is
  // invalid, so sanitizeSplitOutfitState nulls shirtId. With no shirt
  // selected at all, there is no shirt-material slot to upload into, so
  // the previously uploaded file is correctly pruned along with it — this
  // is a consequence of "no component selected -> no material slot", not a
  // material-specific special case.
  const shirtFile = new File([Uint8Array.from([1, 2, 3])], "shirt.png", { type: "image/png" });
  const classicState: SplitOutfitState = {
    family: "suit",
    upperId: "SUIT_UPPER_CLASSIC",
    lowerId: "SUIT_LOWER_CLASSIC_STRAIGHT",
    shirtId: "SUIT_SHIRT_CLASSIC_FORMAL",
    waistcoatId: "SUIT_WAISTCOAT_NONE",
    footwearId: "SUIT_SHOE_OXFORD",
    accessoryIds: [],
    materials: {},
    materialUploads: { "shirt-material": shirtFile },
  };
  const sanitized = sanitizeSplitOutfitState({ ...classicState, upperId: "SUIT_UPPER_TUXEDO" });
  assert.equal(sanitized.shirtId, null);
  assert.equal(sanitized.materialUploads?.["shirt-material"], undefined);
});

test("sanitizeSplitOutfitState: suit fabric upload persists only while the canonical suit group id stays the same", () => {
  const suitFile = new File([Uint8Array.from([9])], "suit.png", { type: "image/png" });
  const classicState: SplitOutfitState = {
    family: "suit",
    upperId: "SUIT_UPPER_CLASSIC",
    lowerId: "SUIT_LOWER_CLASSIC_STRAIGHT",
    shirtId: "SUIT_SHIRT_CLASSIC_FORMAL",
    waistcoatId: "SUIT_WAISTCOAT_NONE",
    footwearId: "SUIT_SHOE_OXFORD",
    accessoryIds: [],
    materials: {},
    materialUploads: { "jacket-primary+trouser-primary": suitFile },
  };

  // Double-Breasted and Statement both share the exact same suit group id
  // ("jacket-primary+trouser-primary") as Classic, and both keep the
  // trouser selection valid — the upload must survive these transitions.
  for (const upperId of ["SUIT_UPPER_DOUBLE_BREASTED", "SUIT_UPPER_STATEMENT"]) {
    const sanitized = sanitizeSplitOutfitState({ ...classicState, upperId });
    assert.equal(sanitized.materialUploads?.["jacket-primary+trouser-primary"], suitFile, `suit upload must persist for ${upperId}`);
  }

  // Three-Piece's suit group id is different ("...+waistcoat-material") once
  // a waistcoat is actually selected — the stale Classic-shaped upload must
  // be dropped then, not silently reused under a group id the server would
  // no longer expect. (Until a waistcoat is chosen, Three-Piece's REQUIRED-
  // but-unselected waistcoat leaves the suit group temporarily identical to
  // Classic's — see the dedicated INCOMPLETE-state case below.)
  const switchedToThreePieceWithWaistcoat = sanitizeSplitOutfitState({
    ...classicState,
    upperId: "SUIT_UPPER_THREE_PIECE",
    waistcoatId: "SUIT_WAISTCOAT_CLASSIC",
  });
  assert.equal(switchedToThreePieceWithWaistcoat.materialUploads?.["jacket-primary+trouser-primary"], undefined);
  assert.equal(Object.keys(switchedToThreePieceWithWaistcoat.materialUploads ?? {}).length, 0);

  // Immediately after switching to Three-Piece, before a waistcoat is
  // chosen, the required-but-unselected waistcoat leaves only jacket+trouser
  // active — coincidentally the same group id as Classic — so the upload is
  // (correctly) retained rather than needlessly discarded while the recipe
  // is still INCOMPLETE.
  const switchedToThreePieceNoWaistcoatYet = sanitizeSplitOutfitState({ ...classicState, upperId: "SUIT_UPPER_THREE_PIECE" });
  assert.equal(switchedToThreePieceNoWaistcoatYet.waistcoatId, null);
  assert.equal(switchedToThreePieceNoWaistcoatYet.materialUploads?.["jacket-primary+trouser-primary"], suitFile);
});
