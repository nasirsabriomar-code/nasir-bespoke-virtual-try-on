import "server-only";
import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";
import { HighResolutionUploadError } from "./upload-error";

// Distributed limits cover storage/CPU work independently of paid generation.
// Expiring leases cannot remain stuck after a function crashes.
const TTL_MS = 330_000;
const memory = new Map<string, Map<string, number>>();
function redis() {
  if (process.env.NODE_ENV !== "production") return null;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new HighResolutionUploadError("Upload controls are unavailable.", 503);
  return new Redis({ url, token, retry: false, signal: () => AbortSignal.timeout(3000) });
}
const ACQUIRE = `
local clock = redis.call('time')
local now = tonumber(clock[1]) * 1000 + math.floor(tonumber(clock[2]) / 1000)
redis.call('zremrangebyscore', KEYS[1], '-inf', now)
if redis.call('zcard', KEYS[1]) >= tonumber(ARGV[1]) then return 0 end
redis.call('zadd', KEYS[1], now + tonumber(ARGV[3]), ARGV[2])
redis.call('pexpire', KEYS[1], ARGV[3])
return 1
`;
export async function withUploadLease<T>(username: string, operation: string, limit: number, work: () => Promise<T>): Promise<T> {
  const key = `nasir-tryon:upload-lease:${createHash("sha256").update(`${username}:${operation}`).digest("hex")}`;
  const id = crypto.randomUUID();
  const now = Date.now();
  const store = redis();
  let acquired: boolean;
  try {
    if (store) acquired = Number(await store.eval(ACQUIRE, [key], [limit, id, TTL_MS])) === 1;
    else {
      const entries = memory.get(key) ?? new Map<string, number>();
      for (const [lease, expiry] of entries) if (expiry <= now) entries.delete(lease);
      acquired = entries.size < limit;
      if (acquired) entries.set(id, now + TTL_MS);
      memory.set(key, entries);
    }
  } catch { throw new HighResolutionUploadError("Upload controls are unavailable.", 503); }
  if (!acquired) throw new HighResolutionUploadError("An upload is already in progress. Please wait and retry.", 429);
  try { return await work(); }
  finally {
    if (store) await store.zrem(key, id).catch(() => console.error("upload_lease_release_failed"));
    else { const entries = memory.get(key); entries?.delete(id); if (!entries?.size) memory.delete(key); }
  }
}
