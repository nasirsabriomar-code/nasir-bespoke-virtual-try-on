import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import bcrypt from "bcryptjs";
import { parsePendingGeneration, clearPendingGenerations, pendingStorageKey } from "@/lib/pending-generation";
import { cachedCatalogueProbe, invalidateCatalogueAvailability } from "@/lib/catalog/availability-cache";
import { sanitizeGenerationMetadata } from "@/lib/tryon/metadata";
import { parseReview } from "@/lib/history/review-types";
import { GET, PUT } from "@/app/api/history/[id]/review/route";
import { recordUsageEvent, getUsageHistory, resetMemoryUsageHistoryForTests } from "@/lib/usage-history";
import { createSessionToken, getSessionCookieName } from "@/lib/auth/session";
import { resetMemorySessionsForTests } from "@/lib/auth/session-store";
import { createUploadSlot, markUploadComplete, consumeUploadSlots } from "@/lib/highres/ledger";
import { uploadOriginal } from "@/lib/highres/client-upload";
import { UPLOAD_CHUNK_BYTES } from "@/lib/highres/upload-config";

beforeEach(() => {
  process.env.AUTH_SESSION_SECRET = "synthetic-improvement-secret-at-least-32-bytes";
  process.env.AUTH_USERS_JSON = JSON.stringify(["staff-one", "staff-two"].map(username => ({ username, displayName: username, passwordHash: bcrypt.hashSync("fixture-only", 4) })));
  delete process.env.AUTH_USERS_JSON_BASE64;
  delete process.env.DATABASE_URL;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  resetMemorySessionsForTests(); resetMemoryUsageHistoryForTests(); invalidateCatalogueAvailability();
});
function storage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); }, clear: () => values.clear(), key: (index: number) => [...values.keys()][index] ?? null, get length() { return values.size; } } satisfies Storage;
}
const summary = { garment: "Suit", fabric: "Uploaded fabric", shoes: "Keep existing" };

test("pending jobs preserve only bounded metadata and expire per account", () => {
  const key = crypto.randomUUID();
  const raw = JSON.stringify({ key, createdAt: 1000, summary, photo: "must-not-be-copied" });
  assert.deepEqual(parsePendingGeneration(raw, 2000), { key, createdAt: 1000, summary });
  assert.equal(parsePendingGeneration(raw, 1000 + 15 * 60000), null);
  assert.equal(parsePendingGeneration(JSON.stringify({ key: "-".repeat(36), createdAt: 1000, summary }), 2000), null);
  assert.equal(parsePendingGeneration(JSON.stringify({ key, createdAt: "1000", summary }), 2000), null);
  assert.notEqual(pendingStorageKey("one"), pendingStorageKey("two"));
  const store = storage(); store.setItem(pendingStorageKey("one"), raw); store.setItem("unrelated", "keep");
  clearPendingGenerations(store); assert.equal(store.length, 1); assert.equal(store.getItem("unrelated"), "keep");
});

test("catalogue cache deduplicates concurrent probes, isolates realms and invalidates", async () => {
  let calls = 0;
  const probe = async () => { calls++; return true; };
  await Promise.all([cachedCatalogueProbe("one", "asset", probe, 1000), cachedCatalogueProbe("one", "asset", probe, 1000)]);
  await cachedCatalogueProbe("one", "asset", probe, 2000); assert.equal(calls, 1);
  await cachedCatalogueProbe("two", "asset", probe, 2000); assert.equal(calls, 2);
  invalidateCatalogueAvailability("asset"); await cachedCatalogueProbe("one", "asset", probe, 2000); assert.equal(calls, 3);
  await cachedCatalogueProbe("one", "asset", probe, 33000); assert.equal(calls, 4);
});

test("catalogue failures are not cached as missing assets", async () => {
  await assert.rejects(cachedCatalogueProbe("one", "asset", async () => { throw new Error("outage"); }));
  assert.equal(await cachedCatalogueProbe("one", "asset", async () => true), true);
});

test("generation metadata survives history round-trip without arbitrary provider data", async () => {
  const metadata = sanitizeGenerationMetadata({ model: "fixture", reportedQuality: "medium", requestedSize: "2160x3840", outputWidth: 2160, outputHeight: 3840, prompt: "private hidden instruction", usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 }, provenance: { promptVersion: "v2", preprocessingVersion: "v2", promptHash: "a".repeat(64), providerAttempts: 2, fallbackReasons: ["size", "secret"] } });
  assert.doesNotMatch(JSON.stringify(metadata), /private hidden|secret/);
  await recordUsageEvent({ id: crypto.randomUUID(), occurredAt: new Date().toISOString(), username: "staff-one", status: "success", device: { kind: "desktop", browser: "fixture", operatingSystem: "fixture" }, durationMs: 1, model: "fixture", provider: "fixture", quality: "medium", metadata });
  const history = await getUsageHistory();
  assert.deepEqual(history.events[0].metadata, metadata);
});

