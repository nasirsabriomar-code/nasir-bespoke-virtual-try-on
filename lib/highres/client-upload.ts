import { UPLOAD_CHUNK_BYTES } from "./upload-config";
import { fetchUploadWithTimeout } from "@/lib/generation-recovery";
export type ClientUploadRole = "person" | "fabric" | "lowerFabric" | "shirtFabric" | "waistcoatFabric";
export const UPLOAD_STORAGE_PREFIX = "nasir-upload-v1:";
type Checkpoint = { id: string; expiresAt: number; nextPart: number };
type Options = { accountId: string; signal?: AbortSignal; storage?: Storage; onBytes?: (bytes: number) => void; onPhase?: (phase: "uploading" | "validating") => void };
export async function uploadOriginal(role: ClientUploadRole, file: File, onProgress: (progress: number) => void, options: Options) {
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()))).map(x => x.toString(16).padStart(2, "0")).join("");
  const key = `${UPLOAD_STORAGE_PREFIX}${encodeURIComponent(options.accountId)}:${role}:${hash}`;
  let storage = options.storage;
  try { storage ??= sessionStorage; } catch { /* Persistence is optional. */ }
  const clear = () => { try { storage?.removeItem(key); } catch { /* Storage unavailable. */ } };
  const save = (value: Checkpoint) => { try { storage?.setItem(key, JSON.stringify(value)); } catch { /* Storage unavailable. */ } };
  const count = Math.ceil(file.size / UPLOAD_CHUNK_BYTES);
  let checkpoint: Checkpoint | null = null;
  try {
    const value = JSON.parse(storage?.getItem(key) ?? "null");
    if (value && typeof value.id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.id) && Number.isFinite(value.expiresAt) && value.expiresAt > Date.now() && Number.isInteger(value.nextPart) && value.nextPart >= 0 && value.nextPart <= count) checkpoint = value;
  } catch { clear(); }
  const request = (url: string, init: RequestInit) => fetchUploadWithTimeout(url, { ...init, credentials: "same-origin", signal: options.signal });
  if (checkpoint) {
    const response = await request(`/api/try-on/uploads/${checkpoint.id}`, { method: "GET" });
    if (response.ok) {
      const slot = await response.json();
      if (slot.status === "uploaded") { options.onBytes?.(file.size); onProgress(100); return checkpoint.id; }
      if (slot.status !== "authorized" || slot.bytes !== file.size || slot.role !== role) { clear(); checkpoint = null; }
    } else if ([404, 409, 410].includes(response.status)) { clear(); checkpoint = null; }
    else throw new Error("Couldn't check the interrupted upload. Please try again.");
  }
  if (!checkpoint) {
    const response = await request("/api/try-on/uploads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role, filename: file.name, contentType: file.type, bytes: file.size }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.id || !payload.expiresAt) throw new Error(payload.error || "Couldn't prepare this upload.");
    checkpoint = { id: payload.id, expiresAt: new Date(payload.expiresAt).getTime(), nextPart: 0 }; save(checkpoint);
  }
  options.onPhase?.("uploading");
  options.onBytes?.(Math.min(checkpoint.nextPart * UPLOAD_CHUNK_BYTES, file.size));
  for (let index = checkpoint.nextPart; index < count; index++) {
    for (let attempt = 0; ; attempt++) {
      options.signal?.throwIfAborted();
      let response: Response;
      try {
        response = await request(`/api/try-on/uploads/${checkpoint.id}/parts/${index}`, { method: "PUT", headers: { "Content-Type": "application/octet-stream" }, body: file.slice(index * UPLOAD_CHUNK_BYTES, (index + 1) * UPLOAD_CHUNK_BYTES) });
      } catch (error) {
        if (options.signal?.aborted || attempt >= 2) throw error;
        await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1))); continue;
      }
      if (response.ok) break;
      if ([408, 502, 503, 504].includes(response.status) && attempt < 2) { await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1))); continue; }
      const payload = await response.json().catch(() => ({}));
      if ([404, 409, 410].includes(response.status)) clear();
      throw new Error(payload.error || "Couldn't upload this image part.");
    }
    checkpoint.nextPart = index + 1; save(checkpoint);
    options.onBytes?.(Math.min((index + 1) * UPLOAD_CHUNK_BYTES, file.size));
    onProgress(Math.round((index + 1) * 100 / count));
  }
  options.onPhase?.("validating");
  const completed = await request(`/api/try-on/uploads/${checkpoint.id}/complete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  const payload = await completed.json().catch(() => ({}));
  if (!completed.ok) { if ([400, 404, 409, 410].includes(completed.status)) clear(); throw new Error(payload.error || "Couldn't validate this upload."); }
  return checkpoint.id;
}
