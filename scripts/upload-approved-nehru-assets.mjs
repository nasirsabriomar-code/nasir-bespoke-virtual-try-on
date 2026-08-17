#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { get, put } from "@vercel/blob";

const BLOB_TOKEN_ENV = "NASIR_BLOB_READ_WRITE_TOKEN";

export const APPROVED_NEHRU_TARGETS = [
  {
    order: 1,
    designId: "NEHRU_01_CLASSIC",
    name: "Classic",
    sourceFile: "/Users/omar/.gemini/antigravity/brain/50ead555-ec46-4007-bc59-b9ca610951bf/.user_uploaded/media_1786957335932.jpg",
    localCacheCard: ".cache/catalog-assets/NEHRU_01_CLASSIC_CARD_V1.jpg",
    localCachePrimary: ".cache/catalog-assets/NEHRU_01_CLASSIC_PRIMARY_V1.jpg",
    aliasFile: ".cache/catalog-assets/nehru-classic.jpg",
    privatePath: "nasir-bespoke/catalogue/level1/v1/NEHRU_01_CLASSIC/approved.jpg",
    expectedSha256: "3152976c51e3e60dd661ff795d10526012111d4d3c333a39e802377319ad080a",
    expectedSizeBytes: 195160,
    contentType: "image/jpeg",
  },
  {
    order: 2,
    designId: "NEHRU_02_FORMAL",
    name: "Formal",
    sourceFile: "/Users/omar/.gemini/antigravity/brain/50ead555-ec46-4007-bc59-b9ca610951bf/.user_uploaded/media_1786957335925.jpg",
    localCacheCard: ".cache/catalog-assets/NEHRU_02_FORMAL_CARD_V1.jpg",
    localCachePrimary: ".cache/catalog-assets/NEHRU_02_FORMAL_PRIMARY_V1.jpg",
    aliasFile: ".cache/catalog-assets/nehru-formal.jpg",
    privatePath: "nasir-bespoke/catalogue/level1/v1/NEHRU_02_FORMAL/approved.jpg",
    expectedSha256: "fdea7f61a352ca49dd824707119e99596001099615a133f9b84e622b74052ca5",
    expectedSizeBytes: 220552,
    contentType: "image/jpeg",
  },
  {
    order: 3,
    designId: "NEHRU_03_TEXTURED",
    name: "Textured",
    sourceFile: "/Users/omar/.gemini/antigravity/brain/50ead555-ec46-4007-bc59-b9ca610951bf/.user_uploaded/media_1786957335930.jpg",
    localCacheCard: ".cache/catalog-assets/NEHRU_03_TEXTURED_CARD_V1.jpg",
    localCachePrimary: ".cache/catalog-assets/NEHRU_03_TEXTURED_PRIMARY_V1.jpg",
    aliasFile: ".cache/catalog-assets/nehru-textured.jpg",
    privatePath: "nasir-bespoke/catalogue/level1/v1/NEHRU_03_TEXTURED/approved.jpg",
    expectedSha256: "c10df77de1966a3d9e4a8ea64da8a21396b1859f71587d60da80fcb9d75ee5a1",
    expectedSizeBytes: 239053,
    contentType: "image/jpeg",
  },
  {
    order: 4,
    designId: "NEHRU_04_CONTEMPORARY",
    name: "Contemporary",
    sourceFile: "/Users/omar/.gemini/antigravity/brain/50ead555-ec46-4007-bc59-b9ca610951bf/.user_uploaded/media_1786957335935.jpg",
    localCacheCard: ".cache/catalog-assets/NEHRU_04_CONTEMPORARY_CARD_V1.jpg",
    localCachePrimary: ".cache/catalog-assets/NEHRU_04_CONTEMPORARY_PRIMARY_V1.jpg",
    aliasFile: ".cache/catalog-assets/nehru-contemporary.jpg",
    privatePath: "nasir-bespoke/catalogue/level1/v1/NEHRU_04_CONTEMPORARY/approved.jpg",
    expectedSha256: "e78d8a6dc96e95aa1c437349141fb5d68128ee3e87498c1995cb4d306b3a0780",
    expectedSizeBytes: 214544,
    contentType: "image/jpeg",
  },
  {
    order: 5,
    designId: "NEHRU_05_STATEMENT",
    name: "Statement",
    sourceFile: "/Users/omar/.gemini/antigravity/brain/50ead555-ec46-4007-bc59-b9ca610951bf/.user_uploaded/media_1786957335927.jpg",
    localCacheCard: ".cache/catalog-assets/NEHRU_05_STATEMENT_CARD_V1.jpg",
    localCachePrimary: ".cache/catalog-assets/NEHRU_05_STATEMENT_PRIMARY_V1.jpg",
    aliasFile: ".cache/catalog-assets/nehru-statement.jpg",
    privatePath: "nasir-bespoke/catalogue/level1/v1/NEHRU_05_STATEMENT/approved.jpg",
    expectedSha256: "b5ef173371b69733ebdf1b608889146df7c02b34a66bb341c2c31e9f137e96b3",
    expectedSizeBytes: 240115,
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
  if (!token) throw new Error("Missing Blob token");
  return token;
}

async function syncLocalCacheAndUpload() {
  console.log("==================================================");
  console.log("NASIR BESPOKE — NEHRU JACKET ASSET INGESTION & UPLOAD");
  console.log("==================================================");

  await mkdir(".cache/catalog-assets", { recursive: true });
  const token = await getBlobToken();

  for (const target of APPROVED_NEHRU_TARGETS) {
    console.log(`\nProcessing ${target.designId} (${target.name})...`);

    // Verify remote Blob read-back
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

  console.log("\n[3/3] Nehru Jacket assets successfully verified in private Blob storage!");
}

syncLocalCacheAndUpload().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
