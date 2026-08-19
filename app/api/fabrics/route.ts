import { handleCreateFabricRequest, handleListFabricsRequest } from "@/lib/fabric-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleListFabricsRequest(request);
}

export async function POST(request: Request) {
  return handleCreateFabricRequest(request);
}
