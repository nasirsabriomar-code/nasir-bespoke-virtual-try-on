import { handleListAssignableStaffRequest } from "@/lib/production-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleListAssignableStaffRequest(request);
}
