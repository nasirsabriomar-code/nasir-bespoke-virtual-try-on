#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { get, put } from "@vercel/blob";

const BLOB_TOKEN_ENV = "NASIR_BLOB_READ_WRITE_TOKEN";

export const APPROVED_ACHKAN_TARGETS = [
  {
    order: 1,
    designId: "ACHKAN_01_CLASSIC",
    name: "Classic",
    sourceFile: "/Users/omar/.gemini/antigravity/brain/50ead555-ec46-4007-bc59-b9ca610951bf/.user_uploaded/media_1786964909390.jpg",
    localCacheCard: ".cache/catalog-assets/ACHKAN_01_CLASSIC_CARD_V1.jpg",
    localCachePrimary: ".cache/catalog-assets/ACHKAN_01_CLASSIC_PRIMARY_V1.jpg",
    aliasFile: ".cache/catalog-assets/achkan-classic.jpg",
    privatePath: "nasir-bespoke/catalogue/level1/v1/ACHKAN_01_CLASSIC/approved.jpg",
    expectedSha256: "1612ea8836a1cef3096271f4b8b6e451d343f2edaffa475797d4e2fbd02650d1",
    expectedSizeBytes: 179680,
    contentType: "image/jpeg",
  },
  {
    order: 2,
    designId: "ACHKAN_02_JODHPURI",
    name: "Jodhpuri",
    sourceFile: "/Users/omar/.gemini/antigravity/brain/50ead555-ec46-4007-bc59-b9ca610951bf/.user_uploaded/media_1786964909389.jpg",
    localCacheCard: ".cache/catalog-assets/ACHKAN_02_JODHPURI_CARD_V1.jpg",
    localCachePrimary: ".cache/catalog-assets/ACHKAN_02_JODHPURI_PRIMARY_V1.jpg",
    aliasFile: ".cache/catalog-assets/achkan-jodhpuri.jpg",
    privatePath: "nasir-bespoke/catalogue/level1/v1/ACHKAN_02_JODHPURI/approved.jpg",
    expectedSha256: "aaa5c6470613edd7c01e31f9b238da6937a4ce3d06eba52553bf910df273f88b",
    expectedSizeBytes: 214332,
    contentType: "image/jpeg",
  },
  {
    order: 3,
    designId: "ACHKAN_03_ASYMMETRIC",
    name: "Asymmetric",
    sourceFile: "/Users/omar/.gemini/antigravity/brain/50ead555-ec46-4007-bc59-b9ca610951bf/.user_uploaded/media_1786964909394.jpg",
    localCacheCard: ".cache/catalog-assets/ACHKAN_03_ASYMMETRIC_CARD_V1.jpg",
    localCachePrimary: ".cache/catalog-assets/ACHKAN_03_ASYMMETRIC_PRIMARY_V1.jpg",
    aliasFile: ".cache/catalog-assets/achkan-asymmetric.jpg",
    privatePath: "nasir-bespoke/catalogue/level1/v1/ACHKAN_03_ASYMMETRIC/approved.jpg",
    expectedSha256: "17b9322ef4887fbe3b29b44baf051a76f2a55f570407922ac8909620cba1673a",
    expectedSizeBytes: 210902,
    contentType: "image/jpeg",
  },
  {
    order: 4,
    designId: "ACHKAN_04_EMBROIDERED",
    name: "Embroidered",
    sourceFile: "/Users/omar/.gemini/antigravity/brain/50ead555-ec46-4007-bc59-b9ca610951bf/.user_uploaded/media_1786964909416.jpg",
    localCacheCard: ".cache/catalog-assets/ACHKAN_04_EMBROIDERED_CARD_V1.jpg",
    localCachePrimary: ".cache/catalog-assets/ACHKAN_04_EMBROIDERED_PRIMARY_V1.jpg",
    aliasFile: ".cache/catalog-assets/achkan-embroidered.jpg",
    privatePath: "nasir-bespoke/catalogue/level1/v1/ACHKAN_04_EMBROIDERED/approved.jpg",
    expectedSha256: "5712a5fd0eba7b9391c97472dad976a4983230bfc1fd50b46c28ba417aaa2ffd",
    expectedSizeBytes: 252163,
    contentType: "image/jpeg",
  },
  {
    order: 5,
    designId: "ACHKAN_05_ROYAL",
    name: "Royal",
    sourceFile: "/Users/omar/.gemini/antigravity/brain/50ead555-ec46-4007-bc59-b9ca610951bf/.user_uploaded/media_1786964909418.jpg",
    localCacheCard: ".cache/catalog-assets/ACHKAN_05_ROYAL_CARD_V1.jpg",
    localCachePrimary: ".cache/catalog-assets/ACHKAN_05_ROYAL_PRIMARY_V1.jpg",
    aliasFile: ".cache/catalog-assets/achkan-royal.jpg",
    privatePath: "nasir-bespoke/catalogue/level1/v1/ACHKAN_05_ROYAL/approved.jpg",
    expectedSha256: "1b8acde57768b600ae6b697d51aaf52c135364e5ec4fa5751161a345235a3f2d",
    expectedSizeBytes: 247188,
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
  console.log("NASIR BESPOKE — ACHKAN PRIVATE ASSET INGESTION");
  console.log("==================================================");

  await mkdir(".cache/catalog-assets", { recursive: true });

  // 1. Stage locally in cache
  console.log("\n[1/3] Staging approved files into .cache/catalog-assets...");
  for (const target of APPROVED_ACHKAN_TARGETS) {
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

  console.log("\n[2/3] Uploading approved Achkan assets to private Vercel Blob...");
  for (const target of APPROVED_ACHKAN_TARGETS) {
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

  console.log("\n[3/3] Achkan assets successfully staged and uploaded to private Blob storage!");
}

syncLocalCacheAndUpload().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
