import "server-only";
import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";
import { parseReview, type GenerationReview } from "./review-types";
const state = globalThis as typeof globalThis & { __nasirReviews?: Map<string, GenerationReview> };
const memory = state.__nasirReviews ??= new Map();
function reviewKey(id: string, username: string) {
  return `nasir-tryon:review:v1:${createHash("sha256").update(username).digest("hex")}:${id}`;
}
function redis() {
  if (process.env.NODE_ENV === "test" || process.env.NODE_ENV === "development") return null;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("Review storage is unavailable.");
  return new Redis({ url, token, retry: { retries: 0 }, signal: () => AbortSignal.timeout(3000) });
}
export async function getGenerationReview(id: string, username: string): Promise<GenerationReview> {
  const store = redis();
  const key = reviewKey(id, username);
  const raw = store ? await store.get<GenerationReview>(key) : memory.get(key);
  const parsed = parseReview(raw);
  return parsed && raw ? { ...parsed, updatedAt: raw.updatedAt } : { decision: "unreviewed", favourite: false, reasons: [], updatedAt: "" };
}
export async function saveGenerationReview(id: string, username: string, review: Omit<GenerationReview, "updatedAt">) {
  const value = { ...review, updatedAt: new Date().toISOString() };
  const key = reviewKey(id, username);
  const store = redis();
  if (store) await store.set(key, value);
  else memory.set(key, value);
  return value;
}

export async function getGenerationReviews(ids: string[], username: string): Promise<Record<string, GenerationReview>> {
  const store = redis();
  if (!store) return Object.fromEntries(await Promise.all(ids.map(async id => [id, await getGenerationReview(id, username)])));
  if (!ids.length) return {};
  const values = await store.mget<GenerationReview[]>(...ids.map(id => reviewKey(id, username)));
  return Object.fromEntries(ids.map((id, index) => {
    const raw = values[index];
    const parsed = parseReview(raw);
    return [id, parsed && raw ? { ...parsed, updatedAt: raw.updatedAt } : { decision: "unreviewed", favourite: false, reasons: [], updatedAt: "" }];
  }));
}
