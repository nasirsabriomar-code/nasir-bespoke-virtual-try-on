import { handleGetProductionJobRequest, handleUpdateProductionJobStageRequest } from "@/lib/production-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await context.params;
  return handleGetProductionJobRequest(request, jobId);
}

export async function PATCH(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await context.params;
  return handleUpdateProductionJobStageRequest(request, jobId);
}
