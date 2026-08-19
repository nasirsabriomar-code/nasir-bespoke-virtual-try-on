import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { put } from "@vercel/blob";
import { detectImageMime, MAX_IMAGE_BYTES, type SupportedImageMime } from "@/lib/validation";
import { findSplitOption } from "./compatibility";
import { getSplitReferencePolicy } from "./reference-policy";
import {
  findSplitReferenceAsset,
  getBlobToken,
  upsertSplitReferenceAsset,
  type SplitComponentReferenceAsset,
  type SplitReferenceAssetRole,
} from "./reference-assets";

/**
 * Safe ingestion tooling for future approved Split component construction-
 * reference images, mirroring lib/catalog/level1-assets.ts's ingestion
 * strengths (magic-byte validation, sha256 checksum, private-only Blob
 * storage, never a client-supplied path) but tailored to component assets:
 * exactly one (componentId, role) pair per asset, and an explicit replace
 * policy rather than silent overwrite.
 *
 * This module is NOT run against any real file in this milestone — it is
 * built and tested (with a mocked `put`) only. No image was uploaded.
 */

const ALLOWED_TYPES = new Set<SupportedImageMime>(["image/jpeg", "image/png", "image/webp"]);

/** The only categories that may ever receive a Split construction reference, and their required role. */
const ROLE_FOR_CATEGORY: Partial<Record<string, SplitReferenceAssetRole>> = {
  upper: "split-upper-construction",
  "inner-waistcoat": "split-waistcoat-construction",
};

export type SplitReferenceIngestionErrorCode =
  | "unsupported_type"
  | "invalid_image"
  | "file_too_large"
  | "unknown_component"
  | "wrong_role_for_component"
  | "component_not_required"
  | "duplicate_asset"
  | "storage_not_configured";

export class SplitReferenceIngestionError extends Error {
  constructor(
    public readonly code: SplitReferenceIngestionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SplitReferenceIngestionError";
  }
}

function extensionFor(contentType: SupportedImageMime) {
  return contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
}

export type BlobPutFn = (
  path: string,
  body: Blob,
  options: {
    access: "private";
    token: string;
    addRandomSuffix: boolean;
    allowOverwrite: boolean;
    cacheControlMaxAge: number;
    contentType: SupportedImageMime;
  },
) => Promise<unknown>;

const defaultBlobPut: BlobPutFn = (path, body, options) => put(path, body, options);

export type IngestSplitReferenceAssetInput = {
  componentId: string;
  role: SplitReferenceAssetRole;
  /** An already-approved local source image, read into a File by the caller (e.g. a future CLI script). */
  file: File;
  provenance: string;
  /**
   * Must be explicitly true to overwrite an existing ACTIVE asset for this
   * (componentId, role). Defaults to false — ingestion never silently
   * clobbers a live reference.
   */
  allowReplace?: boolean;
};

export type IngestSplitReferenceAssetDependencies = {
  /** Injectable for tests — never touches real Blob storage when overridden. */
  putBlob?: BlobPutFn;
  getToken?: () => string;
};

/**
 * Validates, checksums, privately uploads, and registers exactly one Split
 * component construction-reference asset. Throws SplitReferenceIngestionError
 * for any validation failure — nothing is ever partially registered (the
 * registry is only updated after the Blob upload itself succeeds).
 */
export async function ingestSplitReferenceAsset(
  input: IngestSplitReferenceAssetInput,
  dependencies: IngestSplitReferenceAssetDependencies = {},
): Promise<SplitComponentReferenceAsset> {
  const declaredType = input.file.type as SupportedImageMime;
  if (!ALLOWED_TYPES.has(declaredType)) {
    throw new SplitReferenceIngestionError("unsupported_type", "Approved Split reference assets must be JPG, PNG, or WebP images.");
  }
  if (input.file.size === 0) {
    throw new SplitReferenceIngestionError("invalid_image", "The supplied source image is empty.");
  }
  if (input.file.size > MAX_IMAGE_BYTES) {
    throw new SplitReferenceIngestionError("file_too_large", "The supplied source image exceeds the maximum allowed size.");
  }

  const bytes = new Uint8Array(await input.file.arrayBuffer());
  const detected = detectImageMime(bytes.slice(0, 32));
  if (!detected || detected === "image/heic" || detected !== declaredType) {
    throw new SplitReferenceIngestionError("invalid_image", "The image bytes do not match a supported, correctly-declared format.");
  }

  // componentId + role must map to an actual, known, REQUIRED-policy Suit
  // component — this rejects both an unknown component and a component/role
  // mismatch (e.g. a trouser ID, or an upper paired with the waistcoat role)
  // before anything is ever written to Blob or the registry.
  const option = findSplitOption("suit", input.componentId);
  if (!option) {
    throw new SplitReferenceIngestionError("unknown_component", "The supplied component ID is not recognized in the Suit family.");
  }
  const expectedRole = ROLE_FOR_CATEGORY[option.categoryId];
  if (!expectedRole || expectedRole !== input.role) {
    throw new SplitReferenceIngestionError("wrong_role_for_component", "This component does not accept a reference of the supplied role.");
  }
  if (getSplitReferencePolicy(input.componentId) !== "REQUIRED") {
    throw new SplitReferenceIngestionError("component_not_required", "This component's reference policy is not REQUIRED; ingestion is not applicable.");
  }

  const existing = findSplitReferenceAsset(input.componentId, input.role);
  if (existing && existing.status === "active" && !input.allowReplace) {
    throw new SplitReferenceIngestionError(
      "duplicate_asset",
      "An active reference already exists for this component. Pass allowReplace to intentionally replace it.",
    );
  }

  const token = dependencies.getToken ? dependencies.getToken() : getBlobToken();
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const privatePath = `nasir-bespoke/split-outfit/references/v1/${input.role}/${input.componentId}.${extensionFor(declaredType)}`;

  const putBlob = dependencies.putBlob ?? defaultBlobPut;
  await putBlob(privatePath, new Blob([bytes], { type: declaredType }), {
    access: "private",
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
    // Private blobs are only ever read through the checksum-verifying
    // server reader (readSplitReferenceAssetFromBlob) — never a public URL.
    cacheControlMaxAge: 60,
    contentType: declaredType,
  });

  const now = new Date().toISOString();
  const asset: SplitComponentReferenceAsset = {
    id: existing?.id ?? randomUUID(),
    componentId: input.componentId,
    role: input.role,
    status: "active",
    privatePath,
    contentType: declaredType,
    checksum,
    provenance: input.provenance.trim() || "approved Nasir Bespoke Split reference source",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  upsertSplitReferenceAsset(asset);
  return asset;
}
