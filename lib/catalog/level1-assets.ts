import "server-only";

import { existsSync, createReadStream } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { createHash } from "node:crypto";
import { r2Get, r2Put } from "@/lib/r2-storage";
import { getLevel1Catalogue, getActiveLevel1Asset, replaceLevel1Catalogue } from "@/lib/catalog/level1-store";
import type { CuratedAsset, CuratedAssetPurpose } from "@/lib/catalog/level1-types";
import type { SupportedImageMime } from "@/lib/validation";

const ALLOWED_TYPES = new Set<SupportedImageMime>(["image/jpeg", "image/png", "image/webp"]);

export class CuratedAssetStorageError extends Error {
  constructor(message = "Private catalogue asset storage is not configured.") {
    super(message);
    this.name = "CuratedAssetStorageError";
  }
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
  try {
    const response = await r2Get(asset.privatePath as string);
    if (!response.ok || !response.body) return null;
    return { asset, blob: { statusCode: response.status, stream: response.body, blob: { contentType: response.headers.get("content-type") ?? asset.contentType } } };
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      const exts = [extensionFor(asset.contentType || "image/png"), "png", "jpg", "jpeg", "webp"];
      for (const ext of exts) {
        const localCachePath = path.join(process.cwd(), ".cache/catalog-assets", `${assetId}.${ext}`);
        if (existsSync(localCachePath)) {
          const stream = Readable.toWeb(createReadStream(localCachePath));
          return {
            asset,
            blob: {
              statusCode: 200,
              stream: stream as unknown as ReadableStream,
              blob: { contentType: asset.contentType || (ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg") },
            },
          };
        }
      }
    }
    throw error;
  }
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
  const bytes = new Uint8Array(await input.file.arrayBuffer());
  const privatePath = canonicalPath(current, contentType);
  await r2Put(privatePath, new Blob([bytes], { type: contentType }), contentType);
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
  await r2Put(privatePath, new Blob([bytes], { type: contentType }), contentType);
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
