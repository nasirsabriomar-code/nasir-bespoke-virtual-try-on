import { handleCreateProductionJobRequest, handleGetProductionJobByOrderRequest } from "@/lib/production-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await context.params;
  return handleGetProductionJobByOrderRequest(request, orderId);
}

export async function POST(request: Request, context: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await context.params;
  return handleCreateProductionJobRequest(request, orderId);
}
