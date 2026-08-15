import { AuthConfigurationError } from "@/lib/auth/config";
import { requireRequestUser } from "@/lib/auth/session";
import { getCatalog } from "@/lib/catalog/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const JSON_HEADERS = {
  "Cache-Control": "private, no-store",
  "Content-Type": "application/json",
  "X-Content-Type-Options": "nosniff",
};

export async function GET(request: Request) {
  try {
    const user = await requireRequestUser(request);
    if (!user) {
      return Response.json({ error: "Your session has expired. Please sign in again." }, { status: 401, headers: JSON_HEADERS });
    }
    const catalog = await getCatalog();
    return Response.json(catalog, { status: 200, headers: JSON_HEADERS });
  } catch (error) {
    if (error instanceof AuthConfigurationError) {
      return Response.json({ error: "Authentication is not configured." }, { status: 503, headers: JSON_HEADERS });
    }
    console.error("catalog_read_failed", { errorName: error instanceof Error ? error.name : "UnknownError" });
    return Response.json({ error: "The men's garment catalog is temporarily unavailable." }, { status: 503, headers: JSON_HEADERS });
  }
}
