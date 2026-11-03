import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test, { beforeEach } from "node:test";
import sharp from "sharp";
import * as uploadRoute from "@/app/api/try-on/uploads/[id]/route";
import {
  acquireGenerationLock,
  readIdempotencyRecord,
  releaseGenerationLock,
  resetMemoryGenerationGuardsForTests,
  writeIdempotencyRecord,
} from "@/lib/generation-guard";
import { classifyGenerationResponse, GENERATION_STATE_HEADER, RESULT_SAVED_HEADER } from "@/lib/generation-recovery";
import { createUploadSlot, getUploadSlot, markUploadComplete } from "@/lib/highres/ledger";
import { completeUploadForUser } from "@/lib/highres/uploads";
import { resetMemoryRateLimitsForTests } from "@/lib/rate-limit";
import { handleTryOnRequest } from "@/lib/try-on-handler";
import type { TryOnOutput } from "@/lib/tryon/types";
import type { UsageEvent } from "@/lib/usage-history";

const USER = { username: "flow-user", displayName: "Flow Staff", passwordHash: "unused" };
const allowRate = async () => ({ allowed: true, limit: 20, remaining: 19, resetAt: Date.now() + 60_000 });
const denyRate = async () => ({ allowed: false, limit: 2, remaining: 0, resetAt: Date.now() + 60_000, blockedBy: "minute" as const });

const result: TryOnOutput = {
  bytes: Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]),
  contentType: "image/png",
  metadata: { provider: "test", model: "test", quality: "medium", durationMs: 1 },
};

beforeEach(() => {
  delete process.env.DATABASE_URL;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  process.env.R2_ACCOUNT_ID = "a".repeat(32);
  process.env.R2_BUCKET_NAME = "test-bucket";
  process.env.R2_ACCESS_KEY_ID = "test-access";
  process.env.R2_SECRET_ACCESS_KEY = "test-secret";
  resetMemoryGenerationGuardsForTests();
  resetMemoryRateLimitsForTests();
});

type MockOptions = { failPut?: (path: string) => boolean; contentLength?: (path: string) => string | null };

function mockR2(t: { mock: { method: typeof import("node:test").mock.method } }, options: MockOptions = {}) {
  const objects = new Map<string, Uint8Array>();
  const deleted: string[] = [];
  t.mock.method(globalThis, "fetch", async (input: string, init?: RequestInit) => {
    const path = new URL(input).pathname.replace("/test-bucket/", "");
    if (init?.method === "PUT") {
      if (options.failPut?.(path)) return new Response(null, { status: 500 });
      objects.set(path, new Uint8Array(await new Response(init.body as BodyInit).arrayBuffer()));
      return new Response(null, { status: 200 });
    }
    if (init?.method === "DELETE") {
      deleted.push(path);
      objects.delete(path);
      return new Response(null, { status: 204 });
    }
    const bytes = objects.get(path);
    if (!bytes) return new Response("<Error><Code>NoSuchKey</Code></Error>", { status: 404 });
    const length = options.contentLength ? options.contentLength(path) : String(bytes.byteLength);
    return new Response(Buffer.from(bytes), { headers: { "Content-Type": "image/png", ...(length === null ? {} : { "Content-Length": length }) } });
  });
  return { objects, deleted };
}

async function pngBytes() {
  return sharp({ create: { width: 32, height: 48, channels: 3, background: "#334455" } }).png().toBuffer();
}

async function uploadedSlots(objects: Map<string, Uint8Array>) {
  const bytes = await pngBytes();
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const ids: Record<string, string> = {};
  const pathnames: string[] = [];
  for (const role of ["person", "fabric", "outfit"] as const) {
    const slot = await createUploadSlot({ username: USER.username, role, filename: `${role}.png`, contentType: "image/png", bytes: bytes.length });
    objects.set(slot.pathname, new Uint8Array(bytes));
    await markUploadComplete(slot.id, { checksum, width: 32, height: 48 });
    ids[role] = slot.id;
    pathnames.push(slot.pathname);
  }
  return { ids, pathnames };
}

function tryOnRequest(uploads: Record<string, string>, key?: string) {
  return new Request("http://localhost/api/try-on", {
    method: "POST",
    headers: {
      origin: "http://localhost",
      host: "localhost",
      "sec-fetch-site": "same-origin",
      "content-type": "application/json",
      ...(key ? { "Idempotency-Key": key } : {}),
    },
    body: JSON.stringify({ selectionMode: "outfit", uploads }),
  });
}

test("classifier: only server-marked or replayed rejections are final; other conflicts are followed", () => {
  const response = (status: number, headers: Record<string, string> = {}) => ({ ok: status < 400, status, headers: new Headers(headers) });
  assert.equal(classifyGenerationResponse(response(200)), "stored");
  assert.equal(classifyGenerationResponse(response(200, { [RESULT_SAVED_HEADER]: "false" })), "unsaved");
  assert.equal(classifyGenerationResponse(response(409, { [GENERATION_STATE_HEADER]: "not-started" })), "rejected");
  assert.equal(classifyGenerationResponse(response(503, { [GENERATION_STATE_HEADER]: "not-started" })), "rejected");
  assert.equal(classifyGenerationResponse(response(502, { "Idempotency-Replayed": "true" })), "rejected");
  assert.equal(classifyGenerationResponse(response(409, { [GENERATION_STATE_HEADER]: "in-progress" })), "uncertain");
  assert.equal(classifyGenerationResponse(response(504)), "uncertain");
  assert.equal(classifyGenerationResponse(response(502)), "uncertain");
  assert.equal(classifyGenerationResponse(response(400)), "rejected");
});

