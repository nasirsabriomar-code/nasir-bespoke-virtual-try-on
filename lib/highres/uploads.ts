import "server-only";

import { createHash } from "node:crypto";
import { r2Delete, r2Get, r2Put } from "@/lib/r2-storage";
import { isGenerationStorageConfigured } from "@/lib/generation-storage";
import { readUploadChunks, removeUploadChunks } from "@/lib/highres/upload-chunks";
import { validateImageFile } from "@/lib/validation";
import {
  type UploadRole,
  type UploadSlot,
  deleteUploadSlot,
  getUploadSlot,
  listExpiredUploadSlots,
  markUploadComplete,
} from "@/lib/highres/ledger";

import { HighResolutionUploadError } from "@/lib/highres/upload-error";
export { HighResolutionUploadError } from "@/lib/highres/upload-error";

const EXPIRED_UPLOAD_GRACE_MS = 60 * 60_000;
const EXPIRED_UPLOAD_BATCH = 500;

export function assertHighResolutionStorage() {
  if (!isGenerationStorageConfigured()) throw new HighResolutionUploadError("Private image storage is not configured.", 503);
}

function extension(type: string) {
  return type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
}

async function readSlotBlob(slot: UploadSlot) {
  const response = await r2Get(slot.pathname);
  if (!response.ok || !response.body) throw new HighResolutionUploadError("The uploaded image is unavailable. Please upload it again.", 404);
  const bytes = new Uint8Array(await response.arrayBuffer());
  return { bytes, contentType: response.headers.get("content-type") || slot.contentType };
}

export async function completeUploadForUser(username: string, id: string) {
  const slot = await getUploadSlot(id);
  if (!slot || slot.username !== username) throw new HighResolutionUploadError("Upload not found.", 404);
  if (slot.status === "consumed") throw new HighResolutionUploadError("This upload has already been used. Please choose the image again.", 409);
  if (new Date(slot.expiresAt).getTime() < Date.now()) throw new HighResolutionUploadError("This upload session expired. Please choose the image again.", 410);
  if (slot.status === "uploaded" && slot.checksum) return slot;
  // An existing master is one this function wrote from chunks before a crash
  // could mark the slot complete. Check its declared size before buffering it.
  const response = await r2Get(slot.pathname);
  const fromChunks = response.status === 404;
  if (!fromChunks) {
    const declared = Number(response.headers.get("content-length"));
    if (!Number.isFinite(declared) || declared !== slot.bytes) {
      await response.body?.cancel().catch(() => undefined);
      throw new HighResolutionUploadError("The uploaded image size did not match the approved upload.", 400);
    }
  }
  const bytes = fromChunks ? await readUploadChunks(slot) : new Uint8Array(await response.arrayBuffer());
  const contentType = fromChunks ? slot.contentType : response.headers.get("content-type") || slot.contentType;
  if (bytes.byteLength !== slot.bytes) throw new HighResolutionUploadError("The uploaded image size did not match the approved upload.", 400);
  const file = new File([bytes], `${slot.role}.${extension(contentType)}`, { type: contentType });
  const validated = await validateImageFile(file, "an uploaded image");
  if (validated.mime !== slot.contentType) throw new HighResolutionUploadError("The uploaded image type did not match the approved upload.", 400);
  const checksum = createHash("sha256").update(bytes).digest("hex");
  if (fromChunks) await r2Put(slot.pathname, bytes, slot.contentType);
  const completed = await markUploadComplete(id, { checksum, width: validated.width, height: validated.height });
  if (!completed) throw new HighResolutionUploadError("Upload not found.", 404);
  if (fromChunks) await removeUploadChunks(slot);
  return completed;
}

export async function uploadSlotToFile(slot: UploadSlot) {
  const { bytes, contentType } = await readSlotBlob(slot);
  const file = new File([bytes], `${slot.role}.${extension(contentType)}`, { type: contentType });
  const validated = await validateImageFile(file, "an uploaded image");
  const checksum = createHash("sha256").update(bytes).digest("hex");
  if (slot.checksum && checksum !== slot.checksum) throw new HighResolutionUploadError("The uploaded image changed after validation.", 409);
  return validated;
}

export async function removeConsumedUploadObjects(slots: UploadSlot[]) {
  await Promise.all(slots.map((slot) => r2Delete(slot.pathname).catch(() => undefined)));
}

/** Removes abandoned uploads. The grace period keeps a slot consumed just before expiry safe. */
export async function removeExpiredUploads(now = Date.now()) {
  const slots = await listExpiredUploadSlots(new Date(now - EXPIRED_UPLOAD_GRACE_MS), EXPIRED_UPLOAD_BATCH);
  for (const slot of slots) {
    await r2Delete(slot.pathname);
    await removeUploadChunks(slot);
    await deleteUploadSlot(slot.id);
  }
  return slots.length;
}

export function requiredRolesForRequest(
  mode: string | undefined,
  present: Partial<Record<UploadRole, boolean>>,
): UploadRole[] {
  if (mode === "split") {
    const roles: UploadRole[] = ["person"];
    for (const role of ["fabric", "lowerFabric", "shirtFabric", "waistcoatFabric"] as const) {
      if (present[role]) roles.push(role);
    }
    return roles;
  }
  return [
    "person",
    "fabric",
    ...(mode === "outfit" || present.outfit ? ["outfit" as const] : []),
    ...(present.lowerFabric ? ["lowerFabric" as const] : []),
  ];
}
