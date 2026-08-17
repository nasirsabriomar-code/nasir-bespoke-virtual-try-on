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

const SHERWANI_DESIGN_IDS = [
  "SHERWANI_01_CLASSIC",
  "SHERWANI_02_LAYERED",
  "SHERWANI_03_JODHPURI",
  "SHERWANI_04_ASYMMETRIC",
  "SHERWANI_05_ROYAL",
];

const SHERWANI_ASSET_IDS = [
  "SHERWANI_01_CLASSIC_CARD_V1",
  "SHERWANI_01_CLASSIC_PRIMARY_V1",
  "SHERWANI_02_LAYERED_CARD_V1",
  "SHERWANI_02_LAYERED_PRIMARY_V1",
  "SHERWANI_03_JODHPURI_CARD_V1",
  "SHERWANI_03_JODHPURI_PRIMARY_V1",
  "SHERWANI_04_ASYMMETRIC_CARD_V1",
  "SHERWANI_04_ASYMMETRIC_PRIMARY_V1",
  "SHERWANI_05_ROYAL_CARD_V1",
  "SHERWANI_05_ROYAL_PRIMARY_V1",
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
  const envFiles = [".env.production.local", ".env.local"];
  for (const envFile of envFiles) {
    const envPath = path.resolve(process.cwd(), envFile);
    try {
      const content = await readFile(envPath, "utf8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const equalsIndex = trimmed.indexOf("=");
        if (equalsIndex === -1) continue;
        const key = trimmed.slice(0, equalsIndex).trim();
        const value = cleanEnvValue(trimmed.slice(equalsIndex + 1));
        if (value && value !== "[SENSITIVE]" && (!process.env[key] || process.env[key] === "[SENSITIVE]")) {
          process.env[key] = value;
        }
      }
    } catch {
      // file is optional
    }
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

function buildAuthoritativeSherwaniPatch() {
  const sherwaniCategory = DEFAULT_LEVEL1_CATALOGUE.categories.find((c) => c.id === "sherwani");
  if (!sherwaniCategory || sherwaniCategory.status !== "active") {
    throw new Error("Authoritative seed does not have an active 'sherwani' category.");
  }

  const sherwaniDesigns = DEFAULT_LEVEL1_CATALOGUE.designs.filter((d) => d.categoryId === "sherwani");
  if (sherwaniDesigns.length !== 5) {
    throw new Error(`Expected 5 Sherwani designs in authoritative seed, found ${sherwaniDesigns.length}.`);
  }

  const sherwaniAssets = DEFAULT_LEVEL1_CATALOGUE.assets.filter((a) => SHERWANI_ASSET_IDS.includes(a.id));
  if (sherwaniAssets.length !== 10) {
    throw new Error(`Expected 10 Sherwani assets in authoritative seed, found ${sherwaniAssets.length}.`);
  }

  for (const a of sherwaniAssets) {
    if (!a.checksum || a.checksum.length !== 64 || !/^[0-9a-f]{64}$/i.test(a.checksum)) {
      throw new Error(`Invalid checksum for Sherwani asset "${a.id}": "${a.checksum}".`);
    }
    if (!a.privatePath || a.status !== "active") {
      throw new Error(`Incomplete Sherwani asset record for "${a.id}".`);
    }
  }

  return {
    category: sherwaniCategory,
    designs: sherwaniDesigns,
    assets: sherwaniAssets,
  };
}

function computeSherwaniChanges(storedCatalogue, patch) {
  const changes = {
    category: null,
    designsToAdd: [],
    designsUnchanged: [],
    assetsToAdd: [],
    assetsToUpdate: [],
    assetsUnchanged: [],
  };

  // 1. Category check
  const existingCat = storedCatalogue.categories.find((c) => c.id === "sherwani");
  if (!existingCat) {
    changes.category = { action: "insert", from: null, to: patch.category };
  } else if (existingCat.status !== "active") {
    changes.category = { action: "update_status", from: existingCat.status, to: "active" };
  } else {
    changes.category = { action: "unchanged", status: "active" };
  }

  // 2. Designs check
  const storedDesignMap = new Map(storedCatalogue.designs.map((d) => [d.id, d]));
  for (const d of patch.designs) {
    if (!storedDesignMap.has(d.id)) {
      changes.designsToAdd.push(d);
    } else {
      changes.designsUnchanged.push(d.id);
    }
  }

  // 3. Assets check
  const storedAssetMap = new Map(storedCatalogue.assets.map((a) => [a.id, a]));
  for (const a of patch.assets) {
    const existing = storedAssetMap.get(a.id);
    if (!existing) {
      changes.assetsToAdd.push(a);
    } else {
      let hasDifference = false;
      const diff = {};
      for (const field of ["status", "privatePath", "checksum", "contentType", "provenance"]) {
        if (existing[field] !== a[field]) {
          diff[field] = { from: existing[field], to: a[field] };
          hasDifference = true;
        }
      }
      if (hasDifference) {
        changes.assetsToUpdate.push({ id: a.id, diff });
      } else {
        changes.assetsUnchanged.push(a.id);
      }
    }
  }

  return changes;
}

function applySherwaniPatchInMemory(storedCatalogue, patch) {
  const patched = structuredClone(storedCatalogue);

  // 1. Update / Insert sherwani category
  const catIndex = patched.categories.findIndex((c) => c.id === "sherwani");
  if (catIndex >= 0) {
    patched.categories[catIndex] = { ...patched.categories[catIndex], status: "active" };
  } else {
    patched.categories.push(structuredClone(patch.category));
  }

  // 2. Add Sherwani designs (skip existing)
  const existingDesignIds = new Set(patched.designs.map((d) => d.id));
  for (const d of patch.designs) {
    if (!existingDesignIds.has(d.id)) {
      patched.designs.push(structuredClone(d));
    }
  }

  // 3. Add or update Sherwani assets
  const existingAssetMap = new Map(patched.assets.map((a, index) => [a.id, index]));
  for (const a of patch.assets) {
    if (existingAssetMap.has(a.id)) {
      const idx = existingAssetMap.get(a.id);
      patched.assets[idx] = structuredClone(a);
    } else {
      patched.assets.push(structuredClone(a));
    }
  }

  return patched;
}

async function saveBackup(catalogue, preHash) {
  await mkdir(BACKUP_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `redis-catalog-level1-sherwani-${timestamp}-${preHash.slice(0, 12)}.json`;
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
  console.log("NASIR BESPOKE — LEVEL 1 SHERWANI REDIS MIGRATION");
  console.log("MODE: DRY-RUN (READ-ONLY)");
  console.log("==================================================");
  console.log(`Endpoint:   ${maskedUrl}`);
  console.log(`Target Key: ${TARGET_KEY}`);

  const rawStored = await redis.get(TARGET_KEY);
  if (!rawStored) {
    console.log("\nTarget key does NOT exist in Redis.");
    console.log("A future --apply will initialize the default Level 1 catalogue with all 10 active designs.");
    return;
  }

  validateCatalogueSchema(rawStored);
  const preHash = sha256(rawStored);
  console.log(`Catalogue Version: ${rawStored.version}`);
  console.log(`Pre-migration SHA-256: ${preHash}`);

  const patch = buildAuthoritativeSherwaniPatch();
  const changes = computeSherwaniChanges(rawStored, patch);

  console.log("\n--- CATEGORY CHANGES ---");
  if (changes.category.action === "update_status") {
    console.log(`➜ [UPDATE] sherwani category status: "${changes.category.from}" → "${changes.category.to}"`);
  } else if (changes.category.action === "insert") {
    console.log(`➜ [INSERT] sherwani category will be added as "active".`);
  } else {
    console.log(`✔ [MATCH] sherwani category is already active.`);
  }

  console.log("\n--- DESIGN CHANGES (5 SHERWANI DESIGNS) ---");
  for (const d of changes.designsToAdd) {
    console.log(`➜ [INSERT DESIGN] ${d.id} ("${d.customer.name}" - ${d.blueprint.garmentFamily})`);
  }
  for (const id of changes.designsUnchanged) {
    console.log(`✔ [MATCH DESIGN] ${id} already present.`);
  }

  console.log("\n--- ASSET CHANGES (10 SHERWANI ASSETS) ---");
  for (const a of changes.assetsToAdd) {
    console.log(`➜ [INSERT ASSET] ${a.id} (${a.designId} / ${a.purpose}) -> ${a.privatePath}`);
  }
  for (const a of changes.assetsToUpdate) {
    console.log(`➜ [UPDATE ASSET] ${a.id}:`, a.diff);
  }
  for (const id of changes.assetsUnchanged) {
    console.log(`✔ [MATCH ASSET] ${id} already matches approved metadata.`);
  }

  console.log("\n--- CURRENT WORKING SUIT CATALOGUE CHECK ---");
  const storedSuitDesigns = rawStored.designs.filter((d) => d.id.startsWith("SUIT_"));
  const storedSuitAssets = rawStored.assets.filter((a) => a.id.startsWith("SUIT_"));
  console.log(`✔ Working Suits preserved: ${storedSuitDesigns.length} designs, ${storedSuitAssets.length} active assets.`);

  const needsApply = changes.category.action !== "unchanged" || changes.designsToAdd.length > 0 || changes.assetsToAdd.length > 0 || changes.assetsToUpdate.length > 0;

  console.log("\n--- SUMMARY ---");
  if (!needsApply) {
    console.log("STATUS: IDEMPOTENT (Redis already contains the complete Sherwani expansion).");
    console.log("A future --apply will perform 0 writes.");
  } else {
    console.log(`STATUS: READY FOR APPLY (${changes.designsToAdd.length} designs and ${changes.assetsToAdd.length} assets will be added).`);
    console.log("No changes were made to Redis during this dry-run.");
  }
}

async function runApply(redis, maskedUrl) {
  console.log("==================================================");
  console.log("NASIR BESPOKE — LEVEL 1 SHERWANI REDIS MIGRATION");
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
  const patch = buildAuthoritativeSherwaniPatch();
  const changes = computeSherwaniChanges(rawStored, patch);
  const needsApply = changes.category.action !== "unchanged" || changes.designsToAdd.length > 0 || changes.assetsToAdd.length > 0 || changes.assetsToUpdate.length > 0;

  if (!needsApply) {
    console.log("✔ Sherwani catalogue is already present and active. No write needed.");
    return;
  }

  const patched = applySherwaniPatchInMemory(rawStored, patch);
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
  console.log(`✔ Updated catalogue with Sherwani expansion written to "${TARGET_KEY}".`);

  // 5. Write Audit Marker
  const auditTimestamp = new Date().toISOString();
  const auditKey = `${AUDIT_KEY_PREFIX}${auditTimestamp.replace(/[:.]/g, "-")}`;
  const auditRecord = {
    action: "migrate_level1_sherwani_catalogue",
    targetKey: TARGET_KEY,
    timestamp: auditTimestamp,
    preMigrationSha256: preHash,
    postMigrationSha256: postHash,
    backupFile,
    addedDesigns: changes.designsToAdd.map((d) => d.id),
    addedAssets: changes.assetsToAdd.map((a) => a.id),
  };
  await redis.set(auditKey, auditRecord);
  console.log(`✔ Audit record stored at "${auditKey}".`);

  // 6. Post-Write Verification
  const verifyRead = await redis.get(TARGET_KEY);
  validateCatalogueSchema(verifyRead);
  const verifyDesignMap = new Map(verifyRead.designs.map((d) => [d.id, d]));
  const verifyAssetMap = new Map(verifyRead.assets.map((a) => [a.id, a]));

  for (const designId of [...EXPECTED_SUIT_IDS, ...SHERWANI_DESIGN_IDS]) {
    if (!verifyDesignMap.has(designId)) {
      throw new Error(`POST-VERIFICATION FAILED: design "${designId}" is missing.`);
    }
  }

  for (const assetId of SHERWANI_ASSET_IDS) {
    const asset = verifyAssetMap.get(assetId);
    if (!asset || asset.status !== "active" || !asset.privatePath || !asset.checksum) {
      throw new Error(`POST-VERIFICATION FAILED for asset "${assetId}".`);
    }
  }
  console.log("✔ Post-verification succeeded: all 10 designs and 20 assets are active with verified paths and checksums.");
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
    console.log("  node scripts/migrate-level1-sherwani.mjs [--dry-run]   (default, read-only)");
    console.log("  node scripts/migrate-level1-sherwani.mjs --apply        (performs live write with backup & concurrency guard)");
    console.log("  node scripts/migrate-level1-sherwani.mjs --rollback <path/to/backup.json>");
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
  console.error("\n❌ MIGRATION ERROR:", error instanceof Error ? error.message : error);
  process.exit(1);
});
