import { checkUploadRateLimit } from "@/lib/rate-limit";
import { AuthConfigurationError } from "@/lib/auth/config";
import { requireRequestUser } from "@/lib/auth/session";
import { HighResolutionUploadError } from "@/lib/highres/uploads";
import { writeUploadChunk } from "@/lib/highres/upload-chunks";
import { isSameOriginRequest } from "@/lib/request-security";

export const maxDuration = 300;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: Request, context: { params: Promise<{ id: string; index: string }> }) {
  try {
    if (!isSameOriginRequest(request)) return Response.json({ error: "This request was blocked." }, { status: 403 });
    const user = await requireRequestUser(request);
    if (!user) return Response.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });
    const admission = await checkUploadRateLimit(user.username, "part");
    if (!admission.allowed) return Response.json({ error: "Too many uploads. Please wait and retry." }, { status: 429, headers: { "Cache-Control": "private, no-store", "Retry-After": String(Math.max(1, Math.ceil((admission.resetAt - Date.now()) / 1000))) } });
    const { id, index } = await context.params;
    if (!/^\d+$/.test(index)) return Response.json({ error: "Invalid upload part." }, { status: 400 });
    await writeUploadChunk(user.username, id, Number(index), request);
    return Response.json({ uploaded: true }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    if (error instanceof AuthConfigurationError) return Response.json({ error: "Authentication is not configured." }, { status: 503 });
    if (error instanceof HighResolutionUploadError) return Response.json({ error: error.message }, { status: error.status });
    console.error("highres_upload_part_failed", { errorName: error instanceof Error ? error.name : "UnknownError" });
    return Response.json({ error: "We couldn't upload this image part. Please try again." }, { status: 503 });
  }
}
