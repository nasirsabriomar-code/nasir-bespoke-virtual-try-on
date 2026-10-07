import { createHash } from "node:crypto";
import { get, list } from "@vercel/blob";
import { recoveryManifest } from "../lib/catalog/recovery";
import { r2Get, r2Put } from "../lib/r2-storage";

// Read-only on Blob. Never overwrite an R2 object that has different contents.
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const token = process.env.NASIR_BLOB_READ_WRITE_TOKEN;
if (!token) throw new Error("Original Blob source token is missing.");
const sources = new Map<string, string>();
let cursor: string | undefined;
do {
  const page = await list({ prefix: "nasir-bespoke/catalogue/", limit: 1000, token, cursor });
  for (const blob of page.blobs) sources.set(blob.pathname, blob.url);
  cursor = page.hasMore ? page.cursor : undefined;
} while (cursor);
const unique = new Map<string, Awaited<ReturnType<typeof recoveryManifest>>[number]>();
for (const asset of await recoveryManifest()) {
  const previous = unique.get(asset.privatePath);
  if (previous && previous.checksum !== asset.checksum) throw new Error("Conflicting approved reference checksums.");
  unique.set(asset.privatePath,asset);
}
let restored=0, verified=0, blocked=0;
for (const asset of unique.values()) {
  try {
    const destination = await r2Get(asset.privatePath);
    if (destination.ok) {
      if (hash(new Uint8Array(await destination.arrayBuffer())) !== asset.checksum) throw new Error("DestinationChecksumMismatch");
      verified++; continue;
    }
    const url = sources.get(asset.privatePath);
    if (!url) throw new Error("OriginalSourceMissing");
    const source = await get(url,{access:"private",token,useCache:false});
    if (!source || source.statusCode !== 200) throw new Error("OriginalSourceUnavailable");
    const bytes = new Uint8Array(await new Response(source.stream).arrayBuffer());
    if (hash(bytes) !== asset.checksum) throw new Error("SourceChecksumMismatch");
    await r2Put(asset.privatePath,bytes,asset.contentType);
    const check = await r2Get(asset.privatePath);
    if (!check.ok || hash(new Uint8Array(await check.arrayBuffer())) !== asset.checksum) throw new Error("ReadbackChecksumMismatch");
    restored++;
  } catch (error) {
    blocked++;
    console.log("CATALOGUE_ASSET_BLOCKED", { id:asset.id, errorName:error instanceof Error ? error.name : "UnknownError" });
  }
}
console.log("CATALOGUE_MIGRATION", { expected:unique.size,restored,verified,blocked,blobWrites:0,blobDeletes:0 });
if(blocked) process.exitCode=2;
