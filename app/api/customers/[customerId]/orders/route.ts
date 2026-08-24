import { handleCreateOrderRequest, handleListCustomerOrdersRequest } from "@/lib/order-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ customerId: string }> }) {
  const { customerId } = await context.params;
  return handleListCustomerOrdersRequest(request, customerId);
}

export async function POST(request: Request, context: { params: Promise<{ customerId: string }> }) {
  const { customerId } = await context.params;
  return handleCreateOrderRequest(request, customerId);
}
