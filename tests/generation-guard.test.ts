import assert from "node:assert/strict";
import { createServer } from "node:http";
import test, { beforeEach } from "node:test";
import bcrypt from "bcryptjs";
import { handleTryOnRequest } from "@/lib/try-on-handler";
import {
  acquireGenerationLock,
  expireMemoryGenerationLocksForTests,
  failGenerationGuardWritesAfterForTests,
  GENERATION_GUARD_REDIS_TIMEOUT_MS,
  GenerationGuardConfigurationError,
  releaseGenerationLock,
  resetMemoryGenerationGuardsForTests,
  writeIdempotencyRecord,
} from "@/lib/generation-guard";
import { resetMemorySessionsForTests } from "@/lib/auth/session-store";
import { resetMemoryRateLimitsForTests } from "@/lib/rate-limit";

const PASSWORD = "Correct-Horse-Battery-Staple";
const TEST_USER = {
  username: "showroom",
  displayName: "Showroom Staff",
  passwordHash: bcrypt.hashSync(PASSWORD, 4),
};
const OTHER_USER = {
  username: "atelier",
  displayName: "Atelier Staff",
  passwordHash: bcrypt.hashSync(PASSWORD, 4),
};

function setNodeEnv(value: string | undefined) {
  const environment = process.env as Record<string, string | undefined>;
  if (value === undefined) delete environment.NODE_ENV;
  else environment.NODE_ENV = value;
}

beforeEach(() => {
  process.env.AUTH_SESSION_SECRET = "test-session-secret-that-is-at-least-thirty-two-bytes";
  process.env.AUTH_USERS_JSON = JSON.stringify([TEST_USER, OTHER_USER]);
  process.env.TRYON_RATE_LIMIT_PER_MINUTE = "20";
  process.env.TRYON_RATE_LIMIT_PER_HOUR = "20";
  process.env.TRYON_RATE_LIMIT_PER_DAY = "20";
  process.env.TRYON_GLOBAL_RATE_LIMIT_PER_DAY = "100";
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  resetMemoryRateLimitsForTests();
  resetMemorySessionsForTests();
  resetMemoryGenerationGuardsForTests();
});

function sameOriginHeaders(extra: Record<string, string> = {}) {
  return {
    origin: "http://localhost",
    host: "localhost",
    "sec-fetch-site": "same-origin",
    ...extra,
  };
}

function tinyPng(name: string) {
  return new File(
    [Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])],
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

function jpegResult() {
  return {
    bytes: Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]),
    contentType: "image/jpeg",
    metadata: { provider: "test", model: "gpt-image-2", quality: "medium", durationMs: 1 },
  };
}

test("unauthenticated requests still cannot generate", async () => {
  let generationCalls = 0;
  const response = await handleTryOnRequest(new Request("http://localhost/api/try-on", {
    method: "POST",
    headers: sameOriginHeaders({ "Idempotency-Key": crypto.randomUUID() }),
    body: catalogForm(),
  }), {
    authenticate: async () => null,
    rateLimit: async () => ({ allowed: true, limit: 2, remaining: 1, resetAt: Date.now() + 60_000 }),
    generate: async () => {
      generationCalls += 1;
      throw new Error("must not run");
    },
  });
  assert.equal(response.status, 401);
  assert.equal(generationCalls, 0);
});

test("rate-limited requests still cannot generate", async () => {
  let generationCalls = 0;
  const response = await handleTryOnRequest(new Request("http://localhost/api/try-on", {
    method: "POST",
    headers: sameOriginHeaders({ "Idempotency-Key": crypto.randomUUID() }),
    body: catalogForm(),
  }), {
    authenticate: async () => TEST_USER,
    rateLimit: async () => ({
      allowed: false,
      limit: 2,
      remaining: 0,
      resetAt: Date.now() + 60_000,
      blockedBy: "minute",
    }),
    generate: async () => {
      generationCalls += 1;
      throw new Error("must not run");
    },
  });
  assert.equal(response.status, 429);
  assert.equal(generationCalls, 0);
});

