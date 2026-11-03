import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { fork } from "node:child_process";
import { once } from "node:events";
import bcrypt from "bcryptjs";

test("two production-mode processes share revocation and fail closed on errors and deadlines", { timeout: 30000 }, async (t) => {
  const values = new Map<string, string>();
  let mode: "ok" | "error" | "hang" = "ok";
  const server = createServer(async (request, response) => {
    if (mode === "hang") return;
    if (mode === "error") { response.writeHead(503).end("fixture unavailable"); return; }
    const parts: Buffer[] = [];
    for await (const part of request) parts.push(Buffer.from(part));
    const commands = JSON.parse(Buffer.concat(parts).toString()) as string[][];
    const results = commands.map(([command, key, value]) => {
      if (command.toLowerCase() === "set") { values.set(key, value); return { result: "OK" }; }
      if (command.toLowerCase() === "get") return { result: values.has(key) ? Buffer.from(values.get(key)!).toString("base64") : null };
      assert.equal(command.toLowerCase(), "del");
      return { result: values.delete(key) ? 1 : 0 };
    });
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify(results));
  });
  t.after(() => { server.closeAllConnections(); server.close(); });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const env: NodeJS.ProcessEnv = { NODE_ENV: "production", ...Object.fromEntries(["PATH", "HOME", "TMPDIR"].filter(key => process.env[key]).map(key => [key, process.env[key]])) };
  Object.assign(env, { NODE_ENV: "production", NODE_OPTIONS: "--conditions=react-server", AUTH_SESSION_SECRET: "synthetic-integration-secret-at-least-32-bytes", AUTH_USERS_JSON: JSON.stringify([{ username: "assessment", displayName: "Assessment", passwordHash: bcrypt.hashSync("fixture-only", 4) }]), UPSTASH_REDIS_REST_URL: `http://127.0.0.1:${address.port}`, UPSTASH_REDIS_REST_TOKEN: "fixture-only" });
  const workers = [0, 1].map(() => fork(new URL("./fixtures/session-worker.ts", import.meta.url), [], { env, execArgv: ["--import=tsx"], stdio: ["ignore", "ignore", "ignore", "ipc"] }));
  t.after(async () => { await Promise.all(workers.map(async worker => { if (worker.exitCode === null) { const exit = once(worker, "exit"); worker.kill("SIGKILL"); await exit; } })); });
  async function call(index: number, action: string, token?: string) {
    const worker = workers[index];
    const reply = once(worker, "message", { signal: AbortSignal.timeout(6000) });
    worker.send({ action, token });
    return (await reply)[0] as { result: unknown; error?: string; message?: string; elapsed: number };
  }
  const created = await call(0, "create");
  assert.equal(typeof created.result, "string");
  const token = created.result as string;
  assert.equal((await call(1, "read", token)).result, true);
  await call(0, "revoke", token);
  for (const index of [0, 1]) assert.equal((await call(index, "read", token)).result, false);
  const active = (await call(0, "create")).result as string;
  for (const failure of ["error", "hang"] as const) {
    mode = failure;
    for (const action of ["create", "read", "logout"]) {
      const response = await call(1, action, active);
      assert.ok(response.elapsed < 4000, "session operation must have a bounded deadline");
      if (action === "logout") {
        const result = response.result as { status: number; cookie: boolean; body: string };
        assert.equal(result.status, 503); assert.equal(result.cookie, false);
        assert.doesNotMatch(result.body, /fixture unavailable|127\.0\.0\.1|fixture-only/);
      } else { assert.equal(response.error, "SessionStoreConfigurationError"); assert.equal(response.message, "Authentication is not configured correctly."); }
    }
  }
  mode = "ok";
  assert.equal((await call(1, "read", active)).result, true);
  const signedOut = (await call(0, "logout", active)).result as { status: number; cookie: boolean };
  assert.equal(signedOut.status, 303); assert.equal(signedOut.cookie, true);
  assert.equal((await call(1, "read", active)).result, false);
});
