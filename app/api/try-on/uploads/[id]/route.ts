import { AuthConfigurationError } from "@/lib/auth/config";
import { requireRequestUser } from "@/lib/auth/session";
import { getUploadSlot } from "@/lib/highres/ledger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Uploads arrive in bounded chunks through /parts. There is deliberately no
// route that hands out a direct storage PUT URL: such a URL cannot cap the
// object size or type.

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
  } catch (error) {
    if (error instanceof AuthConfigurationError) return Response.json({ error: "Authentication is not configured." }, { status: 503 });
    console.error("highres_upload_status_failed", { errorName: error instanceof Error ? error.name : "UnknownError" });
    return Response.json({ error: "Upload status is unavailable." }, { status: 503 });
  }
}
