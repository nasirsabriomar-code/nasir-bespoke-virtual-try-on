import "server-only";

import { createHash } from "node:crypto";
import sharp from "sharp";
import { isR2Configured, presignR2Url, r2Get, r2Put } from "@/lib/r2-storage";
import { detectImageDimensions } from "@/lib/validation";

export type GenerationAssetKey = "person" | "outfit" | "fabric" | "lower-fabric" | "shirt-fabric" | "waistcoat-fabric" | "result" | "result-thumb" | "upper" | "lower" | "subtype" | "turban" | "shoes" | "upper-style" | "lower-style" | "turban-style" | "shoe-style" | "bespoke-detail-1" | "bespoke-detail-2" | "curated-design" | "curated-detail" | "split-upper" | "split-lower" | "split-shirt" | "split-waistcoat" | "split-footwear";

export type GenerationAssetRefs = Partial<Record<GenerationAssetKey, {
  pathname: string;
  contentType: string;
  bytes?: number;
  checksum?: string;
  width?: number;
  height?: number;
}>>;

export type GenerationAssetInput = {
  generationId: string;
  person: File;
  outfit?: File;
  fabric?: File;
  lowerFabric?: File;
  shirtFabric?: File;
  waistcoatFabric?: File;
  references: Array<{ role: Exclude<GenerationAssetKey, "person" | "outfit" | "fabric" | "lower-fabric" | "shirt-fabric" | "waistcoat-fabric" | "result" | "result-thumb">; file: File }>;
  resultBytes: Uint8Array;
  resultContentType: string;
};

const PUT_ATTEMPTS = 3;
/** Longest edge of the history-list preview. The list shows it at 60px tall, so 320px covers 3x screens. */
export const RESULT_THUMB_EDGE = 320;
const PUT_RETRY_DELAY_MS = 150;

export class GenerationStorageConfigurationError extends Error {
  constructor() {
    super("Private generation image storage is not configured.");
    this.name = "GenerationStorageConfigurationError";
  }
}

export function isGenerationStorageConfigured() {
  return isR2Configured();
}

function extensionFor(contentType: string) {
  return contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
}

function pathname(generationId: string, asset: GenerationAssetKey, contentType = "image/jpeg") {
  return `nasir-bespoke/generations/${generationId}/${asset}.${extensionFor(contentType)}`;
}

export function isGenerationAssetPath(path: string, generationId: string, asset: GenerationAssetKey, contentType?: string) {
  return contentType
    ? path === pathname(generationId, asset, contentType)
    : /^nasir-bespoke\/generations\/[0-9a-f-]{36}\/[a-z0-9-]+\.(jpg|png|webp)$/i.test(path) && path.startsWith(`nasir-bespoke/generations/${generationId}/${asset}.`);
}

async function putPrivate(path: string, body: Blob | Uint8Array, contentType: string) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await r2Put(path, body, contentType);
      return;
    } catch (error) {
      if (attempt >= PUT_ATTEMPTS) throw error;
      await new Promise((resolve) => setTimeout(resolve, PUT_RETRY_DELAY_MS * attempt));
    }
  }
}

/**
 * A small WebP preview for the history list. The full PNG stays the master copy;
 * the list used to download every full result (several MB each) just to show a 60px tile.
 */
export async function createResultThumbnail(bytes: Uint8Array) {
  return new Uint8Array(await sharp(bytes, { failOn: "error", limitInputPixels: 40_000_000 })
    .rotate()
    .resize({ width: RESULT_THUMB_EDGE, height: RESULT_THUMB_EDGE, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 78 })
    .toBuffer());
}

async function describeAsset(body: Blob | Uint8Array, contentType: string) {
  const bytes = body instanceof Uint8Array ? body : new Uint8Array(await body.arrayBuffer());
  const mime = contentType === "image/png" || contentType === "image/webp" || contentType === "image/jpeg"
    ? contentType
    : undefined;
  const dimensions = mime ? detectImageDimensions(bytes.subarray(0, 512 * 1024), mime) : null;
  return {
    rawBytes: bytes,
    metadata: {
      bytes: bytes.byteLength,
      checksum: createHash("sha256").update(bytes).digest("hex"),
      ...(dimensions ? { width: dimensions.width, height: dimensions.height } : {}),
    },
  };
}

export async function storeGenerationAssets(input: GenerationAssetInput): Promise<GenerationAssetRefs | null> {
  if (!isGenerationStorageConfigured()) return null;

  const store = async (refs: GenerationAssetRefs, asset: GenerationAssetKey, body: Blob | Uint8Array, contentType: string) => {
    const path = pathname(input.generationId, asset, contentType);
    const { rawBytes, metadata } = await describeAsset(body, contentType);
    await putPrivate(path, rawBytes, contentType);
    refs[asset] = { pathname: path, contentType, ...metadata };
  };

  // The paid result goes first, and only its failure fails the save. A missing
  // input or reference copy must never cost the customer's finished image.
  const refs: GenerationAssetRefs = {};
  await store(refs, "result", input.resultBytes, input.resultContentType);

  // The preview is a convenience. If it fails, the history list falls back to the full result.
  try {
    await store(refs, "result-thumb", await createResultThumbnail(input.resultBytes), "image/webp");
  } catch (error) {
    console.error("generation_asset_store_failed", {
      generationId: input.generationId,
      asset: "result-thumb",
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
  }

  const entries: Array<[GenerationAssetKey, Blob, string]> = [
    ["person", input.person, input.person.type || "image/jpeg"],
    ...(input.outfit ? [["outfit", input.outfit, input.outfit.type || "image/jpeg"] as [GenerationAssetKey, Blob, string]] : []),
    ...(input.fabric ? [["fabric", input.fabric, input.fabric.type || "image/jpeg"] as [GenerationAssetKey, Blob, string]] : []),
    ...(input.lowerFabric ? [["lower-fabric", input.lowerFabric, input.lowerFabric.type || "image/jpeg"] as [GenerationAssetKey, Blob, string]] : []),
    ...(input.shirtFabric ? [["shirt-fabric", input.shirtFabric, input.shirtFabric.type || "image/jpeg"] as [GenerationAssetKey, Blob, string]] : []),
    ...(input.waistcoatFabric ? [["waistcoat-fabric", input.waistcoatFabric, input.waistcoatFabric.type || "image/jpeg"] as [GenerationAssetKey, Blob, string]] : []),
    ...input.references.map(({ role, file }) => [role, file, file.type || "image/jpeg"] as [GenerationAssetKey, Blob, string]),
  ];
  await Promise.all(entries.map(async ([asset, body, contentType]) => {
    try {
      await store(refs, asset, body, contentType);
    } catch (error) {
      console.error("generation_asset_store_failed", {
        generationId: input.generationId,
        asset,
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
    }
  }));
  return refs;
}

export async function getPrivateGenerationAsset(path: string) {
  const response = await r2Get(path);
  if (response.status === 404) return null;
  if (!response.ok || !response.body) throw new Error(`R2 read failed with status ${response.status}.`);
  return { statusCode: response.status, stream: response.body, blob: { contentType: response.headers.get("content-type") ?? undefined } };
}

export async function getPrivateGenerationAssetUrl(path: string) {
  return presignR2Url(path, "GET", 5 * 60);
}
