import "server-only";

import { createHash } from "node:crypto";
import { get } from "@vercel/blob";
import type { SupportedImageMime } from "@/lib/validation";

/**
 * Split Outfit component construction-reference assets. This is the
 * server-owned abstraction for the isolated single-garment photography
 * identified as a hard content dependency in the Phase 2 architecture
 * inspection (see REFERENCE_ASSET_GAP_MATRIX) — jacket and waistcoat
 * references, per upper design. No assets exist yet: the registry below is
 * intentionally empty, and no fake/placeholder Blob path is ever invented.
 * A component with no registered asset simply has no image authority; the
 * generation compiler falls back to text-only construction instruction for
 * it (see lib/split-outfit/generation-compiler.ts).
 *
 * Trust model mirrors lib/catalog/level1-assets.ts exactly: assets are
 * always resolved server-side from an opaque (componentId, role) pair, never
 * from a browser-supplied path or ID.
 */

export type SplitReferenceAssetRole = "split-upper-construction" | "split-waistcoat-construction";

export type SplitComponentReferenceAsset = {
  /** Opaque asset ID. Never a Blob path; never accepted from the client. */
  id: string;
  /** The SplitComponentOption.id this reference governs, e.g. "SUIT_UPPER_THREE_PIECE". */
  componentId: string;
  role: SplitReferenceAssetRole;
  status: "awaiting-upload" | "active" | "retired";
  privatePath?: string;
  contentType?: SupportedImageMime;
  /** sha256 hex of the stored bytes, verified on every read once set. */
  checksum?: string;
  provenance?: string;
};

export class SplitReferenceAssetError extends Error {
  constructor(
    public readonly code: "asset_pending" | "checksum_mismatch" | "asset_unavailable",
    message: string,
  ) {
    super(message);
    this.name = "SplitReferenceAssetError";
  }
}

/**
 * The registry of known Split component reference assets. Empty until a
 * future ingestion task (mirroring storeApprovedLevel1DesignImage) populates
 * it with real, checksum-tracked, privately-stored photography. Deliberately
 * a plain in-memory structure, not Redis-backed — this milestone builds the
 * abstraction only, per the task's explicit "do not upload/invent assets".
 */
const SPLIT_REFERENCE_ASSET_REGISTRY: ReadonlyMap<string, SplitComponentReferenceAsset> = new Map();

export function findSplitReferenceAsset(
  componentId: string,
  role: SplitReferenceAssetRole,
): SplitComponentReferenceAsset | null {
  for (const asset of SPLIT_REFERENCE_ASSET_REGISTRY.values()) {
    if (asset.componentId === componentId && asset.role === role) return asset;
  }
  return null;
}

const BLOB_TOKEN_ENV = "NASIR_BLOB_READ_WRITE_TOKEN";

function getBlobToken() {
  const token = process.env[BLOB_TOKEN_ENV]?.trim();
  if (!token) throw new SplitReferenceAssetError("asset_unavailable", "Split component reference storage is not configured.");
  return token;
}

export type SplitReferenceAssetReader = (
  asset: SplitComponentReferenceAsset,
) => Promise<{ bytes: Uint8Array; contentType: SupportedImageMime }>;

/**
 * Default reader: fetches the asset's private Blob bytes and verifies the
 * stored sha256 checksum on every read. This closes, for NEW Split assets
 * only, the pre-existing Level 1 gap where a checksum is stored at upload
 * time but never re-verified on retrieval (lib/catalog/level1-assets.ts).
 * Level 1 read behavior is intentionally left unchanged by this milestone.
 */
export const readSplitReferenceAssetFromBlob: SplitReferenceAssetReader = async (asset) => {
  if (asset.status !== "active" || !asset.privatePath || !asset.contentType) {
    throw new SplitReferenceAssetError("asset_pending", "This Split construction reference is not yet available.");
  }
  const blob = await get(asset.privatePath, { access: "private", token: getBlobToken() });
  if (!blob || blob.statusCode !== 200 || !blob.stream) {
    throw new SplitReferenceAssetError("asset_unavailable", "This Split construction reference is temporarily unavailable.");
  }
  const bytes = new Uint8Array(await new Response(blob.stream).arrayBuffer());
  if (asset.checksum) {
    const computed = createHash("sha256").update(bytes).digest("hex");
    if (computed !== asset.checksum) {
      throw new SplitReferenceAssetError("checksum_mismatch", "This Split construction reference failed integrity verification.");
    }
  }
  return { bytes, contentType: asset.contentType };
};

/**
 * Resolves a Split component's construction reference, if one exists and is
 * active. Returns null (not an error) when no reference asset has been
 * produced for this component yet — callers MUST treat that as "fall back
 * to text-only construction instruction" per the Hybrid strategy, not as a
 * failure. `reader` is injectable so tests can exercise the resolution path
 * (including checksum-mismatch/pending/unavailable branches) without any
 * real Blob access.
 */
export async function resolveSplitReferenceAsset(
  componentId: string,
  role: SplitReferenceAssetRole,
  reader: SplitReferenceAssetReader = readSplitReferenceAssetFromBlob,
): Promise<{ asset: SplitComponentReferenceAsset; bytes: Uint8Array; contentType: SupportedImageMime } | null> {
  const asset = findSplitReferenceAsset(componentId, role);
  if (!asset) return null;
  const { bytes, contentType } = await reader(asset);
  return { asset, bytes, contentType };
}
