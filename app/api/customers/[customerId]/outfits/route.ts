import { handleCreateSavedOutfitRequest, handleListCustomerOutfitsRequest } from "@/lib/saved-outfit-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ customerId: string }> }) {
  const { customerId } = await context.params;
  return handleListCustomerOutfitsRequest(request, customerId);
}

export async function POST(request: Request, context: { params: Promise<{ customerId: string }> }) {
  const { customerId } = await context.params;
  return handleCreateSavedOutfitRequest(request, customerId);
}
