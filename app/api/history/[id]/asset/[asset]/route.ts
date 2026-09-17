import { AuthConfigurationError } from "@/lib/auth/config";
import { requireRequestUser } from "@/lib/auth/session";
import { getPrivateGenerationAssetUrl, isGenerationAssetPath, type GenerationAssetKey } from "@/lib/generation-storage";
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
]);

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

    const signedUrl = await getPrivateGenerationAssetUrl(reference.pathname);
    return Response.redirect(signedUrl, 302);
  } catch (error) {
    if (error instanceof AuthConfigurationError) return new Response("Not found", { status: 404 });
    console.error("history_asset_read_failed", { errorName: error instanceof Error ? error.name : "UnknownError" });
    return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
}
