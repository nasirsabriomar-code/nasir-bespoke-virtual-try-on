import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import bcrypt from "bcryptjs";
import { POST as login } from "@/app/api/auth/login/route";
import { GET as readAsset } from "@/app/api/history/[id]/asset/[asset]/route";
import { GET as cleanupUploads } from "@/app/api/cron/cleanup-uploads/route";
import { GET as readStatus } from "@/app/api/try-on/status/route";
import { activateSession, isSessionActive, resetMemorySessionsForTests, SessionStoreConfigurationError } from "@/lib/auth/session-store";
import { createSessionToken, getSessionCookieName } from "@/lib/auth/session";
import { writeIdempotencyRecord } from "@/lib/generation-guard";
import { migrateGenerationAsset } from "@/lib/history/migrate-generation-assets";
import { getRequestIdentifier, resetMemoryRateLimitsForTests } from "@/lib/rate-limit";
import { recordUsageEvent, resetMemoryUsageHistoryForTests, type UsageEvent } from "@/lib/usage-history";

const PASSWORD = "Correct-Horse-Battery-Staple";
const users = [
  { username: "showroom", displayName: "Showroom", passwordHash: bcrypt.hashSync(PASSWORD, 4) },
  { username: "atelier", displayName: "Atelier", passwordHash: bcrypt.hashSync(PASSWORD, 4) },
];

function setNodeEnv(value: string) {
  (process.env as Record<string, string>).NODE_ENV = value;
}

beforeEach(() => {
  process.env.AUTH_SESSION_SECRET = "test-session-secret-that-is-at-least-thirty-two-bytes";
  process.env.AUTH_USERS_JSON = JSON.stringify(users);
  process.env.RATE_LIMIT_BACKEND = "memory";
  delete process.env.DATABASE_URL;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  process.env.R2_ACCOUNT_ID = "a".repeat(32);
  process.env.R2_BUCKET_NAME = "test-bucket";
  process.env.R2_ACCESS_KEY_ID = "test-access";
  process.env.R2_SECRET_ACCESS_KEY = "test-secret";
  resetMemorySessionsForTests();
  resetMemoryRateLimitsForTests();
  resetMemoryUsageHistoryForTests();
});

test("#8 a session deleted from Redis is rejected even if this instance remembers it", async (t) => {
  await activateSession("session-1", "showroom", 600);
  process.env.UPSTASH_REDIS_REST_URL = "https://redis.example";
  process.env.UPSTASH_REDIS_REST_TOKEN = "token";
  setNodeEnv("production");
  t.after(() => setNodeEnv("test"));
  t.mock.method(globalThis, "fetch", async () => Response.json([{ result: null }]));
  assert.equal(await isSessionActive("session-1", "showroom"), false);
});

test("#8 a Redis outage cannot fall back to this instance's session record", async (t) => {
  await activateSession("session-2", "showroom", 600);
  process.env.UPSTASH_REDIS_REST_URL = "https://redis.example";
  process.env.UPSTASH_REDIS_REST_TOKEN = "token";
  setNodeEnv("production");
  t.after(() => setNodeEnv("test"));
  t.mock.method(globalThis, "fetch", async () => { throw new TypeError("network down"); });
  await assert.rejects(isSessionActive("session-2", "showroom"), SessionStoreConfigurationError);
});

test("#9 a client-supplied cf-connecting-ip cannot change the login identity", () => {
  const request = (fake: string) => new Request("http://localhost/api/auth/login", {
    headers: { "cf-connecting-ip": fake, "x-forwarded-for": "203.0.113.7" },
  });
  assert.equal(getRequestIdentifier(request("1.1.1.1")), "203.0.113.7");
  assert.equal(getRequestIdentifier(request("2.2.2.2")), "203.0.113.7");
});

test("#9 rotating addresses cannot bypass the per-account login limit", async () => {
  process.env.AUTH_LOGIN_RATE_LIMIT_PER_15_MINUTES = "2";
  const attempt = (ip: string) => login(new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", origin: "http://localhost", host: "localhost", "sec-fetch-site": "same-origin", "x-forwarded-for": ip },
    body: JSON.stringify({ username: "showroom", password: "wrong" }),
  }));
  assert.equal((await attempt("10.0.0.1")).status, 401);
  assert.equal((await attempt("10.0.0.2")).status, 401);
  assert.equal((await attempt("10.0.0.3")).status, 429);
});

async function staffGeneration(owner: string) {
  const id = crypto.randomUUID();
  const event: UsageEvent = {
    id, occurredAt: new Date().toISOString(), username: owner, status: "success",
    device: { kind: "desktop", browser: "Chrome", operatingSystem: "macOS" },
    durationMs: 1, provider: "openai", model: "test", quality: "medium",
    generation: { mode: "outfit" },
    assets: { result: { pathname: `nasir-bespoke/generations/${id}/result.png`, contentType: "image/png" } },
  };
  await recordUsageEvent(event);
  return id;
}

