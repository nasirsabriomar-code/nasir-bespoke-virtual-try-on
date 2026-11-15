import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_SPLIT_OUTFIT_STATE,
  SPLIT_CATALOGUE_BY_FAMILY,
  SPLIT_SLOTS,
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
  findSplitOption,
  optionsFor,
  reconcile,
  validateRecipe,
} from "@/lib/split-outfit/compatibility";
import { isSplitOutfitEnabled } from "@/lib/split-outfit/config";
import { getSplitCatalogueView } from "@/lib/split-outfit/view";
import * as clientEngine from "@/lib/split-outfit/client-engine";
import { SUIT_UPPER_IDS, SUIT_SHIRT_IDS } from "@/lib/split-outfit/types";
import type { SplitComponentCategory, SplitComponentOption, SplitOutfitState } from "@/lib/split-outfit/types";
import { DEFAULT_LEVEL1_CATALOGUE } from "@/lib/catalog/level1-seed";

test("Full Outfit remains the authoritative default catalogue and is untouched", () => {
  assert.equal(DEFAULT_LEVEL1_CATALOGUE.categories.length, 8);
  assert.equal(DEFAULT_LEVEL1_CATALOGUE.designs.length, 40);
  assert.equal(DEFAULT_LEVEL1_CATALOGUE.assets.length, 84);

  for (const cat of DEFAULT_LEVEL1_CATALOGUE.categories) {
    const designsInCat = DEFAULT_LEVEL1_CATALOGUE.designs.filter((d) => d.categoryId === cat.id);
    const expectedCount = cat.id === "suit" ? 6 : cat.id === "nehru-jacket" ? 7 : cat.id === "jackets" ? 2 : 5;
    assert.equal(designsInCat.length, expectedCount, `Category ${cat.id} must have exactly ${expectedCount} designs`);
  }
});

function setNodeEnv(value: string | undefined) {
  const environment = process.env as Record<string, string | undefined>;
  if (value === undefined) delete environment.NODE_ENV;
  else environment.NODE_ENV = value;
}

test("Feature flag behaves correctly across environments", () => {
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
  assert.equal(SUIT_LOWER_OPTIONS.length, 10);
  assert.equal(SUIT_SHIRT_OPTIONS.length, 3);
  assert.equal(SUIT_WAISTCOAT_OPTIONS.length, 4);
  assert.equal(SUIT_FOOTWEAR_OPTIONS.length, 4);
  assert.equal(SUIT_ACCESSORY_OPTIONS.length, 5);

  const upperNames = SUIT_UPPER_OPTIONS.map((o) => o.customer.name);
  assert.deepEqual(upperNames, [
    "Classic",
    "Double-Breasted",
    "Tuxedo",
    "Three-Piece",
    "Statement",
  ]);

  const lowerNames = SUIT_LOWER_OPTIONS.map((o) => o.customer.name);
  assert.deepEqual(lowerNames, [
    "Non-pleated",
    "One-pleated",
    "Two-pleated",
    "Three-pleated",
    "Casual",
    "Denim",
    "Gorkha",
    "Parallel",
    "Baggy",
    "Trendy",
  ]);
});

test("findSplitOption correctly resolves component IDs in suit family", () => {
  const classic = findSplitOption("suit", "SUIT_UPPER_CLASSIC");
  assert.ok(classic, "expected findSplitOption to resolve SUIT_UPPER_CLASSIC");
  assert.equal(classic.customer.name, "Classic");
  assert.equal(classic.categoryId, "upper");

  const none = findSplitOption("suit", "NON_EXISTENT_ID");
  assert.equal(none, null);
});

function allSuitOptions(): SplitComponentOption[] {
  const catalogue = SPLIT_CATALOGUE_BY_FAMILY.suit;
  return [
    ...catalogue.uppers,
    ...catalogue.lowers,
    ...catalogue.shirts,
    ...catalogue.waistcoats,
    ...catalogue.footwear,
    ...catalogue.accessories,
  ];
}

