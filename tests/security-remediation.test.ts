import { handleTryOnRequest } from "@/lib/try-on-handler";
import { acquireGenerationLock, releaseGenerationLock } from "@/lib/generation-guard";
import { writeIdempotencyRecord, resolveIdempotencyForRequest } from "@/lib/generation-guard";
import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import bcrypt from "bcryptjs";
import sharp from "sharp";
import { createSessionToken, getCurrentUserFromToken, getSessionCookieName } from "@/lib/auth/session";
import { GET as history } from "@/app/api/history/route";
import { GET as asset } from "@/app/api/history/[id]/asset/[asset]/route";
import { GET as review } from "@/app/api/history/[id]/review/route";
import { DELETE as deleteGeneration } from "@/app/api/history/[id]/route";
import { createUploadSlot, persistPermanentGeneration, resetMemoryUploadLedgerForTests, pendingGenerationDeletions } from "@/lib/highres/ledger";
import { withUploadLease } from "@/lib/highres/upload-control";
import { checkUploadRateLimit, resetMemoryRateLimitsForTests } from "@/lib/rate-limit";
import { getUsageHistory, recordUsageEvent, resetMemoryUsageHistoryForTests, type UsageEvent } from "@/lib/usage-history";
import { validateImageFile } from "@/lib/validate-image";
import { readBoundedBody } from "@/lib/request-body";
import { eraseGeneration, cleanupRetainedGenerations } from "@/lib/history/deletion";
import { getGenerationReview, saveGenerationReview } from "@/lib/history/reviews";

const passwordHash = bcrypt.hashSync("synthetic-fixture-password", 4);
const users = [
  { username: "alice", displayName: "Alice", passwordHash, role: "staff" },
  { username: "bob", displayName: "Bob", passwordHash, role: "staff" },
  { username: "owner", displayName: "Owner", passwordHash, role: "admin" },
];
beforeEach(() => {
  process.env.AUTH_SESSION_SECRET = "synthetic-remediation-session-secret-at-least-32-bytes";
  process.env.AUTH_USERS_JSON = JSON.stringify(users);
  process.env.RATE_LIMIT_BACKEND = "memory";
  delete process.env.AUTH_USERS_JSON_BASE64;
  delete process.env.DATABASE_URL;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.GENERATION_RETENTION_DAYS;
  process.env.R2_ACCOUNT_ID = "a".repeat(32);
  process.env.R2_BUCKET_NAME = "test-bucket";
  process.env.R2_ACCESS_KEY_ID = "synthetic-access";
  process.env.R2_SECRET_ACCESS_KEY = "synthetic-secret";
  resetMemoryUsageHistoryForTests(); resetMemoryUploadLedgerForTests(); resetMemoryRateLimitsForTests();
});
function event(username = "alice", occurredAt = new Date().toISOString()): UsageEvent {
  const id = crypto.randomUUID();
  return { id, username, occurredAt, status: "success", durationMs: 1, provider: "fixture", model: "fixture", quality: "medium",
    device: { kind: "desktop", browser: "fixture", operatingSystem: "fixture" },
    assets: { result: { pathname: `nasir-bespoke/generations/${id}/result.png`, contentType: "image/png" } } };
}
async function request(path: string, username: string, method = "GET") {
  return new Request(`http://localhost${path}`, { method, headers: { cookie: `${getSessionCookieName()}=${await createSessionToken(username)}`, origin: "http://localhost" } });
}
const context = (id: string) => ({ params: Promise.resolve({ id, asset: "result" }) });

test("password, role and authVersion changes invalidate existing sessions", async () => {
  for (const change of [{ passwordHash: bcrypt.hashSync("replacement-password", 4) }, { role: "admin" }, { authVersion: "2" }]) {
    process.env.AUTH_USERS_JSON = JSON.stringify(users);
    const token = await createSessionToken("alice");
    assert.equal((await getCurrentUserFromToken(token))?.username, "alice");
    process.env.AUTH_USERS_JSON = JSON.stringify([{ ...users[0], ...change }, ...users.slice(1)]);
    assert.equal(await getCurrentUserFromToken(token), null);
    assert.equal((await getCurrentUserFromToken(await createSessionToken("alice")))?.username, "alice");
  }
});

test("staff history is scoped before pagination and counts; admin can explicitly see all", async () => {
  for (let i = 0; i < 105; i++) await recordUsageEvent(event("alice"));
  await recordUsageEvent(event("bob"));
  const response = await history(await request("/api/history?limit=100&offset=100", "alice"));
  const data = await response.json();
  assert.equal(data.total, 105); assert.equal(data.events.length, 5);
  assert.ok(data.events.every((row: UsageEvent) => row.username === "alice"));
  const admin = await (await history(await request("/api/history", "owner"))).json();
  assert.equal(admin.total, 106);
});

