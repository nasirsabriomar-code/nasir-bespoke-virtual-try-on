#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { get, put } from "@vercel/blob";

const BLOB_TOKEN_ENV = "NASIR_BLOB_READ_WRITE_TOKEN";

export const APPROVED_INDO_TARGETS = [
  {
    order: 1,
    designId: "INDO_01_CLASSIC",
    name: "Classic",
    sourceFile: "/Users/omar/.gemini/antigravity/brain/50ead555-ec46-4007-bc59-b9ca610951bf/.user_uploaded/media_1786962514541.jpg",
    localCacheCard: ".cache/catalog-assets/INDO_01_CLASSIC_CARD_V1.jpg",
    localCachePrimary: ".cache/catalog-assets/INDO_01_CLASSIC_PRIMARY_V1.jpg",
    aliasFile: ".cache/catalog-assets/indo-classic.jpg",
    privatePath: "nasir-bespoke/catalogue/level1/v1/INDO_01_CLASSIC/approved.jpg",
    expectedSha256: "80d01ff2629bad975d73dc36c3325212434aa4f9f431a91e36df5235594404b7",
    expectedSizeBytes: 169677,
    contentType: "image/jpeg",
  },
  {
    order: 2,
    designId: "INDO_02_ASYMMETRIC",
    name: "Asymmetric",
    sourceFile: "/Users/omar/.gemini/antigravity/brain/50ead555-ec46-4007-bc59-b9ca610951bf/.user_uploaded/media_1786962514542.jpg",
    localCacheCard: ".cache/catalog-assets/INDO_02_ASYMMETRIC_CARD_V1.jpg",
    localCachePrimary: ".cache/catalog-assets/INDO_02_ASYMMETRIC_PRIMARY_V1.jpg",
    aliasFile: ".cache/catalog-assets/indo-asymmetric.jpg",
    privatePath: "nasir-bespoke/catalogue/level1/v1/INDO_02_ASYMMETRIC/approved.jpg",
    expectedSha256: "a37834450653445bd3297e9dbefd1874ae42d85887c3708021ec7ebe749644da",
    expectedSizeBytes: 199777,
    contentType: "image/jpeg",
  },
  {
    order: 3,
    designId: "INDO_03_LAYERED",
    name: "Layered",
    sourceFile: "/Users/omar/.gemini/antigravity/brain/50ead555-ec46-4007-bc59-b9ca610951bf/.user_uploaded/media_1786962617155.jpg",
    localCacheCard: ".cache/catalog-assets/INDO_03_LAYERED_CARD_V1.jpg",
    localCachePrimary: ".cache/catalog-assets/INDO_03_LAYERED_PRIMARY_V1.jpg",
    aliasFile: ".cache/catalog-assets/indo-layered.jpg",
    privatePath: "nasir-bespoke/catalogue/level1/v1/INDO_03_LAYERED/approved.jpg",
    expectedSha256: "ff540bae7a575342a0e0b9793f8fbaa39e1ec25407fe71b6f2beba4c86f2948d",
    expectedSizeBytes: 198701,
    contentType: "image/jpeg",
  },
  {
    order: 4,
    designId: "INDO_04_DRAPED",
    name: "Draped",
    sourceFile: "/Users/omar/.gemini/antigravity/brain/50ead555-ec46-4007-bc59-b9ca610951bf/.user_uploaded/media_1786962514540.jpg",
    localCacheCard: ".cache/catalog-assets/INDO_04_DRAPED_CARD_V1.jpg",
    localCachePrimary: ".cache/catalog-assets/INDO_04_DRAPED_PRIMARY_V1.jpg",
    aliasFile: ".cache/catalog-assets/indo-draped.jpg",
    privatePath: "nasir-bespoke/catalogue/level1/v1/INDO_04_DRAPED/approved.jpg",
    expectedSha256: "20e795e538a32e0fe6caa4ec5317da6c51b135a18be239ff709256c8d259023b",
    expectedSizeBytes: 201182,
    contentType: "image/jpeg",
  },
  {
    order: 5,
    designId: "INDO_05_STATEMENT",
    name: "Statement",
    sourceFile: "/Users/omar/.gemini/antigravity/brain/50ead555-ec46-4007-bc59-b9ca610951bf/.user_uploaded/media_1786962514544.jpg",
    localCacheCard: ".cache/catalog-assets/INDO_05_STATEMENT_CARD_V1.jpg",
    localCachePrimary: ".cache/catalog-assets/INDO_05_STATEMENT_PRIMARY_V1.jpg",
    aliasFile: ".cache/catalog-assets/indo-statement.jpg",
    privatePath: "nasir-bespoke/catalogue/level1/v1/INDO_05_STATEMENT/approved.jpg",
    expectedSha256: "7d4247f557d8d54b3b5689befbd99b2542eed7d4f400fc29aa3ce8f6d4763b5e",
    expectedSizeBytes: 227147,
    contentType: "image/jpeg",
  },
];