test("Referential integrity: every rule references a real slot and a real option", () => {
  const slotIds = new Set(SPLIT_SLOTS.map((slot) => slot.id));
  const optionIdsByFamily = new Set<string>(allSuitOptions().map((option) => option.id));

  for (const option of allSuitOptions()) {
    const ruleLists = [
      option.rules?.requires,
      option.rules?.conflictsWith,
      option.rules?.recommendedWhen,
      option.rules?.discouragedWhen,
    ];
    for (const rules of ruleLists) {
      if (!rules) continue;
      for (const rule of rules) {
        assert.ok(slotIds.has(rule.groupId as SplitComponentCategory), `${option.id} references unknown slot "${rule.groupId}"`);
        for (const referencedId of rule.optionIds) {
          assert.ok(optionIdsByFamily.has(referencedId), `${option.id} references unknown option "${referencedId}"`);
        }
      }
    }
  }
});

test("Cartesian rule audit: no rule evaluation throws across every upper x shirt combination", () => {
  for (const upperId of SUIT_UPPER_IDS) {
    for (const shirtId of SUIT_SHIRT_IDS) {
      const state: SplitOutfitState = { ...DEFAULT_SPLIT_OUTFIT_STATE, upperId, shirtId };
      for (const slot of SPLIT_SLOTS) {
        const entries = optionsFor(state, slot.id);
        for (const { verdict } of entries) {
          assert.ok(
            verdict.status === "available" || verdict.status === "recommended" || verdict.status === "discouraged" || verdict.status === "incompatible",
            `Unexpected verdict status for slot ${slot.id}`,
          );
        }
      }
    }
  }
});

test("No option is permanently unreachable", () => {
  function isReachable(option: SplitComponentOption): boolean {
    for (const upperId of SUIT_UPPER_IDS) {
      for (const shirtId of SUIT_SHIRT_IDS) {
        const state: SplitOutfitState = {
          ...DEFAULT_SPLIT_OUTFIT_STATE,
          upperId,
          shirtId,
          accessoryIds: option.categoryId === "accessory" ? [option.id] : [],
        };
        const match = optionsFor(state, option.categoryId).find((entry) => entry.option.id === option.id);
        if (match && match.verdict.status !== "incompatible") return true;
      }
    }
    return false;
  }

  for (const option of allSuitOptions()) {
    assert.ok(isReachable(option), `${option.id} is never selectable under any upper/shirt combination`);
  }
});

test("Default state is self-consistent", () => {
  const result = validateRecipe(DEFAULT_SPLIT_OUTFIT_STATE);
  assert.equal(result.valid, true, JSON.stringify(result.violations));
});

test("Owner's rule: a waistcoat is only available with a three-piece jacket", () => {
  const twoPieceState: SplitOutfitState = { ...DEFAULT_SPLIT_OUTFIT_STATE, upperId: "SUIT_UPPER_CLASSIC" };
  const classicWaistcoatUnderTwoPiece = optionsFor(twoPieceState, "inner-waistcoat")
    .find((entry) => entry.option.id === "SUIT_WAISTCOAT_CLASSIC");
  assert.equal(classicWaistcoatUnderTwoPiece?.verdict.status, "incompatible");

  const threePieceState: SplitOutfitState = { ...DEFAULT_SPLIT_OUTFIT_STATE, upperId: "SUIT_UPPER_THREE_PIECE" };
  const classicWaistcoatUnderThreePiece = optionsFor(threePieceState, "inner-waistcoat")
    .find((entry) => entry.option.id === "SUIT_WAISTCOAT_CLASSIC");
  assert.equal(classicWaistcoatUnderThreePiece?.verdict.status, "available");

  const noWaistcoatUnderThreePiece = optionsFor(threePieceState, "inner-waistcoat")
    .find((entry) => entry.option.id === "SUIT_WAISTCOAT_NONE");
  assert.equal(noWaistcoatUnderThreePiece?.verdict.status, "incompatible");
});

