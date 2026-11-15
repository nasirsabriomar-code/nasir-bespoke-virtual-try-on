import { reconcileSelections, type ReconcileGroup } from "@/lib/rules/engine";
import type { OptionRuleSet, RepairNotice, Selections } from "@/lib/rules/types";
import type {
  MaterialSlotState,
  SplitComponentOption,
  SplitComponentOptionView,
  SplitOutfitState,
} from "./types";

type SplitOptionLike = Pick<SplitComponentOption, "customer" | "materialRequirements">
  | Pick<SplitComponentOptionView, "customer" | "materialRequirements">;

export function hasRealWaistcoat(state: SplitOutfitState): boolean {
  return Boolean(state.waistcoatId && state.waistcoatId !== "SUIT_WAISTCOAT_NONE");
}

export function isWaistcoatRequiredForState(state: SplitOutfitState): boolean {
  return state.upperId === "SUIT_UPPER_THREE_PIECE";
}

export function hasRequiredSplitSelections(state: SplitOutfitState): boolean {
  const baseRequired = Boolean(state.upperId && state.lowerId && state.shirtId && state.footwearId);
  if (!baseRequired) return false;
  return !isWaistcoatRequiredForState(state) || hasRealWaistcoat(state);
}

/** Maps the named-field state onto the generic Selections record the rule engine consumes. */
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

export function reconcileFromGroups(
  groups: ReconcileGroup[],
  state: SplitOutfitState,
): { state: SplitOutfitState; notices: RepairNotice[] } {
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

export function deriveActiveMaterialSlotsFromResolver<T extends SplitOptionLike>(
  state: SplitOutfitState,
  resolveOption: (id: string | null | undefined) => T | null,
  resolveAccessories: () => T[],
): MaterialSlotState[] {
  const slots: MaterialSlotState[] = [];

  const pushSlotsFor = (option: T | null) => {
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

  pushSlotsFor(resolveOption(state.upperId));
  pushSlotsFor(resolveOption(state.lowerId));
  pushSlotsFor(resolveOption(state.shirtId));
  pushSlotsFor(resolveOption(state.waistcoatId));
  for (const accessoryOption of resolveAccessories()) {
    pushSlotsFor(accessoryOption);
  }
  pushSlotsFor(resolveOption(state.footwearId));

  return slots;
}

export type ReconcileSlotInput = {
  id: string;
  multi: boolean;
  options: Array<{ id: string; rules?: OptionRuleSet }>;
};
