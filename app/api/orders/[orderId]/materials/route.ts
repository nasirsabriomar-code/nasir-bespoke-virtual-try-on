import { handleListOrderMaterialsRequest, handleSetOrderMaterialRequest } from "@/lib/order-material-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await context.params;
  return handleListOrderMaterialsRequest(request, orderId);
}

export async function POST(request: Request, context: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await context.params;
  return handleSetOrderMaterialRequest(request, orderId);
}
