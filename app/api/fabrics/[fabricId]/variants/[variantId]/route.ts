import { handleUpdateFabricVariantRequest } from "@/lib/fabric-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ fabricId: string; variantId: string }> },
) {
  const { fabricId, variantId } = await context.params;
  return handleUpdateFabricVariantRequest(request, fabricId, variantId);
}
