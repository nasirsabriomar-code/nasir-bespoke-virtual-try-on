import "server-only";

import { createHash } from "node:crypto";
import { r2Delete, r2Get } from "@/lib/r2-storage";
import { isGenerationStorageConfigured } from "@/lib/generation-storage";
import { validateImageFile } from "@/lib/validation";
import {
  type UploadRole,
  type UploadSlot,
  getUploadSlot,
  markUploadComplete,
} from "@/lib/highres/ledger";

export class HighResolutionUploadError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "HighResolutionUploadError";
  }
}

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
  const { bytes, contentType } = await readSlotBlob(slot);
  if (bytes.byteLength !== slot.bytes) throw new HighResolutionUploadError("The uploaded image size did not match the approved upload.", 400);
  const file = new File([bytes], `${slot.role}.${extension(contentType)}`, { type: contentType });
  const validated = await validateImageFile(file, "an uploaded image");
  if (validated.mime !== slot.contentType) throw new HighResolutionUploadError("The uploaded image type did not match the approved upload.", 400);
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const completed = await markUploadComplete(id, { checksum, width: validated.width, height: validated.height });
  if (!completed) throw new HighResolutionUploadError("Upload not found.", 404);
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
