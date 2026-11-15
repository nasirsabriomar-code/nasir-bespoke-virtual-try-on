import "server-only";

import { getActiveLevel1Asset } from "@/lib/catalog/level1-store";
import { readLocalCatalogAssetCache } from "@/lib/catalog/local-cache";
import { r2Get } from "@/lib/r2-storage";

export class CuratedAssetStorageError extends Error {
  constructor(message = "Private catalogue asset storage is not configured.") {
    super(message);
    this.name = "CuratedAssetStorageError";
  }
}

export async function getPrivateLevel1Asset(assetId: string) {
  const asset = await getActiveLevel1Asset(assetId);
  if (!asset) return null;
  try {
    const response = await r2Get(asset.privatePath as string);
    if (!response.ok || !response.body) return null;
    return { asset, blob: { statusCode: response.status, stream: response.body, blob: { contentType: response.headers.get("content-type") ?? asset.contentType } } };
  } catch (error) {
    const cached = readLocalCatalogAssetCache(assetId, asset.contentType);
    if (cached) return { asset, blob: cached };
    throw error;
  }
}
