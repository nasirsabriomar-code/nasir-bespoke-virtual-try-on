#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { get, put } from "@vercel/blob";

const BLOB_TOKEN_ENV = "NASIR_BLOB_READ_WRITE_TOKEN";

export const APPROVED_KURTA_TARGETS = [
  {
    order: 1,
    designId: "KURTA_01_CLASSIC",
    name: "Classic",
    sourceFile: "/Users/omar/.gemini/antigravity/brain/50ead555-ec46-4007-bc59-b9ca610951bf/.user_uploaded/media_1786960566356.jpg",
    localCacheCard: ".cache/catalog-assets/KURTA_01_CLASSIC_CARD_V1.jpg",
    localCachePrimary: ".cache/catalog-assets/KURTA_01_CLASSIC_PRIMARY_V1.jpg",
    aliasFile: ".cache/catalog-assets/kurta-classic.jpg",
    privatePath: "nasir-bespoke/catalogue/level1/v1/KURTA_01_CLASSIC/approved.jpg",
    expectedSha256: "121f7986b606c2b2cb0720dc8aed72423bd61734628af1b18ed51120b2c6ef6c",
    expectedSizeBytes: 174385,
    contentType: "image/jpeg",
  },
  {
    order: 2,
    designId: "KURTA_05_CONTEMPORARY",
    name: "Contemporary",
    sourceFile: "/Users/omar/.gemini/antigravity/brain/50ead555-ec46-4007-bc59-b9ca610951bf/.user_uploaded/media_1786960566354.jpg",
    localCacheCard: ".cache/catalog-assets/KURTA_05_CONTEMPORARY_CARD_V1.jpg",
    localCachePrimary: ".cache/catalog-assets/KURTA_05_CONTEMPORARY_PRIMARY_V1.jpg",
    aliasFile: ".cache/catalog-assets/kurta-contemporary.jpg",
    privatePath: "nasir-bespoke/catalogue/level1/v1/KURTA_05_CONTEMPORARY/approved.jpg",
    expectedSha256: "a36b6662e1f00ca833724e0ec7a33a07f3ff67b256f2c1d2e48e18ffa43e9f84",
    expectedSizeBytes: 195358,
    contentType: "image/jpeg",
  },
  {
    order: 3,
    designId: "KURTA_03_LAYERED",
    name: "Layered",
    sourceFile: "/Users/omar/.gemini/antigravity/brain/50ead555-ec46-4007-bc59-b9ca610951bf/.user_uploaded/media_1786961610242.jpg",
    localCacheCard: ".cache/catalog-assets/KURTA_03_LAYERED_CARD_V1.jpg",
    localCachePrimary: ".cache/catalog-assets/KURTA_03_LAYERED_PRIMARY_V1.jpg",
    aliasFile: ".cache/catalog-assets/kurta-layered.jpg",
    privatePath: "nasir-bespoke/catalogue/level1/v1/KURTA_03_LAYERED/approved.jpg",
    expectedSha256: "ac92b716ad15d8454f45e68d576dc1f5cec237887f2a9d16521c15ddb6d041db",
    expectedSizeBytes: 206067,
    contentType: "image/jpeg",
  },
  {
    order: 4,
    designId: "KURTA_02_PATHANI",
    name: "Pathani",
    sourceFile: "/Users/omar/.gemini/antigravity/brain/50ead555-ec46-4007-bc59-b9ca610951bf/.user_uploaded/media_1786960566359.jpg",
    localCacheCard: ".cache/catalog-assets/KURTA_02_PATHANI_CARD_V1.jpg",
    localCachePrimary: ".cache/catalog-assets/KURTA_02_PATHANI_PRIMARY_V1.jpg",
    aliasFile: ".cache/catalog-assets/kurta-pathani.jpg",
    privatePath: "nasir-bespoke/catalogue/level1/v1/KURTA_02_PATHANI/approved.jpg",
    expectedSha256: "f077900f61957baa72e7c29ec5edc5f2602791af2d7c4e57583463d641b4d4c5",
    expectedSizeBytes: 188815,
    contentType: "image/jpeg",
  },
  {
    order: 5,
    designId: "KURTA_04_FESTIVE",
    name: "Festive",
    sourceFile: "/Users/omar/.gemini/antigravity/brain/50ead555-ec46-4007-bc59-b9ca610951bf/.user_uploaded/media_1786960566358.jpg",
    localCacheCard: ".cache/catalog-assets/KURTA_04_FESTIVE_CARD_V1.jpg",
    localCachePrimary: ".cache/catalog-assets/KURTA_04_FESTIVE_PRIMARY_V1.jpg",
    aliasFile: ".cache/catalog-assets/kurta-festive.jpg",
    privatePath: "nasir-bespoke/catalogue/level1/v1/KURTA_04_FESTIVE/approved.jpg",
    expectedSha256: "d7ee35981814d1fd109463e08fc63da2e73e5ed72627ba7cbcc86eb5dfb44d6b",
    expectedSizeBytes: 223946,
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
  console.log("NASIR BESPOKE — KURTA SET PRIVATE ASSET INGESTION");
  console.log("==================================================");

  await mkdir(".cache/catalog-assets", { recursive: true });

  // 1. Stage locally in cache
  console.log("\n[1/3] Staging approved files into .cache/catalog-assets...");
  for (const target of APPROVED_KURTA_TARGETS) {
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

  console.log("\n[2/3] Uploading approved Kurta Set assets to private Vercel Blob...");
  for (const target of APPROVED_KURTA_TARGETS) {
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

  console.log("\n[3/3] Kurta Set assets successfully staged and uploaded to private Blob storage!");
}

syncLocalCacheAndUpload().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
