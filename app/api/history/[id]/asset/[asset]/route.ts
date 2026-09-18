import { AuthConfigurationError } from "@/lib/auth/config";
import { requireRequestUser } from "@/lib/auth/session";
import {
  getPrivateGenerationAsset,
  getPrivateGenerationAssetUrl,
  isGenerationAssetPath,
  type GenerationAssetKey,
} from "@/lib/generation-storage";
import { getUsageEvent } from "@/lib/usage-history";
import { getPermanentGeneration, isPermanentHistoryConfigured } from "@/lib/highres/ledger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ASSET_KEYS = new Set<GenerationAssetKey>([
  "person",
  "outfit",
  "fabric",
  "lower-fabric",
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
]);

function downloadFilename(contentType: string) {
  if (contentType === "image/jpeg") return "nasir-bespoke-try-on.jpg";
  if (contentType === "image/webp") return "nasir-bespoke-try-on.webp";
  return "nasir-bespoke-try-on.png";
}

export async function GET(request: Request, context: { params: Promise<{ id: string; asset: string }> }) {
  try {
    const user = await requireRequestUser(request);
    if (!user) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

    const { id, asset } = await context.params;
    if (!id || !ASSET_KEYS.has(asset as GenerationAssetKey)) return new Response("Not found", { status: 404 });
    if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
    const event = isPermanentHistoryConfigured()
      ? await getPermanentGeneration(id)
      : await getUsageEvent(id);
    const reference = event?.assets?.[asset as GenerationAssetKey];
    if (!reference || !isGenerationAssetPath(reference.pathname, id, asset as GenerationAssetKey)) {
      return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
    }

    const wantsDownload = new URL(request.url).searchParams.get("download") === "1";
    if (wantsDownload) {
      // Downloads are owner-only. Return the same 404 used for missing assets so
      // this endpoint does not disclose another staff member's generation.
      if (!event || event.username !== user.username) {
        return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
      }

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
          "Content-Disposition": `attachment; filename="${downloadFilename(contentType)}"`,
          "Content-Type": contentType,
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
