import type { OptionRuleSet } from "@/lib/rules/types";

export type VisualTryOnMode = "full" | "split";

export type SplitOutfitFamily =
  | "suit"
  | "sherwani"
  | "bandhgala"
  | "nehru-jacket"
  | "kurta-set"
  | "indo-western"
  | "achkan";

export type SplitComponentCategory =
  | "upper"
  | "lower"
  | "inner-shirt"
  | "inner-waistcoat"
  | "footwear"
  | "accessory";

export const SUIT_UPPER_IDS = [
  "SUIT_UPPER_CLASSIC",
  "SUIT_UPPER_DOUBLE_BREASTED",
  "SUIT_UPPER_TUXEDO",
  "SUIT_UPPER_THREE_PIECE",
  "SUIT_UPPER_STATEMENT",
] as const;

export const SUIT_LOWER_IDS = [
  "SUIT_LOWER_CLASSIC_STRAIGHT",
  "SUIT_LOWER_TAILORED_TAPERED",
  "SUIT_LOWER_PLEATED_FORMAL",
  "SUIT_LOWER_TUXEDO_TROUSER",
  "SUIT_LOWER_CONTEMPORARY",
] as const;

export const SUIT_SHIRT_IDS = [
  "SUIT_SHIRT_CLASSIC_FORMAL",
  "SUIT_SHIRT_SPREAD_COLLAR",
  "SUIT_SHIRT_TUXEDO_PLEATED",
] as const;

export const SUIT_WAISTCOAT_IDS = [
  "SUIT_WAISTCOAT_NONE",
  "SUIT_WAISTCOAT_CLASSIC",
  "SUIT_WAISTCOAT_FORMAL",
  "SUIT_WAISTCOAT_TUXEDO",
] as const;

export const SUIT_FOOTWEAR_IDS = [
  "SUIT_SHOE_OXFORD",
  "SUIT_SHOE_DERBY",
  "SUIT_SHOE_LOAFER",
  "SUIT_SHOE_PATENT_OXFORD",
] as const;

export const SUIT_ACCESSORY_IDS = [
  "SUIT_ACC_TIE",
  "SUIT_ACC_BOW_TIE",
  "SUIT_ACC_POCKET_SQUARE",
  "SUIT_ACC_CUFFLINKS",
  "SUIT_ACC_BUTTONS",
] as const;

export const SPLIT_OPTION_IDS = [
  ...SUIT_UPPER_IDS,
  ...SUIT_LOWER_IDS,
  ...SUIT_SHIRT_IDS,
  ...SUIT_WAISTCOAT_IDS,
  ...SUIT_FOOTWEAR_IDS,
  ...SUIT_ACCESSORY_IDS,
] as const;

export type SplitOptionId = (typeof SPLIT_OPTION_IDS)[number];

export type MaterialSlotId =
  | "jacket-primary"
  | "trouser-primary"
  | "shirt-material"
  | "waistcoat-material"
  | "neckwear-material"
  | "pocket-square-material"
  | "cufflinks-finish"
  | "buttons-finish"
  | "footwear-leather";

export type MaterialRequirement = {
  slotId: MaterialSlotId;
  label: string;
  defaultFabricSource: "uploaded-fabric" | "atelier-standard" | "custom";
  description: string;
};

export type SplitComponentOption = {
  id: SplitOptionId;
  categoryId: SplitComponentCategory;
  family: SplitOutfitFamily;

  /** Client-safe presentation copy. */
  customer: {
    name: string;
    subtitle?: string;
    description: string;
    details?: string[];
    imagePlaceholderLabel: string;
  };

  /** Client-safe — the browser needs these to filter options. */
  rules?: OptionRuleSet;
  compatibilityTags?: string[];
  materialRequirements?: MaterialRequirement[];

  /** SERVER-ONLY. Must never reach the client view. */
  generation: {
    constructionFragment: string;
    negativeConstraints?: string[];
  };
};

export type MaterialSlotState = {
  slotId: MaterialSlotId;
  label: string;
  componentName: string;
  fabricSource: "uploaded-fabric" | "atelier-standard" | "custom";
  description: string;
};

export type SplitOutfitState = {
  family: SplitOutfitFamily;
  upperId: string | null;
  lowerId: string | null;
  shirtId: string | null;
  waistcoatId: string | null;
  footwearId: string | null;
  accessoryIds: string[];
};

export type SplitOutfitSummary = {
  family: SplitOutfitFamily;
  upper: SplitComponentOption | null;
  lower: SplitComponentOption | null;
  shirt: SplitComponentOption | null;
  waistcoat: SplitComponentOption | null;
  footwear: SplitComponentOption | null;
  accessories: SplitComponentOption[];
  activeMaterialSlots: MaterialSlotState[];
  isComplete: boolean;
};
