import { AuthConfigurationError } from "@/lib/auth/config";
import { requireRequestUser } from "@/lib/auth/session";
import { getUploadSlot } from "@/lib/highres/ledger";
import { HighResolutionUploadError } from "@/lib/highres/uploads";
import { isSameOriginRequest } from "@/lib/request-security";
import { presignR2Url } from "@/lib/r2-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!isSameOriginRequest(request)) return Response.json({ error: "This request was blocked." }, { status: 403 });
    const user = await requireRequestUser(request);
    const { id } = await context.params;
    const slot = await getUploadSlot(id);
    if (!user || !slot || slot.username !== user.username || slot.status !== "authorized" || new Date(slot.expiresAt).getTime() < Date.now()) {
      return Response.json({ error: "Upload session is unavailable." }, { status: 401 });
    }
    return Response.json({
      uploadUrl: presignR2Url(slot.pathname, "PUT", Math.max(1, Math.floor((new Date(slot.expiresAt).getTime() - Date.now()) / 1000))),
    }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    if (error instanceof AuthConfigurationError) return Response.json({ error: "Authentication is not configured." }, { status: 503 });
    if (error instanceof HighResolutionUploadError) return Response.json({ error: error.message }, { status: error.status });
    console.error("highres_upload_token_failed", { errorName: error instanceof Error ? error.name : "UnknownError" });
    return Response.json({ error: "We couldn't authorize this upload." }, { status: 400 });
  }
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRequestUser(request);
    if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
    const { id } = await context.params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "Upload not found." }, { status: 404 });
    const slot = await getUploadSlot(id);
    if (!slot || slot.username !== user.username) return Response.json({ error: "Upload not found." }, { status: 404 });
    if (Date.parse(slot.expiresAt) <= Date.now()) return Response.json({ error: "Upload expired." }, { status: 410 });
    return Response.json({ id: slot.id, status: slot.status, bytes: slot.bytes, role: slot.role, expiresAt: slot.expiresAt }, { headers: { "Cache-Control": "no-store, private" } });
  } catch { return Response.json({ error: "Upload status is unavailable." }, { status: 503 }); }
}
