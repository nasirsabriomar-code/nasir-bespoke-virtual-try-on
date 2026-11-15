import "server-only";

import { evaluateOption, isSelectable, type ReconcileGroup } from "@/lib/rules/engine";
import type { RepairNotice, Verdict } from "@/lib/rules/types";
import { SPLIT_CATALOGUE_BY_FAMILY, SPLIT_SLOTS } from "./catalogue";
import {
  deriveActiveMaterialSlotsFromResolver,
  hasRealWaistcoat,
  hasRequiredSplitSelections,
  isWaistcoatRequiredForState,
  reconcileFromGroups,
  toSelections,
} from "./shared-engine";
import type {
  SplitComponentCategory,
  SplitComponentOption,
  SplitOutfitFamily,
  SplitOutfitState,
  SplitOutfitSummary,
  MaterialSlotState,
} from "./types";

type SplitSlot = (typeof SPLIT_SLOTS)[number];

const MISSING_OPTION_VERDICT: Verdict = {
  status: "incompatible",
  reason: "Not available with the current selections.",
  blockedBy: [],
};

function verdictReason(verdict: Verdict): string {
  return verdict.status === "incompatible" ? verdict.reason : "Not available with the current selections.";
}

export function optionsForSlot(family: SplitOutfitFamily, slotId: SplitComponentCategory): SplitComponentOption[] {
  const catalogue = SPLIT_CATALOGUE_BY_FAMILY[family];
  if (!catalogue) return [];
  switch (slotId) {
    case "upper": return catalogue.uppers;
    case "lower": return catalogue.lowers;
    case "inner-shirt": return catalogue.shirts;
    case "inner-waistcoat": return catalogue.waistcoats;
    case "footwear": return catalogue.footwear;
    case "accessory": return catalogue.accessories;
  }
}

function getSlotValue(state: SplitOutfitState, slot: SplitSlot): string | string[] | null {
  switch (slot.stateKey) {
    case "upperId": return state.upperId;
    case "lowerId": return state.lowerId;
    case "shirtId": return state.shirtId;
    case "waistcoatId": return state.waistcoatId;
    case "footwearId": return state.footwearId;
    case "accessoryIds": return state.accessoryIds;
  }
}

export { toSelections };

const optionIndexCache = new Map<SplitOutfitFamily, Map<string, SplitComponentOption>>();

function optionIndexFor(family: SplitOutfitFamily): Map<string, SplitComponentOption> {
  let index = optionIndexCache.get(family);
  if (!index) {
    index = new Map();
    const catalogue = SPLIT_CATALOGUE_BY_FAMILY[family];
    if (catalogue) {
      for (const list of [catalogue.uppers, catalogue.lowers, catalogue.shirts, catalogue.waistcoats, catalogue.footwear, catalogue.accessories]) {
        for (const option of list) index.set(option.id, option);
      }
    }
    optionIndexCache.set(family, index);
  }
  return index;
}

/**
 * Resolves a component option by its ID within a given family.
 */
export function findSplitOption(
  family: SplitOutfitFamily,
  optionId: string | null | undefined,
): SplitComponentOption | null {
  if (!optionId) return null;
  return optionIndexFor(family).get(optionId) ?? null;
}

/**
 * Every option for a slot, each carrying its live Verdict given the rest of
 * the current state. This is what the UI renders.
 */
export function optionsFor(state: SplitOutfitState, slotId: SplitComponentCategory):
  Array<{ option: SplitComponentOption; verdict: Verdict }> {
  const selections = toSelections(state);
  return optionsForSlot(state.family, slotId).map((option) => ({
    option,
    verdict: evaluateOption(option.rules, selections),
  }));
}

/**
 * Server-authoritative check: is this whole recipe valid? Every selected
 * option (including each selected accessory) must not be "incompatible"
 * given the rest of the state, and every required slot must be filled.
 */