test("two concurrent requests from the same user cause only one OpenAI call", async () => {
  let generationCalls = 0;
  let releaseFirst: (() => void) | undefined;
  const firstStarted = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });

  const dependencies = {
    authenticate: async () => TEST_USER,
    rateLimit: async () => ({ allowed: true, limit: 20, remaining: 19, resetAt: Date.now() + 60_000 }),
    generate: async () => {
      generationCalls += 1;
      await new Promise<void>((resolve) => {
        releaseFirst?.();
        setTimeout(resolve, 40);
      });
      return jpegResult();
    },
  };

  const first = handleTryOnRequest(new Request("http://localhost/api/try-on", {
    method: "POST",
    headers: sameOriginHeaders({ "Idempotency-Key": crypto.randomUUID() }),
    body: catalogForm(),
  }), dependencies);
  await firstStarted;
  const second = await handleTryOnRequest(new Request("http://localhost/api/try-on", {
    method: "POST",
    headers: sameOriginHeaders({ "Idempotency-Key": crypto.randomUUID() }),
    body: catalogForm(),
  }), dependencies);
  const firstResponse = await first;

  assert.equal(firstResponse.status, 200);
  assert.equal(second.status, 409);
  assert.equal(generationCalls, 1);
});

test("duplicate idempotency keys cannot cause a second OpenAI call", async () => {
  let generationCalls = 0;
  const key = crypto.randomUUID();
  const dependencies = {
    authenticate: async () => TEST_USER,
    rateLimit: async () => ({ allowed: true, limit: 20, remaining: 19, resetAt: Date.now() + 60_000 }),
    generate: async () => {
      generationCalls += 1;
      return jpegResult();
    },
  };

  const first = await handleTryOnRequest(new Request("http://localhost/api/try-on", {
    method: "POST",
    headers: sameOriginHeaders({ "Idempotency-Key": key }),
    body: catalogForm(),
  }), dependencies);
  const second = await handleTryOnRequest(new Request("http://localhost/api/try-on", {
    method: "POST",
    headers: sameOriginHeaders({ "Idempotency-Key": key }),
    body: catalogForm(),
  }), dependencies);

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(second.headers.get("Idempotency-Replayed"), "true");
  assert.equal(generationCalls, 1);
  assert.deepEqual(new Uint8Array(await second.arrayBuffer()), new Uint8Array(await first.arrayBuffer()));
});

test("different users are not blocked by each other's per-user lock", async () => {
  let generationCalls = 0;
  const dependenciesFor = (user: typeof TEST_USER) => ({
    authenticate: async () => user,
    rateLimit: async () => ({ allowed: true, limit: 20, remaining: 19, resetAt: Date.now() + 60_000 }),
    generate: async () => {
      generationCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return jpegResult();
    },
  });

  const [first, second] = await Promise.all([
    handleTryOnRequest(new Request("http://localhost/api/try-on", {
      method: "POST",
      headers: sameOriginHeaders({ "Idempotency-Key": crypto.randomUUID() }),
      body: catalogForm(),
    }), dependenciesFor(TEST_USER)),
    handleTryOnRequest(new Request("http://localhost/api/try-on", {
      method: "POST",
      headers: sameOriginHeaders({ "Idempotency-Key": crypto.randomUUID() }),
      body: catalogForm(),
    }), dependenciesFor(OTHER_USER)),
  ]);

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(generationCalls, 2);
});

test("stale locks recover so a later request can generate", async () => {
  const first = await acquireGenerationLock("showroom");
  assert.ok(first);
  expireMemoryGenerationLocksForTests();
  const second = await acquireGenerationLock("showroom");
  assert.ok(second);
  assert.notEqual(second.leaseId, first.leaseId);
  assert.equal(await releaseGenerationLock(first), false);
  assert.equal(await releaseGenerationLock(second), true);
});

test("lock ownership is respected", async () => {
  const lease = await acquireGenerationLock("showroom");
  assert.ok(lease);
  assert.equal(await releaseGenerationLock({ username: "showroom", leaseId: crypto.randomUUID() }), false);
  assert.equal(await acquireGenerationLock("showroom"), null);
  assert.equal(await releaseGenerationLock(lease), true);
  assert.ok(await acquireGenerationLock("showroom"));
});

