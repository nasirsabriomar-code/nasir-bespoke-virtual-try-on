import { AuthConfigurationError } from "@/lib/auth/config";
import { requireRequestUser } from "@/lib/auth/session";
import { completeUploadForUser, HighResolutionUploadError } from "@/lib/highres/uploads";
import { isSameOriginRequest } from "@/lib/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!isSameOriginRequest(request)) return Response.json({ error: "This request was blocked." }, { status: 403 });
    const user = await requireRequestUser(request);
    if (!user) return Response.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });
    const { id } = await context.params;
    const slot = await completeUploadForUser(user.username, id);
    return Response.json({ id: slot.id, role: slot.role, width: slot.width, height: slot.height, checksum: slot.checksum }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    if (error instanceof AuthConfigurationError) return Response.json({ error: "Authentication is not configured." }, { status: 503 });
    if (error instanceof HighResolutionUploadError) return Response.json({ error: error.message }, { status: error.status });
    console.error("highres_upload_complete_failed", { errorName: error instanceof Error ? error.name : "UnknownError" });
    return Response.json({ error: "We couldn't validate this upload." }, { status: 400 });
  }
}
