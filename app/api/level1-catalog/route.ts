import { AuthConfigurationError } from "@/lib/auth/config";
import { requireRequestUser } from "@/lib/auth/session";
import { getLevel1CatalogueView } from "@/lib/catalog/level1-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const JSON_HEADERS = { "Cache-Control": "private, no-store", "Content-Type": "application/json", "X-Content-Type-Options": "nosniff" };

export async function GET(request: Request) {
  try {
    const user = await requireRequestUser(request);
    if (!user) return Response.json({ error: "Your session has expired. Please sign in again." }, { status: 401, headers: JSON_HEADERS });
    return Response.json(await getLevel1CatalogueView(), { status: 200, headers: JSON_HEADERS });
  } catch (error) {
    if (error instanceof AuthConfigurationError) return Response.json({ error: "Authentication is not configured." }, { status: 503, headers: JSON_HEADERS });
    console.error("level1_catalog_read_failed", { errorName: error instanceof Error ? error.name : "UnknownError" });
    return Response.json({ error: "The curated catalogue is temporarily unavailable." }, { status: 503, headers: JSON_HEADERS });
  }
}
