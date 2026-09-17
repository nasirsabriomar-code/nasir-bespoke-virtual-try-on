import "server-only";

import { createHash } from "node:crypto";
import { del, get, issueSignedToken, presignUrl, put } from "@vercel/blob";
import { detectImageDimensions } from "@/lib/validation";

const BLOB_TOKEN_ENV = "NASIR_BLOB_READ_WRITE_TOKEN";

export type GenerationAssetKey = "person" | "outfit" | "fabric" | "lower-fabric" | "result" | "upper" | "lower" | "subtype" | "turban" | "shoes" | "upper-style" | "lower-style" | "turban-style" | "shoe-style" | "bespoke-detail-1" | "bespoke-detail-2" | "curated-design" | "curated-detail";

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
  fabric: File;
  lowerFabric?: File;
  references: Array<{ role: Exclude<GenerationAssetKey, "person" | "outfit" | "fabric" | "lower-fabric" | "result">; file: File }>;
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
  return Boolean(process.env[BLOB_TOKEN_ENV]?.trim());
}

function getBlobToken() {
  const token = process.env[BLOB_TOKEN_ENV]?.trim();
  if (!token) throw new GenerationStorageConfigurationError();
  return token;
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

async function putPrivate(path: string, body: Blob, contentType: string, token: string) {
  return put(path, body, {
    access: "private",
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType,
    cacheControlMaxAge: 0,
  });
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
    const token = getBlobToken();
    const entries: Array<[GenerationAssetKey, Blob, string]> = [
      ["person", input.person, input.person.type || "image/jpeg"],
      ...(input.outfit ? [["outfit", input.outfit, input.outfit.type || "image/jpeg"] as [GenerationAssetKey, Blob, string]] : []),
      ["fabric", input.fabric, input.fabric.type || "image/jpeg"],
      ...(input.lowerFabric ? [["lower-fabric", input.lowerFabric, input.lowerFabric.type || "image/jpeg"] as [GenerationAssetKey, Blob, string]] : []),
      ...input.references.map(({ role, file }) => [role, file, file.type || "image/jpeg"] as [GenerationAssetKey, Blob, string]),
      ["result", new Blob([new Uint8Array(input.resultBytes)]), input.resultContentType],
    ];
    const refs: GenerationAssetRefs = {};
    for (const [asset, body, contentType] of entries) {
      const path = pathname(input.generationId, asset, contentType);
      const metadata = await describeAsset(body, contentType);
      await putPrivate(path, body, contentType, token);
      uploaded.push(path);
      refs[asset] = { pathname: path, contentType, ...metadata };
    }
    return refs;
  } catch (error) {
    const token = process.env[BLOB_TOKEN_ENV]?.trim();
    await Promise.all(uploaded.map((path) => del(path, token ? { token } : undefined).catch(() => undefined)));
    throw error;
  }
}

export async function getPrivateGenerationAsset(path: string) {
  const token = getBlobToken();
  return get(path, { access: "private", token });
}

export async function getPrivateGenerationAssetUrl(path: string) {
  const token = getBlobToken();
  const validUntil = Date.now() + 5 * 60_000;
  const signedToken = await issueSignedToken({ token, pathname: path, operations: ["get"], validUntil });
  const result = await presignUrl(signedToken, { access: "private", pathname: path, operation: "get", validUntil });
  return result.presignedUrl;
}
