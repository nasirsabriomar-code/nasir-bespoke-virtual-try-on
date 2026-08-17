#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { get, put } from "@vercel/blob";

const BLOB_TOKEN_ENV = "NASIR_BLOB_READ_WRITE_TOKEN";

export const APPROVED_BANDHGALA_TARGETS = [
  {
    order: 1,
    designId: "BANDHGALA_01_CLASSIC",
    name: "Classic",
    sourceFile: "/Users/omar/.gemini/antigravity/brain/50ead555-ec46-4007-bc59-b9ca610951bf/.user_uploaded/media_1786956235074.jpg",
    localCacheCard: ".cache/catalog-assets/BANDHGALA_01_CLASSIC_CARD_V1.jpg",
    localCachePrimary: ".cache/catalog-assets/BANDHGALA_01_CLASSIC_PRIMARY_V1.jpg",
    aliasFile: ".cache/catalog-assets/bandhgala-classic.jpg",
    privatePath: "nasir-bespoke/catalogue/level1/v1/BANDHGALA_01_CLASSIC/approved.jpg",
    expectedSha256: "bf2064b0c1dd77be16a37d39a393577285b5ed21e63842fe1bce831b6652f8cc",
    expectedSizeBytes: 183004,
    contentType: "image/jpeg",
  },
  {
    order: 2,
    designId: "BANDHGALA_02_DOUBLE_BREASTED",
    name: "Double-Breasted",
    sourceFile: "/Users/omar/.gemini/antigravity/brain/50ead555-ec46-4007-bc59-b9ca610951bf/.user_uploaded/media_1786956235067.jpg",
    localCacheCard: ".cache/catalog-assets/BANDHGALA_02_DOUBLE_BREASTED_CARD_V1.jpg",
    localCachePrimary: ".cache/catalog-assets/BANDHGALA_02_DOUBLE_BREASTED_PRIMARY_V1.jpg",
    aliasFile: ".cache/catalog-assets/bandhgala-double-breasted.jpg",
    privatePath: "nasir-bespoke/catalogue/level1/v1/BANDHGALA_02_DOUBLE_BREASTED/approved.jpg",
    expectedSha256: "4c0579693f391caca2b7113526f852b417e1090f903d235712704d081c06caa5",
    expectedSizeBytes: 219229,
    contentType: "image/jpeg",
  },
  {
    order: 3,
    designId: "BANDHGALA_03_VELVET",
    name: "Velvet",
    sourceFile: "/Users/omar/.gemini/antigravity/brain/50ead555-ec46-4007-bc59-b9ca610951bf/.user_uploaded/media_1786956235071.jpg",
    localCacheCard: ".cache/catalog-assets/BANDHGALA_03_VELVET_CARD_V1.jpg",
    localCachePrimary: ".cache/catalog-assets/BANDHGALA_03_VELVET_PRIMARY_V1.jpg",
    aliasFile: ".cache/catalog-assets/bandhgala-velvet.jpg",
    privatePath: "nasir-bespoke/catalogue/level1/v1/BANDHGALA_03_VELVET/approved.jpg",
    expectedSha256: "65545fc524f699bec426449cc270b5a7edd06d442710ae12070e306adf6f7df1",
    expectedSizeBytes: 192433,
    contentType: "image/jpeg",
  },
  {
    order: 4,
    designId: "BANDHGALA_04_TEXTURED",
    name: "Textured",
    sourceFile: "/Users/omar/.gemini/antigravity/brain/50ead555-ec46-4007-bc59-b9ca610951bf/.user_uploaded/media_1786956235077.jpg",
    localCacheCard: ".cache/catalog-assets/BANDHGALA_04_TEXTURED_CARD_V1.jpg",
    localCachePrimary: ".cache/catalog-assets/BANDHGALA_04_TEXTURED_PRIMARY_V1.jpg",
    aliasFile: ".cache/catalog-assets/bandhgala-textured.jpg",
    privatePath: "nasir-bespoke/catalogue/level1/v1/BANDHGALA_04_TEXTURED/approved.jpg",
    expectedSha256: "13e0d229708780440fe416aabe4ab37a949c2307a4870d50bae5c5390c7f21a8",
    expectedSizeBytes: 262556,
    contentType: "image/jpeg",
  },
  {
    order: 5,
    designId: "BANDHGALA_05_STATEMENT",
    name: "Statement",
    sourceFile: "/Users/omar/.gemini/antigravity/brain/50ead555-ec46-4007-bc59-b9ca610951bf/.user_uploaded/media_1786956235069.jpg",
    localCacheCard: ".cache/catalog-assets/BANDHGALA_05_STATEMENT_CARD_V1.jpg",
    localCachePrimary: ".cache/catalog-assets/BANDHGALA_05_STATEMENT_PRIMARY_V1.jpg",
    aliasFile: ".cache/catalog-assets/bandhgala-statement.jpg",
    privatePath: "nasir-bespoke/catalogue/level1/v1/BANDHGALA_05_STATEMENT/approved.jpg",
    expectedSha256: "58564ebb1a6f325cced789634264b8f314bc6ceb0181987977d69c7159db635a",
    expectedSizeBytes: 228638,
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
  console.log("NASIR BESPOKE — BANDHGALA PRIVATE ASSET INGESTION");
  console.log("==================================================");

  await mkdir(".cache/catalog-assets", { recursive: true });

  // 1. Stage locally in cache
  console.log("\n[1/3] Staging approved files into .cache/catalog-assets...");
  for (const target of APPROVED_BANDHGALA_TARGETS) {
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

  console.log("\n[2/3] Uploading approved Bandhgala assets to private Vercel Blob...");
  for (const target of APPROVED_BANDHGALA_TARGETS) {
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

  console.log("\n[3/3] Bandhgala assets successfully staged and uploaded to private Blob storage!");
}

syncLocalCacheAndUpload().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
