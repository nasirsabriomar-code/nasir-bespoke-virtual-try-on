import { AuthConfigurationError } from "@/lib/auth/config";
import { requireRequestUser } from "@/lib/auth/session";
import { normalizeIdempotencyKey, resolveIdempotencyForRequest } from "@/lib/generation-guard";
import type { GenerationStatus } from "@/lib/generation-recovery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "no-store, private" };

function statusFrom(resolution: Awaited<ReturnType<typeof resolveIdempotencyForRequest>>): GenerationStatus {
  if (resolution.kind === "absent") return { state: "absent" };
  if (resolution.kind === "in_progress") return { state: "in_progress" };
  const { record } = resolution;
  if (record.status === "failed") return { state: "failed", error: record.error };
  if (record.status === "complete_generation") {
    const id = encodeURIComponent(record.generationId);
    return { state: "complete", resultUrl: `/api/history/${id}/asset/result`, originalUrl: `/api/history/${id}/asset/person` };
  }
  return { state: "failed", error: "We couldn't recover this try-on. Please check History." };
}

export async function GET(request: Request) {
  try {
    const user = await requireRequestUser(request);
    if (!user) return Response.json({ error: "Your session has expired. Please sign in again." }, { status: 401, headers: HEADERS });
    const key = normalizeIdempotencyKey(new URL(request.url).searchParams.get("key") ?? "");
    if (!key) return Response.json({ error: "Invalid generation key." }, { status: 400, headers: HEADERS });
    return Response.json(statusFrom(await resolveIdempotencyForRequest(user.username, key)), { headers: HEADERS });
  } catch (error) {
    if (error instanceof AuthConfigurationError) return Response.json({ error: "Authentication is not configured." }, { status: 503, headers: HEADERS });
    console.error("try_on_status_failed", { errorName: error instanceof Error ? error.name : "UnknownError" });
    return Response.json({ error: "Status is temporarily unavailable." }, { status: 503, headers: HEADERS });
  }
}
