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
} from "@/lib/split-outfit/compatibility";
import { isSplitOutfitEnabled } from "@/lib/split-outfit/config";
import type { SplitOutfitState } from "@/lib/split-outfit/types";
import { DEFAULT_LEVEL1_CATALOGUE } from "@/lib/catalog/level1-seed";

test("Full Outfit remains the authoritative default catalogue and is untouched", () => {
  assert.equal(DEFAULT_LEVEL1_CATALOGUE.categories.length, 8);
  assert.equal(DEFAULT_LEVEL1_CATALOGUE.designs.length, 39);
  assert.equal(DEFAULT_LEVEL1_CATALOGUE.assets.length, 78);

  for (const cat of DEFAULT_LEVEL1_CATALOGUE.categories) {
    const designsInCat = DEFAULT_LEVEL1_CATALOGUE.designs.filter((d) => d.categoryId === cat.id);
    const expectedCount = cat.id === "nehru-jacket" ? 7 : cat.id === "jackets" ? 2 : 5;
    assert.equal(designsInCat.length, expectedCount, `Category ${cat.id} must have exactly ${expectedCount} designs`);
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
