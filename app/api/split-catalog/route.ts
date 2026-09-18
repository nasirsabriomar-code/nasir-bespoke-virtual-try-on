import { AuthConfigurationError } from "@/lib/auth/config";
import { requireRequestUser } from "@/lib/auth/session";
import { getSplitCatalogueView } from "@/lib/split-outfit/view";
import { SPLIT_OUTFIT_FAMILIES } from "@/lib/split-outfit/types";
import type { SplitOutfitFamily } from "@/lib/split-outfit/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const JSON_HEADERS = { "Cache-Control": "private, no-store", "Content-Type": "application/json", "X-Content-Type-Options": "nosniff" };

function isSplitOutfitFamily(value: string): value is SplitOutfitFamily {
  return (SPLIT_OUTFIT_FAMILIES as readonly string[]).includes(value);
}

export async function GET(request: Request) {
  try {
    const user = await requireRequestUser(request);
    if (!user) return Response.json({ error: "Your session has expired. Please sign in again." }, { status: 401, headers: JSON_HEADERS });

    const requestedFamily = new URL(request.url).searchParams.get("family") ?? "suit";
    if (!isSplitOutfitFamily(requestedFamily)) {
      return Response.json({ error: "Please choose a valid outfit family." }, { status: 400, headers: JSON_HEADERS });
    }

    return Response.json(getSplitCatalogueView(requestedFamily), { status: 200, headers: JSON_HEADERS });
  } catch (error) {
    if (error instanceof AuthConfigurationError) return Response.json({ error: "Authentication is not configured." }, { status: 503, headers: JSON_HEADERS });
    console.error("split_catalog_read_failed", { errorName: error instanceof Error ? error.name : "UnknownError" });
    return Response.json({ error: "The outfit catalogue is temporarily unavailable." }, { status: 503, headers: JSON_HEADERS });
  }
}
