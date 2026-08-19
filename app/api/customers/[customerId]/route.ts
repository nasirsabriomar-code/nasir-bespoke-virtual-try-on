import { handleGetCustomerRequest, handleUpdateCustomerRequest } from "@/lib/customer-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ customerId: string }> }) {
  const { customerId } = await context.params;
  return handleGetCustomerRequest(request, customerId);
}

export async function PATCH(request: Request, context: { params: Promise<{ customerId: string }> }) {
  const { customerId } = await context.params;
  return handleUpdateCustomerRequest(request, customerId);
}
