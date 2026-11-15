import "server-only";

import { createReadStream, existsSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";

function extensionFor(contentType: string): string {
  return contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
}

function contentTypeForExtension(ext: string, fallback: string): string {
  if (fallback) return fallback;
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

export function readLocalCatalogAssetCache(assetId: string, preferredContentType?: string) {
  if (process.env.NODE_ENV === "production") return null;
  const preferredExt = preferredContentType ? extensionFor(preferredContentType) : null;
  const exts = [...new Set([...(preferredExt ? [preferredExt] : []), "png", "jpg", "jpeg", "webp"])];
  for (const ext of exts) {
    const localCachePath = path.join(process.cwd(), ".cache/catalog-assets", `${assetId}.${ext}`);
    if (existsSync(localCachePath)) {
      const stream = Readable.toWeb(createReadStream(localCachePath));
      return {
        statusCode: 200,
        stream: stream as unknown as ReadableStream,
        blob: { contentType: contentTypeForExtension(ext, preferredContentType ?? "") },
      };
    }
  }
  return null;
}
