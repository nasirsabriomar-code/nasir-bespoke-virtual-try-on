import { AuthConfigurationError } from "@/lib/auth/config";
import { requireRequestUser } from "@/lib/auth/session";
import { findActiveSplitReference } from "@/lib/split-outfit/catalogue";
import { getPrivateSplitAsset, SplitAssetStorageError } from "@/lib/split-outfit/assets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ assetId: string }> }) {
  try {
    const user = await requireRequestUser(request);
    if (!user) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
    const { assetId } = await context.params;
    if (!/^[A-Z0-9_]+_REFERENCE_V1$/i.test(assetId)) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
    const reference = findActiveSplitReference(assetId);
    if (!reference) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
    const privateAsset = await getPrivateSplitAsset(reference);
    const blob = privateAsset?.blob;
    if (!privateAsset || !blob || blob.statusCode !== 200 || !blob.stream) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
    return new Response(blob.stream, {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": blob.blob.contentType || reference.contentType || "application/octet-stream",
        "Content-Disposition": 'inline; filename="nasir-bespoke-split-reference"',
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (!(error instanceof AuthConfigurationError) && !(error instanceof SplitAssetStorageError)) {
      console.error("split_catalogue_asset_read_failed", { errorName: error instanceof Error ? error.name : "UnknownError" });
    }
    return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
}
