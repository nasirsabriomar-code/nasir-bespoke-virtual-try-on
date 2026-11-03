import { checkUploadRateLimit } from "@/lib/rate-limit";
import { AuthConfigurationError } from "@/lib/auth/config";
import { requireRequestUser } from "@/lib/auth/session";
import { createUploadSlot, type UploadRole } from "@/lib/highres/ledger";
import { HighResolutionUploadError, assertHighResolutionStorage } from "@/lib/highres/uploads";
import { MAX_IMAGE_BYTES, type SupportedImageMime } from "@/lib/validation";
import { isSameOriginRequest } from "@/lib/request-security";
import { readBoundedJson, RequestBodyTooLargeError } from "@/lib/request-body";

export const maxDuration = 300;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROLES = new Set<UploadRole>(["person", "fabric", "lowerFabric", "shirtFabric", "waistcoatFabric", "outfit"]);
const TYPES = new Set<SupportedImageMime>(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) return Response.json({ error: "This request was blocked. Please refresh and try again." }, { status: 403 });
    const user = await requireRequestUser(request);
    if (!user) return Response.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });
    const admission = await checkUploadRateLimit(user.username, "create");
    if (!admission.allowed) return Response.json({ error: "Too many uploads. Please wait and retry." }, { status: 429, headers: { "Cache-Control": "private, no-store", "Retry-After": String(Math.max(1, Math.ceil((admission.resetAt - Date.now()) / 1000))) } });
    assertHighResolutionStorage();
    const parsed = await readBoundedJson(request, 4_096);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return Response.json({ error: "Invalid upload request." }, { status: 400 });
    }
    const body = parsed as Record<string, unknown>;
    const role = typeof body.role === "string" && ROLES.has(body.role as UploadRole) ? body.role as UploadRole : null;
    const filename = typeof body.filename === "string" ? body.filename : "";
    const contentType = typeof body.contentType === "string" && TYPES.has(body.contentType as SupportedImageMime)
      ? body.contentType as SupportedImageMime : null;
    const bytes = typeof body.bytes === "number" ? body.bytes : 0;
    if (!role || !filename || !contentType || !Number.isInteger(bytes) || bytes < 1 || bytes > MAX_IMAGE_BYTES) {
      return Response.json({ error: "Choose a JPG, PNG, or WebP image under 50 MB." }, { status: 400 });
    }
    const slot = await createUploadSlot({ username: user.username, role, filename, contentType, bytes });
    return Response.json({ id: slot.id, pathname: slot.pathname, expiresAt: slot.expiresAt }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return Response.json({ error: "Upload request is too large." }, { status: 413 });
    if (error instanceof SyntaxError) return Response.json({ error: "Invalid upload request." }, { status: 400 });
    if (error instanceof AuthConfigurationError) return Response.json({ error: "Authentication is not configured." }, { status: 503 });
    if (error instanceof HighResolutionUploadError) return Response.json({ error: error.message }, { status: error.status });
    console.error("highres_upload_slot_failed", { errorName: error instanceof Error ? error.name : "UnknownError" });
    return Response.json({ error: "We couldn't prepare this upload. Please try again." }, { status: 503 });
  }
}