test("Cufflinks require a French-cuff shirt", () => {
  // Classic Formal and the Tuxedo shirt both carry French double cuffs.
  const classicFormalState: SplitOutfitState = { ...DEFAULT_SPLIT_OUTFIT_STATE, shirtId: "SUIT_SHIRT_CLASSIC_FORMAL" };
  const cufflinksUnderClassicFormal = optionsFor(classicFormalState, "accessory")
    .find((entry) => entry.option.id === "SUIT_ACC_CUFFLINKS");
  assert.equal(cufflinksUnderClassicFormal?.verdict.status, "available");

  // Spread Collar has rounded barrel cuffs, not French cuffs — no cufflinks.
  const spreadCollarState: SplitOutfitState = { ...DEFAULT_SPLIT_OUTFIT_STATE, shirtId: "SUIT_SHIRT_SPREAD_COLLAR" };
  const cufflinksUnderSpreadCollar = optionsFor(spreadCollarState, "accessory")
    .find((entry) => entry.option.id === "SUIT_ACC_CUFFLINKS");
  assert.equal(cufflinksUnderSpreadCollar?.verdict.status, "incompatible");
});

test("Tie and bow tie are mutually exclusive", () => {
  const withBowTie: SplitOutfitState = { ...DEFAULT_SPLIT_OUTFIT_STATE, accessoryIds: ["SUIT_ACC_BOW_TIE"] };
  const tieUnderBowTie = optionsFor(withBowTie, "accessory").find((entry) => entry.option.id === "SUIT_ACC_TIE");
  assert.equal(tieUnderBowTie?.verdict.status, "incompatible");

  const withTie: SplitOutfitState = { ...DEFAULT_SPLIT_OUTFIT_STATE, accessoryIds: ["SUIT_ACC_TIE"] };
  const bowTieUnderTie = optionsFor(withTie, "accessory").find((entry) => entry.option.id === "SUIT_ACC_BOW_TIE");
  assert.equal(bowTieUnderTie?.verdict.status, "incompatible");
});

test("reconcile drops an invalidated waistcoat and reports why", () => {
  const threePieceWithWaistcoat: SplitOutfitState = {
    ...DEFAULT_SPLIT_OUTFIT_STATE,
    upperId: "SUIT_UPPER_THREE_PIECE",
    waistcoatId: "SUIT_WAISTCOAT_CLASSIC",
  };
  assert.equal(validateRecipe(threePieceWithWaistcoat).valid, true);

  const switchedToTwoPiece: SplitOutfitState = { ...threePieceWithWaistcoat, upperId: "SUIT_UPPER_CLASSIC" };
  const { state: reconciled, notices } = reconcile(switchedToTwoPiece);

  assert.equal(reconciled.waistcoatId, null);
  assert.equal(notices.length, 1);
  assert.equal(notices[0].groupId, "inner-waistcoat");
  assert.equal(notices[0].removedOptionId, "SUIT_WAISTCOAT_CLASSIC");
  assert.equal(notices[0].reason, "Requires a three-piece jacket.");
});

test("Completeness requires every required slot filled AND a valid recipe", () => {
  const missingFootwear: SplitOutfitState = { ...DEFAULT_SPLIT_OUTFIT_STATE, footwearId: null };
  assert.equal(buildSplitOutfitSummary(missingFootwear).isComplete, false);

  const staleWaistcoat: SplitOutfitState = {
    ...DEFAULT_SPLIT_OUTFIT_STATE,
    upperId: "SUIT_UPPER_THREE_PIECE",
    waistcoatId: "SUIT_WAISTCOAT_NONE",
  };
  assert.equal(validateRecipe(staleWaistcoat).valid, false);
  assert.equal(buildSplitOutfitSummary(staleWaistcoat).isComplete, false);

  const validThreePiece: SplitOutfitState = {
    ...DEFAULT_SPLIT_OUTFIT_STATE,
    upperId: "SUIT_UPPER_THREE_PIECE",
    waistcoatId: "SUIT_WAISTCOAT_CLASSIC",
  };
  assert.equal(buildSplitOutfitSummary(validThreePiece).isComplete, true);
});