test("production fails closed when generation locking Redis is missing", async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  setNodeEnv("production");
  let generationCalls = 0;
  try {
    await assert.rejects(
      () => acquireGenerationLock("showroom"),
      GenerationGuardConfigurationError,
    );
    // Idempotency lookup uses the same Redis control plane and must fail closed
    // before any paid generation when the header is present.
    const response = await handleTryOnRequest(new Request("http://localhost/api/try-on", {
      method: "POST",
      headers: sameOriginHeaders({ "Idempotency-Key": crypto.randomUUID() }),
      body: catalogForm(),
    }), {
      authenticate: async () => TEST_USER,
      rateLimit: async () => ({ allowed: true, limit: 20, remaining: 19, resetAt: Date.now() + 60_000 }),
      generate: async () => {
        generationCalls += 1;
        throw new Error("must not run");
      },
    });
    assert.equal(response.status, 503);
    assert.equal(generationCalls, 0);
  } finally {
    setNodeEnv(originalNodeEnv);
  }
});

test("invalid idempotency keys are rejected before generation", async () => {
  let generationCalls = 0;
  const response = await handleTryOnRequest(new Request("http://localhost/api/try-on", {
    method: "POST",
    headers: sameOriginHeaders({ "Idempotency-Key": "not-a-uuid" }),
    body: catalogForm(),
  }), {
    authenticate: async () => TEST_USER,
    rateLimit: async () => ({ allowed: true, limit: 20, remaining: 19, resetAt: Date.now() + 60_000 }),
    generate: async () => {
      generationCalls += 1;
      throw new Error("must not run");
    },
  });
  assert.equal(response.status, 400);
  assert.equal(generationCalls, 0);
});

test("one user cannot replay another user's idempotency key", async () => {
  const key = crypto.randomUUID();
  let generationCalls = 0;
  const first = await handleTryOnRequest(new Request("http://localhost/api/try-on", {
    method: "POST",
    headers: sameOriginHeaders({ "Idempotency-Key": key }),
    body: catalogForm(),
  }), {
    authenticate: async () => TEST_USER,
    rateLimit: async () => ({ allowed: true, limit: 20, remaining: 19, resetAt: Date.now() + 60_000 }),
    generate: async () => {
      generationCalls += 1;
      return jpegResult();
    },
  });
  const second = await handleTryOnRequest(new Request("http://localhost/api/try-on", {
    method: "POST",
    headers: sameOriginHeaders({ "Idempotency-Key": key }),
    body: catalogForm(),
  }), {
    authenticate: async () => OTHER_USER,
    rateLimit: async () => ({ allowed: true, limit: 20, remaining: 19, resetAt: Date.now() + 60_000 }),
    generate: async () => {
      generationCalls += 1;
      return {
        bytes: Uint8Array.from([0xff, 0xd8, 0xff, 0xdb]),
        contentType: "image/jpeg",
        metadata: { provider: "test", model: "gpt-image-2", quality: "medium", durationMs: 1 },
      };
    },
  });
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(second.headers.get("Idempotency-Replayed"), null);
  assert.equal(generationCalls, 2);
});

function countingDeps(overrides: {
  user?: typeof TEST_USER;
  generate?: () => Promise<ReturnType<typeof jpegResult>>;
} = {}) {
  let generationCalls = 0;
  let rateCalls = 0;
  return {
    generationCalls: () => generationCalls,
    rateCalls: () => rateCalls,
    dependencies: {
      authenticate: async () => overrides.user ?? TEST_USER,
      rateLimit: async () => {
        rateCalls += 1;
        return { allowed: true, limit: 20, remaining: 19, resetAt: Date.now() + 60_000 };
      },
      generate: async () => {
        generationCalls += 1;
        if (overrides.generate) return overrides.generate();
        return jpegResult();
      },
    },
  };
}

test("leftover pending with no lock cannot start another paid generate", async () => {
  const key = crypto.randomUUID();
  await writeIdempotencyRecord("showroom", key, { status: "pending", leaseId: crypto.randomUUID() });
  const counted = countingDeps();
  const response = await handleTryOnRequest(new Request("http://localhost/api/try-on", {
    method: "POST",
    headers: sameOriginHeaders({ "Idempotency-Key": key }),
    body: catalogForm(),
  }), counted.dependencies);
  assert.equal(response.status, 502);
  assert.equal(counted.generationCalls(), 0);
  assert.equal(counted.rateCalls(), 0);
  const replay = await handleTryOnRequest(new Request("http://localhost/api/try-on", {
    method: "POST",
    headers: sameOriginHeaders({ "Idempotency-Key": key }),
    body: catalogForm(),
  }), counted.dependencies);
  assert.equal(replay.status, 502);
  assert.equal(counted.generationCalls(), 0);
});

