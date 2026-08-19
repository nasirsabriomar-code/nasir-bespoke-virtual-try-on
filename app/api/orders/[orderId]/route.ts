import { handleGetOrderRequest, handleUpdateOrderStatusRequest } from "@/lib/order-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await context.params;
  return handleGetOrderRequest(request, orderId);
}

export async function PATCH(request: Request, context: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await context.params;
  return handleUpdateOrderStatusRequest(request, orderId);
}
