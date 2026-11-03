import assert from "node:assert/strict";
import test, { beforeEach, type TestContext } from "node:test";
import bcrypt from "bcryptjs";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { GET as history } from "@/app/api/history/route";
import { POST as authorizeUpload } from "@/app/api/try-on/uploads/route";
import { requireRequestUser, createSessionToken, getSessionCookieName, getCurrentUserFromToken, revokeSessionToken } from "@/lib/auth/session";
import { activateSession, isSessionActive, resetMemorySessionsForTests, SessionStoreConfigurationError } from "@/lib/auth/session-store";
import { resetMemoryRateLimitsForTests } from "@/lib/rate-limit";
import { handleTryOnRequest } from "@/lib/try-on-handler";
import { MAX_REQUEST_BYTES } from "@/lib/validation";
import { readBoundedBody, RequestBodyTooLargeError } from "@/lib/request-body";

const user = { username: "showroom", displayName: "Showroom", passwordHash: bcrypt.hashSync("local-test-password", 4) };

function setNodeEnv(value: string) {
  (process.env as Record<string, string>).NODE_ENV = value;
}

const headers = { origin: "http://localhost", host: "localhost", "sec-fetch-site": "same-origin" };

beforeEach(() => {
  setNodeEnv("test");
  process.env.AUTH_SESSION_SECRET = "local-assessment-secret-at-least-thirty-two-bytes";
  process.env.AUTH_USERS_JSON = JSON.stringify([user]);
  process.env.RATE_LIMIT_BACKEND = "memory";
  delete process.env.AUTH_USERS_JSON_BASE64;
  delete process.env.DATABASE_URL;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.R2_ACCOUNT_ID;
  delete process.env.R2_BUCKET_NAME;
  delete process.env.R2_ACCESS_KEY_ID;
  delete process.env.R2_SECRET_ACCESS_KEY;
  resetMemorySessionsForTests();
  resetMemoryRateLimitsForTests();
});

test("development APIs require a verified session for missing and forged cookies", async (t) => {
  setNodeEnv("development");
  t.after(() => setNodeEnv("test"));
  for (const cookie of ["", "nasir-bespoke-session=forged"]) {
    const request = new Request("http://localhost/api/history", { headers: { cookie } });
    assert.equal(await requireRequestUser(request), null);
    assert.equal((await history(request)).status, 401);
  }
});

test("malformed session cookie is treated as unauthenticated", async () => {
  assert.equal(await requireRequestUser(new Request("http://localhost/api/history", {
    headers: { cookie: `${getSessionCookieName()}=%E0%A4%A` },
  })), null);
});

function persistentSessions(t: TestContext) {
  process.env.UPSTASH_REDIS_REST_URL = "http://127.0.0.1:1";
  process.env.UPSTASH_REDIS_REST_TOKEN = "local-test-token";
  setNodeEnv("production");
  t.after(() => setNodeEnv("test"));
}

test("Redis failure cannot reactivate a locally remembered session", async (t) => {
  await activateSession("remembered", "showroom", 600);
  persistentSessions(t);
  t.mock.method(globalThis, "fetch", async () => { throw new TypeError("simulated outage"); });
  await assert.rejects(isSessionActive("remembered", "showroom"), SessionStoreConfigurationError);
});

test("failed persistent session activation cannot mint a usable token", async (t) => {
  persistentSessions(t);
  t.mock.method(globalThis, "fetch", async () => { throw new TypeError("simulated outage"); });
  await assert.rejects(createSessionToken("showroom"), SessionStoreConfigurationError);
});

test("logout reports persistent revocation failure without clearing the cookie", async (t) => {
  const token = await createSessionToken("showroom");
  persistentSessions(t);
  t.mock.method(globalThis, "fetch", async () => { throw new TypeError("simulated outage"); });
  const response = await logout(new Request("http://localhost/api/auth/logout", {
    method: "POST", headers: { ...headers, cookie: `${getSessionCookieName()}=${token}` },
  }));
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("set-cookie"), null);
});

test("login enforces the actual byte limit without trusting Content-Length", async () => {
  for (const length of [undefined, "1"]) {
    const response = await login(new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { ...headers, "content-type": "application/json", ...(length ? { "content-length": length } : {}) },
      body: JSON.stringify({ username: "showroom", password: "local-test-password", padding: "x".repeat(8192) }),
    }));
    assert.equal(response.status, 413);
  }
});

test("oversized multipart requests are rejected before selection or generation", async () => {
  let generated = false;
  const form = new FormData();
  form.set("padding", "x".repeat(MAX_REQUEST_BYTES + 1));
  const encoded = new Response(form);
  const response = await handleTryOnRequest(new Request("http://localhost/api/try-on", {
    method: "POST", headers: { ...headers, "content-type": encoded.headers.get("content-type")! },
    body: await encoded.arrayBuffer(),
  }), {
    authenticate: async () => user,
    rateLimit: async () => { throw new Error("must reject before rate limiting"); },
    generate: async () => { generated = true; throw new Error("must not generate"); },
  });
  assert.equal(response.status, 413);
  assert.equal(generated, false);
});

test("bounded body reader cancels an oversized stream before reading its tail", async () => {
  let cancelled = false;
  let pulls = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulls++;
      controller.enqueue(new Uint8Array(9));
    },
    cancel() { cancelled = true; },
  });
  const request = new Request("http://localhost/api/auth/login", {
    method: "POST", body: stream, duplex: "half",
  } as RequestInit);
  await assert.rejects(readBoundedBody(request, 8), RequestBodyTooLargeError);
  assert.equal(cancelled, true);
  assert.ok(pulls <= 2);
});

