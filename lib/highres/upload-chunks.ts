import { readBoundedBody, RequestBodyTooLargeError } from "@/lib/request-body";
import { withUploadLease } from "./upload-control";
import "server-only";
import { r2Get, r2Put, r2Delete } from "@/lib/r2-storage";
import { UPLOAD_CHUNK_BYTES } from "@/lib/highres/upload-config";
import { getUploadSlot, type UploadSlot } from "@/lib/highres/ledger";
import { HighResolutionUploadError } from "@/lib/highres/upload-error";

export function uploadChunkPath(slot: UploadSlot, index: number) {
  return slot.pathname + ".chunks/" + index;
}

export function expectedChunkBytes(slot: UploadSlot, index: number) {
  const count = Math.ceil(slot.bytes / UPLOAD_CHUNK_BYTES);
  if (!Number.isInteger(index) || index < 0 || index >= count) {
    throw new HighResolutionUploadError("Invalid upload part.", 400);
  }
  return Math.min(UPLOAD_CHUNK_BYTES, slot.bytes - index * UPLOAD_CHUNK_BYTES);
}

export async function writeUploadChunk(username: string, id: string, index: number, request: Request) {
  return withUploadLease(username, "parts", 4, async () => {
    const slot = await getUploadSlot(id);
    if (!slot || slot.username !== username) throw new HighResolutionUploadError("Upload not found.", 404);
    if (slot.status !== "authorized") throw new HighResolutionUploadError("This upload is already complete.", 409);
    if (new Date(slot.expiresAt).getTime() < Date.now()) throw new HighResolutionUploadError("This upload session expired.", 410);
    const expected = expectedChunkBytes(slot, index);
    let bytes: Uint8Array;
    try { bytes = await readBoundedBody(request, expected); }
    catch (error) {
      if (error instanceof RequestBodyTooLargeError) throw new HighResolutionUploadError("The upload part is too large.", 413);
      throw error;
    }
    if (bytes.byteLength !== expected) throw new HighResolutionUploadError("The upload part is incomplete.", 400);
    // A slow request may have started before another request completed the slot.
    const current = await getUploadSlot(id);
    if (!current || current.status !== "authorized") throw new HighResolutionUploadError("This upload is already complete.", 409);
    if (new Date(current.expiresAt).getTime() < Date.now()) throw new HighResolutionUploadError("This upload session expired.", 410);
    await r2Put(uploadChunkPath(slot, index), bytes, "application/octet-stream");
    const after = await getUploadSlot(id);
    if (!after || after.status !== "authorized" || new Date(after.expiresAt).getTime() < Date.now()) {
      // Completion only reads chunks and writes the separate immutable master.
      // A late duplicate part must not leave a new orphan behind that completion.
      await r2Delete(uploadChunkPath(slot, index)).catch(() => undefined);
      throw new HighResolutionUploadError("This upload is already complete or expired.", 409);
    }
  });
}

export async function readUploadChunks(slot: UploadSlot) {
  const parts: Uint8Array[] = [];
  for (let index = 0; index < Math.ceil(slot.bytes / UPLOAD_CHUNK_BYTES); index++) {
    const response = await r2Get(uploadChunkPath(slot, index));
    if (!response.ok) throw new HighResolutionUploadError("The upload is incomplete. Please choose the image again.", 400);
    const part = new Uint8Array(await response.arrayBuffer());
    if (part.byteLength !== expectedChunkBytes(slot, index)) throw new HighResolutionUploadError("The upload part size changed.", 400);
    parts.push(part);
  }
  return new Uint8Array(Buffer.concat(parts));
}

export async function removeUploadChunks(slot: UploadSlot) {
  await Promise.all(Array.from({ length: Math.ceil(slot.bytes / UPLOAD_CHUNK_BYTES) }, (_, index) =>
    r2Delete(uploadChunkPath(slot, index))));
}
