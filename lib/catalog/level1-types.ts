import type { SupportedImageMime } from "@/lib/validation";

export const CURATED_CATEGORY_IDS = [
  "suit",
  "sherwani",
  "bandhgala",
  "nehru-jacket",
  "kurta-set",
  "indo-western",
  "achkan",
] as const;

export const SUIT_DESIGN_IDS = [
  "SUIT_01_CLASSIC",
  "SUIT_02_TUXEDO",
  "SUIT_03_STATEMENT",
  "SUIT_04_DOUBLE_BREASTED",
  "SUIT_05_THREE_PIECE",
] as const;

export const SHERWANI_DESIGN_IDS = [
  "SHERWANI_01_CLASSIC",
  "SHERWANI_02_LAYERED",
  "SHERWANI_03_JODHPURI",
  "SHERWANI_04_ASYMMETRIC",
  "SHERWANI_05_ROYAL",
] as const;

export const BANDHGALA_DESIGN_IDS = [
  "BANDHGALA_01_CLASSIC",
  "BANDHGALA_02_DOUBLE_BREASTED",
  "BANDHGALA_03_VELVET",
  "BANDHGALA_04_TEXTURED",
  "BANDHGALA_05_STATEMENT",
] as const;

export const NEHRU_DESIGN_IDS = [
  "NEHRU_01_CLASSIC",
  "NEHRU_02_FORMAL",
  "NEHRU_03_TEXTURED",
  "NEHRU_04_CONTEMPORARY",
  "NEHRU_05_STATEMENT",
] as const;

export const KURTA_DESIGN_IDS = [
  "KURTA_01_CLASSIC",
  "KURTA_02_PATHANI",
  "KURTA_03_LAYERED",
  "KURTA_04_FESTIVE",
  "KURTA_05_CONTEMPORARY",
] as const;

export const INDO_WESTERN_DESIGN_IDS = [
  "INDO_01_CLASSIC",
  "INDO_02_ASYMMETRIC",
  "INDO_03_LAYERED",
  "INDO_04_DRAPED",
  "INDO_05_STATEMENT",
] as const;

export const ACHKAN_DESIGN_IDS = [
  "ACHKAN_01_CLASSIC",
  "ACHKAN_02_JODHPURI",
  "ACHKAN_03_ASYMMETRIC",
  "ACHKAN_04_EMBROIDERED",
  "ACHKAN_05_ROYAL",
] as const;

export const CURATED_DESIGN_IDS = [
  ...SUIT_DESIGN_IDS,
  ...SHERWANI_DESIGN_IDS,
  ...BANDHGALA_DESIGN_IDS,
  ...NEHRU_DESIGN_IDS,
  ...KURTA_DESIGN_IDS,
  ...INDO_WESTERN_DESIGN_IDS,
  ...ACHKAN_DESIGN_IDS,
] as const;

export type CuratedCategoryId = (typeof CURATED_CATEGORY_IDS)[number];
export type SuitDesignId = (typeof SUIT_DESIGN_IDS)[number];
export type SherwaniDesignId = (typeof SHERWANI_DESIGN_IDS)[number];
export type BandhgalaDesignId = (typeof BANDHGALA_DESIGN_IDS)[number];
export type NehruDesignId = (typeof NEHRU_DESIGN_IDS)[number];
export type KurtaDesignId = (typeof KURTA_DESIGN_IDS)[number];
export type IndoWesternDesignId = (typeof INDO_WESTERN_DESIGN_IDS)[number];
export type AchkanDesignId = (typeof ACHKAN_DESIGN_IDS)[number];
export type CuratedDesignId = (typeof CURATED_DESIGN_IDS)[number];
export type CuratedStatus = "draft" | "active" | "retired";
export type CuratedAssetStatus = "awaiting-upload" | "active" | "retired";
export type CuratedAssetPurpose = "card" | "primary-construction" | "detail";

export type CuratedCategory = {
  id: CuratedCategoryId;
  name: string;
  description: string;
  status: CuratedStatus;
  sortOrder: number;
};

export type CuratedAsset = {
  id: string;
  designId: CuratedDesignId;
  purpose: CuratedAssetPurpose;
  status: CuratedAssetStatus;
  privatePath?: string;
  contentType?: SupportedImageMime;
  checksum?: string;
  provenance?: string;
  sortOrder: number;
};

export type CuratedDesign = {
  id: CuratedDesignId;
  version: 1;
  categoryId: CuratedCategoryId;
  status: CuratedStatus;
  sortOrder: number;
  customer: {
    name: string;
    description: string;
    intent: string;
  };
  blueprint: {
    garmentFamily: string;
    silhouette: string[];
    includedPieces: string[];
    construction: Record<string, string | string[]>;
    stylingPolicy: "preserve-existing-accessories";
    bodyFitPolicy: "adapt-garment-to-customer";
  };
  assetIds: {
    card: string;
    primaryConstruction: string;
    details: string[];
  };
  generation: {
    promptFragments: string[];
    negativeConstraints: string[];
    maximumReferenceImages: 2;
  };
};

export type Level1Catalogue = {
  version: 1;
  categories: CuratedCategory[];
  designs: CuratedDesign[];
  assets: CuratedAsset[];
};

export type Level1CatalogueDesignView = {
  id: CuratedDesignId;
  categoryId: CuratedCategoryId;
  name: string;
  description: string;
  intent: string;
  sortOrder: number;
  cardImage: {
    state: "ready" | "awaiting-approval";
    url?: string;
  };
  generation: {
    state: "ready" | "awaiting-approved-reference";
  };
};

export type Level1CatalogueView = {
  categories: Array<Pick<CuratedCategory, "id" | "name" | "description" | "sortOrder">>;
  designs: Level1CatalogueDesignView[];
};

export type ResolvedLevel1Design = {
  category: CuratedCategory;
  design: CuratedDesign;
  primaryAsset: CuratedAsset;
  detailAssets: CuratedAsset[];
};

export class Level1CatalogueError extends Error {
  constructor(
    public readonly code: "unknown_selection" | "category_design_mismatch" | "inactive_design" | "asset_pending" | "asset_unavailable",
    message: string,
  ) {
    super(message);
    this.name = "Level1CatalogueError";
  }
}

export function isCuratedCategoryId(value: string): value is CuratedCategoryId {
  return CURATED_CATEGORY_IDS.includes(value as CuratedCategoryId);
}

export function isCuratedDesignId(value: string): value is CuratedDesignId {
  return (CURATED_DESIGN_IDS as readonly string[]).includes(value);
}
