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

test("Level 1 catalogue CSS enforces 4:5 aspect ratio and object-fit contain without cropping", async () => {
  const css = await source("app/globals.css");
  assert.match(css, /aspect-ratio:\s*4\s*\/\s*5/);
  assert.match(css, /\.atelier-shell \.level1-card-image \{[^}]*object-fit:\s*contain/);
  assert.match(css, /\.level1-viewer-image \{[^}]*object-fit:\s*contain/);
  assert.match(css, /\.level1-viewer-backdrop/);
  assert.match(css, /\.level1-viewer-dialog/);
});

test("Level 1 catalogue component contains full-screen design viewer with accessibility attributes", async () => {
  const component = await source("components/Level1Catalogue.tsx");
  assert.match(component, /level1-card-inspect-btn/);
  assert.match(component, /level1-viewer-dialog/);
  assert.match(component, /role="dialog"/);
  assert.match(component, /aria-modal="true"/);
  assert.match(component, /aria-labelledby="viewer-design-name"/);
  assert.match(component, /Inspect full silhouette and tailoring details/);
  assert.match(component, /Escape/);
});

test("Split component cards render approved photos instead of silhouettes when a reference URL is present", async () => {
  const component = await source("components/split-outfit/SplitComponentCard.tsx");
  assert.match(component, /option\.reference\.url/);
  assert.match(component, /split-card-photo/);
});

test("UsageHistory renders through a React portal with proper stacking and accessibility", async () => {
  const [component, css] = await Promise.all([
    source("components/UsageHistory.tsx"),
    source("app/globals.css"),
  ]);
  assert.match(component, /createPortal/);
  assert.match(component, /document\.body/);
  assert.match(component, /history-modal-root/);
  assert.match(component, /role="dialog"/);
  assert.match(component, /aria-modal="true"/);
  assert.match(component, /aria-labelledby="history-title"/);
  assert.match(component, /overflow = "hidden"/);
  assert.match(css, /\.history-modal-root\s*\{[^}]*z-index:\s*99999/);
  assert.match(css, /\.history-panel\s*\{[^}]*overflow-y:\s*auto/);
});
