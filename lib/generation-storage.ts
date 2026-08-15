import "server-only";

import { del, get, put } from "@vercel/blob";

const BLOB_TOKEN_ENV = "NASIR_BLOB_READ_WRITE_TOKEN";

export type GenerationAssetKey = "person" | "outfit" | "fabric" | "result" | "upper" | "lower" | "subtype" | "turban" | "shoes" | "upper-style" | "lower-style" | "turban-style" | "shoe-style" | "bespoke-detail-1" | "bespoke-detail-2";

export type GenerationAssetRefs = Partial<Record<GenerationAssetKey, {
  pathname: string;
  contentType: string;
}>>;

export type GenerationAssetInput = {
  generationId: string;
  person: File;
  outfit?: File;
  fabric: File;
  references: Array<{ role: Exclude<GenerationAssetKey, "person" | "outfit" | "fabric" | "result">; file: File }>;
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

function pathname(generationId: string, asset: GenerationAssetKey) {
  return `nasir-bespoke/generations/${generationId}/${asset}.jpg`;
}

export function isGenerationAssetPath(path: string, generationId: string, asset: GenerationAssetKey) {
  return path === pathname(generationId, asset);
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

export async function storeGenerationAssets(input: GenerationAssetInput): Promise<GenerationAssetRefs | null> {
  if (!isGenerationStorageConfigured()) return null;

  const uploaded: string[] = [];
  try {
    const token = getBlobToken();
    const entries: Array<[GenerationAssetKey, Blob, string]> = [
      ["person", input.person, input.person.type || "image/jpeg"],
      ...(input.outfit ? [["outfit", input.outfit, input.outfit.type || "image/jpeg"] as [GenerationAssetKey, Blob, string]] : []),
      ["fabric", input.fabric, input.fabric.type || "image/jpeg"],
      ...input.references.map(({ role, file }) => [role, file, file.type || "image/jpeg"] as [GenerationAssetKey, Blob, string]),
      ["result", new Blob([new Uint8Array(input.resultBytes)]), input.resultContentType],
    ];
    const refs: GenerationAssetRefs = {};
    for (const [asset, body, contentType] of entries) {
      const path = pathname(input.generationId, asset);
      await putPrivate(path, body, contentType, token);
      uploaded.push(path);
      refs[asset] = { pathname: path, contentType };
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
