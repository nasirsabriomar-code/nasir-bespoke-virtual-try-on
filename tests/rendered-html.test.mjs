import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("homepage requires a verified server session before rendering the try-on app", async () => {
  const page = await source("app/page.tsx");
  assert.match(page, /getCurrentUserFromToken/);
  assert.match(page, /if \(!user\) redirect\("\/login"\)/);
  assert.ok(page.indexOf("if (!user)") < page.indexOf("<TryOnApp"));
});

test("login page contains only private staff authentication", async () => {
  const page = await source("app/login/page.tsx");
  assert.match(page, /Private staff access/);
  assert.match(page, /<LoginForm \/>/);
  assert.doesNotMatch(page, /ImageUpload|Generate Try-On|prompt editor/i);
});

test("security headers and private metadata are configured", async () => {
  const [config, layout] = await Promise.all([
    source("next.config.ts"),
    source("app/layout.tsx"),
  ]);
  assert.match(config, /Content-Security-Policy/);
  assert.match(config, /frame-ancestors 'none'/);
  assert.match(config, /Strict-Transport-Security/);
  assert.match(layout, /index: false/);
  assert.match(layout, /follow: false/);
});
