#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Redis } from "@upstash/redis";
import { DEFAULT_LEVEL1_CATALOGUE } from "../lib/catalog/level1-seed.ts";

const TARGET_KEY = "nasir-tryon:catalog:level1:v1";
const AUDIT_KEY_PREFIX = "nasir-tryon:catalog:level1:audit:";
const BACKUP_DIR = path.resolve(process.cwd(), "backups");

const EXPECTED_SUIT_IDS = [
  "SUIT_01_CLASSIC",
  "SUIT_02_TUXEDO",
  "SUIT_03_STATEMENT",
  "SUIT_04_DOUBLE_BREASTED",
  "SUIT_05_THREE_PIECE",
];

const TARGET_ASSET_IDS = [
  "SUIT_01_CLASSIC_CARD_V1",
  "SUIT_01_CLASSIC_PRIMARY_V1",
  "SUIT_02_TUXEDO_CARD_V1",
  "SUIT_02_TUXEDO_PRIMARY_V1",
  "SUIT_03_STATEMENT_CARD_V1",
  "SUIT_03_STATEMENT_PRIMARY_V1",
  "SUIT_04_DOUBLE_BREASTED_CARD_V1",
  "SUIT_04_DOUBLE_BREASTED_PRIMARY_V1",
  "SUIT_05_THREE_PIECE_CARD_V1",
  "SUIT_05_THREE_PIECE_PRIMARY_V1",
];

function sha256(content) {
  const normalized = typeof content === "string" ? content : JSON.stringify(content);
  return createHash("sha256").update(normalized).digest("hex");
}

function maskUrl(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//***.${parsed.hostname.split(".").slice(-2).join(".")}`;
  } catch {
    return "***";
  }
}

