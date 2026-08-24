import { handleCreateFabricVariantRequest, handleListFabricVariantsRequest } from "@/lib/fabric-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ fabricId: string }> }) {
  const { fabricId } = await context.params;
  return handleListFabricVariantsRequest(request, fabricId);
}

export async function POST(request: Request, context: { params: Promise<{ fabricId: string }> }) {
  const { fabricId } = await context.params;
  return handleCreateFabricVariantRequest(request, fabricId);
}
