#!/usr/bin/env node
// Uploads one approved jacket/trouser reference photograph for Split Outfit
// Mode and prints a ready-to-paste APPROVED_SPLIT_REFERENCES ledger entry.
//
// Usage:
//   node scripts/upload-split-reference.mjs <optionId> <localFilePath>
//
// Example:
//   node scripts/upload-split-reference.mjs SUIT_UPPER_CLASSIC ./photos/classic-jacket.jpg
//
// This only uploads and computes a checksum — it does not edit
// lib/split-outfit/catalogue.ts. Paste the printed entry into
// APPROVED_SPLIT_REFERENCES yourself, matching the key to the optionId.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { put } from "@vercel/blob";

const BLOB_TOKEN_ENV = "NASIR_BLOB_READ_WRITE_TOKEN";

const CONTENT_TYPE_BY_EXT = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

function usageError(message) {
  console.error(`Error: ${message}\n`);
  console.error("Usage: node scripts/upload-split-reference.mjs <optionId> <localFilePath>");
  process.exit(1);
}

async function main() {
  const [optionId, localFilePath] = process.argv.slice(2);
  if (!optionId || !localFilePath) usageError("both <optionId> and <localFilePath> are required.");
  if (!/^[A-Z0-9_]+$/.test(optionId)) usageError(`"${optionId}" doesn't look like a real option ID (expected e.g. SUIT_UPPER_CLASSIC).`);

  const ext = extname(localFilePath).toLowerCase();
  const contentType = CONTENT_TYPE_BY_EXT[ext];
  if (!contentType) usageError(`Unsupported file extension "${ext}". Use .jpg, .jpeg, .png, or .webp.`);

  const token = (process.env[BLOB_TOKEN_ENV] ?? "").trim();
  if (!token || token === "[SENSITIVE]") usageError(`${BLOB_TOKEN_ENV} is not set in this shell's environment.`);

  const bytes = await readFile(localFilePath);
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const privatePath = `nasir-bespoke/catalogue/split/v1/${optionId}_REFERENCE_V1/approved${ext}`;

  console.log(`Uploading ${localFilePath} (${bytes.byteLength} bytes) to ${privatePath}...`);
  await put(privatePath, new Blob([bytes], { type: contentType }), {
    access: "private",
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
    contentType,
  });

  console.log("\nUpload complete. Paste this into APPROVED_SPLIT_REFERENCES in lib/split-outfit/catalogue.ts:\n");
  console.log(`  ${optionId}: {`);
  console.log(`    privatePath: "${privatePath}",`);
  console.log(`    checksum: "${checksum}",`);
  console.log(`    provenance: "Approved Nasir Bespoke Split Outfit reference supplied by project owner on ${new Date().toISOString().slice(0, 10)}.",`);
  console.log(`    contentType: "${contentType}",`);
  console.log("  },");
}

main().catch((error) => {
  console.error("Upload failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