test("asset views and downloads enforce ownership and never emit signed URLs", async t => {
  const row = event(); await recordUsageEvent(row);
  let reads = 0;
  t.mock.method(globalThis, "fetch", async () => { reads++; return new Response("fixture", { headers: { "Content-Type": "image/png" } }); });
  for (const suffix of ["", "?download=1"]) {
    const path = `/api/history/${row.id}/asset/result${suffix}`;
    assert.equal((await asset(await request(path, "bob"), context(row.id))).status, 404);
    for (const username of ["alice", "owner"]) {
      const result = await asset(await request(path, username), context(row.id));
      assert.equal(result.status, 200); assert.equal(result.headers.get("location"), null);
      assert.match(result.headers.get("cache-control")!, /private.*no-store/);
      assert.match(result.headers.get("content-disposition")!, suffix ? /attachment/ : /inline/);
      assert.equal(await result.text(), "fixture");
    }
  }
  assert.equal(reads, 4);
  assert.equal((await review(await request(`/api/history/${row.id}/review`, "bob"), context(row.id))).status, 404);
});

test("complete decoding rejects truncated containers and pixel bombs while preserving valid originals", async () => {
  const truncated = new Uint8Array(24); truncated.set([137,80,78,71,13,10,26,10]);
  const view = new DataView(truncated.buffer); view.setUint32(16, 1); view.setUint32(20, 1);
  await assert.rejects(validateImageFile(new File([truncated], "truncated.png", { type: "image/png" }), "photo"), /damaged|unsupported/);
  view.setUint32(16, 100000); view.setUint32(20, 100000);
  await assert.rejects(validateImageFile(new File([truncated], "huge.png", { type: "image/png" }), "photo"), /40 megapixels/);
  for (const format of ["png", "jpeg", "webp"] as const) {
    const bytes = await sharp({ create: { width: 64, height: 64, channels: 3, background: "navy" } }).toFormat(format).toBuffer();
    const file = new File([bytes], `photo.${format}`, { type: `image/${format}` });
    const result = await validateImageFile(file, "photo");
    assert.equal(result.file, file); assert.equal(result.width, 64);
    await assert.rejects(validateImageFile(new File([bytes.subarray(0, Math.floor(bytes.length / 2))], `broken.${format}`, { type: `image/${format}` }), "photo"));
  }
});

test("upload slot and byte quotas cannot be exceeded by concurrent admissions", async () => {
  const input = { username: "alice", role: "person" as const, filename: "photo.png", contentType: "image/png" as const, bytes: 1024 };
  const small = await Promise.allSettled(Array.from({ length: 20 }, () => createUploadSlot(input)));
  assert.equal(small.filter(result => result.status === "fulfilled").length, 12);
  resetMemoryUploadLedgerForTests();
  const large = await Promise.allSettled(Array.from({ length: 10 }, () => createUploadSlot({ ...input, bytes: 50 * 1024 * 1024 })));
  assert.equal(large.filter(result => result.status === "fulfilled").length, 4);
});

test("upload throttles apply independently of paid generation", async () => {
  for (let i = 0; i < 50; i++) assert.equal((await checkUploadRateLimit("alice", "create")).allowed, true);
  assert.equal((await checkUploadRateLimit("alice", "create")).allowed, false);
  for (let user = 0; user < 4; user++) for (let i = 0; i < 50; i++) assert.equal((await checkUploadRateLimit(`user-${user}`, "create")).allowed, true);
  assert.equal((await checkUploadRateLimit("bob", "create")).allowed, false);
});

test("concurrent upload work is bounded and releases leases after failures", async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const work = Array.from({ length: 4 }, () => withUploadLease("alice", "parts", 4, () => gate));
  await assert.rejects(withUploadLease("alice", "parts", 4, async () => {}), /already in progress/);
  release(); await Promise.all(work);
  await assert.rejects(withUploadLease("alice", "parts", 4, async () => { throw new Error("fixture failure"); }), /fixture failure/);
  await withUploadLease("alice", "parts", 4, async () => {});
});

test("production upload leases fail closed when their shared backend fails", async t => {
  const env = process.env as Record<string, string | undefined>;
  env.NODE_ENV = "production";
  process.env.UPSTASH_REDIS_REST_URL = "https://redis.example"; process.env.UPSTASH_REDIS_REST_TOKEN = "fixture";
  t.after(() => { env.NODE_ENV = "test"; });
  t.mock.method(globalThis, "fetch", async () => { throw new Error("fixture offline"); });
  let ran = false;
  await assert.rejects(withUploadLease("alice", "parts", 4, async () => { ran = true; }), /unavailable/);
  assert.equal(ran, false);
});

