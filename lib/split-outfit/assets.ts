import "server-only";

import { existsSync, createReadStream } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { get } from "@vercel/blob";
import type { SplitOptionReference } from "./types";

const BLOB_TOKEN_ENV = "NASIR_BLOB_READ_WRITE_TOKEN";

export class SplitAssetStorageError extends Error {
  constructor(message = "Private split-outfit asset storage is not configured.") {
    super(message);
    this.name = "SplitAssetStorageError";
  }
}

function getBlobToken() {
  const token = process.env[BLOB_TOKEN_ENV]?.trim();
  if (!token || token === "[SENSITIVE]") throw new SplitAssetStorageError();
  return token;
}

function extensionFor(contentType: string) {
  return contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
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
    const blob = await get(reference.privatePath, { access: "private", token: getBlobToken() });
    return { reference, blob };
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      const exts = [extensionFor(reference.contentType), "png", "jpg", "jpeg", "webp"];
      for (const ext of exts) {
        const localCachePath = path.join(process.cwd(), ".cache/catalog-assets", `${reference.assetId}.${ext}`);
        if (existsSync(localCachePath)) {
          const stream = Readable.toWeb(createReadStream(localCachePath));
          return {
            reference,
            blob: {
              statusCode: 200,
              stream: stream as unknown as ReadableStream,
              blob: { contentType: reference.contentType },
            },
          };
        }
      }
    }
    throw error;
  }
}
