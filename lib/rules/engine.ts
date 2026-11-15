import type { OptionRule, OptionRuleSet, RepairNotice, Selections, Verdict } from "@/lib/rules/types";

const DEFAULT_INCOMPATIBLE = "Not available with the current selections.";
const DEFAULT_DISCOURAGED = "Unusual with the current selections.";
const DEFAULT_RECOMMENDED = "Recommended with the current selections.";

/**
 * Every rule must match. A multi-select group matches if ANY selected option
 * is listed; a single-select group matches if its selection is listed.
 */
export function matchesRules(selections: Selections, rules: OptionRule[]): boolean {
  return rules.every((rule) => {
    const selected = selections[rule.groupId];
    if (Array.isArray(selected)) return selected.some((id) => rule.optionIds.includes(id));
    return rule.optionIds.includes(selected ?? "");
  });
}

/** A slot/group is hidden entirely unless its visibleWhen rules are satisfied. */
export function isGroupVisible(visibleWhen: OptionRule[] | undefined, selections: Selections): boolean {
  return !visibleWhen?.length || matchesRules(selections, visibleWhen);
}

/** Check order is significant: hard blocks first, then soft flags. */
export function evaluateOption(rules: OptionRuleSet | undefined, selections: Selections): Verdict {
  if (!rules) return { status: "available" };

  if (rules.requires?.length && !matchesRules(selections, rules.requires)) {
    return {
      status: "incompatible",
      reason: rules.reasons?.requires ?? DEFAULT_INCOMPATIBLE,
      blockedBy: rules.requires.map((rule) => rule.groupId),
    };
  }
  if (rules.conflictsWith?.length && matchesRules(selections, rules.conflictsWith)) {
    return {
      status: "incompatible",
      reason: rules.reasons?.conflictsWith ?? DEFAULT_INCOMPATIBLE,
      blockedBy: rules.conflictsWith.map((rule) => rule.groupId),
    };
  }
  if (rules.discouragedWhen?.length && matchesRules(selections, rules.discouragedWhen)) {
    return { status: "discouraged", reason: rules.reasons?.discouragedWhen ?? DEFAULT_DISCOURAGED };
  }
  if (rules.recommendedWhen?.length && matchesRules(selections, rules.recommendedWhen)) {
    return { status: "recommended", reason: rules.reasons?.recommendedWhen ?? DEFAULT_RECOMMENDED };
  }
  return { status: "available" };
}

export function isSelectable(verdict: Verdict): boolean {
  return verdict.status !== "incompatible";
}

export type ReconcileGroup = {
  groupId: string;
  multi: boolean;
  visibleWhen?: OptionRule[];
  /** Options in this group, in display order. */
  options: Array<{ id: string; rules?: OptionRuleSet }>;
};

const MISSING_OPTION_VERDICT: Verdict = {
  status: "incompatible",
  reason: DEFAULT_INCOMPATIBLE,
  blockedBy: [],
};

function verdictReason(verdict: Verdict): string {
  return verdict.status === "incompatible" ? verdict.reason : DEFAULT_INCOMPATIBLE;
}

/**
 * Walks groups in dependency order, keeping only selections that are still
 * valid given the selections accepted so far. Mirrors the existing
 * normalize() in BespokeConfigurator.tsx, but reports what it dropped.
 */
export function reconcileSelections(
  groups: ReconcileGroup[],
  current: Selections,
): { selections: Selections; notices: RepairNotice[] } {
  const accepted: Selections = {};
  const notices: RepairNotice[] = [];

  for (const group of groups) {
    const currentValue = current[group.groupId];

    if (!isGroupVisible(group.visibleWhen, accepted)) {
      if (group.multi) {
        const ids = Array.isArray(currentValue) ? currentValue : [];
        for (const id of ids) {
          notices.push({ groupId: group.groupId, removedOptionId: id, reason: DEFAULT_INCOMPATIBLE });
        }
      } else if (typeof currentValue === "string" && currentValue) {
        notices.push({ groupId: group.groupId, removedOptionId: currentValue, reason: DEFAULT_INCOMPATIBLE });
      }
      continue;
    }

    if (group.multi) {
      const ids = Array.isArray(currentValue) ? currentValue : [];
      const kept: string[] = [];
      accepted[group.groupId] = kept;
      for (const id of ids) {
        const option = group.options.find((item) => item.id === id);
        const verdict = option ? evaluateOption(option.rules, accepted) : MISSING_OPTION_VERDICT;
        if (isSelectable(verdict)) {
          kept.push(id);
        } else {
          notices.push({ groupId: group.groupId, removedOptionId: id, reason: verdictReason(verdict) });
        }
      }
    } else {
      const id = typeof currentValue === "string" ? currentValue : undefined;
      if (id) {
        const option = group.options.find((item) => item.id === id);
        const verdict = option ? evaluateOption(option.rules, accepted) : MISSING_OPTION_VERDICT;
        if (isSelectable(verdict)) {
          accepted[group.groupId] = id;
        } else {
          notices.push({ groupId: group.groupId, removedOptionId: id, reason: verdictReason(verdict) });
        }
      }
    }
  }

  return { selections: accepted, notices };
}