test("leftover pending with a live lease is in-progress and does not generate", async () => {
  const key = crypto.randomUUID();
  const lease = await acquireGenerationLock("showroom");
  assert.ok(lease);
  await writeIdempotencyRecord("showroom", key, { status: "pending", leaseId: lease.leaseId });
  const counted = countingDeps();
  const response = await handleTryOnRequest(new Request("http://localhost/api/try-on", {
    method: "POST",
    headers: sameOriginHeaders({ "Idempotency-Key": key }),
    body: catalogForm(),
  }), counted.dependencies);
  assert.equal(response.status, 409);
  assert.equal(counted.generationCalls(), 0);
  assert.equal(counted.rateCalls(), 0);
  assert.equal(await releaseGenerationLock(lease), true);
});

test("leftover pending after lock expiry cannot start another paid generate", async () => {
  const key = crypto.randomUUID();
  const lease = await acquireGenerationLock("showroom");
  assert.ok(lease);
  await writeIdempotencyRecord("showroom", key, { status: "pending", leaseId: lease.leaseId });
  expireMemoryGenerationLocksForTests();
  const counted = countingDeps();
  const response = await handleTryOnRequest(new Request("http://localhost/api/try-on", {
    method: "POST",
    headers: sameOriginHeaders({ "Idempotency-Key": key }),
    body: catalogForm(),
  }), counted.dependencies);
  assert.equal(response.status, 502);
  assert.equal(counted.generationCalls(), 0);
  assert.equal(counted.rateCalls(), 0);
  assert.ok(await acquireGenerationLock("showroom"), "stale pending must not permanently hold the user lock");
});

test("same key during an active generation is 409 and does not bill again", async () => {
  const key = crypto.randomUUID();
  let releaseFirst: (() => void) | undefined;
  const firstStarted = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  const counted = countingDeps({
    generate: async () => {
      await new Promise<void>((resolve) => {
        releaseFirst?.();
        setTimeout(resolve, 40);
      });
      return jpegResult();
    },
  });
  const first = handleTryOnRequest(new Request("http://localhost/api/try-on", {
    method: "POST",
    headers: sameOriginHeaders({ "Idempotency-Key": key }),
    body: catalogForm(),
  }), counted.dependencies);
  await firstStarted;
  const second = await handleTryOnRequest(new Request("http://localhost/api/try-on", {
    method: "POST",
    headers: sameOriginHeaders({ "Idempotency-Key": key }),
    body: catalogForm(),
  }), counted.dependencies);
  const firstResponse = await first;
  assert.equal(firstResponse.status, 200);
  assert.equal(second.status, 409);
  assert.equal(counted.generationCalls(), 1);
  assert.equal(counted.rateCalls(), 1);
});

test("same key after a failed generate replays without a second paid call", async () => {
  const key = crypto.randomUUID();
  let generationCalls = 0;
  const first = await handleTryOnRequest(new Request("http://localhost/api/try-on", {
    method: "POST",
    headers: sameOriginHeaders({ "Idempotency-Key": key }),
    body: catalogForm(),
  }), {
    authenticate: async () => TEST_USER,
    rateLimit: async () => ({ allowed: true, limit: 20, remaining: 19, resetAt: Date.now() + 60_000 }),
    generate: async () => {
      generationCalls += 1;
      throw new Error("provider exploded");
    },
  });
  const counted = countingDeps();
  const second = await handleTryOnRequest(new Request("http://localhost/api/try-on", {
    method: "POST",
    headers: sameOriginHeaders({ "Idempotency-Key": key }),
    body: catalogForm(),
  }), counted.dependencies);
  assert.equal(first.status, 502);
  assert.equal(second.status, 502);
  assert.equal(generationCalls, 1);
  assert.equal(counted.generationCalls(), 0);
  assert.equal(counted.rateCalls(), 0);
});

test("stale pending for one key does not permanently block a new key", async () => {
  const staleKey = crypto.randomUUID();
  await writeIdempotencyRecord("showroom", staleKey, { status: "pending", leaseId: crypto.randomUUID() });
  const counted = countingDeps();
  const stale = await handleTryOnRequest(new Request("http://localhost/api/try-on", {
    method: "POST",
    headers: sameOriginHeaders({ "Idempotency-Key": staleKey }),
    body: catalogForm(),
  }), counted.dependencies);
  const fresh = await handleTryOnRequest(new Request("http://localhost/api/try-on", {
    method: "POST",
    headers: sameOriginHeaders({ "Idempotency-Key": crypto.randomUUID() }),
    body: catalogForm(),
  }), counted.dependencies);
  assert.equal(stale.status, 502);
  assert.equal(fresh.status, 200);
  assert.equal(counted.generationCalls(), 1);
});

