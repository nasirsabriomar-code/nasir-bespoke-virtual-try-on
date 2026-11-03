import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { APIConnectionTimeoutError } from "openai";
import sharp from "sharp";
import { maxDuration } from "@/app/api/try-on/route";
import { GENERATION_LOCK_TTL_SECONDS, resetMemoryGenerationGuardsForTests } from "@/lib/generation-guard";
import { storeGenerationAssets } from "@/lib/generation-storage";
import { createUploadSlot, getPermanentHistory, getUploadSlot, markUploadComplete } from "@/lib/highres/ledger";
import { lookupGenerationEvent } from "@/lib/history/lookup-generation";
import { removeExpiredUploads } from "@/lib/highres/uploads";
import { resetMemoryRateLimitsForTests } from "@/lib/rate-limit";
import { handleTryOnRequest } from "@/lib/try-on-handler";
import { grayscaleConstruction } from "@/lib/tryon/neutralize-construction";
import { OpenAITryOnProvider } from "@/lib/tryon/providers/openai";
import type { TryOnOutput } from "@/lib/tryon/types";
import type { UsageEvent } from "@/lib/usage-history";

const USER = { username: "showroom", displayName: "Showroom Staff", passwordHash: "unused" };

const headers = (extra: Record<string, string> = {}) => ({
  origin: "http://localhost",
  host: "localhost",
  "sec-fetch-site": "same-origin",
  ...extra,
});

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

function tinyPng(name: string) {
  return new File(
    [Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVQImWNgYGgAAACEAIGcaMMkAAAAAElFTkSuQmCC", "base64")],
    name,
    { type: "image/png" },
  );
}

function catalogForm() {
  const form = new FormData();
  form.append("person", tinyPng("person.png"));
  form.append("fabric", tinyPng("fabric.png"));
  form.append("selectionMode", "catalog");
  form.append("upperGarmentId", "coat-blazer");
  form.append("lowerGarmentId", "trousers-tailored");
  form.append("turbanId", "turban-none");
  form.append("shoeId", "shoes-keep-existing");
  return form;
}

const result: TryOnOutput = {
  bytes: Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]),
  contentType: "image/jpeg",
  metadata: { provider: "test", model: "test", quality: "medium", durationMs: 1 },
};

const allowRate = async () => ({ allowed: true, limit: 20, remaining: 19, resetAt: Date.now() + 60_000 });

function mockR2(t: { mock: { method: typeof import("node:test").mock.method } }, failPut: (path: string, attempt: number) => boolean = () => false) {
  const objects = new Map<string, Uint8Array>();
  const attempts = new Map<string, number>();
  const deleted: string[] = [];
  t.mock.method(globalThis, "fetch", async (input: string, init?: RequestInit) => {
    const path = new URL(input).pathname.replace("/test-bucket/", "");
    if (init?.method === "PUT") {
      const attempt = (attempts.get(path) ?? 0) + 1;
      attempts.set(path, attempt);
      if (failPut(path, attempt)) return new Response(null, { status: 500 });
      objects.set(path, new Uint8Array(await new Response(init.body as BodyInit).arrayBuffer()));
      return new Response(null, { status: 200 });
    }
    if (init?.method === "DELETE") {
      deleted.push(path);
      objects.delete(path);
      return new Response(null, { status: 204 });
    }
    const bytes = objects.get(path);
    return bytes
      ? new Response(Buffer.from(bytes), { headers: { "Content-Type": "image/png" } })
      : new Response("<Error><Code>NoSuchKey</Code></Error>", { status: 404 });
  });
  return { objects, deleted };
}

test("#1 a Redis history failure still writes the permanent generation record", async () => {
  const before = (await getPermanentHistory(100)).total;
  const response = await handleTryOnRequest(new Request("http://localhost/api/try-on", {
    method: "POST", headers: headers(), body: catalogForm(),
  }), {
    authenticate: async () => USER,
    rateLimit: allowRate,
    generate: async () => result,
    recordUsage: async () => { throw new Error("redis down"); },
  });
  assert.equal(response.status, 200);
  assert.equal((await getPermanentHistory(100)).total, before + 1);
});

const event = (id: string) => ({ id, username: "showroom", occurredAt: new Date().toISOString() }) as UsageEvent;