test("persistent session read times out without consulting memory", async (t) => {
  await activateSession("timeout-session", "showroom", 600);
  persistentSessions(t);
  t.mock.method(globalThis, "fetch", () => new Promise<Response>(() => {}));
  await assert.rejects(isSessionActive("timeout-session", "showroom"), SessionStoreConfigurationError);
});

test("bounded body reader accepts the exact byte limit", async () => {
  const bytes = new Uint8Array([0, 1, 2, 3]);
  assert.deepEqual(await readBoundedBody(new Request("http://localhost", { method: "POST", body: bytes }), 4), bytes);
});

test("upload and high-resolution JSON limits reject oversized input without storage or provider calls", async (t) => {
  process.env.R2_ACCOUNT_ID = "a".repeat(32);
  process.env.R2_BUCKET_NAME = "local-test-bucket";
  process.env.R2_ACCESS_KEY_ID = "local-test-access";
  process.env.R2_SECRET_ACCESS_KEY = "local-test-secret";
  const fetch = t.mock.method(globalThis, "fetch", async () => { throw new Error("No network access permitted"); });
  const cookie = `${getSessionCookieName()}=${await createSessionToken("showroom")}`;
  const upload = await authorizeUpload(new Request("http://localhost/api/try-on/uploads", {
    method: "POST", headers: { ...headers, cookie, "content-type": "application/json" },
    body: JSON.stringify({ padding: "x".repeat(8192) }),
  }));
  assert.equal(upload.status, 413);
  const generation = await handleTryOnRequest(new Request("http://localhost/api/try-on", {
    method: "POST", headers: { ...headers, cookie, "content-type": "application/json" },
    body: JSON.stringify({ uploads: {}, padding: "x".repeat(65536) }),
  }));
  assert.equal(generation.status, 413);
  assert.equal(fetch.mock.callCount(), 0);
});

test("successful persistent sessions remain usable until shared revocation", async (t) => {
  persistentSessions(t);
  const sessions = new Map<string, string>();
  t.mock.method(globalThis, "fetch", async (_input: unknown, init: RequestInit) => {
    const commands = JSON.parse(String(init.body)) as string[][];
    return Response.json(commands.map(([command, key, value]) => {
      if (command.toLowerCase() === "set") {
        sessions.set(key, value);
        return { result: "OK" };
      }
      if (command.toLowerCase() === "get") {
        const stored = sessions.get(key);
        return { result: stored ? Buffer.from(stored).toString("base64") : null };
      }
      assert.equal(command.toLowerCase(), "del");
      return { result: sessions.delete(key) ? 1 : 0 };
    }));
  });
  const token = await createSessionToken("showroom");
  assert.equal((await getCurrentUserFromToken(token))?.username, "showroom");
  await revokeSessionToken(token);
  assert.equal(await getCurrentUserFromToken(token), null);
});

test("a client header cannot choose the trusted high-resolution handoff", async () => {
  const form = new FormData();
  const image = new File([Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1])], "test.png", { type: "image/png" });
  for (const name of ["person", "fabric", "outfit"]) form.set(name, image);
  form.set("selectionMode", "outfit");
  const bytes = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);
  const response = await handleTryOnRequest(new Request("http://localhost/api/try-on", {
    method: "POST", headers: { ...headers, "x-nasir-high-resolution": "1" }, body: form,
  }), {
    authenticate: async () => user,
    rateLimit: async () => ({ allowed: true, limit: 2, remaining: 1, resetAt: Date.now() + 60000 }),
    generate: async () => ({ bytes, contentType: "image/jpeg", metadata: { provider: "local-fixture", model: "test", quality: "medium", durationMs: 1 } }),
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/jpeg");
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
});

test("body limits count multibyte UTF-8 and accept exact boundaries", async () => {
  for (const maximum of [4096, 65536, MAX_REQUEST_BYTES]) {
    const bytes = new TextEncoder().encode("é".repeat(maximum / 2));
    assert.equal(bytes.length, maximum);
    for (const length of [undefined, "1"]) {
      const make = (body: Uint8Array) => new Request("http://localhost", { method: "POST", body: Buffer.from(body), headers: length ? { "content-length": length } : {} });
      assert.equal((await readBoundedBody(make(bytes), maximum)).length, maximum);
      await assert.rejects(readBoundedBody(make(new Uint8Array(maximum + 1)), maximum), RequestBodyTooLargeError);
    }
  }
});

test("valid cookies survive unrelated malformed cookies; expired and revoked sessions fail", async () => {
  const { SignJWT } = await import("jose");
  const token = await createSessionToken("showroom");
  const request = (value: string) => new Request("http://localhost", { headers: { cookie: `unrelated=%E0%A4%A; ${getSessionCookieName()}=${value}` } });
  assert.equal((await requireRequestUser(request(token)))?.username, "showroom");
  await revokeSessionToken(token);
  assert.equal(await requireRequestUser(request(token)), null);
  const expired = await new SignJWT({ type: "staff-session" }).setProtectedHeader({ alg: "HS256" }).setSubject("showroom").setJti("expired").setIssuer("nasir-bespoke-try-on").setAudience("nasir-bespoke-staff").setExpirationTime(1).sign(new TextEncoder().encode(process.env.AUTH_SESSION_SECRET));
  assert.equal(await requireRequestUser(request(expired)), null);
});

test("login sets no cookie when persistent activation fails after credential verification", async (t) => {
  // Switch the session backend only after local rate limiting has completed.
  t.mock.method(bcrypt, "compare", async () => { persistentSessions(t); return true; });
  t.mock.method(globalThis, "fetch", async () => { throw new Error("synthetic backend failure"); });
  const response = await login(new Request("http://localhost/api/auth/login", {
    method: "POST", headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ username: "showroom", password: "fixture-only" }),
  }));
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("set-cookie"), null);
  assert.doesNotMatch(await response.text(), /synthetic backend failure/);
});
