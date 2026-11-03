import { getGenerationReviews } from "@/lib/history/reviews";
import { AuthConfigurationError } from "@/lib/auth/config";
import { requireRequestUser } from "@/lib/auth/session";
import { getUsageHistory, redactUsageHistoryForClient } from "@/lib/usage-history";
import { getPermanentHistory, isPermanentHistoryConfigured } from "@/lib/highres/ledger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const JSON_HEADERS = {
  "Cache-Control": "no-store, private",
  "Content-Type": "application/json",
  "X-Content-Type-Options": "nosniff",
};

export async function GET(request: Request) {
  try {
    const user = await requireRequestUser(request);
    if (!user) {
      return Response.json(
        { error: "Your session has expired. Please sign in again." },
        { status: 401, headers: JSON_HEADERS },
      );
    }

    const url = new URL(request.url);
    const rawLimit = Number.parseInt(url.searchParams.get("limit") ?? "100", 10);
    const offset = Number.parseInt(url.searchParams.get("offset") ?? "0", 10);
    const history = isPermanentHistoryConfigured()
      ? await getPermanentHistory(rawLimit, Number.isFinite(offset) ? Math.max(0, offset) : 0)
      : await getUsageHistory(rawLimit);
    let reviews: Awaited<ReturnType<typeof getGenerationReviews>> = {};
    try { reviews = await getGenerationReviews(history.events.map(event => event.id), user.username); } catch { console.error("history_feedback_unavailable"); }
    return Response.json(redactUsageHistoryForClient({ ...history, events: history.events.map(event => ({ ...event, review: reviews[event.id] })) }), { status: 200, headers: JSON_HEADERS });
  } catch (error) {
    if (error instanceof AuthConfigurationError) {
      console.error("history_auth_configuration_error");
      return Response.json(
        { error: "Authentication is not configured." },
        { status: 503, headers: JSON_HEADERS },
      );
    }

    console.error("history_read_failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return Response.json(
      { error: "Usage history is temporarily unavailable. Please try again." },
      { status: 503, headers: JSON_HEADERS },
    );
  }
}
