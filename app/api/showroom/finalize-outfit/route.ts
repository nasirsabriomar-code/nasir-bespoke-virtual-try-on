import { handleFinalizeOutfitRequest } from "@/lib/showroom-finalize-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleFinalizeOutfitRequest(request);
}