test("Material slots react dynamically to component selections", () => {
  // Case A: 2-piece suit without waistcoat or extra accessories
  const twoPieceState: SplitOutfitState = {
    family: "suit",
    upperId: "SUIT_UPPER_CLASSIC",
    lowerId: "SUIT_LOWER_NON_PLEATED",
    shirtId: "SUIT_SHIRT_CLASSIC_FORMAL",
    waistcoatId: "SUIT_WAISTCOAT_NONE",
    footwearId: "SUIT_SHOE_OXFORD",
    accessoryIds: [],
  };

  const slotsA = deriveActiveMaterialSlots(twoPieceState);
  const slotIdsA = slotsA.map((s) => s.slotId);

  assert.equal(slotIdsA.includes("jacket-primary"), true, "expected jacket-primary slot");
  assert.equal(slotIdsA.includes("trouser-primary"), true, "expected trouser-primary slot");
  assert.equal(slotIdsA.includes("shirt-material"), true, "expected shirt-material slot");
  assert.equal(slotIdsA.includes("footwear-leather"), true, "expected footwear-leather slot");
  assert.equal(slotIdsA.includes("waistcoat-material"), false, "Waistcoat slot must NOT be present when None");
  assert.equal(slotIdsA.includes("neckwear-material"), false);

  // Case B: Add waistcoat and accessories
  const fullEnsembleState: SplitOutfitState = {
    family: "suit",
    upperId: "SUIT_UPPER_THREE_PIECE",
    lowerId: "SUIT_LOWER_NON_PLEATED",
    shirtId: "SUIT_SHIRT_CLASSIC_FORMAL",
    waistcoatId: "SUIT_WAISTCOAT_CLASSIC",
    footwearId: "SUIT_SHOE_OXFORD",
    accessoryIds: ["SUIT_ACC_TIE", "SUIT_ACC_POCKET_SQUARE", "SUIT_ACC_CUFFLINKS", "SUIT_ACC_BUTTONS"],
  };

  const slotsB = deriveActiveMaterialSlots(fullEnsembleState);
  const slotIdsB = slotsB.map((s) => s.slotId);

  assert.equal(slotIdsB.includes("jacket-primary"), true, "expected jacket-primary slot");
  assert.equal(slotIdsB.includes("trouser-primary"), true, "expected trouser-primary slot");
  assert.equal(slotIdsB.includes("shirt-material"), true, "expected shirt-material slot");
  assert.ok(slotIdsB.includes("waistcoat-material"), "Waistcoat slot MUST be present when waistcoat selected");
  assert.ok(slotIdsB.includes("neckwear-material"), "Neckwear slot MUST be present when Tie selected");
  assert.equal(slotIdsB.includes("pocket-square-material"), true, "expected pocket-square-material slot");
  assert.equal(slotIdsB.includes("cufflinks-finish"), true, "expected cufflinks-finish slot");
  assert.equal(slotIdsB.includes("buttons-finish"), true, "expected buttons-finish slot");
  assert.equal(slotIdsB.includes("footwear-leather"), true, "expected footwear-leather slot");
  assert.equal(slotsB.length, 9);
});