test("#1 generation lookup falls back to recent history when the ledger misses or fails", async () => {
  assert.equal((await lookupGenerationEvent("a", { permanent: async () => event("permanent"), recent: async () => event("recent") }))?.id, "permanent");
  assert.equal((await lookupGenerationEvent("a", { permanent: async () => null, recent: async () => event("recent") }))?.id, "recent");
  assert.equal((await lookupGenerationEvent("a", { permanent: async () => { throw new Error("neon down"); }, recent: async () => event("recent") }))?.id, "recent");
  assert.equal(await lookupGenerationEvent("a", { permanent: async () => null, recent: async () => null }), null);
});

const assetInput = (id: string) => ({
  generationId: id,
  person: tinyPng("person.png"),
  fabric: tinyPng("fabric.png"),
  references: [],
  resultBytes: Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  resultContentType: "image/png",
});

test("#2 a failed secondary upload keeps the paid result", async (t) => {
  const id = crypto.randomUUID();
  const r2 = mockR2(t, (path) => path.endsWith("/fabric.png"));
  const refs = await storeGenerationAssets(assetInput(id));
  assert.ok(refs?.result);
  assert.ok(refs?.person);
  assert.equal(refs?.fabric, undefined);
  assert.ok(r2.objects.has(`nasir-bespoke/generations/${id}/result.png`));
  assert.deepEqual(r2.deleted, []);
});

test("#2 a transient failure on the result upload is retried", async (t) => {
  const id = crypto.randomUUID();
  const r2 = mockR2(t, (path, attempt) => path.endsWith("/result.png") && attempt === 1);
  const refs = await storeGenerationAssets(assetInput(id));
  assert.ok(refs?.result);
  assert.ok(r2.objects.has(`nasir-bespoke/generations/${id}/result.png`));
});

test("#2 a result that can never be stored is reported as a failure", async (t) => {
  mockR2(t, (path) => path.endsWith("/result.png"));
  await assert.rejects(storeGenerationAssets(assetInput(crypto.randomUUID())));
});

test("#11 an OpenAI SDK timeout is reported as a timeout", async () => {
  const response = await handleTryOnRequest(new Request("http://localhost/api/try-on", {
    method: "POST", headers: headers(), body: catalogForm(),
  }), {
    authenticate: async () => USER,
    rateLimit: allowRate,
    generate: async () => { throw new APIConnectionTimeoutError(); },
  });
  assert.equal(response.status, 504);
  assert.match((await response.json() as { error: string }).error, /too long/);
});

test("#12 a guard outage on a full-resolution request is a 503, not an upload error", async () => {
  process.env.UPSTASH_REDIS_REST_URL = "http://127.0.0.1:1";
  process.env.UPSTASH_REDIS_REST_TOKEN = "token";
  const response = await handleTryOnRequest(new Request("http://localhost/api/try-on", {
    method: "POST",
    headers: headers({ "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() }),
    body: JSON.stringify({ selectionMode: "level1", uploads: {} }),
  }), { authenticate: async () => USER, rateLimit: allowRate, generate: async () => result });
  assert.equal(response.status, 503);
});

test("#14 the generation lock outlives the route's longest possible run", () => {
  assert.ok(GENERATION_LOCK_TTL_SECONDS > maxDuration);
});

test("#7 a failed full-resolution generation deletes its uploaded customer photos", async (t) => {
  const r2 = mockR2(t);
  const person = await createUploadSlot({ username: USER.username, role: "person", filename: "p.png", contentType: "image/png", bytes: 24 });
  const fabric = await createUploadSlot({ username: USER.username, role: "fabric", filename: "f.png", contentType: "image/png", bytes: 24 });
  for (const slot of [person, fabric]) {
    r2.objects.set(slot.pathname, new Uint8Array(await tinyPng("x.png").arrayBuffer()));
    await markUploadComplete(slot.id, {});
  }
  const response = await handleTryOnRequest(new Request("http://localhost/api/try-on", {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      selectionMode: "catalog",
      upperGarmentId: "coat-blazer",
      lowerGarmentId: "trousers-tailored",
      turbanId: "turban-none",
      shoeId: "shoes-keep-existing",
      uploads: { person: person.id, fabric: fabric.id },
    }),
  }), {
    authenticate: async () => USER,
    rateLimit: allowRate,
    generate: async () => { throw new Error("provider exploded"); },
  });
  assert.equal(response.status, 502);
  assert.deepEqual(r2.deleted.sort(), [person.pathname, fabric.pathname].sort());
});

