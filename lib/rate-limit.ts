import "server-only";

import { createHash } from "node:crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type LimitName = "minute" | "hour" | "day" | "global-day" | "login";

type LimitCheck = {
  name: LimitName;
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  blockedBy?: LimitName;
};

export class RateLimitConfigurationError extends Error {
  constructor() {
    super("Persistent rate limiting is not configured.");
    this.name = "RateLimitConfigurationError";
  }
}

type MemoryEntry = { count: number; resetAt: number };
const memoryEntries = new Map<string, MemoryEntry>();

function positiveInteger(name: string, fallback: number, maximum = 10_000) {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= maximum ? parsed : fallback;
}

function hashedIdentifier(namespace: string, value: string) {
  return createHash("sha256").update(`${namespace}:${value}`).digest("hex");
}

function canUseMemoryLimiter() {
  return process.env.NODE_ENV !== "production";
}

function memoryLimit(name: LimitName, identifier: string, limit: number, windowMs: number): LimitCheck {
  const now = Date.now();
  const key = `${name}:${identifier}`;
  const current = memoryEntries.get(key);
  if (!current || current.resetAt <= now) {
    const resetAt = now + windowMs;
    memoryEntries.set(key, { count: 1, resetAt });
    return { name, allowed: true, limit, remaining: Math.max(0, limit - 1), resetAt };
  }

  if (current.count >= limit) {
    return { name, allowed: false, limit, remaining: 0, resetAt: current.resetAt };
  }

  current.count += 1;
  memoryEntries.set(key, current);
  return {
    name,
    allowed: true,
    limit,
    remaining: Math.max(0, limit - current.count),
    resetAt: current.resetAt,
  };
}

let redisCache: { key: string; redis: Redis } | null = null;

function getRedis() {
  if (process.env.NODE_ENV === "development" || (process.env.NODE_ENV === "test" && process.env.RATE_LIMIT_BACKEND === "memory")) return null;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    if (canUseMemoryLimiter()) return null;
    throw new RateLimitConfigurationError();
  }

  const key = createHash("sha256").update(`${url}:${token}`).digest("hex");
  if (!redisCache || redisCache.key !== key) {
    redisCache = { key, redis: new Redis({ url, token }) };
  }
  return redisCache.redis;
}

async function persistentLimit(
  redis: Redis,
  name: LimitName,
  identifier: string,
  limit: number,
  duration: "1 m" | "15 m" | "1 h" | "1 d",
): Promise<LimitCheck> {
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.fixedWindow(limit, duration),
    prefix: `nasir-tryon:${name}`,
    analytics: false,
    timeout: 3_000,
  });
  const response = await limiter.limit(identifier);
  await response.pending;
  if (response.reason === "timeout") throw new RateLimitConfigurationError();
  return {
    name,
    allowed: response.success,
    limit: response.limit,
    remaining: response.remaining,
    resetAt: response.reset,
  };
}

function summarize(checks: LimitCheck[]): RateLimitResult {
  const blocked = checks.find((check) => !check.allowed);
  if (blocked) {
    return {
      allowed: false,
      limit: blocked.limit,
      remaining: 0,
      resetAt: blocked.resetAt,
      blockedBy: blocked.name,
    };
  }

  const tightest = checks.reduce((current, check) =>
    check.remaining < current.remaining ? check : current,
  );
  return {
    allowed: true,
    limit: tightest.limit,
    remaining: tightest.remaining,
    resetAt: tightest.resetAt,
  };
}

export async function checkGenerationRateLimit(username: string): Promise<RateLimitResult> {
  const perMinute = positiveInteger("TRYON_RATE_LIMIT_PER_MINUTE", 2, 60);
  const perHour = positiveInteger("TRYON_RATE_LIMIT_PER_HOUR", 10, 1_000);
  const perDay = positiveInteger("TRYON_RATE_LIMIT_PER_DAY", 30, 10_000);
  const globalPerDay = positiveInteger("TRYON_GLOBAL_RATE_LIMIT_PER_DAY", 50, 100_000);
  const userId = hashedIdentifier("user", username.toLowerCase());
  const globalId = "application";
  const redis = getRedis();

  const definitions = [
    ["minute", userId, perMinute, "1 m", 60_000],
    ["hour", userId, perHour, "1 h", 3_600_000],
    ["day", userId, perDay, "1 d", 86_400_000],
    ["global-day", globalId, globalPerDay, "1 d", 86_400_000],
  ] as const;
  const checks: LimitCheck[] = [];
  for (const [name, identifier, limit, duration, windowMs] of definitions) {
    const check = redis
      ? await persistentLimit(redis, name, identifier, limit, duration)
      : memoryLimit(name, identifier, limit, windowMs);
    checks.push(check);
    if (!check.allowed) break;
  }

  return summarize(checks);
}

export async function checkLoginRateLimit(identifier: string): Promise<RateLimitResult> {
  const limit = positiveInteger("AUTH_LOGIN_RATE_LIMIT_PER_15_MINUTES", 10, 100);
  const safeIdentifier = hashedIdentifier("login", identifier);
  const redis = getRedis();
  const check = redis
    ? await persistentLimit(redis, "login", safeIdentifier, limit, "15 m")
    : memoryLimit("login", safeIdentifier, limit, 15 * 60_000);
  return summarize([check]);
}

export function getRequestIdentifier(request: Request) {
  // Vercel overwrites x-forwarded-for. Other client-supplied headers such as
  // cf-connecting-ip pass through unverified, so they must not identify anyone.
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    forwarded ||
    request.headers.get("x-real-ip") ||
    "local"
  ).slice(0, 128);
}

export function resetMemoryRateLimitsForTests() {
  if (process.env.NODE_ENV !== "test") return;
  memoryEntries.clear();
}
