import "server-only";

import { createHash } from "node:crypto";
import { isR2Configured, presignR2Url, r2Delete, r2Get, r2Put } from "@/lib/r2-storage";
import { detectImageDimensions } from "@/lib/validation";

export type GenerationAssetKey = "person" | "outfit" | "fabric" | "lower-fabric" | "shirt-fabric" | "waistcoat-fabric" | "result" | "upper" | "lower" | "subtype" | "turban" | "shoes" | "upper-style" | "lower-style" | "turban-style" | "shoe-style" | "bespoke-detail-1" | "bespoke-detail-2" | "curated-design" | "curated-detail" | "split-upper" | "split-lower" | "split-shirt" | "split-waistcoat" | "split-footwear";

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
  references: Array<{ role: Exclude<GenerationAssetKey, "person" | "outfit" | "fabric" | "lower-fabric" | "shirt-fabric" | "waistcoat-fabric" | "result">; file: File }>;
  resultBytes: Uint8Array;
  resultContentType: string;
};

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

async function putPrivate(path: string, body: Blob, contentType: string) {
  await r2Put(path, body, contentType);
}

async function describeAsset(body: Blob, contentType: string) {
  const bytes = new Uint8Array(await body.arrayBuffer());
  const mime = contentType === "image/png" || contentType === "image/webp" || contentType === "image/jpeg"
    ? contentType
    : undefined;
  const dimensions = mime ? detectImageDimensions(bytes.subarray(0, 512 * 1024), mime) : null;
  return {
    bytes: bytes.byteLength,
    checksum: createHash("sha256").update(bytes).digest("hex"),
    ...(dimensions ? { width: dimensions.width, height: dimensions.height } : {}),
  };
}

export async function storeGenerationAssets(input: GenerationAssetInput): Promise<GenerationAssetRefs | null> {
  if (!isGenerationStorageConfigured()) return null;

  const uploaded: string[] = [];
  try {
    const entries: Array<[GenerationAssetKey, Blob, string]> = [
      ["person", input.person, input.person.type || "image/jpeg"],
      ...(input.outfit ? [["outfit", input.outfit, input.outfit.type || "image/jpeg"] as [GenerationAssetKey, Blob, string]] : []),
      ...(input.fabric ? [["fabric", input.fabric, input.fabric.type || "image/jpeg"] as [GenerationAssetKey, Blob, string]] : []),
      ...(input.lowerFabric ? [["lower-fabric", input.lowerFabric, input.lowerFabric.type || "image/jpeg"] as [GenerationAssetKey, Blob, string]] : []),
      ...(input.shirtFabric ? [["shirt-fabric", input.shirtFabric, input.shirtFabric.type || "image/jpeg"] as [GenerationAssetKey, Blob, string]] : []),
      ...(input.waistcoatFabric ? [["waistcoat-fabric", input.waistcoatFabric, input.waistcoatFabric.type || "image/jpeg"] as [GenerationAssetKey, Blob, string]] : []),
      ...input.references.map(({ role, file }) => [role, file, file.type || "image/jpeg"] as [GenerationAssetKey, Blob, string]),
      ["result", new Blob([new Uint8Array(input.resultBytes)]), input.resultContentType],
    ];
    const refs: GenerationAssetRefs = {};
    for (const [asset, body, contentType] of entries) {
      const path = pathname(input.generationId, asset, contentType);
      const metadata = await describeAsset(body, contentType);
      await putPrivate(path, body, contentType);
      uploaded.push(path);
      refs[asset] = { pathname: path, contentType, ...metadata };
    }
    return refs;
  } catch (error) {
    await Promise.all(uploaded.map((path) => r2Delete(path).catch(() => undefined)));
    throw error;
  }
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