test("#7 cleanup removes uploads past the grace period and keeps recent ones", async (t) => {
  const r2 = mockR2(t);
  const slot = await createUploadSlot({ username: "cleanup-user", role: "person", filename: "p.png", contentType: "image/png", bytes: 24 });
  const expiresAt = new Date(slot.expiresAt).getTime();
  assert.equal(await removeExpiredUploads(expiresAt + 60_000), 0);
  assert.ok(await getUploadSlot(slot.id));
  assert.ok(await removeExpiredUploads(expiresAt + 2 * 60 * 60_000) >= 1);
  assert.equal(await getUploadSlot(slot.id), null);
  assert.ok(r2.deleted.includes(slot.pathname));
});

async function rotatedJpeg() {
  // Stored 1600x1200 with EXIF orientation 6: a phone portrait held upright.
  const bytes = await sharp({ create: { width: 1600, height: 1200, channels: 3, background: "#884422" } })
    .withMetadata({ orientation: 6 }).jpeg().toBuffer();
  return { file: new File([new Uint8Array(bytes)], "person.jpg", { type: "image/jpeg" }), mime: "image/jpeg" as const, width: 1600, height: 1200 };
}

test("#3 a rotated phone portrait is sent upright and requests a portrait canvas", async () => {
  let captured: { size: string; image: File[] } | null = null;
  const fakeClient = {
    images: {
      edit: async (parameters: { size: string; image: File[] }) => {
        captured = parameters;
        return { data: [{ b64_json: Buffer.from(await tinyPng("result.png").arrayBuffer()).toString("base64") }] };
      },
    },
  };
  await new OpenAITryOnProvider(() => fakeClient as never).generate({
    person: await rotatedJpeg(),
    fabric: { file: tinyPng("fabric.png"), mime: "image/png" },
    references: [],
    selection: { mode: "level1", categoryId: "suit", designId: "x" },
    prompt: "prompt",
    requestId: "rotation-test",
  });
  assert.ok(captured);
  const { size, image } = captured as { size: string; image: File[] };
  const [width, height] = size.split("x").map(Number);
  assert.ok(height > width, `expected portrait canvas, got ${size}`);
  const sent = await sharp(Buffer.from(await image[0].arrayBuffer())).metadata();
  assert.equal(sent.width, 1200);
  assert.equal(sent.height, 1600);
  assert.ok(!sent.orientation || sent.orientation === 1);
});

test("#3 greyscale construction references keep their upright orientation", async () => {
  const output = await grayscaleConstruction(await rotatedJpeg());
  const metadata = await sharp(Buffer.from(await output.file.arrayBuffer())).metadata();
  assert.equal(metadata.width, 1200);
  assert.equal(metadata.height, 1600);
});

test("large uploaded originals pass the trusted JSON handoff without the external multipart cap", async (t) => {
  const { randomBytes, createHash } = await import("node:crypto");
  const { MAX_REQUEST_BYTES } = await import("@/lib/validation");
  const { objects } = mockR2(t);
  const bytes = await sharp(randomBytes(1600 * 900 * 3), { raw: { width: 1600, height: 900, channels: 3 } }).png().toBuffer();
  assert.ok(bytes.length > MAX_REQUEST_BYTES);
  const uploads: Record<string, string> = {};
  for (const role of ["person", "fabric", "outfit"] as const) {
    const slot = await createUploadSlot({ username: USER.username, role, filename: "synthetic.png", contentType: "image/png", bytes: bytes.length });
    objects.set(slot.pathname, bytes);
    await markUploadComplete(slot.id, { checksum: createHash("sha256").update(bytes).digest("hex"), width: 1600, height: 900 });
    uploads[role] = slot.id;
  }
  let generated = 0;
  const response = await handleTryOnRequest(new Request("http://localhost/api/try-on", {
    method: "POST", headers: headers({ "content-type": "application/json" }), body: JSON.stringify({ selectionMode: "outfit", uploads }),
  }), {
    authenticate: async () => USER, rateLimit: allowRate,
    generate: async input => {
      generated++;
      assert.deepEqual(Buffer.from(await input.person.file.arrayBuffer()), bytes);
      assert.deepEqual(Buffer.from(await input.fabric!.file.arrayBuffer()), bytes);
      return result;
    },
    recordUsage: async () => {},
  });
  assert.equal(response.status, 200);
  assert.equal(generated, 1);
  assert.match((await response.json()).resultUrl, /^\/api\/history\//);
});
