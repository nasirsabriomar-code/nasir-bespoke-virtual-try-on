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

export type CuratedCategoryId = (typeof CURATED_CATEGORY_IDS)[number];
export type SuitDesignId = (typeof SUIT_DESIGN_IDS)[number];
export type CuratedDesignId = SuitDesignId;
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
  categoryId: "suit";
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
  categoryId: "suit";
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
  return SUIT_DESIGN_IDS.includes(value as CuratedDesignId);
}