function cleanEnvValue(val) {
  if (!val) return "";
  let v = String(val).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

async function getBlobToken() {
  let token = cleanEnvValue(process.env[BLOB_TOKEN_ENV] || process.env.BLOB_READ_WRITE_TOKEN);
  if (!token || token === "[SENSITIVE]") {
    const envFiles = [".env.production.local", ".env.local"];
    for (const f of envFiles) {
      if (existsSync(f)) {
        const content = await readFile(f, "utf8");
        for (const line of content.split("\n")) {
          if (line.startsWith(`${BLOB_TOKEN_ENV}=`) || line.startsWith("BLOB_READ_WRITE_TOKEN=")) {
            const val = cleanEnvValue(line.slice(line.indexOf("=") + 1));
            if (val && val !== "[SENSITIVE]" && val.startsWith("vercel_blob_rw_")) {
              token = val;
              break;
            }
          }
        }
        if (token && token !== "[SENSITIVE]") break;
      }
    }
  }
  return token;
}

async function syncLocalCacheAndUpload() {
  console.log("==================================================");
  console.log("NASIR BESPOKE — INDO-WESTERN PRIVATE ASSET INGESTION");
  console.log("==================================================");

  await mkdir(".cache/catalog-assets", { recursive: true });

  // 1. Stage locally in cache
  console.log("\n[1/3] Staging approved files into .cache/catalog-assets...");
  for (const target of APPROVED_INDO_TARGETS) {
    const bytes = await readFile(target.sourceFile);
    const hash = createHash("sha256").update(bytes).digest("hex");
    if (hash !== target.expectedSha256) {
      throw new Error(`Checksum mismatch for ${target.designId}: expected ${target.expectedSha256}, got ${hash}`);
    }
    await writeFile(target.localCacheCard, bytes);
    await writeFile(target.localCachePrimary, bytes);
    await writeFile(target.aliasFile, bytes);
    console.log(`  ✓ ${target.designId} (${target.name}) staged [${bytes.length} bytes, SHA-256: ${hash.slice(0, 12)}...]`);
  }

  // 2. Upload to Vercel Blob if token available
  const token = await getBlobToken();
  if (!token) {
    console.log("\n[2/3] Private Blob token not available locally; relying on authenticated local cache fallback.");
    return;
  }

  console.log("\n[2/3] Uploading approved Indo-Western assets to private Vercel Blob...");
  for (const target of APPROVED_INDO_TARGETS) {
    const bytes = await readFile(target.sourceFile);
    console.log(`  Uploading ${target.privatePath}...`);
    const putResult = await put(target.privatePath, new Blob([bytes], { type: target.contentType }), {
      access: "private",
      token,
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 60,
      contentType: target.contentType,
    });
    console.log(`  ✓ Uploaded: ${putResult.pathname}`);

    // Read back and verify
    console.log(`  Verifying remote Blob read-back for ${target.privatePath}...`);
    const blobObj = await get(target.privatePath, { access: "private", token });
    if (!blobObj || !blobObj.stream) throw new Error(`Failed to read back ${target.privatePath} from Blob`);

    const chunks = [];
    for await (const chunk of blobObj.stream) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength));
    }
    const readBytes = Buffer.concat(chunks);
    const remoteHash = createHash("sha256").update(readBytes).digest("hex");
    if (remoteHash !== target.expectedSha256) {
      throw new Error(`Remote SHA-256 mismatch for ${target.privatePath}!`);
    }
    console.log(`  ✓ Remote SHA-256 verified identical: ${remoteHash.slice(0, 16)}...`);
  }

  console.log("\n[3/3] Indo-Western assets successfully staged and uploaded to private Blob storage!");
}

syncLocalCacheAndUpload().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
