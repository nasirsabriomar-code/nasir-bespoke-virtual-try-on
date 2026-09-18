/** One condition: the named group's selection must be one of optionIds. */
export type OptionRule = {
  groupId: string;
  optionIds: string[];
};

/**
 * A group's selection. A string for single-select groups, an array for
 * multi-select ones (Split Outfit's accessories). Bespoke only ever uses strings.
 */
export type Selections = Record<string, string | string[]>;

/** Optional human-readable text explaining why a rule blocked or flagged an option. */
export type RuleReasons = {
  requires?: string;
  conflictsWith?: string;
  recommendedWhen?: string;
  discouragedWhen?: string;
};

/** The rule surface an option may declare. All fields optional and additive. */
export type OptionRuleSet = {
  requires?: OptionRule[];
  conflictsWith?: OptionRule[];
  recommendedWhen?: OptionRule[];
  discouragedWhen?: OptionRule[];
  reasons?: RuleReasons;
};

export type Verdict =
  | { status: "available" }
  | { status: "recommended"; reason: string }
  | { status: "discouraged"; reason: string }
  | { status: "incompatible"; reason: string; blockedBy: string[] };

/** Emitted when reconcile() drops a selection that a change invalidated. */
export type RepairNotice = {
  groupId: string;
  removedOptionId: string;
  reason: string;
};