test("feedback validates fields, persists and is isolated between staff", async () => {
  assert.equal(parseReview({ decision: ["accepted"], favourite: false, reasons: [] }), null);
  assert.equal(parseReview({ decision: "accepted", favourite: true, reasons: [], prompt: "injected" }), null);
  const id = crypto.randomUUID();
  await recordUsageEvent({ id, occurredAt: new Date().toISOString(), username: "staff-one", status: "success", device: { kind: "desktop", browser: "fixture", operatingSystem: "fixture" }, durationMs: 1, provider: "fixture", model: "fixture", quality: "medium" });
  const cookie = async (username: string) => `${getSessionCookieName()}=${await createSessionToken(username)}`;
  const context = { params: Promise.resolve({ id }) };
  const url = `http://localhost/api/history/${id}/review`;
  assert.equal((await GET(new Request(url), context)).status, 401);
  const first = await cookie("staff-one");
  assert.equal((await PUT(new Request(url, { method: "PUT", headers: { cookie: first }, body: "{}" }), context)).status, 403);
  const response = await PUT(new Request(url, { method: "PUT", headers: { cookie: first, origin: "http://localhost" }, body: JSON.stringify({ decision: "rejected", favourite: true, reasons: ["pattern-too-large"] }) }), context);
  assert.equal(response.status, 200);
  const own = await (await GET(new Request(url, { headers: { cookie: first } }), context)).json();
  assert.equal(own.favourite, true); assert.deepEqual(own.reasons, ["pattern-too-large"]);
  const other = await (await GET(new Request(url, { headers: { cookie: await cookie("staff-two") } }), context)).json();
  assert.equal(other.favourite, false); assert.equal(other.decision, "unreviewed");
});

test("consumed slots cannot be revived and memory consumption is atomic", async () => {
  const slot = await createUploadSlot({ username: "staff-one", role: "person", filename: "fixture.png", contentType: "image/png", bytes: 10 });
  await markUploadComplete(slot.id, { checksum: "fixture" });
  const results = await Promise.all([consumeUploadSlots("staff-one", [slot.id]), consumeUploadSlots("staff-one", [slot.id])]);
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(await markUploadComplete(slot.id, { checksum: "replacement" }), null);
});

test("interrupted client uploads resume the same slot with exact original chunk bytes", async (t) => {
  const store = storage(); const id = crypto.randomUUID();
  const file = new File([new Uint8Array(UPLOAD_CHUNK_BYTES + 17).fill(3)], "fixture.png", { type: "image/png" });
  let interrupted = true; let created = 0; let firstParts = 0;
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    if (url === "/api/try-on/uploads") { created++; return Response.json({ id, pathname: "fixture", expiresAt: new Date(Date.now() + 600000).toISOString() }); }
    if (init.method === "GET") return Response.json({ id, status: "authorized", role: "person", bytes: file.size });
    if (url.endsWith("/parts/0")) { firstParts++; assert.equal((init.body as Blob).size, UPLOAD_CHUNK_BYTES); return Response.json({ uploaded: true }); }
    if (url.endsWith("/parts/1")) { assert.equal((init.body as Blob).size, 17); return interrupted ? Response.json({ error: "interrupted" }, { status: 400 }) : Response.json({ uploaded: true }); }
    return Response.json({ id });
  });
  await assert.rejects(uploadOriginal("person", file, () => {}, { accountId: "staff-one", storage: store }));
  interrupted = false;
  assert.equal(await uploadOriginal("person", file, () => {}, { accountId: "staff-one", storage: store }), id);
  assert.equal(created, 1); assert.equal(firstParts, 1);
});

