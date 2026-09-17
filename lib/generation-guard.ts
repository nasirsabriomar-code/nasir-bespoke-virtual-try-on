import "server-only";

import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";

// Function maxDuration is 180s and the OpenAI client times out at 165s.
// The lease must outlive a still-running invocation so a second isolate cannot
// start another paid call. 30s of grace covers clock skew and cleanup.
export const GENERATION_LOCK_TTL_SECONDS = 210;
export const IDEMPOTENCY_TTL_SECONDS = 900;
// Same 3s control-plane ceiling as lib/rate-limit.ts (Ratelimit timeout: 3_000).
// Retry is disabled so a hung Upstash request cannot multiply past that budget.
export const GENERATION_GUARD_REDIS_TIMEOUT_MS = 3_000;

const RELEASE_LOCK_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
end
return 0
`;

const FINALIZE_PENDING_SCRIPT = `
local current = redis.call("get", KEYS[1])
if type(current) ~= "string" then
  return 0
end
if string.find(current, '"status":"pending"', 1, true) == nil then
  return 0
end
redis.call("set", KEYS[1], ARGV[1], "EX", ARGV[2])
return 1
`;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const STALE_FAILED_RECORD: Extract<IdempotencyRecord, { status: "failed" }> = {
  status: "failed",
  error: "We couldn't create the try-on. Please try again.",
  httpStatus: 502,
};

export class GenerationGuardUnavailableError extends Error {
  constructor() {
    super("Persistent generation locking is unavailable.");
    this.name = "GenerationGuardUnavailableError";
  }
}

export class GenerationGuardConfigurationError extends GenerationGuardUnavailableError {
  constructor() {
    super();
    this.name = "GenerationGuardConfigurationError";
  }
}

export type GenerationLease = {
  username: string;
  leaseId: string;
};

export type IdempotencyRecord =
  | { status: "pending"; leaseId: string }
  | { status: "complete"; contentType: string; body: string }
  | { status: "complete_generation"; generationId: string }
  | { status: "failed"; error: string; httpStatus: number };

export type IdempotencyResolution =
  | { kind: "absent" }
  | { kind: "in_progress" }
  | { kind: "replay"; record: Extract<IdempotencyRecord, { status: "complete" } | { status: "complete_generation" } | { status: "failed" }> };

type MemoryLock = { leaseId: string; expiresAt: number };
type MemoryIdempotency = { record: IdempotencyRecord; expiresAt: number };

const globalGuard = globalThis as typeof globalThis & {
  __nasirGenerationLocks?: Map<string, MemoryLock>;
  __nasirIdempotency?: Map<string, MemoryIdempotency>;
};
const memoryLocks = globalGuard.__nasirGenerationLocks ?? new Map<string, MemoryLock>();
const memoryIdempotency = globalGuard.__nasirIdempotency ?? new Map<string, MemoryIdempotency>();
globalGuard.__nasirGenerationLocks = memoryLocks;
globalGuard.__nasirIdempotency = memoryIdempotency;

let redisCache: { key: string; redis: Redis } | null = null;
let testWritesAllowedBeforeFailure: number | null = null;

function userHash(username: string) {
  return createHash("sha256").update(`user:${username.toLowerCase()}`).digest("hex");
}

function lockKey(username: string) {
  return `nasir-tryon:inflight:${userHash(username)}`;
}

function idempotencyKey(username: string, key: string) {
  const hashed = createHash("sha256").update(key.toLowerCase()).digest("hex");
  return `nasir-tryon:idemp:${userHash(username)}:${hashed}`;
}

function canUseMemoryGuard() {
  return process.env.NODE_ENV !== "production";
}

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    if (canUseMemoryGuard()) return null;
    throw new GenerationGuardConfigurationError();
  }

  const key = createHash("sha256").update(`${url}:${token}`).digest("hex");
  if (!redisCache || redisCache.key !== key) {
    redisCache = {
      key,
      redis: new Redis({
        url,
        token,
        retry: false,
        signal: () => AbortSignal.timeout(GENERATION_GUARD_REDIS_TIMEOUT_MS),
      }),
    };
  }
  return redisCache.redis;
}

function guardUnavailable(): never {
  throw new GenerationGuardUnavailableError();
}

async function redisOp<T>(operation: (redis: Redis) => Promise<T>): Promise<T> {
  const redis = getRedis();
  if (!redis) guardUnavailable();
  try {
    return await operation(redis);
  } catch (error) {
    if (error instanceof GenerationGuardUnavailableError) throw error;
    throw new GenerationGuardUnavailableError();
  }
}

export function parseIdempotencyKey(request: Request): string | null {
  const raw = request.headers.get("idempotency-key")?.trim() ?? "";
  if (!raw) return null;
  if (!UUID_PATTERN.test(raw) || raw.length > 80) return "";
  return raw.toLowerCase();
}

function parseRecord(value: unknown): IdempotencyRecord | null {
  if (value == null || value === "") return null;
  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value) as unknown;
    } catch {
      guardUnavailable();
    }
  }
  if (!parsed || typeof parsed !== "object") guardUnavailable();
  const record = parsed as Record<string, unknown>;
  if (record.status === "pending" && typeof record.leaseId === "string" && record.leaseId.length > 0) {
    return { status: "pending", leaseId: record.leaseId };
  }
  if (
    record.status === "complete"
    && typeof record.contentType === "string"
    && typeof record.body === "string"
    && record.body.length > 0
  ) {
    return { status: "complete", contentType: record.contentType, body: record.body };
  }
  if (record.status === "complete_generation" && typeof record.generationId === "string" && UUID_PATTERN.test(record.generationId)) {
    return { status: "complete_generation", generationId: record.generationId };
  }
  if (
    record.status === "failed"
    && typeof record.error === "string"
    && typeof record.httpStatus === "number"
  ) {
    return { status: "failed", error: record.error, httpStatus: record.httpStatus };
  }
  guardUnavailable();
}

export async function readIdempotencyRecord(username: string, key: string) {
  const storageKey = idempotencyKey(username, key);
  if (getRedis()) {
    const value = await redisOp((redis) => redis.get<string | IdempotencyRecord>(storageKey));
    return parseRecord(value);
  }

  const entry = memoryIdempotency.get(storageKey);
  if (!entry || entry.expiresAt <= Date.now()) {
    memoryIdempotency.delete(storageKey);
    return null;
  }
  return entry.record;
}

export async function writeIdempotencyRecord(
  username: string,
  key: string,
  record: IdempotencyRecord,
) {
  if (process.env.NODE_ENV === "test" && testWritesAllowedBeforeFailure !== null) {
    if (testWritesAllowedBeforeFailure <= 0) throw new GenerationGuardUnavailableError();
    testWritesAllowedBeforeFailure -= 1;
  }

  const storageKey = idempotencyKey(username, key);
  if (getRedis()) {
    await redisOp((redis) => redis.set(storageKey, JSON.stringify(record), { ex: IDEMPOTENCY_TTL_SECONDS }));
    return;
  }
  memoryIdempotency.set(storageKey, {
    record,
    expiresAt: Date.now() + IDEMPOTENCY_TTL_SECONDS * 1000,
  });
}

export async function isGenerationLeaseActive(username: string, leaseId: string) {
  const key = lockKey(username);
  if (getRedis()) {
    const current = await redisOp((redis) => redis.get<string>(key));
    return current === leaseId;
  }

  const current = memoryLocks.get(key);
  if (!current || current.expiresAt <= Date.now()) {
    memoryLocks.delete(key);
    return false;
  }
  return current.leaseId === leaseId;
}

async function finalizeStalePendingRecord(username: string, key: string) {
  const storageKey = idempotencyKey(username, key);
  const payload = JSON.stringify(STALE_FAILED_RECORD);

  if (getRedis()) {
    await redisOp((redis) => redis.eval(
      FINALIZE_PENDING_SCRIPT,
      [storageKey],
      [payload, String(IDEMPOTENCY_TTL_SECONDS)],
    ));
    return parseRecord(await redisOp((redis) => redis.get<string | IdempotencyRecord>(storageKey)));
  }

  const entry = memoryIdempotency.get(storageKey);
  if (!entry || entry.expiresAt <= Date.now()) {
    memoryIdempotency.delete(storageKey);
    return null;
  }
  if (entry.record.status === "pending") {
    entry.record = { ...STALE_FAILED_RECORD };
    entry.expiresAt = Date.now() + IDEMPOTENCY_TTL_SECONDS * 1000;
  }
  return entry.record;
}

export async function resolveIdempotencyForRequest(
  username: string,
  key: string,
): Promise<IdempotencyResolution> {
  const existing = await readIdempotencyRecord(username, key);
  if (!existing) return { kind: "absent" };
  if (existing.status === "complete" || existing.status === "complete_generation" || existing.status === "failed") {
    return { kind: "replay", record: existing };
  }

  if (await isGenerationLeaseActive(username, existing.leaseId)) {
    return { kind: "in_progress" };
  }

  const settled = await finalizeStalePendingRecord(username, key);
  if (settled?.status === "complete" || settled?.status === "complete_generation" || settled?.status === "failed") {
    return { kind: "replay", record: settled };
  }
  return { kind: "in_progress" };
}

export async function acquireGenerationLock(username: string): Promise<GenerationLease | null> {
  const key = lockKey(username);
  const leaseId = crypto.randomUUID();

  if (getRedis()) {
    const created = await redisOp((redis) => redis.set(key, leaseId, { nx: true, ex: GENERATION_LOCK_TTL_SECONDS }));
    return created === "OK" ? { username, leaseId } : null;
  }

  const now = Date.now();
  const current = memoryLocks.get(key);
  if (current && current.expiresAt > now) return null;
  memoryLocks.set(key, { leaseId, expiresAt: now + GENERATION_LOCK_TTL_SECONDS * 1000 });
  return { username, leaseId };
}

export async function releaseGenerationLock(lease: GenerationLease) {
  const key = lockKey(lease.username);
  if (getRedis()) {
    const result = await redisOp((redis) => redis.eval(RELEASE_LOCK_SCRIPT, [key], [lease.leaseId]));
    return result === 1 || result === "1";
  }

  const current = memoryLocks.get(key);
  if (!current || current.leaseId !== lease.leaseId) return false;
  memoryLocks.delete(key);
  return true;
}

export function resetMemoryGenerationGuardsForTests() {
  if (process.env.NODE_ENV !== "test") return;
  memoryLocks.clear();
  memoryIdempotency.clear();
  testWritesAllowedBeforeFailure = null;
}

export function expireMemoryGenerationLocksForTests() {
  if (process.env.NODE_ENV !== "test") return;
  for (const lock of memoryLocks.values()) lock.expiresAt = 0;
}

export function failGenerationGuardWritesAfterForTests(allowedSuccesses: number) {
  if (process.env.NODE_ENV !== "test") return;
  testWritesAllowedBeforeFailure = allowedSuccesses;
}