test("#10 staff can download any generation they can already view in shared history", async (t) => {
  const id = await staffGeneration("atelier");
  t.mock.method(globalThis, "fetch", async () => new Response(Buffer.from("image"), { headers: { "Content-Type": "image/png" } }));
  const cookie = `${getSessionCookieName()}=${await createSessionToken("showroom")}`;
  const response = await readAsset(new Request(`http://localhost/api/history/${id}/asset/result?download=1`, { headers: { cookie } }), {
    params: Promise.resolve({ id, asset: "result" }),
  });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "image");
});

test("#10 signed-out requests still cannot read a generation", async () => {
  const id = await staffGeneration("atelier");
  const response = await readAsset(new Request(`http://localhost/api/history/${id}/asset/result?download=1`), {
    params: Promise.resolve({ id, asset: "result" }),
  });
  assert.equal(response.status, 404);
});

async function statusFor(key: string, username = "showroom") {
  const cookie = `${getSessionCookieName()}=${await createSessionToken(username)}`;
  return readStatus(new Request(`http://localhost/api/try-on/status?key=${key}`, { headers: { cookie } }));
}

test("#6 status reports a finished generation to the account that started it", async () => {
  const key = crypto.randomUUID();
  const generationId = crypto.randomUUID();
  await writeIdempotencyRecord("showroom", key, { status: "complete_generation", generationId });
  assert.deepEqual(await (await statusFor(key)).json(), {
    state: "complete",
    resultUrl: `/api/history/${generationId}/asset/result`,
    originalUrl: `/api/history/${generationId}/asset/person`,
  });
});

test("#6 status does not reveal another account's generation", async () => {
  const key = crypto.randomUUID();
  await writeIdempotencyRecord("showroom", key, { status: "complete_generation", generationId: crypto.randomUUID() });
  assert.deepEqual(await (await statusFor(key, "atelier")).json(), { state: "absent" });
});

test("#6 status requires a signed-in user", async () => {
  const response = await readStatus(new Request(`http://localhost/api/try-on/status?key=${crypto.randomUUID()}`));
  assert.equal(response.status, 401);
});

test("#7 the cleanup job refuses requests without the configured secret", async () => {
  process.env.CRON_SECRET = "cleanup-secret";
  assert.equal((await cleanupUploads(new Request("http://localhost/api/cron/cleanup-uploads"))).status, 401);
  assert.equal((await cleanupUploads(new Request("http://localhost/api/cron/cleanup-uploads", {
    headers: { authorization: "Bearer wrong" },
  }))).status, 401);
  delete process.env.CRON_SECRET;
  assert.equal((await cleanupUploads(new Request("http://localhost/api/cron/cleanup-uploads", {
    headers: { authorization: "Bearer undefined" },
  }))).status, 401);
});

test("#7 the cleanup job runs with the configured secret", async () => {
  process.env.CRON_SECRET = "cleanup-secret";
  const response = await cleanupUploads(new Request("http://localhost/api/cron/cleanup-uploads", {
    headers: { authorization: "Bearer cleanup-secret" },
  }));
  assert.equal(response.status, 200);
  assert.equal(typeof (await response.json() as { removed: number }).removed, "number");
});

const png = Uint8Array.from([1, 2, 3]);
// sha256 of bytes 01 02 03.
const pngChecksum = "039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81";

function migrationStore(existing: boolean, source: Uint8Array | null) {
  const writes: string[] = [];
  return {
    writes,
    store: {
      exists: async () => existing,
      readSource: async () => source,
      write: async (path: string) => { writes.push(path); },
    },
  };
}

const reference = { pathname: "nasir-bespoke/generations/x/result.png", contentType: "image/png", checksum: pngChecksum };

test("#15 an image already in R2 is left alone", async () => {
  const { store, writes } = migrationStore(true, png);
  assert.equal(await migrateGenerationAsset(reference, store), "present");
  assert.deepEqual(writes, []);
});

test("#15 a missing image is copied from the old store", async () => {
  const { store, writes } = migrationStore(false, png);
  assert.equal(await migrateGenerationAsset(reference, store), "copied");
  assert.deepEqual(writes, [reference.pathname]);
});

test("#15 a source that fails its checksum is never copied", async () => {
  const { store, writes } = migrationStore(false, Uint8Array.from([9]));
  assert.equal(await migrateGenerationAsset(reference, store), "corrupt");
  assert.deepEqual(writes, []);
});

test("#15 an image missing from both stores is reported", async () => {
  const { store } = migrationStore(false, null);
  assert.equal(await migrateGenerationAsset(reference, store), "missing");
});
