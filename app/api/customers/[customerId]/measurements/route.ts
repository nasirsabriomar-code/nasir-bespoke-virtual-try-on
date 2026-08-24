import { handleCreateMeasurementRequest, handleGetMeasurementHistoryRequest } from "@/lib/measurement-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ customerId: string }> }) {
  const { customerId } = await context.params;
  return handleGetMeasurementHistoryRequest(request, customerId);
}

export async function POST(request: Request, context: { params: Promise<{ customerId: string }> }) {
  const { customerId } = await context.params;
  return handleCreateMeasurementRequest(request, customerId);
}
