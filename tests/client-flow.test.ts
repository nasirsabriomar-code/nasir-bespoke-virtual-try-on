import assert from "node:assert/strict";
import test from "node:test";
import { fetchWithTimeout, recoverGeneration, RecoveryAuthenticationError } from "@/lib/generation-recovery";
import { buildResultSummary } from "@/lib/result-summary";
import { DEFAULT_SPLIT_OUTFIT_STATE, SUIT_FOOTWEAR_OPTIONS, SUIT_LOWER_OPTIONS, SUIT_UPPER_OPTIONS } from "@/lib/split-outfit/catalogue";
import { clearSplitFabrics } from "@/lib/split-outfit/client-fabrics";

test("#4 clearing split fabrics empties every piece and releases each preview", () => {
  const revoked: string[] = [];
  const cleared = clearSplitFabrics({
    jacket: { file: new File([], "j"), previewUrl: "blob:j" },
    trousers: null,
    shirt: { file: new File([], "s"), previewUrl: "blob:s" },
    waistcoat: null,
  }, (url) => revoked.push(url));
  assert.deepEqual(cleared, { jacket: null, trousers: null, shirt: null, waistcoat: null });
  assert.deepEqual(revoked.sort(), ["blob:j", "blob:s"]);
});

test("#5 the request timeout aborts a request that never answers", async (t) => {
  t.mock.method(globalThis, "fetch", (_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
    init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
  }));
  await assert.rejects(fetchWithTimeout("/api/try-on", { method: "POST" }, 10), { name: "AbortError" });
});

test("#5 a request that answers in time returns its response", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("ok"));
  const response = await fetchWithTimeout("/api/try-on", { method: "POST" }, 1_000);
  assert.equal(await response.text(), "ok");
});

test("generation response bodies remain covered by the request deadline", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response(new ReadableStream({ start() { /* Synthetic hung response body. */ } })));
  await assert.rejects(fetchWithTimeout("/api/try-on", { method: "POST" }, 10), { name: "AbortError" });
});

function statusSequence(...states: unknown[]) {
  let index = 0;
  return async () => states[Math.min(index++, states.length - 1)];
}

const noWait = async () => undefined;

test("#6 a lost response recovers the finished generation", async () => {
  const finished = { state: "complete", resultUrl: "/r", originalUrl: "/o" };
  const recovered = await recoverGeneration("key", {
    readStatus: statusSequence({ state: "in_progress" }, { state: "in_progress" }, finished) as never,
    wait: noWait,
  });
  assert.deepEqual(recovered, { kind: "complete", resultUrl: "/r", originalUrl: "/o" });
});

test("#6 a recorded failure ends recovery with the server's message", async () => {
  const recovered = await recoverGeneration("key", {
    readStatus: statusSequence({ state: "failed", error: "We couldn't create the try-on." }) as never,
    wait: noWait,
  });
  assert.deepEqual(recovered, { kind: "failed", error: "We couldn't create the try-on." });
});

test("expired authentication ends recovery immediately instead of looking like a status outage", async (t) => {
  let reads = 0;
  t.mock.method(globalThis, "fetch", async () => { reads++; return Response.json({ error: "Sign in again" }, { status: 401 }); });
  await assert.rejects(recoverGeneration("fixture-key", undefined, { totalTimeoutMs: 100 }), RecoveryAuthenticationError);
  assert.equal(reads, 1);
});

test("#6 a request the server never saw stops quickly instead of polling for minutes", async () => {
  let reads = 0;
  const recovered = await recoverGeneration("key", {
    readStatus: async () => { reads += 1; return { state: "absent" }; },
    wait: noWait,
  });
  assert.deepEqual(recovered, { kind: "unknown" });
  assert.ok(reads <= 8, `expected a short search, read ${reads} times`);
});

test("#6 a brief status outage does not abandon a running generation", async () => {
  let reads = 0;
  const recovered = await recoverGeneration("key", {
    readStatus: async () => {
      reads += 1;
      if (reads === 1) throw new TypeError("network lost");
      return { state: "complete", resultUrl: "/r", originalUrl: "/o" };
    },
    wait: noWait,
  });
  assert.equal(recovered.kind, "complete");
});

test("#13 a Split Outfit result names the pieces that were actually chosen", () => {
  const summary = buildResultSummary({
    mode: "split",
    splitOutfit: {
      ...DEFAULT_SPLIT_OUTFIT_STATE,
      family: "suit",
      upperId: SUIT_UPPER_OPTIONS[0].id,
      lowerId: SUIT_LOWER_OPTIONS[0].id,
      footwearId: SUIT_FOOTWEAR_OPTIONS[0].id,
    },
    hasUploadedFabric: false,
  });
  assert.equal(summary.garment, SUIT_UPPER_OPTIONS[0].customer.name);
  assert.equal(summary.lower, SUIT_LOWER_OPTIONS[0].customer.name);
  assert.equal(summary.shoes, SUIT_FOOTWEAR_OPTIONS[0].customer.name);
  assert.equal(summary.fabric, "Approved reference cloth");
  assert.equal(summary.turban, undefined);
});

test("#13 a Full Outfit result names the design and variation", () => {
  const summary = buildResultSummary({ mode: "full", designName: "Classic Suit", variantName: "Navy" });
  assert.equal(summary.garment, "Classic Suit — Navy");
  assert.equal(summary.fabric, "Uploaded fabric");
  assert.equal(summary.shoes, "Keep existing");
});
