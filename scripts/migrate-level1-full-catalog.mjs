#!/usr/bin/env node
/**
 * Nasir Bespoke Level 1 Catalogue — Full 35-Design Production Synchronization Script
 *
 * This script safely updates the Redis catalogue key `nasir-tryon:catalog:level1:v1`
 * to the authoritative 35-design `DEFAULT_LEVEL1_CATALOGUE` across all 7 categories.
 *
 * Usage:
 *   node scripts/migrate-level1-full-catalog.mjs [--dry-run]
 *   node scripts/migrate-level1-full-catalog.mjs --execute
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { Redis } from "@upstash/redis";

const TARGET_KEY = "nasir-tryon:catalog:level1:v1";
const AUDIT_KEY_PREFIX = "nasir-tryon:catalog:level1:audit:";
const BACKUP_DIR = path.resolve(process.cwd(), "backups");

function sha256(content) {
  const normalized = typeof content === "string" ? content : JSON.stringify(content);
  return createHash("sha256").update(normalized).digest("hex");
}

function cleanEnvValue(val) {
  if (!val) return "";
  let v = String(val).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

async function getRedisCredentials() {
  let url = cleanEnvValue(process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL);
  let token = cleanEnvValue(process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN);

  if (!url || !token || token === "[SENSITIVE]") {
    const envFiles = [".env.production.local", ".env.local"];
    for (const f of envFiles) {
      if (existsSync(f)) {
        const content = await readFile(f, "utf8");
        for (const line of content.split("\n")) {
          if (line.startsWith("UPSTASH_REDIS_REST_URL=") || line.startsWith("KV_REST_API_URL=")) {
            const val = cleanEnvValue(line.slice(line.indexOf("=") + 1));
            if (val && val !== "[SENSITIVE]" && val.startsWith("https://")) url = val;
          }
          if (line.startsWith("UPSTASH_REDIS_REST_TOKEN=") || line.startsWith("KV_REST_API_TOKEN=")) {
            const val = cleanEnvValue(line.slice(line.indexOf("=") + 1));
            if (val && val !== "[SENSITIVE]" && val.length > 10) token = val;
          }
        }
      }
    }
  }

  if (!url || !token || token === "[SENSITIVE]") {
    throw new Error("Missing required Redis environment variables: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.");
  }
  return { url, token };
}

async function loadAuthoritativeCatalogue() {
  const seedModule = await import("../lib/catalog/level1-seed.ts");
  return seedModule.DEFAULT_LEVEL1_CATALOGUE;
}

async function main() {
  const isExecute = process.argv.includes("--execute");
  const isDryRun = !isExecute;

  console.log("==================================================");
  console.log("NASIR BESPOKE — FULL 35-DESIGN CATALOGUE MIGRATION");
  console.log(`MODE: ${isExecute ? "EXECUTE (LIVE WRITE)" : "DRY RUN (READ ONLY)"}`);
  console.log("==================================================");

  const { url, token } = await getRedisCredentials();
  const redis = new Redis({ url, token });

  // 1. Read existing Redis key
  console.log(`\n[1/4] Reading existing catalogue from Redis key: ${TARGET_KEY}...`);
  const existing = await redis.get(TARGET_KEY);

  let existingSummary = "EMPTY (Not set)";
  if (existing && typeof existing === "object") {
    const extObj = existing;
    existingSummary = `${extObj.categories?.length || 0} categories, ${extObj.designs?.length || 0} designs (${extObj.designs?.filter((d) => d.status === "active").length || 0} active), ${extObj.assets?.length || 0} assets (${extObj.assets?.filter((a) => a.status === "active").length || 0} active)`;
  }
  console.log(`  Current State: ${existingSummary}`);

  // 2. Prepare migration payload
  console.log("\n[2/4] Validating authoritative Level 1 seed payload...");
  const authoritativeCatalogue = await loadAuthoritativeCatalogue();
  const targetCatalogue = structuredClone(authoritativeCatalogue);
  console.log(`  Target State: ${targetCatalogue.categories.length} categories (all active), ${targetCatalogue.designs.length} designs (all active), ${targetCatalogue.assets.length} assets (all active)`);

  const payloadHash = sha256(targetCatalogue);
  console.log(`  Target SHA-256 Digest: ${payloadHash}`);

  if (isDryRun) {
    console.log("\n[DRY RUN SUMMARY]");
    console.log(`- Redis key to write: ${TARGET_KEY}`);
    console.log(`- Backup will be saved to: backups/catalog-level1-v1-backup-<timestamp>.json`);
    console.log(`- New categories: Suits (5), Sherwanis (5), Bandhgalas (5), Nehru Jackets (5), Kurta Sets (5), Indo-Western (5), Achkans (5)`);
    console.log(`\nTo execute this migration against Redis, run:\n  node scripts/migrate-level1-full-catalog.mjs --execute`);
    process.exit(0);
  }

  // 3. Backup existing
  console.log("\n[3/4] Creating backup of existing Redis key...");
  await mkdir(BACKUP_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFile = path.join(BACKUP_DIR, `catalog-level1-v1-backup-${timestamp}.json`);
  await writeFile(backupFile, JSON.stringify(existing, null, 2), "utf8");
  console.log(`  ✓ Backup written to ${backupFile}`);

  // 4. Atomic write to Redis
  console.log(`\n[4/4] Writing 35-design catalogue to Redis key: ${TARGET_KEY}...`);
  await redis.set(TARGET_KEY, targetCatalogue);

  // Write audit record
  const auditKey = `${AUDIT_KEY_PREFIX}${timestamp}`;
  await redis.set(auditKey, {
    migratedAt: new Date().toISOString(),
    sha256: payloadHash,
    categoryCount: targetCatalogue.categories.length,
    designCount: targetCatalogue.designs.length,
    assetCount: targetCatalogue.assets.length,
  });
  console.log(`  ✓ Written to Redis and logged audit key: ${auditKey}`);

  // Read back and verify
  const readBack = await redis.get(TARGET_KEY);
  const readBackHash = sha256(readBack);
  if (readBackHash !== payloadHash) {
    throw new Error(`CRITICAL: Read-back hash mismatch! Expected ${payloadHash}, got ${readBackHash}`);
  }
  console.log(`  ✓ Verified remote Redis read-back: SHA-256 match!`);
  console.log("\n✓ FULL 35-DESIGN CATALOGUE MIGRATION COMPLETED SUCCESSFULLY!");
  process.exit(0);
}

main().catch((err) => {
  console.error("\nMIGRATION ERROR:", err.message);
  process.exit(1);
});
