import { HighResolutionUploadError } from "@/lib/highres/upload-error";
import { AuthConfigurationError } from "@/lib/auth/config";
import { readBoundedBody, RequestBodyTooLargeError } from "@/lib/request-body";
import { checkUploadRateLimit } from "@/lib/rate-limit";
import { withUploadLease } from "@/lib/highres/upload-control";
import { createHash } from "node:crypto";
import { requireRequestUser } from "@/lib/auth/session";
import { isSameOriginRequest } from "@/lib/request-security";
import { recoveryManifest } from "@/lib/catalog/recovery";
import { r2Get, r2Put } from "@/lib/r2-storage";

export const maxDuration = 120;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    if (!await requireRequestUser(request)) return Response.json({ error: "Sign in required." }, { status: 401 });
    const manifest = await recoveryManifest();
    return Response.json({ assets: manifest.map(({ id, checksum, contentType }) => ({ id, checksum, contentType })) },
      { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    if (error instanceof AuthConfigurationError) return Response.json({ error: "Authentication is not configured." }, { status: 503 });
    console.error("catalogue_recovery_manifest_failed", { errorName: error instanceof Error ? error.name : "UnknownError" });
    return Response.json({ error: "Catalogue recovery is temporarily unavailable." }, { status: 503 });
  }
}

async function restore(request: Request) {
  if (!isSameOriginRequest(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  const user = await requireRequestUser(request);
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  const admission = await checkUploadRateLimit(user.username, "complete");
  if (!admission.allowed) return Response.json({ error: "Too many recovery requests." }, { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil((admission.resetAt - Date.now()) / 1000))) } });
  return withUploadLease(user.username, "recovery", 1, async () => {
  const id = new URL(request.url).searchParams.get("id");
  const asset = (await recoveryManifest()).find(a => a.id === id);
  if (!asset) return Response.json({ error: "Approved reference not found." }, { status: 404 });
  const bytes = await readBoundedBody(request, 4 * 1024 * 1024);
  if (createHash("sha256").update(bytes).digest("hex") !== asset.checksum) {
    return Response.json({ error: "This file does not match the approved reference." }, { status: 400 });
  }
  const existing = await r2Get(asset.privatePath);
  if (existing.ok) {
    const current = new Uint8Array(await existing.arrayBuffer());
    if (createHash("sha256").update(current).digest("hex") !== asset.checksum) {
      return Response.json({ error: "Existing reference differs; review is required." }, { status: 409 });
    }
  } else {
    await r2Put(asset.privatePath, bytes, asset.contentType);
  }
  const verify = await r2Get(asset.privatePath);
  if (!verify.ok || createHash("sha256").update(new Uint8Array(await verify.arrayBuffer())).digest("hex") !== asset.checksum) {
    return Response.json({ error: "Storage verification failed." }, { status: 503 });
  }
  return Response.json({ restored: true, id: asset.id }, { headers: { "Cache-Control": "no-store, private" } });
  });
}

export async function POST(request: Request) {
  try {
    const response = await restore(request);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    const status = error instanceof HighResolutionUploadError ? error.status : error instanceof RequestBodyTooLargeError ? 413
      : error instanceof DOMException && error.name === "TimeoutError" ? 408 : 503;
    return Response.json({ error: status === 408 ? "Upload timed out. Please retry." : status === 413 ? "Reference exceeds 4 MB." : "Recovery is temporarily unavailable." }, { status, headers: { "Cache-Control": "private, no-store", ...(status === 429 ? { "Retry-After": "1" } : {}) } });
  }
}
