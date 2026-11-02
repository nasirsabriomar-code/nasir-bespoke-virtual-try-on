import { get, list } from "@vercel/blob";
import { getPermanentHistory } from "../lib/highres/ledger";
import { migrateGenerationAsset, type MigrationOutcome } from "../lib/history/migrate-generation-assets";
import { presignR2Url, r2Put } from "../lib/r2-storage";

// Read-only on Blob. Existing R2 objects are never overwritten.
const token = process.env.NASIR_BLOB_READ_WRITE_TOKEN;
if (!token) throw new Error("Original Blob source token is missing.");

const sources = new Map<string, string>();
let cursor: string | undefined;
do {
  const page = await list({ prefix: "nasir-bespoke/generations/", limit: 1000, token, cursor });
  for (const blob of page.blobs) sources.set(blob.pathname, blob.url);
  cursor = page.hasMore ? page.cursor : undefined;
} while (cursor);

const store = {
  exists: async (pathname: string) => {
    const response = await fetch(presignR2Url(pathname, "HEAD"), { method: "HEAD", cache: "no-store" });
    if (response.status === 404) return false;
    if (!response.ok) throw new Error(`R2 check failed with status ${response.status}.`);
    return true;
  },
  readSource: async (pathname: string) => {
    const url = sources.get(pathname);
    if (!url) return null;
    const source = await get(url, { access: "private", token, useCache: false });
    if (!source || source.statusCode !== 200) return null;
    return new Uint8Array(await new Response(source.stream).arrayBuffer());
  },
  write: (pathname: string, bytes: Uint8Array, contentType: string) => r2Put(pathname, bytes, contentType),
};

const counts: Record<MigrationOutcome | "failed", number> = { present: 0, copied: 0, missing: 0, corrupt: 0, failed: 0 };
const PAGE_SIZE = 100;
for (let offset = 0; ; offset += PAGE_SIZE) {
  const { events, total } = await getPermanentHistory(PAGE_SIZE, offset);
  for (const event of events) {
    for (const reference of Object.values(event.assets ?? {})) {
      try {
        const outcome = await migrateGenerationAsset(reference, store);
        counts[outcome] += 1;
        if (outcome === "missing" || outcome === "corrupt") console.log("GENERATION_ASSET_BLOCKED", { id: event.id, outcome });
      } catch (error) {
        counts.failed += 1;
        console.log("GENERATION_ASSET_FAILED", { id: event.id, errorName: error instanceof Error ? error.name : "UnknownError" });
      }
    }
  }
  if (offset + PAGE_SIZE >= total) break;
}
console.log("GENERATION_ASSET_MIGRATION", { ...counts, blobWrites: 0, blobDeletes: 0 });
if (counts.missing || counts.corrupt || counts.failed) process.exitCode = 2;