test("buildSplitOutfitSummary generates accurate live recipe", () => {
  const state: SplitOutfitState = {
    family: "suit",
    upperId: "SUIT_UPPER_DOUBLE_BREASTED",
    lowerId: "SUIT_LOWER_PARALLEL",
    shirtId: "SUIT_SHIRT_SPREAD_COLLAR",
    waistcoatId: "SUIT_WAISTCOAT_NONE",
    footwearId: "SUIT_SHOE_DERBY",
    accessoryIds: ["SUIT_ACC_POCKET_SQUARE"],
  };

  const summary = buildSplitOutfitSummary(state);

  assert.equal(summary.upper?.customer.name, "Double-Breasted");
  assert.equal(summary.lower?.customer.name, "Parallel");
  assert.equal(summary.shirt?.customer.name, "Spread Collar");
  assert.equal(summary.waistcoat?.id, "SUIT_WAISTCOAT_NONE");
  assert.equal(summary.footwear?.customer.name, "Derby");
  assert.equal(summary.accessories.length, 1);
  assert.equal(summary.accessories[0].customer.name, "Pocket Square");
  assert.equal(summary.isComplete, true);
});


test("SplitCatalogueView never carries generation/prompt text to the client", () => {
  const view = getSplitCatalogueView("suit");
  const serialized = JSON.stringify(view);
  assert.doesNotMatch(serialized, /constructionFragment|negativeConstraints/i);

  // Every option's rules and presentation copy still made it through.
  const upperSlot = view.slots.find((slot) => slot.id === "upper");
  assert.ok(upperSlot);
  assert.equal(upperSlot.options.length, 5);
  assert.ok(upperSlot.options.every((option) => typeof option.customer.name === "string"));
});

test("Client engine reproduces the same verdicts as the server engine from the fetched view", () => {
  const view = getSplitCatalogueView("suit");
  const threePieceState: SplitOutfitState = { ...DEFAULT_SPLIT_OUTFIT_STATE, upperId: "SUIT_UPPER_THREE_PIECE" };

  const serverVerdict = optionsFor(threePieceState, "inner-waistcoat")
    .find((entry) => entry.option.id === "SUIT_WAISTCOAT_NONE")?.verdict;
  const clientVerdict = clientEngine.optionsFor(view, threePieceState, "inner-waistcoat")
    .find((entry) => entry.option.id === "SUIT_WAISTCOAT_NONE")?.verdict;

  assert.deepEqual(clientVerdict, serverVerdict);
});

test("Client engine reconcile matches the server engine reconcile", () => {
  const view = getSplitCatalogueView("suit");
  const threePieceWithWaistcoat: SplitOutfitState = {
    ...DEFAULT_SPLIT_OUTFIT_STATE,
    upperId: "SUIT_UPPER_THREE_PIECE",
    waistcoatId: "SUIT_WAISTCOAT_CLASSIC",
  };
  const switchedToTwoPiece: SplitOutfitState = { ...threePieceWithWaistcoat, upperId: "SUIT_UPPER_CLASSIC" };

  const serverResult = reconcile(switchedToTwoPiece);
  const clientResult = clientEngine.reconcile(view, switchedToTwoPiece);

  assert.deepEqual(clientResult.state, serverResult.state);
  assert.deepEqual(clientResult.notices, serverResult.notices);
});


test("Client engine buildSummaryFromView enforces three-piece waistcoat requirement", () => {
  const view = getSplitCatalogueView("suit");
  const missingWaistcoat: SplitOutfitState = {
    ...DEFAULT_SPLIT_OUTFIT_STATE,
    upperId: "SUIT_UPPER_THREE_PIECE",
    waistcoatId: "SUIT_WAISTCOAT_NONE",
  };
  assert.equal(clientEngine.buildSummaryFromView(view, missingWaistcoat).isComplete, false);
});

test("reconcileSelections preserves multiple valid accessories when multi is true", () => {
  const withMultipleAccessories: SplitOutfitState = {
    ...DEFAULT_SPLIT_OUTFIT_STATE,
    accessoryIds: ["SUIT_ACC_TIE", "SUIT_ACC_POCKET_SQUARE"],
  };
  const { state: reconciled } = reconcile(withMultipleAccessories);
  assert.deepEqual(reconciled.accessoryIds, ["SUIT_ACC_TIE", "SUIT_ACC_POCKET_SQUARE"]);
});