test("stalled bodies are cancelled within their total deadline", async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({ cancel() { cancelled = true; } });
  const req = new Request("http://localhost/upload", { method: "POST", body, duplex: "half" } as RequestInit);
  await assert.rejects(readBoundedBody(req, 100, 10), { name: "TimeoutError" });
  assert.equal(cancelled, true);
});

test("deletion denies nonowners and CSRF, hides immediately on storage failure and retries all stores", async t => {
  const row = event(); await recordUsageEvent(row); await persistPermanentGeneration(row);
  await saveGenerationReview(row.id, "alice", { decision: "accepted", favourite: true, reasons: [] });
  const path = `/api/history/${row.id}`;
  assert.equal((await deleteGeneration(await request(path, "bob", "DELETE"), context(row.id))).status, 404);
  assert.equal((await deleteGeneration(new Request(`http://localhost${path}`, { method: "DELETE" }), context(row.id))).status, 403);
  const replayKey = crypto.randomUUID();
  await writeIdempotencyRecord("alice", replayKey, { status: "complete", generationId: row.id, contentType: "image/png", body: "Zml4dHVyZQ==" });
  let fail = true;
  t.mock.method(globalThis, "fetch", async () => { if (fail) throw new Error("storage offline"); return new Response(null, { status: 204 }); });
  assert.equal((await deleteGeneration(await request(path, "alice", "DELETE"), context(row.id))).status, 503);
  assert.equal((await asset(await request(`${path}/asset/result`, "alice"), context(row.id))).status, 404);
  assert.equal((await getUsageHistory()).events.some(item => item.id === row.id), false);
  assert.ok((await pendingGenerationDeletions()).some(item => item.id === row.id));
  const replay = await resolveIdempotencyForRequest("alice", replayKey);
  assert.equal(replay.kind, "replay");
  assert.ok(replay.kind === "replay" && replay.record.status === "failed" && replay.record.httpStatus === 410);
  fail = false; await eraseGeneration(row);
  assert.equal((await pendingGenerationDeletions()).some(item => item.id === row.id), false);
  assert.equal((await getGenerationReview(row.id, "alice")).favourite, false);
  await assert.rejects(saveGenerationReview(row.id, "alice", { decision: "accepted", favourite: true, reasons: [] }), /deleted/);
});

test("retention hides expired generations before cleanup and deletes their images", async t => {
  const row = event("alice", new Date(Date.now() - 31 * 86_400_000).toISOString());
  await recordUsageEvent(row); await persistPermanentGeneration(row);
  assert.equal((await asset(await request(`/api/history/${row.id}/asset/result`, "owner"), context(row.id))).status, 404);
  const paths: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string) => { paths.push(new URL(url).pathname); return new Response(null, { status: 204 }); });
  const result = await cleanupRetainedGenerations();
  assert.equal(result.failed, 0);
  assert.ok(paths.some(path => path.endsWith(`${row.id}/result.png`)));
});

test("older inline replay records without a generation identity never release cached image bytes", async () => {
  const key = crypto.randomUUID();
  await writeIdempotencyRecord("alice", key, { status: "complete", contentType: "image/png", body: "Zml4dHVyZQ==" });
  const result = await resolveIdempotencyForRequest("alice", key);
  assert.ok(result.kind === "replay" && result.record.status === "failed" && result.record.httpStatus === 410);
});

test("legacy preprocessing rejects busy accounts before parsing malformed images and throttles invalid attempts", async () => {
  const user = { username: "alice", displayName: "Alice", passwordHash };
  let paidChecks = 0;
  const submit = () => {
    const form = new FormData();
    form.set("selectionMode", "outfit");
    for (const role of ["person", "outfit", "fabric"]) form.set(role, new File(["broken"], "broken.png", { type: "image/png" }));
    return handleTryOnRequest(new Request("http://localhost/api/try-on", { method: "POST", headers: { origin: "http://localhost" }, body: form }), {
      authenticate: async () => user,
      rateLimit: async () => { paidChecks++; throw new Error("must not charge generation quota"); },
      generate: async () => { throw new Error("must not generate"); },
    });
  };
  const lease = await acquireGenerationLock("alice"); assert.ok(lease);
  assert.equal((await submit()).status, 409);
  await releaseGenerationLock(lease);
  for (let i = 0; i < 11; i++) assert.equal((await submit()).status, 400);
  assert.equal((await submit()).status, 429);
  assert.equal(paidChecks, 0);
});
