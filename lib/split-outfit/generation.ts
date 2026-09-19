import "server-only";

import { createHash } from "node:crypto";
import { getPrivateSplitAsset } from "./assets";
import { findSplitOption, validateRecipe } from "./compatibility";
import { SPLIT_OUTFIT_FAMILIES } from "./types";
import type { SplitComponentOption, SplitOutfitFamily, SplitOutfitState } from "./types";
import type { TryOnInput } from "@/lib/tryon/types";
import { detectImageMime, validateImageFile } from "@/lib/validation";

export class SplitOutfitError extends Error {
  constructor(
    public readonly code: "malformed" | "invalid_recipe" | "asset_pending",
    message: string,
  ) {
    super(message);
    this.name = "SplitOutfitError";
  }
}

function isSplitOutfitFamily(value: unknown): value is SplitOutfitFamily {
  return typeof value === "string" && (SPLIT_OUTFIT_FAMILIES as readonly string[]).includes(value);
}

function optionalId(value: unknown): string | null {
  if (value === null) return null;
  return typeof value === "string" && value.length > 0 && value.length <= 120 ? value : null;
}

/**
 * Parses the JSON-serialized recipe submitted in the `splitRecipe` form
 * field, mirroring parseSubmittedBespokeConfiguration's shape (a controlled
 * client state object, JSON.stringify'd by the browser, JSON.parse'd here).
 * Only validates shape — compatibility is checked separately by
 * resolveSplitOutfitRecipe via validateRecipe.
 */
export function parseSubmittedSplitRecipe(value: string): SplitOutfitState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    throw new SplitOutfitError("malformed", "The outfit recipe is malformed.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new SplitOutfitError("malformed", "The outfit recipe is malformed.");
  }
  const record = parsed as Record<string, unknown>;
  if (!isSplitOutfitFamily(record.family)) {
    throw new SplitOutfitError("malformed", "Please choose a valid outfit family.");
  }
  const upperId = optionalId(record.upperId);
  const lowerId = optionalId(record.lowerId);
  const shirtId = optionalId(record.shirtId);
  const waistcoatId = optionalId(record.waistcoatId);
  const footwearId = optionalId(record.footwearId);
  const accessoryIdsRaw = record.accessoryIds;
  if (upperId === null && record.upperId !== null) throw new SplitOutfitError("malformed", "The outfit recipe is malformed.");
  if (lowerId === null && record.lowerId !== null) throw new SplitOutfitError("malformed", "The outfit recipe is malformed.");
  if (shirtId === null && record.shirtId !== null) throw new SplitOutfitError("malformed", "The outfit recipe is malformed.");
  if (waistcoatId === null && record.waistcoatId !== null) throw new SplitOutfitError("malformed", "The outfit recipe is malformed.");
  if (footwearId === null && record.footwearId !== null) throw new SplitOutfitError("malformed", "The outfit recipe is malformed.");
  if (!Array.isArray(accessoryIdsRaw) || !accessoryIdsRaw.every((item) => typeof item === "string" && item.length > 0 && item.length <= 120)) {
    throw new SplitOutfitError("malformed", "The outfit recipe is malformed.");
  }
  return {
    family: record.family,
    upperId,
    lowerId,
    shirtId,
    waistcoatId,
    footwearId,
    accessoryIds: accessoryIdsRaw as string[],
  };
}

export type ResolvedSplitOutfit = {
  state: SplitOutfitState;
  upper: SplitComponentOption;
  lower: SplitComponentOption;
  shirt: SplitComponentOption;
  waistcoat: SplitComponentOption | null;
  footwear: SplitComponentOption;
  accessories: SplitComponentOption[];
};

/**
 * Parses and validates a submitted recipe, re-running the same
 * validateRecipe the client used to gate the Generate button — client-side
 * hiding is UX, this is correctness. Fails closed on any invalid recipe,
 * even one the UI should never have been able to produce.
 */
export async function resolveSplitOutfitRecipe(raw: string): Promise<ResolvedSplitOutfit> {
  const state = parseSubmittedSplitRecipe(raw);
  const { valid, violations } = validateRecipe(state);
  if (!valid) {
    throw new SplitOutfitError("invalid_recipe", violations[0]?.reason ?? "This outfit recipe is not valid.");
  }
  const upper = findSplitOption(state.family, state.upperId);
  const lower = findSplitOption(state.family, state.lowerId);
  const shirt = findSplitOption(state.family, state.shirtId);
  const waistcoat = findSplitOption(state.family, state.waistcoatId);
  const footwear = findSplitOption(state.family, state.footwearId);
  const accessories = state.accessoryIds
    .map((id) => findSplitOption(state.family, id))
    .filter((option): option is SplitComponentOption => option !== null);
  // validateRecipe already guarantees every required slot resolved to a real,
  // compatible option — these are non-null by construction, not re-checked.
  if (!upper || !lower || !shirt || !footwear) {
    throw new SplitOutfitError("invalid_recipe", "This outfit recipe is not valid.");
  }
  return { state, upper, lower, shirt, waistcoat, footwear, accessories };
}

export type SplitReferenceRole = "split-upper" | "split-lower" | "split-shirt" | "split-waistcoat" | "split-footwear";

const PIECE_BY_ROLE: Record<SplitReferenceRole, string> = {
  "split-upper": "jacket",
  "split-lower": "trouser",
  "split-shirt": "shirt",
  "split-waistcoat": "waistcoat",
  "split-footwear": "shoe",
};

function pendingReferenceError(role: SplitReferenceRole, detail?: string) {
  const piece = PIECE_BY_ROLE[role];
  return new SplitOutfitError(
    "asset_pending",
    detail ?? `This modular outfit's ${piece} reference photograph is not yet available. Please check back soon, or use Full Outfit for now.`,
  );
}

/**
 * Reads the approved reference photograph for a Split Outfit piece.
 *
 * Fail-closed: awaiting-upload, missing blob, MIME mismatch, or checksum
 * mismatch all become asset_pending. Accessories never call this.
 */
export async function readSplitReference(
  option: SplitComponentOption,
  role: SplitReferenceRole,
): Promise<TryOnInput["references"][number]> {
  const reference = option.reference;
  if (!reference || reference.status !== "active") throw pendingReferenceError(role);

  const privateAsset = await getPrivateSplitAsset(reference);
  const blob = privateAsset?.blob;
  if (!privateAsset || !blob || blob.statusCode !== 200 || !blob.stream) {
    throw pendingReferenceError(role, `This modular outfit's ${PIECE_BY_ROLE[role]} reference photograph is temporarily unavailable. Please try again shortly.`);
  }
  const contentType = reference.contentType;
  if (!contentType) throw pendingReferenceError(role);

  const bytes = new Uint8Array(await new Response(blob.stream).arrayBuffer());
  const detectedMime = detectImageMime(bytes);
  if (detectedMime !== contentType || (blob.blob.contentType && blob.blob.contentType.split(";", 1)[0]?.toLowerCase() !== contentType)) {
    throw new SplitOutfitError("asset_pending", "This modular outfit's reference photograph is invalid. Please contact an administrator.");
  }
  const file = new File([bytes], `${reference.assetId}.${contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg"}`, { type: contentType });
  const validated = await validateImageFile(file, "the approved reference photograph");
  if (reference.checksum && createHash("sha256").update(bytes).digest("hex") !== reference.checksum) {
    throw new SplitOutfitError("asset_pending", "This modular outfit's reference photograph is invalid. Please contact an administrator.");
  }
  return { role, image: { file: validated.file, mime: validated.mime } };
}
