import "server-only";

import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";
import { DEFAULT_LEVEL1_CATALOGUE } from "@/lib/catalog/level1-seed";
import {
  type CuratedAsset,
  type CuratedCategory,
  type Level1Catalogue,
  type Level1CatalogueView,
  Level1CatalogueError,
  type ResolvedLevel1Design,
} from "@/lib/catalog/level1-types";

const CATALOGUE_KEY = "nasir-tryon:catalog:level1:v1";

let memoryCatalogue: Level1Catalogue | null = null;
let redisCache: { key: string; redis: Redis } | null = null;

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const key = createHash("sha256").update(`${url}:${token}`).digest("hex");
  if (!redisCache || redisCache.key !== key) redisCache = { key, redis: new Redis({ url, token }) };
  return redisCache.redis;
}

function cloneDefault() {
  return structuredClone(DEFAULT_LEVEL1_CATALOGUE);
}

function isStoredCatalogue(value: unknown): value is Level1Catalogue {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return record.version === 1 && Array.isArray(record.categories) && Array.isArray(record.designs) && Array.isArray(record.assets);
}

export async function getLevel1Catalogue(): Promise<Level1Catalogue> {
  const redis = getRedis();
  if (!redis) {
    memoryCatalogue ??= cloneDefault();
    return memoryCatalogue;
  }
  const stored = await redis.get<unknown>(CATALOGUE_KEY);
  if (isStoredCatalogue(stored)) return stored;
  const initial = cloneDefault();
  await redis.set(CATALOGUE_KEY, initial);
  return initial;
}

function activeCategories(catalogue: Level1Catalogue) {
  return catalogue.categories.filter((category): category is CuratedCategory => category.status === "active").sort((a, b) => a.sortOrder - b.sortOrder);
}

function findAsset(catalogue: Level1Catalogue, assetId: string) {
  return catalogue.assets.find((asset) => asset.id === assetId);
}

export async function getLevel1CatalogueView(): Promise<Level1CatalogueView> {
  const catalogue = await getLevel1Catalogue();
  const categories = activeCategories(catalogue);
  const activeCategoryIds = new Set(categories.map((category) => category.id));
  const designs = catalogue.designs
    .filter((design) => design.status === "active" && activeCategoryIds.has(design.categoryId))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((design) => {
      const card = findAsset(catalogue, design.assetIds.card);
      const primary = findAsset(catalogue, design.assetIds.primaryConstruction);
      return {
        id: design.id,
        categoryId: design.categoryId,
        name: design.customer.name,
        description: design.customer.description,
        intent: design.customer.intent,
        sortOrder: design.sortOrder,
        cardImage: card?.status === "active"
          ? { state: "ready" as const, url: `/api/catalog-assets/${encodeURIComponent(card.id)}` }
          : { state: "awaiting-approval" as const },
        generation: primary?.status === "active"
          ? { state: "ready" as const }
          : { state: "awaiting-approved-reference" as const },
      };
    });
  return {
    categories: categories.map(({ id, name, description, sortOrder }) => ({ id, name, description, sortOrder })),
    designs,
  };
}

export async function resolveLevel1Design(categoryId: string, designId: string): Promise<ResolvedLevel1Design> {
  const catalogue = await getLevel1Catalogue();
  const category = catalogue.categories.find((item) => item.id === categoryId);
  if (!category) throw new Level1CatalogueError("unknown_selection", "Please choose a valid curated category.");
  const design = catalogue.designs.find((item) => item.id === designId);
  if (!design) throw new Level1CatalogueError("unknown_selection", "Please choose a valid curated design.");
  if (design.categoryId !== category.id) throw new Level1CatalogueError("category_design_mismatch", "That design does not belong to the selected category.");
  if (category.status !== "active" || design.status !== "active") throw new Level1CatalogueError("inactive_design", "This curated design is not currently available.");
  const primaryAsset = findAsset(catalogue, design.assetIds.primaryConstruction);
  if (!primaryAsset || primaryAsset.status !== "active" || !primaryAsset.privatePath || !primaryAsset.contentType) {
    throw new Level1CatalogueError("asset_pending", "This design is awaiting its approved catalogue reference and cannot be generated yet.");
  }
  const detailAssets = design.assetIds.details
    .map((assetId) => findAsset(catalogue, assetId))
    .filter((asset): asset is CuratedAsset => Boolean(asset && asset.status === "active" && asset.privatePath && asset.contentType))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .slice(0, Math.max(0, design.generation.maximumReferenceImages - 1));
  return { category, design, primaryAsset, detailAssets };
}

export async function getActiveLevel1Asset(assetId: string) {
  const catalogue = await getLevel1Catalogue();
  const asset = catalogue.assets.find((item) => item.id === assetId);
  if (!asset || asset.status !== "active" || !asset.privatePath || !asset.contentType) return null;
  const trustedDesignPrefix = `nasir-bespoke/catalogue/level1/v1/${asset.designId}/`;
  const trustedAssetPrefix = `nasir-bespoke/catalogue/level1/v1/${asset.id}/`;
  if (
    (!asset.privatePath.startsWith(trustedDesignPrefix) && !asset.privatePath.startsWith(trustedAssetPrefix))
    || asset.privatePath.includes("..")
  ) return null;
  return asset;
}

/**
 * Deliberately server-only: future approved-asset tooling can use this to map a
 * verified upload to an existing asset ID without exposing paths to clients.
 */
export async function replaceLevel1Catalogue(catalogue: Level1Catalogue) {
  const redis = getRedis();
  if (!redis) {
    memoryCatalogue = structuredClone(catalogue);
    return;
  }
  await redis.set(CATALOGUE_KEY, catalogue);
}

export function resetLevel1CatalogueForTests() {
  if (process.env.NODE_ENV === "test") memoryCatalogue = null;
}
