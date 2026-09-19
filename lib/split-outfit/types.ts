import type { OptionRuleSet } from "@/lib/rules/types";
import type { SupportedImageMime } from "@/lib/validation";

export type VisualTryOnMode = "full" | "split";

export const SPLIT_OUTFIT_FAMILIES = [
  "suit",
  "sherwani",
  "bandhgala",
  "nehru-jacket",
  "kurta-set",
  "indo-western",
  "achkan",
] as const;

export type SplitOutfitFamily = (typeof SPLIT_OUTFIT_FAMILIES)[number];

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
  "SUIT_LOWER_NON_PLEATED",
  "SUIT_LOWER_ONE_PLEAT",
  "SUIT_LOWER_TWO_PLEAT",
  "SUIT_LOWER_THREE_PLEAT",
  "SUIT_LOWER_CASUAL",
  "SUIT_LOWER_DENIM",
  "SUIT_LOWER_GORKHA",
  "SUIT_LOWER_PARALLEL",
  "SUIT_LOWER_BAGGY",
  "SUIT_LOWER_TRENDY",
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

// Jacket, trousers, shirt, waistcoat (except "None"), and footwear carry an
// approved construction photograph. Accessories remain text-only.
export type SplitAssetStatus = "awaiting-upload" | "active";

export type SplitOptionReference = {
  assetId: string;
  status: SplitAssetStatus;
  // SERVER-ONLY. privatePath/checksum must never reach the client view —
  // only `status` does, mirroring how Level 1's CuratedAsset splits into a
  // server-side record and a client-safe "ready"/"awaiting-approval" state.
  privatePath?: string;
  contentType?: SupportedImageMime;
  checksum?: string;
  provenance?: string;
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

  /** SERVER-ONLY (see SplitOptionReference). Present on photographed pieces. */
  reference?: SplitOptionReference;

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

/**
 * The client-safe projection of a SplitComponentOption. Deliberately omits
 * `family` (redundant once scoped to a single fetched view) and, most
 * importantly, the entire `generation` layer — construction/prompt text
 * must never reach the browser. Mirrors how Level1CatalogueView strips
 * `blueprint`/`generation` from CuratedDesign.
 */
export type SplitComponentOptionView = {
  id: SplitOptionId;
  categoryId: SplitComponentCategory;
  customer: SplitComponentOption["customer"];
  rules?: OptionRuleSet;
  compatibilityTags?: string[];
  materialRequirements?: MaterialRequirement[];
  /** Status and same-origin URL only — never the private path, checksum, or provenance. */
  reference?: { status: SplitAssetStatus; url?: string };
};

export type SplitCatalogueSlotView = {
  id: SplitComponentCategory;
  multi: boolean;
  required: boolean;
  options: SplitComponentOptionView[];
};

export type SplitCatalogueView = {
  family: SplitOutfitFamily;
  slots: SplitCatalogueSlotView[];
};

/** Same shape as SplitOutfitSummary, but built from client-safe option views. */
export type SplitOutfitSummaryView = {
  family: SplitOutfitFamily;
  upper: SplitComponentOptionView | null;
  lower: SplitComponentOptionView | null;
  shirt: SplitComponentOptionView | null;
  waistcoat: SplitComponentOptionView | null;
  footwear: SplitComponentOptionView | null;
  accessories: SplitComponentOptionView[];
  activeMaterialSlots: MaterialSlotState[];
  isComplete: boolean;
};
