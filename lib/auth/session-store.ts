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
const SESSION_STORE_TIMEOUT_MS = 2500;

async function persistentSessionOperation<T>(operation: () => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new SessionStoreConfigurationError()), SESSION_STORE_TIMEOUT_MS);
      }),
    ]);
  } catch {
    // Session state is authoritative across instances. An outage must never
    // revive a revoked session or claim that an unconfirmed logout succeeded.
    throw new SessionStoreConfigurationError();
  } finally {
    clearTimeout(timer);
  }
}

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
    redisCache = { key, redis: new Redis({
      url, token,
      retry: { retries: 0 },
      signal: () => AbortSignal.timeout(SESSION_STORE_TIMEOUT_MS),
    }) };
  }
  return redisCache.redis;
}

export async function activateSession(sessionId: string, username: string, ttlSeconds: number) {
  const redis = getRedis();
  const key = sessionKey(sessionId);
  const userHash = usernameHash(username);
  if (redis) {
    const result = await persistentSessionOperation(() => redis.set(key, userHash, { ex: ttlSeconds }));
    if (result !== "OK") throw new SessionStoreConfigurationError();
    return;
  }
  memorySessions.set(key, { usernameHash: userHash, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export async function isSessionActive(sessionId: string, username: string) {
  const redis = getRedis();
  const key = sessionKey(sessionId);
  const userHash = usernameHash(username);
  if (redis) {
    return (await persistentSessionOperation(() => redis.get<string>(key))) === userHash;
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
    await persistentSessionOperation(() => redis.del(key));
    return;
  }
  memorySessions.delete(key);
}

export function resetMemorySessionsForTests() {
  if (process.env.NODE_ENV === "test") memorySessions.clear();
}
