import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import { readdir } from "node:fs/promises";
import bcrypt from "bcryptjs";

// Refuse environment files: Next loads them independently of the child env.
const environmentFiles = (await readdir(new URL("../", import.meta.url)))
  .filter(name => /^\.env(?:\.|$)/.test(name) && name !== ".env.example");
assert.equal(environmentFiles.length, 0, "Run the local assessment in a checkout without .env files.");

const origin = "http://127.0.0.1:3147";
const password = randomBytes(32).toString("hex");
const env = Object.fromEntries(["PATH", "HOME", "TMPDIR", "SystemRoot"]
  .filter(key => process.env[key]).map(key => [key, process.env[key]]));
Object.assign(env, {
  NEXT_TELEMETRY_DISABLED: "1",
  AUTH_SESSION_SECRET: randomBytes(48).toString("base64"),
  AUTH_USERS_JSON: JSON.stringify([{ username: "assessment", displayName: "Local Assessment", passwordHash: bcrypt.hashSync(password, 4) }]),
});

const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--webpack", "--hostname", "127.0.0.1", "--port", "3147"], {
  cwd: new URL("../", import.meta.url), env, stdio: ["ignore", "pipe", "pipe"],
});
// Do not probe a port until this child confirms it owns the listener.
let listening = false;
server.stdout.setEncoding("utf8");
server.stdout.on("data", chunk => { if (chunk.includes("Ready in")) listening = true; });
// Consume server output without recording cookies, credentials, or page data.
server.stderr.resume();
let spawnError;
server.on("error", error => { spawnError = error; });

async function request(path, options = {}) {
  const url = new URL(path, origin);
  assert.equal(url.origin, origin);
  return fetch(url, { ...options, redirect: "manual", signal: AbortSignal.timeout(15_000) });
}

async function expectStatus(path, status, options) {
  const response = await request(path, options);
  assert.equal(response.status, status, `${path}: expected ${status}, got ${response.status}`);
  await response.body?.cancel();
  return response;
}

async function stopServer() {
  if (server.exitCode !== null || server.signalCode !== null) return;
  const exited = once(server, "exit");
  server.kill("SIGTERM");
  const timer = setTimeout(() => server.kill("SIGKILL"), 5000);
  try { await exited; } finally { clearTimeout(timer); }
}
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => { void stopServer().finally(() => process.exit(1)); });
}
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (spawnError) throw spawnError;
    if (server.exitCode !== null) throw new Error("The assessment server could not start; port 3147 must be free.");
    if (!listening) {
      await new Promise(resolve => setTimeout(resolve, 250));
      continue;
    }
    try {
      await expectStatus("/login", 200);
      ready = true;
      break;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }
  assert.ok(ready, "Local assessment server did not become ready.");

  const headers = { origin, "sec-fetch-site": "same-origin", "content-type": "application/json" };
  for (const path of ["/api/history", "/api/catalog", "/api/level1-catalog", "/api/split-catalog", "/api/try-on/status", "/api/catalogue-recovery"]) {
    await expectStatus(path, 401);
  }
  for (const path of ["/", "/catalogue-recovery"]) {
    const response = await expectStatus(path, 307);
    assert.equal(response.headers.get("location"), "/login");
  }
  await expectStatus("/api/history", 401, { headers: { cookie: "nasir-bespoke-session=%E0%A4%A" } });
  await expectStatus("/api/auth/login", 403, {
    method: "POST", headers: { ...headers, origin: "http://out-of-scope.invalid", "sec-fetch-site": "cross-site" },
    body: JSON.stringify({ username: "assessment", password }),
  });
  await expectStatus("/api/auth/login", 400, { method: "POST", headers, body: "{" });
  const login = await expectStatus("/api/auth/login", 200, {
    method: "POST", headers, body: JSON.stringify({ username: "assessment", password }),
  });
  const cookie = login.headers.get("set-cookie")?.split(";", 1)[0];
  assert.ok(cookie);
  assert.match(login.headers.get("set-cookie"), /HttpOnly/i);
  assert.match(login.headers.get("set-cookie"), /SameSite=Strict/i);
  await expectStatus("/api/history", 200, { headers: { cookie } });
  await expectStatus("/", 200, { headers: { cookie } });

  // Async iterable bodies use chunked transfer, without Content-Length.
  async function* oversizedLogin() {
    yield JSON.stringify({ username: "assessment", password, padding: "x".repeat(8192) });
  }
  await expectStatus("/api/auth/login", 413, { method: "POST", headers, body: oversizedLogin(), duplex: "half" });
  async function* oversizedMultipart() {
    yield "--local-assessment\r\nContent-Disposition: form-data; name=\"padding\"\r\n\r\n";
    for (let index = 0; index < 65; index++) yield "x".repeat(65_536);
    yield "\r\n--local-assessment--\r\n";
  }
  await expectStatus("/api/try-on", 413, {
    method: "POST", headers: { ...headers, cookie, "content-type": "multipart/form-data; boundary=local-assessment" },
    body: oversizedMultipart(), duplex: "half",
  });
  const logout = await expectStatus("/api/auth/logout", 303, { method: "POST", headers: { ...headers, cookie } });
  assert.equal(logout.headers.get("location"), "/login");
  await expectStatus("/api/history", 401, { headers: { cookie } });
  console.log("Local HTTP assessment passed: authentication, page gates, cookie parsing, CSRF, chunked body limits, logout and revoked-token replay.");
} finally {
  await stopServer();
}
