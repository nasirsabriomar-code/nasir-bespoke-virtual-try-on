import { AuthConfigurationError } from "@/lib/auth/config";
import { requireRequestUser } from "@/lib/auth/session";
import {
  getPrivateGenerationAsset,
  getPrivateGenerationAssetUrl,
  isGenerationAssetPath,
  type GenerationAssetKey,
} from "@/lib/generation-storage";
import { lookupGenerationEvent } from "@/lib/history/lookup-generation";
import { getUsageEvent } from "@/lib/usage-history";
import { getPermanentGeneration, isPermanentHistoryConfigured } from "@/lib/highres/ledger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ASSET_KEYS = new Set<GenerationAssetKey>([
  "person",
  "outfit",
  "fabric",
  "lower-fabric",
  "shirt-fabric",
  "waistcoat-fabric",
  "result",
  "upper",
  "lower",
  "subtype",
  "turban",
  "shoes",
  "upper-style",
  "lower-style",
  "turban-style",
  "shoe-style",
  "bespoke-detail-1",
  "bespoke-detail-2",
  "curated-design",
  "curated-detail",
  "split-upper",
  "split-lower",
  "split-shirt",
  "split-waistcoat",
  "split-footwear",
]);

function extensionFor(contentType: string) {
  if (contentType === "image/jpeg") return "jpg";
  if (contentType === "image/webp") return "webp";
  return "png";
}

function downloadFilename(asset: string, contentType: string) {
  const safeAsset = asset.replace(/[^a-z0-9-]/gi, "") || "image";
  return `nasir-bespoke-${safeAsset}.${extensionFor(contentType)}`;
}

export async function GET(request: Request, context: { params: Promise<{ id: string; asset: string }> }) {
  try {
    const user = await requireRequestUser(request);
    if (!user) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

    const { id, asset } = await context.params;
    if (!id || !ASSET_KEYS.has(asset as GenerationAssetKey)) return new Response("Not found", { status: 404 });
    if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
    const event = await lookupGenerationEvent(id, {
      permanent: async (generationId) => isPermanentHistoryConfigured() ? getPermanentGeneration(generationId) : null,
      recent: getUsageEvent,
    });
    const reference = event?.assets?.[asset as GenerationAssetKey];
    if (!reference || !isGenerationAssetPath(reference.pathname, id, asset as GenerationAssetKey)) {
      return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
    }

    const wantsDownload = new URL(request.url).searchParams.get("download") === "1";
    if (wantsDownload) {
      // History is shared among authenticated staff, so downloads follow the
      // same access as viewing.
      // Stream the private Blob through this authenticated route. This keeps the
      // signed Blob URL out of the browser address bar and download history.
      const blob = await getPrivateGenerationAsset(reference.pathname);
      if (!blob?.stream) {
        return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
      }

      const contentType = reference.contentType || blob.blob.contentType || "application/octet-stream";
      return new Response(blob.stream, {
        status: 200,
        headers: {
          "Cache-Control": "private, no-store",
          "Content-Disposition": `attachment; filename="${downloadFilename(asset, contentType)}"`,
          "Content-Type": contentType,
          ...(reference.bytes ? { "Content-Length": String(reference.bytes) } : {}),
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    const signedUrl = await getPrivateGenerationAssetUrl(reference.pathname);
    return Response.redirect(signedUrl, 302);
  } catch (error) {
    if (error instanceof AuthConfigurationError) return new Response("Not found", { status: 404 });
    console.error("history_asset_read_failed", { errorName: error instanceof Error ? error.name : "UnknownError" });
    return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
}