test("a busy account lock is a final not-started 409 and leaves the uploads reusable", async (t) => {
  const r2 = mockR2(t);
  const { ids, pathnames } = await uploadedSlots(r2.objects);
  const otherDevice = await acquireGenerationLock(USER.username);
  assert.ok(otherDevice);
  let generated = 0;
  const blocked = await handleTryOnRequest(tryOnRequest(ids, crypto.randomUUID()), {
    authenticate: async () => USER, rateLimit: allowRate, generate: async () => { generated++; return result; }, recordUsage: async () => {},
  });
  assert.equal(blocked.status, 409);
  assert.equal(blocked.headers.get(GENERATION_STATE_HEADER), "not-started");
  assert.equal(classifyGenerationResponse(blocked), "rejected");
  assert.equal(generated, 0);
  assert.deepEqual(r2.deleted, []);
  for (const id of Object.values(ids)) assert.equal((await getUploadSlot(id))?.status, "uploaded");

  await releaseGenerationLock(otherDevice);
  const retried = await handleTryOnRequest(tryOnRequest(ids, crypto.randomUUID()), {
    authenticate: async () => USER, rateLimit: allowRate, generate: async () => { generated++; return result; }, recordUsage: async () => {},
  });
  assert.equal(retried.status, 200);
  assert.equal(generated, 1);
  assert.deepEqual(r2.deleted.filter((path) => pathnames.includes(path)).sort(), [...pathnames].sort());
});

test("a rate-limited request is not-started and keeps its uploads", async (t) => {
  const r2 = mockR2(t);
  const { ids } = await uploadedSlots(r2.objects);
  const response = await handleTryOnRequest(tryOnRequest(ids, crypto.randomUUID()), {
    authenticate: async () => USER, rateLimit: denyRate, generate: async () => result, recordUsage: async () => {},
  });
  assert.equal(response.status, 429);
  assert.equal(response.headers.get(GENERATION_STATE_HEADER), "not-started");
  assert.deepEqual(r2.deleted, []);
  for (const id of Object.values(ids)) assert.equal((await getUploadSlot(id))?.status, "uploaded");
});

test("an in-progress key is not marked not-started, so the client keeps following it", async (t) => {
  const r2 = mockR2(t);
  const { ids } = await uploadedSlots(r2.objects);
  const key = crypto.randomUUID();
  const lease = await acquireGenerationLock(USER.username);
  assert.ok(lease);
  await writeIdempotencyRecord(USER.username, key, { status: "pending", leaseId: lease.leaseId });
  const response = await handleTryOnRequest(tryOnRequest(ids, key), {
    authenticate: async () => USER, rateLimit: allowRate, generate: async () => result, recordUsage: async () => {},
  });
  assert.equal(response.status, 409);
  assert.equal(response.headers.get(GENERATION_STATE_HEADER), "in-progress");
  assert.equal(classifyGenerationResponse(response), "uncertain");
});

test("a provider failure after the paid call starts is not marked not-started", async (t) => {
  const r2 = mockR2(t);
  const { ids } = await uploadedSlots(r2.objects);
  const response = await handleTryOnRequest(tryOnRequest(ids, crypto.randomUUID()), {
    authenticate: async () => USER, rateLimit: allowRate, generate: async () => { throw new Error("provider exploded"); }, recordUsage: async () => {},
  });
  assert.equal(response.status, 502);
  assert.equal(response.headers.get(GENERATION_STATE_HEADER), null);
});

test("a paid result that History cannot store is returned once instead of discarded", async (t) => {
  const r2 = mockR2(t, { failPut: (path) => path.startsWith("nasir-bespoke/generations/") && path.endsWith("/result.png") });
  const { ids } = await uploadedSlots(r2.objects);
  const key = crypto.randomUUID();
  const events: UsageEvent[] = [];
  const response = await handleTryOnRequest(tryOnRequest(ids, key), {
    authenticate: async () => USER, rateLimit: allowRate, generate: async () => result, recordUsage: async (event) => { events.push(event); },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get(RESULT_SAVED_HEADER), "false");
  assert.equal(classifyGenerationResponse(response), "unsaved");
  assert.equal(response.headers.get("content-type"), "image/png");
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), result.bytes);
  assert.equal(events.length, 1);
  assert.equal(events[0].status, "success");
  assert.equal(events[0].id, response.headers.get("X-Generation-Id"));
  const record = await readIdempotencyRecord(USER.username, key);
  assert.equal(record?.status, "failed");
});

test("completion refuses a stored master whose size does not match, before buffering it", async (t) => {
  const r2 = mockR2(t, { contentLength: () => String(5 * 1024 * 1024 * 1024) });
  const bytes = await pngBytes();
  const slot = await createUploadSlot({ username: USER.username, role: "person", filename: "p.png", contentType: "image/png", bytes: bytes.length });
  r2.objects.set(slot.pathname, new Uint8Array(bytes));
  await assert.rejects(completeUploadForUser(USER.username, slot.id), /size did not match/);
  assert.equal((await getUploadSlot(slot.id))?.status, "authorized");
});

test("no route hands out a direct, unbounded storage upload URL", () => {
  assert.equal("POST" in uploadRoute, false);
  assert.equal(typeof uploadRoute.GET, "function");
});
