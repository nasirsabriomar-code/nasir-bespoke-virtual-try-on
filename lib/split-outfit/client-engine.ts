// Deliberately does NOT import "./catalogue" or "./compatibility" — those
// carry every option's server-only generation.constructionFragment text.
// This module only ever sees whatever the browser fetched from
// /api/split-catalog, so it structurally cannot leak prompt text to the
// client bundle. All matching logic is the same pure lib/rules/engine used
// server-side; only the data source differs.
import { evaluateOption, reconcileSelections, type ReconcileGroup } from "@/lib/rules/engine";
import type { RepairNotice, Selections, Verdict } from "@/lib/rules/types";
import type {
  MaterialSlotState,
  SplitCatalogueView,
  SplitComponentCategory,
  SplitComponentOptionView,
  SplitOutfitState,
  SplitOutfitSummaryView,
} from "./types";

export function toSelections(state: SplitOutfitState): Selections {
  return {
    upper: state.upperId ?? "",
    lower: state.lowerId ?? "",
    "inner-shirt": state.shirtId ?? "",
    "inner-waistcoat": state.waistcoatId ?? "",
    footwear: state.footwearId ?? "",
    accessory: state.accessoryIds,
  };
}

function slotByCategory(view: SplitCatalogueView, categoryId: SplitComponentCategory) {
  return view.slots.find((slot) => slot.id === categoryId);
}

export function findOptionInView(view: SplitCatalogueView, id: string | null | undefined): SplitComponentOptionView | null {
  if (!id) return null;
  for (const slot of view.slots) {
    const found = slot.options.find((option) => option.id === id);
    if (found) return found;
  }
  return null;
}

/** Every option for a slot, each carrying its live Verdict. What the UI renders. */
export function optionsFor(view: SplitCatalogueView, state: SplitOutfitState, categoryId: SplitComponentCategory):
  Array<{ option: SplitComponentOptionView; verdict: Verdict }> {
  const slot = slotByCategory(view, categoryId);
  if (!slot) return [];
  const selections = toSelections(state);
  return slot.options.map((option) => ({ option, verdict: evaluateOption(option.rules, selections) }));
}

/**
 * Repairs a state after a change, using the same reconcileSelections engine
 * the server uses — just sourced from the fetched view instead of the full
 * catalogue.
 */
export function reconcile(view: SplitCatalogueView, state: SplitOutfitState): { state: SplitOutfitState; notices: RepairNotice[] } {
  const groups: ReconcileGroup[] = view.slots.map((slot) => ({
    groupId: slot.id,
    multi: slot.multi,
    options: slot.options.map((option) => ({ id: option.id, rules: option.rules })),
  }));

  const { selections, notices } = reconcileSelections(groups, toSelections(state));

  const next: SplitOutfitState = {
    family: state.family,
    upperId: (selections.upper as string) || null,
    lowerId: (selections.lower as string) || null,
    shirtId: (selections["inner-shirt"] as string) || null,
    waistcoatId: (selections["inner-waistcoat"] as string) || null,
    footwearId: (selections.footwear as string) || null,
    accessoryIds: (selections.accessory as string[]) ?? [],
  };

  return { state: next, notices };
}

/** No selected option (in any slot) may have an "incompatible" verdict. */
function isSelectionValid(view: SplitCatalogueView, state: SplitOutfitState): boolean {
  const selections = toSelections(state);
  return view.slots.every((slot) => {
    const value = selections[slot.id];
    const ids = Array.isArray(value) ? value : value ? [value] : [];
    return ids.every((id) => {
      const option = slot.options.find((candidate) => candidate.id === id);
      return option ? evaluateOption(option.rules, selections).status !== "incompatible" : false;
    });
  });
}

function deriveActiveMaterialSlots(view: SplitCatalogueView, state: SplitOutfitState): MaterialSlotState[] {
  const slots: MaterialSlotState[] = [];

  const pushSlotsFor = (option: SplitComponentOptionView | null) => {
    if (!option?.materialRequirements) return;
    for (const requirement of option.materialRequirements) {
      slots.push({
        slotId: requirement.slotId,
        label: requirement.label,
        componentName: option.customer.name,
        fabricSource: requirement.defaultFabricSource,
        description: requirement.description,
      });
    }
  };

  pushSlotsFor(findOptionInView(view, state.upperId));
  pushSlotsFor(findOptionInView(view, state.lowerId));
  pushSlotsFor(findOptionInView(view, state.shirtId));
  pushSlotsFor(findOptionInView(view, state.waistcoatId));

  const accessorySlot = slotByCategory(view, "accessory");
  for (const accessoryOption of accessorySlot?.options ?? []) {
    if (state.accessoryIds.includes(accessoryOption.id)) pushSlotsFor(accessoryOption);
  }

  pushSlotsFor(findOptionInView(view, state.footwearId));

  return slots;
}

/**
 * Client-side equivalent of buildSplitOutfitSummary, built from the fetched
 * view instead of the full server-side catalogue.
 */
export function buildSummaryFromView(view: SplitCatalogueView, state: SplitOutfitState): SplitOutfitSummaryView {
  const upper = findOptionInView(view, state.upperId);
  const lower = findOptionInView(view, state.lowerId);
  const shirt = findOptionInView(view, state.shirtId);
  const waistcoat = findOptionInView(view, state.waistcoatId);
  const footwear = findOptionInView(view, state.footwearId);
  const accessories = state.accessoryIds
    .map((id) => findOptionInView(view, id))
    .filter((option): option is SplitComponentOptionView => option !== null);

  const activeMaterialSlots = deriveActiveMaterialSlots(view, state);

  const requiredFilled = Boolean(upper && lower && shirt && footwear);
  const isRecipeValid = isSelectionValid(view, state);

  return {
    family: view.family,
    upper,
    lower,
    shirt,
    waistcoat,
    footwear,
    accessories,
    activeMaterialSlots,
    isComplete: requiredFilled && isRecipeValid,
  };
}