function cleanEnvValue(val) {
  if (!val) return "";
  let v = String(val).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

async function loadEnvIfMissing() {
  const envLocalPath = path.resolve(process.cwd(), ".env.local");
  try {
    const content = await readFile(envLocalPath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const equalsIndex = trimmed.indexOf("=");
      if (equalsIndex === -1) continue;
      const key = trimmed.slice(0, equalsIndex).trim();
      const value = cleanEnvValue(trimmed.slice(equalsIndex + 1));
      if (!process.env[key] || process.env[key].startsWith('"')) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env.local is optional; environment variables may be injected directly.
  }
}

function getRedisClient() {
  const upstashUrl = cleanEnvValue(process.env.UPSTASH_REDIS_REST_URL);
  const upstashToken = cleanEnvValue(process.env.UPSTASH_REDIS_REST_TOKEN);
  const kvUrl = cleanEnvValue(process.env.KV_REST_API_URL);
  const kvToken = cleanEnvValue(process.env.KV_REST_API_TOKEN);

  const url = (upstashUrl && upstashUrl.startsWith("https://")) ? upstashUrl : (kvUrl && kvUrl.startsWith("https://")) ? kvUrl : "";
  const token = (upstashToken && upstashToken !== "[SENSITIVE]" && upstashToken.length > 5) ? upstashToken : (kvToken && kvToken !== "[SENSITIVE]" && kvToken.length > 5) ? kvToken : "";

  if (!url || !token) {
    throw new Error(
      "Missing required Redis environment variables: UPSTASH_REDIS_REST_URL/TOKEN (or KV_REST_API_URL/TOKEN) must be set with valid HTTPS endpoints.",
    );
  }
  return {
    redis: new Redis({ url, token }),
    maskedUrl: maskUrl(url),
  };
}

function validateCatalogueSchema(catalogue) {
  if (!catalogue || typeof catalogue !== "object") {
    throw new Error("Invalid catalogue structure: stored value is not an object.");
  }
  if (catalogue.version !== 1) {
    throw new Error(`Unsupported catalogue version: expected 1, found ${catalogue.version}.`);
  }
  if (!Array.isArray(catalogue.categories) || !Array.isArray(catalogue.designs) || !Array.isArray(catalogue.assets)) {
    throw new Error("Invalid catalogue structure: categories, designs, and assets must be arrays.");
  }

  // Check for duplicate category IDs
  const categoryIds = new Set();
  for (const cat of catalogue.categories) {
    if (!cat.id || typeof cat.id !== "string") throw new Error("Category record is missing an id.");
    if (categoryIds.has(cat.id)) throw new Error(`Duplicate category ID found: ${cat.id}`);
    categoryIds.add(cat.id);
  }

  // Check for duplicate design IDs and verify expected suit designs exist
  const designIds = new Set();
  for (const design of catalogue.designs) {
    if (!design.id || typeof design.id !== "string") throw new Error("Design record is missing an id.");
    if (designIds.has(design.id)) throw new Error(`Duplicate design ID found: ${design.id}`);
    designIds.add(design.id);
  }

  for (const expectedId of EXPECTED_SUIT_IDS) {
    if (!designIds.has(expectedId)) {
      throw new Error(`Expected Suit design ID "${expectedId}" is missing from the stored catalogue.`);
    }
  }

  // Check for duplicate asset IDs
  const assetIds = new Set();
  for (const asset of catalogue.assets) {
    if (!asset.id || typeof asset.id !== "string") throw new Error("Asset record is missing an id.");
    if (assetIds.has(asset.id)) throw new Error(`Duplicate asset ID found: ${asset.id}`);
    assetIds.add(asset.id);
  }
}

function buildAuthoritativePatchMap() {
  const patchMap = new Map();
  for (const asset of DEFAULT_LEVEL1_CATALOGUE.assets) {
    if (TARGET_ASSET_IDS.includes(asset.id)) {
      if (!asset.privatePath || !asset.checksum || !asset.contentType || asset.status !== "active") {
        throw new Error(`Authoritative seed asset "${asset.id}" is incomplete.`);
      }
      if (asset.checksum.length !== 64 || !/^[0-9a-f]{64}$/i.test(asset.checksum)) {
        throw new Error(`Authoritative seed asset "${asset.id}" has invalid SHA-256 checksum: "${asset.checksum}".`);
      }
      patchMap.set(asset.id, asset);
    }
  }

  if (patchMap.size !== TARGET_ASSET_IDS.length) {
    throw new Error(`Expected ${TARGET_ASSET_IDS.length} target assets in authoritative seed, found ${patchMap.size}.`);
  }
  return patchMap;
}

function computeChanges(storedCatalogue, patchMap) {
  const changes = [];
  const storedAssetMap = new Map(storedCatalogue.assets.map((a) => [a.id, a]));

  for (const [targetId, approvedAsset] of patchMap.entries()) {
    const existing = storedAssetMap.get(targetId);
    if (!existing) {
      changes.push({
        assetId: targetId,
        designId: approvedAsset.designId,
        purpose: approvedAsset.purpose,
        action: "insert",
        diff: {
          status: { from: undefined, to: approvedAsset.status },
          privatePath: { from: undefined, to: approvedAsset.privatePath },
          checksum: { from: undefined, to: approvedAsset.checksum },
          contentType: { from: undefined, to: approvedAsset.contentType },
          provenance: { from: undefined, to: approvedAsset.provenance },
        },
      });
    } else {
      const fieldDiffs = {};
      let hasDifference = false;
      for (const field of ["status", "privatePath", "checksum", "contentType", "provenance"]) {
        if (existing[field] !== approvedAsset[field]) {
          fieldDiffs[field] = { from: existing[field], to: approvedAsset[field] };
          hasDifference = true;
        }
      }
      if (hasDifference) {
        changes.push({
          assetId: targetId,
          designId: approvedAsset.designId,
          purpose: approvedAsset.purpose,
          action: "update",
          diff: fieldDiffs,
        });
      } else {
        changes.push({
          assetId: targetId,
          designId: approvedAsset.designId,
          purpose: approvedAsset.purpose,
          action: "unchanged",
          diff: {},
        });
      }
    }
  }

  const unchangedCount = storedCatalogue.assets.length - changes.filter((c) => c.action === "update").length;
  return { changes, unchangedCount };
}

function applyPatchInMemory(storedCatalogue, patchMap) {
  const patched = structuredClone(storedCatalogue);
  const existingIds = new Set(patched.assets.map((a) => a.id));

  // Update existing matching assets
  patched.assets = patched.assets.map((asset) => {
    if (patchMap.has(asset.id)) {
      const approved = patchMap.get(asset.id);
      return {
        ...asset,
        status: approved.status,
        privatePath: approved.privatePath,
        contentType: approved.contentType,
        checksum: approved.checksum,
        provenance: approved.provenance,
      };
    }
    return asset;
  });

  // If any target assets were missing from stored assets array, append them
  for (const [targetId, approvedAsset] of patchMap.entries()) {
    if (!existingIds.has(targetId)) {
      patched.assets.push(structuredClone(approvedAsset));
    }
  }

  return patched;
}

async function saveBackup(catalogue, preHash) {
  await mkdir(BACKUP_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `redis-catalog-level1-${timestamp}-${preHash.slice(0, 12)}.json`;
  const filepath = path.join(BACKUP_DIR, filename);

  const backupData = {
    targetKey: TARGET_KEY,
    timestamp: new Date().toISOString(),
    preMigrationSha256: preHash,
    catalogue,
  };

  await writeFile(filepath, JSON.stringify(backupData, null, 2), "utf8");
  return filepath;
}

async function runDryRun(redis, maskedUrl) {
  console.log("==================================================");
  console.log("NASIR BESPOKE — LEVEL 1 CATALOGUE REDIS MIGRATION");
  console.log("MODE: DRY-RUN (READ-ONLY)");
  console.log("==================================================");
  console.log(`Endpoint:   ${maskedUrl}`);
  console.log(`Target Key: ${TARGET_KEY}`);

  const rawStored = await redis.get(TARGET_KEY);
  if (!rawStored) {
    console.log("\nTarget key does NOT exist in Redis.");
    console.log("A future --apply would initialize the default Level 1 catalogue with all 5 active Suit designs.");
    console.log(`Total seed categories: ${DEFAULT_LEVEL1_CATALOGUE.categories.length}`);
    console.log(`Total seed designs:    ${DEFAULT_LEVEL1_CATALOGUE.designs.length}`);
    console.log(`Total seed assets:     ${DEFAULT_LEVEL1_CATALOGUE.assets.length}`);
    return;
  }

  validateCatalogueSchema(rawStored);
  const preHash = sha256(rawStored);
  console.log(`Catalogue Version: ${rawStored.version}`);
  console.log(`Pre-migration SHA-256: ${preHash}`);

  const patchMap = buildAuthoritativePatchMap();
  const { changes, unchangedCount } = computeChanges(rawStored, patchMap);

  console.log("\n--- TARGET ASSETS INSPECTION (10 RECORDS) ---");
  let updatesCount = 0;
  for (const item of changes) {
    if (item.action === "unchanged") {
      console.log(`✔ [MATCH] ${item.assetId} (${item.designId}): already matches approved metadata.`);
    } else {
      updatesCount += 1;
      console.log(`➜ [PATCH] ${item.assetId} (${item.designId}):`);
      for (const [field, delta] of Object.entries(item.diff)) {
        console.log(`    - ${field}: ${JSON.stringify(delta.from)} → ${JSON.stringify(delta.to)}`);
      }
    }
  }

  console.log("\n--- SUMMARY ---");
  console.log(`Target assets examined:  ${changes.length}`);
  console.log(`Records requiring update: ${updatesCount}`);
  console.log(`Unrelated assets untouched: ${unchangedCount}`);
  console.log(`Categories preserved:    ${rawStored.categories.length} (including draft ceremonial categories)`);

  if (updatesCount === 0) {
    console.log("\nSTATUS: IDEMPOTENT (Redis already contains all approved active assets).");
    console.log("A future --apply will perform 0 writes.");
  } else {
    console.log(`\nSTATUS: READY FOR APPLY (${updatesCount} records will be updated).`);
    console.log("No changes were made to Redis during this dry-run.");
  }
}

async function runApply(redis, maskedUrl) {
  console.log("==================================================");
  console.log("NASIR BESPOKE — LEVEL 1 CATALOGUE REDIS MIGRATION");
  console.log("MODE: APPLY (LIVE WRITE)");
  console.log("==================================================");
  console.log(`Endpoint:   ${maskedUrl}`);
  console.log(`Target Key: ${TARGET_KEY}`);

  const rawStored = await redis.get(TARGET_KEY);
  if (!rawStored) {
    console.log("Target key does not exist. Initializing with authoritative default Level 1 catalogue...");
    await redis.set(TARGET_KEY, DEFAULT_LEVEL1_CATALOGUE);
    console.log("✔ Default catalogue written successfully.");
    return;
  }

  validateCatalogueSchema(rawStored);
  const preHash = sha256(rawStored);
  console.log(`Pre-migration SHA-256: ${preHash}`);

  // 1. Save Backup
  const backupFile = await saveBackup(rawStored, preHash);
  console.log(`✔ Secure backup saved to: ${backupFile}`);

  // 2. Build Patch
  const patchMap = buildAuthoritativePatchMap();
  const { changes } = computeChanges(rawStored, patchMap);
  const updatesNeeded = changes.filter((c) => c.action !== "unchanged");

  if (updatesNeeded.length === 0) {
    console.log("✔ All 10 assets already match approved target. No write needed.");
    return;
  }

  const patched = applyPatchInMemory(rawStored, patchMap);
  const postHash = sha256(patched);

  // 3. Concurrency Guard: Re-read key immediately before write
  const freshRead = await redis.get(TARGET_KEY);
  const freshHash = sha256(freshRead);
  if (freshHash !== preHash) {
    throw new Error(
      `CONCURRENCY ERROR: Redis key "${TARGET_KEY}" was modified concurrently (expected hash ${preHash.slice(0, 12)}, found ${freshHash.slice(0, 12)}). Aborting write.`,
    );
  }

  // 4. Perform Write
  await redis.set(TARGET_KEY, patched);
  console.log(`✔ Updated catalogue written to "${TARGET_KEY}".`);

  // 5. Write Audit Marker
  const auditTimestamp = new Date().toISOString();
  const auditKey = `${AUDIT_KEY_PREFIX}${auditTimestamp.replace(/[:.]/g, "-")}`;
  const auditRecord = {
    action: "migrate_level1_suit_catalogue",
    targetKey: TARGET_KEY,
    timestamp: auditTimestamp,
    preMigrationSha256: preHash,
    postMigrationSha256: postHash,
    backupFile,
    patchedAssetCount: updatesNeeded.length,
    patchedAssetIds: updatesNeeded.map((u) => u.assetId),
  };
  await redis.set(auditKey, auditRecord);
  console.log(`✔ Audit record stored at "${auditKey}".`);

  // 6. Post-Write Verification
  const verifyRead = await redis.get(TARGET_KEY);
  validateCatalogueSchema(verifyRead);
  const verifyMap = new Map(verifyRead.assets.map((a) => [a.id, a]));
  for (const assetId of TARGET_ASSET_IDS) {
    const asset = verifyMap.get(assetId);
    if (!asset || asset.status !== "active" || !asset.privatePath || !asset.checksum) {
      throw new Error(`POST-VERIFICATION FAILED for asset "${assetId}".`);
    }
  }
  console.log("✔ Post-verification succeeded: all 10 Suit assets are active with verified paths and checksums.");
}

async function runRollback(redis, maskedUrl, backupPath) {
  console.log("==================================================");
  console.log("NASIR BESPOKE — LEVEL 1 CATALOGUE ROLLBACK");
  console.log("==================================================");
  if (!backupPath) {
    throw new Error("Rollback requires a backup file path: --rollback <path/to/backup.json>");
  }

  const absoluteBackupPath = path.resolve(process.cwd(), backupPath);
  console.log(`Reading backup from: ${absoluteBackupPath}`);
  const content = await readFile(absoluteBackupPath, "utf8");
  const parsed = JSON.parse(content);

  if (!parsed.targetKey || parsed.targetKey !== TARGET_KEY || !parsed.catalogue) {
    throw new Error("Invalid backup file: does not contain a valid catalogue snapshot for this target key.");
  }

  validateCatalogueSchema(parsed.catalogue);
  const backupHash = sha256(parsed.catalogue);
  if (parsed.preMigrationSha256 && parsed.preMigrationSha256 !== backupHash) {
    throw new Error("Backup integrity error: computed hash does not match preMigrationSha256.");
  }

  console.log(`Backup hash verified: ${backupHash}`);
  await redis.set(TARGET_KEY, parsed.catalogue);
  console.log(`✔ Successfully restored "${TARGET_KEY}" from backup.`);
}

async function main() {
  const args = process.argv.slice(2);
  const isApply = args.includes("--apply");
  const rollbackIndex = args.indexOf("--rollback");
  const isRollback = rollbackIndex !== -1;
  const isHelp = args.includes("--help") || args.includes("-h");

  if (isHelp) {
    console.log("Usage:");
    console.log("  node scripts/migrate-level1-catalogue.mjs [--dry-run]   (default, read-only)");
    console.log("  node scripts/migrate-level1-catalogue.mjs --apply        (performs live write with backup & concurrency guard)");
    console.log("  node scripts/migrate-level1-catalogue.mjs --rollback <path/to/backup.json>");
    process.exit(0);
  }

  await loadEnvIfMissing();
  const { redis, maskedUrl } = getRedisClient();

  if (isRollback) {
    const backupFile = args[rollbackIndex + 1];
    await runRollback(redis, maskedUrl, backupFile);
  } else if (isApply) {
    await runApply(redis, maskedUrl);
  } else {
    // Default to safe dry-run
    await runDryRun(redis, maskedUrl);
  }
}

main().catch((error) => {
  console.error("\n❌ MIGRATION FAILED:", error instanceof Error ? error.message : error);
  process.exit(1);
});
