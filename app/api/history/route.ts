import { AuthConfigurationError } from "@/lib/auth/config";
import { requireRequestUser } from "@/lib/auth/session";
import { getUsageHistory } from "@/lib/usage-history";

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

    const rawLimit = Number.parseInt(new URL(request.url).searchParams.get("limit") ?? "100", 10);
    const history = await getUsageHistory(rawLimit);
    return Response.json(history, { status: 200, headers: JSON_HEADERS });
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
