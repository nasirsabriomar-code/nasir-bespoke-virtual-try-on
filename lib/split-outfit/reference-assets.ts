import "server-only";

import { createHash } from "node:crypto";
import { get } from "@vercel/blob";
import { detectImageMime, type SupportedImageMime } from "@/lib/validation";

/**
 * Split Outfit component construction-reference assets. This is the
 * server-owned abstraction for the isolated single-garment photography
 * identified as a hard content dependency in the Phase 2 architecture
 * inspection — jacket and waistcoat references, per upper design. No real
 * assets exist yet: the registry below is intentionally empty/pending, and
 * no fake/placeholder Blob path is ever invented. A component with no
 * ACTIVE registered asset has no resolvable image authority; whether that
 * is acceptable depends on the component's SplitReferencePolicy (see
 * lib/split-outfit/reference-policy.ts) — TEXT_ONLY components simply have
 * none, while REQUIRED components make a generation fail readiness (see
 * computeSplitGenerationReadiness in generation-compiler.ts). Draft
 * compilation may still describe an unresolved REQUIRED authority; only
 * provider-ready compilation enforces the policy.
 *
 * Trust model mirrors lib/catalog/level1-assets.ts: assets are always
 * resolved server-side from an opaque (componentId, role) pair, never from
 * a browser-supplied path, asset ID, or checksum.
 */

export type SplitReferenceAssetRole = "split-upper-construction" | "split-waistcoat-construction";

export type SplitReferenceAssetStatus = "pending" | "active" | "inactive";

export type SplitComponentReferenceAsset = {
  /** Opaque asset ID. Never a Blob path; never accepted from the client. */
  id: string;
  /** The SplitComponentOption.id this reference governs, e.g. "SUIT_UPPER_THREE_PIECE". */
  componentId: string;
  role: SplitReferenceAssetRole;
  /**
   * pending: registered but no bytes uploaded yet (or explicitly withheld).
   * active: uploaded, verified at ingestion, eligible for generation.
   * inactive: deliberately disabled (e.g. superseded, under review) —
   *   never used for generation even though bytes may still exist in Blob.
   * Only ACTIVE assets may ever be used for generation.
   */
  status: SplitReferenceAssetStatus;
  privatePath?: string;
  contentType?: SupportedImageMime;
  /** sha256 hex of the stored bytes, verified on every read once set. */
  checksum?: string;
  provenance?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type SplitReferenceAssetErrorCode =
  | "asset_pending"
  | "asset_unavailable"
  | "checksum_mismatch"
  | "content_mismatch";

export class SplitReferenceAssetError extends Error {
  constructor(
    public readonly code: SplitReferenceAssetErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SplitReferenceAssetError";
  }
}

/**
 * Server-owned mapping for the eight Suit v1 REQUIRED construction-reference
 * slots (5 uppers + 3 waistcoats — exactly the set returned by
 * getRequiredSuitComponentIds() in reference-policy.ts). Empty/pending in
 * this milestone because no real photography exists yet; the shape below
 * is what a future ingestion task populates via registerSplitReferenceAsset
 * (lib/split-outfit/reference-ingestion.ts) — no application code elsewhere
 * needs to change when real assets are added.
 *
 * Deliberately a plain in-memory structure, not Redis-backed, matching the
 * Phase 2a precedent — this is architecture, not live content storage.
 */
const SPLIT_REFERENCE_ASSET_REGISTRY = new Map<string, SplitComponentReferenceAsset>();

function registryKey(componentId: string, role: SplitReferenceAssetRole) {
  return `${role}:${componentId}`;
}

export function findSplitReferenceAsset(
  componentId: string,
  role: SplitReferenceAssetRole,
): SplitComponentReferenceAsset | null {
  return SPLIT_REFERENCE_ASSET_REGISTRY.get(registryKey(componentId, role)) ?? null;
}

/**
 * Registers (or replaces) a Split component reference asset's metadata
 * record. Does NOT touch Blob storage — this only updates the in-memory
 * registry entry. Used by the ingestion pipeline after a successful private
 * upload. Exported (not just used internally) so tests can seed the
 * registry with injected/mock entries without any real Blob access.
 */
export function upsertSplitReferenceAsset(asset: SplitComponentReferenceAsset): void {
  SPLIT_REFERENCE_ASSET_REGISTRY.set(registryKey(asset.componentId, asset.role), asset);
}

export function resetSplitReferenceAssetRegistryForTests(): void {
  SPLIT_REFERENCE_ASSET_REGISTRY.clear();
}

const BLOB_TOKEN_ENV = "NASIR_BLOB_READ_WRITE_TOKEN";

export function getBlobToken() {
  const token = process.env[BLOB_TOKEN_ENV]?.trim();
  if (!token) throw new SplitReferenceAssetError("asset_unavailable", "Split component reference storage is not configured.");
  return token;
}

export type SplitReferenceAssetReader = (
  asset: SplitComponentReferenceAsset,
) => Promise<{ bytes: Uint8Array; contentType: SupportedImageMime }>;

/**
 * Default reader: fetches the asset's private Blob bytes, verifies the
 * stored sha256 checksum, and cross-checks the declared content type
 * against the bytes' actual detected magic-byte MIME — fails closed on any
 * mismatch. This is mandatory, unconditional checksum enforcement for NEW
 * Split assets (closing the pre-existing Level 1 gap where a checksum is
 * stored at upload time but never re-verified on retrieval). Level 1 read
 * behavior is intentionally left unchanged by this milestone.
 */
export const readSplitReferenceAssetFromBlob: SplitReferenceAssetReader = async (asset) => {
  if (asset.status !== "active" || !asset.privatePath || !asset.contentType || !asset.checksum) {
    throw new SplitReferenceAssetError("asset_pending", "This Split construction reference is not yet available.");
  }
  const blob = await get(asset.privatePath, { access: "private", token: getBlobToken() });
  if (!blob || blob.statusCode !== 200 || !blob.stream) {
    throw new SplitReferenceAssetError("asset_unavailable", "This Split construction reference is temporarily unavailable.");
  }
  const bytes = new Uint8Array(await new Response(blob.stream).arrayBuffer());

  const computed = createHash("sha256").update(bytes).digest("hex");
  if (computed !== asset.checksum) {
    throw new SplitReferenceAssetError("checksum_mismatch", "This Split construction reference failed integrity verification.");
  }

  const detected = detectImageMime(bytes.slice(0, 32));
  if (detected !== asset.contentType) {
    throw new SplitReferenceAssetError("content_mismatch", "This Split construction reference failed integrity verification.");
  }

  return { bytes, contentType: asset.contentType };
};

/**
 * Resolves a Split component's construction reference. Returns `null` only
 * when no registry entry exists at all for this (componentId, role) pair —
 * callers treat that as "no reference has been produced yet." Throws
 * `SplitReferenceAssetError` for a registered-but-not-ready entry (pending/
 * inactive/unavailable) or a failed integrity check — these are distinct
 * from "never registered" because they represent a real, actionable content
 * problem rather than an expected absence. `reader` is injectable so tests
 * can exercise every branch without any real Blob access.
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