export function validateRecipe(state: SplitOutfitState):
  { valid: boolean; violations: Array<{ slotId: string; optionId: string; reason: string }> } {
  const selections = toSelections(state);
  const violations: Array<{ slotId: string; optionId: string; reason: string }> = [];

  for (const slot of SPLIT_SLOTS) {
    const value = getSlotValue(state, slot);

    if (slot.multi) {
      const ids = Array.isArray(value) ? value : [];
      for (const id of ids) {
        const option = findSplitOption(state.family, id);
        const verdict = option ? evaluateOption(option.rules, selections) : MISSING_OPTION_VERDICT;
        if (!isSelectable(verdict)) {
          violations.push({ slotId: slot.id, optionId: id, reason: verdictReason(verdict) });
        }
      }
      continue;
    }

    const id = typeof value === "string" ? value : null;
    if (!id) {
      if (slot.required || (slot.id === "inner-waistcoat" && isWaistcoatRequiredForState(state))) {
        violations.push({
          slotId: slot.id,
          optionId: "",
          reason: slot.id === "inner-waistcoat" ? "A three-piece suit requires a waistcoat." : "This selection is required.",
        });
      }
      continue;
    }
    if (slot.id === "inner-waistcoat" && isWaistcoatRequiredForState(state) && !hasRealWaistcoat(state)) {
      violations.push({ slotId: slot.id, optionId: id, reason: "A three-piece suit includes a waistcoat." });
      continue;
    }
    const option = findSplitOption(state.family, id);
    const verdict = option ? evaluateOption(option.rules, selections) : MISSING_OPTION_VERDICT;
    if (!isSelectable(verdict)) {
      violations.push({ slotId: slot.id, optionId: id, reason: verdictReason(verdict) });
    }
  }

  return { valid: violations.length === 0, violations };
}

/**
 * Repairs a state after a change: drops any selection a change invalidated,
 * walking slots in dependency order. Generalises BespokeConfigurator's
 * normalize(), but reports what it dropped.
 */
export function reconcile(state: SplitOutfitState): { state: SplitOutfitState; notices: RepairNotice[] } {
  const groups: ReconcileGroup[] = SPLIT_SLOTS.map((slot) => ({
    groupId: slot.id,
    multi: slot.multi,
    options: optionsForSlot(state.family, slot.id).map((option) => ({ id: option.id, rules: option.rules })),
  }));

  return reconcileFromGroups(groups, state);
}

/**
 * Derives the active material slots from the materialRequirements each
 * selected option actually declares — rather than re-declaring labels
 * and fabric sources as separate literals that can drift from the data.
 */
export function deriveActiveMaterialSlots(state: SplitOutfitState): MaterialSlotState[] {
  const family = state.family;
  const catalogue = SPLIT_CATALOGUE_BY_FAMILY[family];
  return deriveActiveMaterialSlotsFromResolver(
    state,
    (id) => findSplitOption(family, id),
    () => (catalogue?.accessories ?? []).filter((option) => state.accessoryIds.includes(option.id)),
  );
}

/**
 * Builds the complete Split Outfit summary view for reactive review.
 */
export function buildSplitOutfitSummary(state: SplitOutfitState): SplitOutfitSummary {
  const family = state.family;
  const upper = findSplitOption(family, state.upperId);
  const lower = findSplitOption(family, state.lowerId);
  const shirt = findSplitOption(family, state.shirtId);
  const waistcoat = findSplitOption(family, state.waistcoatId);
  const footwear = findSplitOption(family, state.footwearId);
  const accessories = state.accessoryIds
    .map((id) => findSplitOption(family, id))
    .filter((acc): acc is SplitComponentOption => acc !== null);

  const activeMaterialSlots = deriveActiveMaterialSlots(state);

  // Complete means every required slot is filled AND the whole recipe is
  // valid — a recipe that looks "filled" but contains an incompatible
  // selection (e.g. a leftover waistcoat after switching to a two-piece
  // jacket) must never be reported complete.
  const requiredFilled = Boolean(upper && lower && shirt && footwear) && hasRequiredSplitSelections(state);
  const isComplete = requiredFilled && validateRecipe(state).valid;

  return {
    family,
    upper,
    lower,
    shirt,
    waistcoat,
    footwear,
    accessories,
    activeMaterialSlots,
    isComplete,
  };
}
