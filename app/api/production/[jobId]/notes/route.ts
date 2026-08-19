import {
  handleCreateProductionNoteRequest,
  handleListProductionNotesRequest,
} from "@/lib/production-notes-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await context.params;
  return handleListProductionNotesRequest(request, jobId);
}

export async function POST(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await context.params;
  return handleCreateProductionNoteRequest(request, jobId);
}
