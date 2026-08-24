import { handleGetFabricRequest, handleUpdateFabricRequest } from "@/lib/fabric-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ fabricId: string }> }) {
  const { fabricId } = await context.params;
  return handleGetFabricRequest(request, fabricId);
}

export async function PATCH(request: Request, context: { params: Promise<{ fabricId: string }> }) {
  const { fabricId } = await context.params;
  return handleUpdateFabricRequest(request, fabricId);
}
