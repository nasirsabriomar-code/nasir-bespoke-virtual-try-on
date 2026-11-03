import { requireRequestUser } from "@/lib/auth/session";
import { isSameOriginRequest } from "@/lib/request-security";
import { canAccessGeneration } from "@/lib/history/access";
import { eraseGeneration } from "@/lib/history/deletion";
import { lookupGenerationEvent } from "@/lib/history/lookup-generation";
import { getPermanentGeneration, isPermanentHistoryConfigured, queueGenerationDeletion } from "@/lib/highres/ledger";
import { getUsageEvent } from "@/lib/usage-history";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
const headers = { "Cache-Control": "private, no-store" };
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  let deletionQueued = false;
  try {
    if (!isSameOriginRequest(request)) return Response.json({ error: "Request blocked." }, { status: 403, headers });
    const user = await requireRequestUser(request);
    if (!user) return Response.json({ error: "Sign in required." }, { status: 401, headers });
    const { id } = await context.params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return Response.json({ error: "Not found." }, { status: 404, headers });
    const event = await lookupGenerationEvent(id, { permanent: async key => isPermanentHistoryConfigured() ? getPermanentGeneration(key) : null, recent: getUsageEvent });
    if (!canAccessGeneration(user, event)) return Response.json({ error: "Not found." }, { status: 404, headers });
    await queueGenerationDeletion(event);
    deletionQueued = true;
    await eraseGeneration(event);
    return Response.json({ deleted: true }, { headers });
  } catch {
    return Response.json({ deletionQueued, error: deletionQueued ? "Deletion is queued. Images are hidden and cleanup will retry." : "Deletion could not be queued. Please try again." }, { status: 503, headers });
  }
}