test("evaluation summaries include rejected-run cost and never fabricate missing costs", async () => {
  const { summarizeEvaluations } = await import("@/lib/evaluation/summary");
  const scores = { scale: 3, colour: 4, construction: 4, background: 5, identity: 5 };
  const summary = summarizeEvaluations([{ caseId: "one", condition: "baseline", accepted: true, durationMs: 100, costUsd: .2, scores }, { caseId: "two", condition: "baseline", accepted: false, durationMs: 300, costUsd: .3, scores }])[0];
  assert.equal(summary.medianDurationMs, 200); assert.equal(summary.p95DurationMs, 300);
  assert.equal(summary.costPerAcceptedUsd, .5);
  assert.equal(summarizeEvaluations([{ caseId: "one", condition: "candidate", accepted: true, durationMs: 100, costUsd: null, scores }])[0].costPerAcceptedUsd, null);
  for (const invalid of [{ scores: {} }, { accepted: "yes" }, { scores: { ...scores, scale: 3.5 } }, { scores: { ...scores, invented: 5 } }]) {
    assert.throws(() => summarizeEvaluations([{ caseId: "one", condition: "candidate", accepted: true, durationMs: 100, costUsd: null, scores, ...invalid } as never]), /Invalid evaluation/);
  }
});

test("transient chunk retries reuse one upload slot and identical bytes", async (t) => {
  const id = crypto.randomUUID(); const file = new File([new Uint8Array(400).fill(73)], "retry.png", { type: "image/png" });
  let creates = 0; let parts = 0; let completes = 0;
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    if (url === "/api/try-on/uploads") { creates++; return Response.json({ id, expiresAt: new Date(Date.now() + 600000).toISOString() }); }
    if (url.endsWith("/parts/0")) {
      assert.deepEqual(new Uint8Array(await (init.body as Blob).arrayBuffer()), new Uint8Array(await file.arrayBuffer())); parts++;
      if (parts === 1) return Response.json({}, { status: 503 });
      if (parts === 2) throw new TypeError("Synthetic lost acknowledgement");
      return Response.json({ uploaded: true });
    }
    assert.ok(url.endsWith("/complete")); completes++; return Response.json({ id });
  });
  assert.equal(await uploadOriginal("fabric", file, () => {}, { accountId: "staff-one", storage: storage() }), id);
  assert.equal(creates, 1); assert.equal(parts, 3); assert.equal(completes, 1);
});

test("failed evaluation runs count toward acceptance and cost without inventing visual scores", async () => {
  const { summarizeEvaluations } = await import("@/lib/evaluation/summary");
  const scores = { scale: 4, colour: 4, construction: 4, background: 5, identity: 5 };
  const summary = summarizeEvaluations([{ caseId: "one", condition: "candidate", accepted: false, failed: true, scores: null, durationMs: 50, costUsd: .1 }, { caseId: "one", condition: "candidate", accepted: true, scores, durationMs: 100, costUsd: .3 }])[0];
  assert.equal(summary.sampleSize, 2); assert.equal(summary.failed, 1); assert.equal(summary.scored, 1);
  assert.equal(summary.acceptanceRate, .5); assert.equal(summary.costPerAcceptedUsd, .4); assert.deepEqual(summary.meanScores, scores);
  const failedOnly = summarizeEvaluations([{ caseId: "one", condition: "baseline", accepted: false, failed: true, scores: null, durationMs: 50, costUsd: null }])[0];
  assert.equal(failedOnly.meanScores, null); assert.equal(failedOnly.costPerAcceptedUsd, null);
});

test("cancelling a chunk aborts waiting without completing or retrying generation", async (t) => {
  const id = crypto.randomUUID(); const controller = new AbortController(); const store = storage();
  let parts = 0;
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    if (url === "/api/try-on/uploads") return Response.json({ id, expiresAt: new Date(Date.now() + 600000).toISOString() });
    assert.ok(url.endsWith("/parts/0")); parts++;
    return new Promise<Response>((_resolve, reject) => {
      init.signal!.addEventListener("abort", () => reject(new DOMException("Cancelled", "AbortError")), { once: true });
      queueMicrotask(() => controller.abort());
    });
  });
  await assert.rejects(uploadOriginal("fabric", new File([new Uint8Array(400)], "cancel.png", { type: "image/png" }), () => {}, { accountId: "staff-one", storage: store, signal: controller.signal }), { name: "AbortError" });
  assert.equal(parts, 1); assert.equal(store.length, 1);
});

test("overlapping upload sets cannot consume the same slot or strand an unrelated slot in memory", async () => {
  const slots = await Promise.all([0, 1, 2].map(async () => {
    const slot = await createUploadSlot({ username: "staff-one", role: "fabric", filename: "overlap.png", contentType: "image/png", bytes: 10 });
    await markUploadComplete(slot.id, { checksum: "fixture" }); return slot;
  }));
  const first = await consumeUploadSlots("staff-one", [slots[0].id, slots[1].id]);
  assert.ok(first);
  assert.equal(await consumeUploadSlots("staff-one", [slots[1].id, slots[2].id]), null);
  assert.ok(await consumeUploadSlots("staff-one", [slots[2].id]));
});