test("image responses copy only the viewed byte range", async () => {
  const secret = Uint8Array.from([0xde, 0xad, 0xbe, 0xef, 0xff, 0xd8, 0xff, 0xd9, 0xca, 0xfe]);
  const view = secret.subarray(4, 8);
  const counted = countingDeps({
    generate: async () => ({
      bytes: view,
      contentType: "image/jpeg",
      metadata: { provider: "test", model: "gpt-image-2", quality: "medium", durationMs: 1 },
    }),
  });
  const live = await handleTryOnRequest(new Request("http://localhost/api/try-on", {
    method: "POST",
    headers: sameOriginHeaders({ "Idempotency-Key": crypto.randomUUID() }),
    body: catalogForm(),
  }), counted.dependencies);
  const liveBytes = new Uint8Array(await live.arrayBuffer());
  assert.equal(live.status, 200);
  assert.equal(liveBytes.byteLength, 4);
  assert.deepEqual(liveBytes, new Uint8Array([0xff, 0xd8, 0xff, 0xd9]));
  assert.equal(liveBytes.includes(0xde), false);
  assert.equal(liveBytes.includes(0xca), false);
});

test("complete-store failure after generate does not bill a same-key retry", async () => {
  const key = crypto.randomUUID();
  failGenerationGuardWritesAfterForTests(1);
  const counted = countingDeps();
  const first = await handleTryOnRequest(new Request("http://localhost/api/try-on", {
    method: "POST",
    headers: sameOriginHeaders({ "Idempotency-Key": key }),
    body: catalogForm(),
  }), counted.dependencies);
  const second = await handleTryOnRequest(new Request("http://localhost/api/try-on", {
    method: "POST",
    headers: sameOriginHeaders({ "Idempotency-Key": key }),
    body: catalogForm(),
  }), counted.dependencies);
  assert.equal(first.status, 200);
  assert.equal(second.status, 502);
  assert.equal(counted.generationCalls(), 1);
  assert.equal(counted.rateCalls(), 1);
});

test("configured-but-unreachable Redis fails closed with 503 before generate", async () => {
  const original = process.env.NODE_ENV;
  setNodeEnv("production");
  process.env.UPSTASH_REDIS_REST_URL = "https://127.0.0.1:1";
  process.env.UPSTASH_REDIS_REST_TOKEN = "not-a-real-token";
  const counted = countingDeps();
  try {
    const response = await handleTryOnRequest(new Request("http://localhost/api/try-on", {
      method: "POST",
      headers: sameOriginHeaders({ "Idempotency-Key": crypto.randomUUID() }),
      body: catalogForm(),
    }), counted.dependencies);
    assert.equal(response.status, 503);
    assert.equal(counted.generationCalls(), 0);
    const body = await response.json() as { error: string };
    assert.match(body.error, /temporarily unavailable/i);
    assert.equal(body.error.toLowerCase().includes("redis"), false);
    assert.equal(body.error.toLowerCase().includes("fetch"), false);
  } finally {
    setNodeEnv(original);
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  }
});

test("Redis timeout fails closed with 503 before generate", async () => {
  const original = process.env.NODE_ENV;
  const server = createServer(() => undefined);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  setNodeEnv("production");
  process.env.UPSTASH_REDIS_REST_URL = `http://127.0.0.1:${port}`;
  process.env.UPSTASH_REDIS_REST_TOKEN = "not-a-real-token";
  const counted = countingDeps();
  const started = Date.now();
  try {
    const response = await handleTryOnRequest(new Request("http://localhost/api/try-on", {
      method: "POST",
      headers: sameOriginHeaders({ "Idempotency-Key": crypto.randomUUID() }),
      body: catalogForm(),
    }), counted.dependencies);
    assert.equal(response.status, 503);
    assert.equal(counted.generationCalls(), 0);
    assert.ok(Date.now() - started < GENERATION_GUARD_REDIS_TIMEOUT_MS + 2_000);
  } finally {
    setNodeEnv(original);
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
