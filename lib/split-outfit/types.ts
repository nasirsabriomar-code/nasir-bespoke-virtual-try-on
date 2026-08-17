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

export type CompatibilityStatus =
  | "REQUIRED"
  | "ALLOWED"
  | "RECOMMENDED"
  | "OPTIONAL"
  | "DISALLOWED"
  | "CONDITIONAL";

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
  id: string;
  categoryId: SplitComponentCategory;
  family: SplitOutfitFamily;
  name: string;
  subtitle?: string;
  description: string;
  details?: string[];
  imagePlaceholderLabel: string;
  imageAssetPath?: string;
  constructionReferencePath?: string;
  materialRequirements?: MaterialRequirement[];
  compatibilityTags?: string[];
  defaultStatus?: CompatibilityStatus;
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
  materials: Record<string, string>;
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
