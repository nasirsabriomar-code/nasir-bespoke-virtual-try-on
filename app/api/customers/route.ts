import { handleCreateCustomerRequest, handleSearchCustomersRequest } from "@/lib/customer-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleSearchCustomersRequest(request);
}

export async function POST(request: Request) {
  return handleCreateCustomerRequest(request);
}
