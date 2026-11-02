import "server-only";

import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";
import { AuthConfigurationError } from "@/lib/auth/config";

export class SessionStoreConfigurationError extends AuthConfigurationError {
  constructor() {
    super();
    this.name = "SessionStoreConfigurationError";
  }
}

type MemorySession = { usernameHash: string; expiresAt: number };
const globalSessionStore = globalThis as typeof globalThis & {
  __nasirMemorySessions?: Map<string, MemorySession>;
};
const memorySessions = globalSessionStore.__nasirMemorySessions ?? new Map<string, MemorySession>();
globalSessionStore.__nasirMemorySessions = memorySessions;
let redisCache: { key: string; redis: Redis } | null = null;
const REDIS_TIMED_OUT = Symbol("redis-timed-out");

function sessionKey(sessionId: string) {
  const hashed = createHash("sha256").update(sessionId).digest("hex");
  return `nasir-tryon:session:${hashed}`;
}

function usernameHash(username: string) {
  return createHash("sha256").update(username).digest("hex");
}

function getRedis() {
  if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") return null;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    if (process.env.NODE_ENV !== "production") return null;
    throw new SessionStoreConfigurationError();
  }

  const key = createHash("sha256").update(`${url}:${token}`).digest("hex");
  if (!redisCache || redisCache.key !== key) {
    redisCache = { key, redis: new Redis({ url, token }) };
  }
  return redisCache.redis;
}

export async function activateSession(sessionId: string, username: string, ttlSeconds: number) {
  const redis = getRedis();
  const key = sessionKey(sessionId);
  const userHash = usernameHash(username);
  if (redis) {
    try {
      const redisPromise = redis.set(key, userHash, { ex: ttlSeconds });
      const timeoutPromise = new Promise<void>((resolve) => setTimeout(resolve, 2500));
      await Promise.race([redisPromise, timeoutPromise]);
    } catch {
      // Fallback to memory
    }
  }
  memorySessions.set(key, { usernameHash: userHash, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export async function isSessionActive(sessionId: string, username: string) {
  const redis = getRedis();
  const key = sessionKey(sessionId);
  const userHash = usernameHash(username);
  if (redis) {
    try {
      const redisPromise = redis.get<string>(key);
      const timeoutPromise = new Promise<typeof REDIS_TIMED_OUT>((resolve) => setTimeout(() => resolve(REDIS_TIMED_OUT), 2500));
      const val = await Promise.race([redisPromise, timeoutPromise]);
      // An answer from Redis is final: null means revoked, possibly by another
      // instance, so this instance's memory must not bring the session back.
      if (val !== REDIS_TIMED_OUT) return val === userHash;
    } catch {
      // Fallback to memory
    }
  }

  const session = memorySessions.get(key);
  if (!session || session.expiresAt <= Date.now()) {
    memorySessions.delete(key);
    return false;
  }
  return session.usernameHash === userHash;
}

export async function revokeSession(sessionId: string) {
  const redis = getRedis();
  const key = sessionKey(sessionId);
  if (redis) {
    try {
      const redisPromise = redis.del(key);
      const timeoutPromise = new Promise<void>((resolve) => setTimeout(resolve, 2500));
      await Promise.race([redisPromise, timeoutPromise]);
    } catch {
      // Fallback
    }
  }
  memorySessions.delete(key);
}

export function resetMemorySessionsForTests() {
  if (process.env.NODE_ENV === "test") memorySessions.clear();
}
