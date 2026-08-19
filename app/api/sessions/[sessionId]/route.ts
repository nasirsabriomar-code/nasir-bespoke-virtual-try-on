import { handleUpdateSessionRequest } from "@/lib/session-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await context.params;
  return handleUpdateSessionRequest(request, sessionId);
}
