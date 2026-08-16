import "server-only";

import { createHash } from "node:crypto";
import { get, put } from "@vercel/blob";
import { getLevel1Catalogue, getActiveLevel1Asset, replaceLevel1Catalogue } from "@/lib/catalog/level1-store";
import type { CuratedAsset, CuratedAssetPurpose } from "@/lib/catalog/level1-types";
import type { SupportedImageMime } from "@/lib/validation";

const BLOB_TOKEN_ENV = "NASIR_BLOB_READ_WRITE_TOKEN";
const ALLOWED_TYPES = new Set<SupportedImageMime>(["image/jpeg", "image/png", "image/webp"]);

export class CuratedAssetStorageError extends Error {
  constructor(message = "Private catalogue asset storage is not configured.") {
    super(message);
    this.name = "CuratedAssetStorageError";
  }
}

function getBlobToken() {
  const token = process.env[BLOB_TOKEN_ENV]?.trim();
  if (!token) throw new CuratedAssetStorageError();
  return token;
}

function extensionFor(contentType: SupportedImageMime) {
  return contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
}

function canonicalPath(asset: CuratedAsset, contentType: SupportedImageMime) {
  const suffix = asset.purpose === "detail" ? asset.id : "approved";
  return `nasir-bespoke/catalogue/level1/v1/${asset.designId}/${suffix}.${extensionFor(contentType)}`;
}

export async function getPrivateLevel1Asset(assetId: string) {
  const asset = await getActiveLevel1Asset(assetId);
  if (!asset) return null;
  const blob = await get(asset.privatePath as string, { access: "private", token: getBlobToken() });
  return { asset, blob };
}

/** Server-only approved-asset activation for a future internal ingestion tool. */
export async function storeApprovedLevel1Asset(input: {
  assetId: string;
  purpose: CuratedAssetPurpose;
  file: File;
  provenance: string;
}) {
  const contentType = input.file.type as SupportedImageMime;
  if (!ALLOWED_TYPES.has(contentType)) throw new CuratedAssetStorageError("Approved catalogue assets must be JPG, PNG, or WebP images.");
  const catalogue = await getLevel1Catalogue();
  const current = catalogue.assets.find((asset) => asset.id === input.assetId && asset.purpose === input.purpose);
  if (!current) throw new CuratedAssetStorageError("The supplied approved asset ID is not recognized.");
  const token = getBlobToken();
  const bytes = new Uint8Array(await input.file.arrayBuffer());
  const privatePath = canonicalPath(current, contentType);
  await put(privatePath, new Blob([bytes], { type: contentType }), {
    access: "private",
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
    // Private blobs are only read through authenticated application routes.
    // Blob requires cache configuration of at least one minute; the route
    // response itself remains private and no-store.
    cacheControlMaxAge: 60,
    contentType,
  });
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const nextAsset: CuratedAsset = { ...current, status: "active", privatePath, contentType, checksum, provenance: input.provenance.trim() || "approved Nasir Bespoke catalogue source" };
  await replaceLevel1Catalogue({ ...catalogue, assets: catalogue.assets.map((asset) => asset.id === current.id ? nextAsset : asset) });
  return nextAsset;
}

/**
 * Server-only ingestion helper for the five approved Level 1 design images.
 * One approved catalogue image intentionally powers both the customer-facing
 * card and the construction reference until Nasir Bespoke supplies separate
 * detail photography. This keeps future activation to five controlled files,
 * without treating the display image as an uncontrolled browser upload.
 */
export async function storeApprovedLevel1DesignImage(input: {
  designId: string;
  file: File;
  provenance: string;
}) {
  const contentType = input.file.type as SupportedImageMime;
  if (!ALLOWED_TYPES.has(contentType)) throw new CuratedAssetStorageError("Approved catalogue assets must be JPG, PNG, or WebP images.");

  const catalogue = await getLevel1Catalogue();
  const design = catalogue.designs.find((item) => item.id === input.designId);
  if (!design) throw new CuratedAssetStorageError("The supplied curated design ID is not recognized.");

  const assetIds = new Set([design.assetIds.card, design.assetIds.primaryConstruction]);
  const linkedAssets = catalogue.assets.filter((asset) => assetIds.has(asset.id));
  if (linkedAssets.length !== assetIds.size) throw new CuratedAssetStorageError("The curated design asset mapping is incomplete.");

  const token = getBlobToken();
  const bytes = new Uint8Array(await input.file.arrayBuffer());
  const privatePath = `nasir-bespoke/catalogue/level1/v1/${design.id}/approved.${extensionFor(contentType)}`;
  await put(privatePath, new Blob([bytes], { type: contentType }), {
    access: "private",
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
    contentType,
  });
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const provenance = input.provenance.trim() || "approved Nasir Bespoke catalogue source";
  await replaceLevel1Catalogue({
    ...catalogue,
    assets: catalogue.assets.map((asset) => assetIds.has(asset.id)
      ? { ...asset, status: "active", privatePath, contentType, checksum, provenance }
      : asset),
  });
  return { designId: design.id, assetIds: [...assetIds], privatePath, checksum };
}
