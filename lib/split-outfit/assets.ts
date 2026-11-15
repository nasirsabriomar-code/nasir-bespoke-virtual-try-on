import "server-only";

import { readLocalCatalogAssetCache } from "@/lib/catalog/local-cache";
import { r2Get } from "@/lib/r2-storage";
import type { SplitOptionReference } from "./types";

export class SplitAssetStorageError extends Error {
  constructor(message = "Private split-outfit asset storage is not configured.") {
    super(message);
    this.name = "SplitAssetStorageError";
  }
}

/**
 * Confines a reference's privatePath to the canonical split-catalogue prefix
 * for its own assetId — the same "don't trust stored data blindly" rule
 * Level 1 applies via getActiveLevel1Asset, even though this reference comes
 * from a static in-code catalogue today rather than Redis.
 */
function isTrustedPath(reference: SplitOptionReference) {
  if (!reference.privatePath) return false;
  const trustedPrefix = `nasir-bespoke/catalogue/split/v1/${reference.assetId}/`;
  return reference.privatePath.startsWith(trustedPrefix) && !reference.privatePath.includes("..");
}

/**
 * Reads an active split-outfit reference photograph from private Blob, with
 * the same local-dev-cache fallback Level 1 uses (.cache/catalog-assets/) so
 * a reference can be exercised locally before real Blob credentials exist.
 * Returns null for anything not active/trusted — callers must not fall back
 * to a public or fabricated source.
 */
export async function getPrivateSplitAsset(reference: SplitOptionReference) {
  if (reference.status !== "active" || !reference.privatePath || !reference.contentType || !isTrustedPath(reference)) {
    return null;
  }
  try {
    const response = await r2Get(reference.privatePath);
    if (!response.ok || !response.body) return null;
    return { reference, blob: { statusCode: response.status, stream: response.body, blob: { contentType: response.headers.get("content-type") ?? reference.contentType } } };
  } catch (error) {
    const cached = readLocalCatalogAssetCache(reference.assetId, reference.contentType);
    if (cached) return { reference, blob: cached };
    throw error;
  }
}
