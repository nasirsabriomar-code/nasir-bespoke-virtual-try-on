import { canAccessGeneration } from "@/lib/history/access";
import { requireRequestUser } from "@/lib/auth/session";
import { isSameOriginRequest } from "@/lib/request-security";
import { readBoundedJson, RequestBodyTooLargeError } from "@/lib/request-body";
import { lookupGenerationEvent } from "@/lib/history/lookup-generation";
import { getPermanentGeneration, isPermanentHistoryConfigured } from "@/lib/highres/ledger";
import { getUsageEvent } from "@/lib/usage-history";
import { parseReview } from "@/lib/history/review-types";
import { getGenerationReview, saveGenerationReview } from "@/lib/history/reviews";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private" };
async function review(request: Request, context: { params: Promise<{ id: string }> }, write: boolean) {
  try {
    if (write && !isSameOriginRequest(request)) return Response.json({ error: "Request blocked." }, { status: 403, headers });
    const user = await requireRequestUser(request);
    if (!user) return Response.json({ error: "Sign in required." }, { status: 401, headers });
    const { id } = await context.params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return Response.json({ error: "Generation not found." }, { status: 404, headers });
    const event = await lookupGenerationEvent(id, { permanent: async key => isPermanentHistoryConfigured() ? getPermanentGeneration(key) : null, recent: getUsageEvent });
    if (!canAccessGeneration(user, event)) return Response.json({ error: "Generation not found." }, { status: 404, headers });
    if (!write) return Response.json(await getGenerationReview(id, user.username), { headers });
    const value = parseReview(await readBoundedJson(request, 4096));
    if (!value) return Response.json({ error: "Invalid feedback." }, { status: 400, headers });
    return Response.json(await saveGenerationReview(id, user.username, value), { headers });
  } catch (error) {
    const status = error instanceof RequestBodyTooLargeError ? 413 : error instanceof SyntaxError ? 400 : 503;
    return Response.json({ error: status === 503 ? "Feedback is temporarily unavailable." : "Invalid feedback." }, { status, headers });
  }
}
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) { return review(request, context, false); }
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) { return review(request, context, true); }
