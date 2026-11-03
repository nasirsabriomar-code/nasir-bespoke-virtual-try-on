import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import bcrypt from "bcryptjs";
import sharp from "sharp";

// Uses the running application and an installed Playwright/Chrome. No application
// service credentials enter this server. Browser service responses are fixtures;
// this verifies interactions, not provider quality or live storage performance.
const root = new URL("../", import.meta.url);
assert.deepEqual((await readdir(root)).filter(name => /^\.env(?:\.|$)/.test(name) && name !== ".env.example"), [], "Use a checkout without environment files.");
const { chromium } = process.env.BESPOKE_PLAYWRIGHT_MODULE
  ? await import(pathToFileURL(process.env.BESPOKE_PLAYWRIGHT_MODULE).href)
  : await import("playwright");
const origin = "http://127.0.0.1:3148";
const password = randomBytes(24).toString("hex");
const env = Object.fromEntries(["PATH", "HOME", "TMPDIR", "SystemRoot"].filter(key => process.env[key]).map(key => [key, process.env[key]]));
Object.assign(env, { NEXT_TELEMETRY_DISABLED: "1", AUTH_SESSION_SECRET: randomBytes(48).toString("base64"), AUTH_USERS_JSON: JSON.stringify([{ username: "assessment", displayName: "Local Assessment", passwordHash: bcrypt.hashSync(password, 4) }]) });
// next dev is intentional: production sessions require shared Redis. The build
// is checked separately; this server uses only isolated in-memory staff sessions.
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--webpack", "--hostname", "127.0.0.1", "--port", "3148"], { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] });
let listening = false; let spawnError; let browser; let page; let releaseChunk;
server.stdout.setEncoding("utf8"); server.stdout.on("data", chunk => { if (chunk.includes("Ready in")) listening = true; });
server.stderr.resume(); server.on("error", error => { spawnError = error; });
async function stop() {
  releaseChunk?.();
  await browser?.close().catch(() => undefined);
  if (server.exitCode !== null || server.signalCode !== null) return;
  const exited = once(server, "exit"); server.kill("SIGTERM");
  const timer = setTimeout(() => server.kill("SIGKILL"), 5000);
  try { await exited; } finally { clearTimeout(timer); }
}
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => { void stop().finally(() => process.exit(1)); });
const output = new URL("../.cache/improvement-browser/", import.meta.url);
const checks = [];
function passed(label) { checks.push(label); console.log(`PASS ${label}`); }
try {
  for (let attempt = 0; attempt < 120 && !listening; attempt++) {
    if (spawnError) throw spawnError;
    assert.equal(server.exitCode, null, "Local server exited; port 3148 must be free.");
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.ok(listening, "Local browser-check server did not become ready.");
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
  page = await context.newPage(); page.setDefaultTimeout(15000);
  const pageErrors = []; page.on("pageerror", error => pageErrors.push(error.message));
  const png = await sharp({ create: { width: 640, height: 960, channels: 3, background: "#26384d" } }).png().toBuffer();
  const cloth = await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000"><defs><pattern id="p" width="100" height="100" patternUnits="userSpaceOnUse"><rect width="100" height="100" fill="#26384d"/><path d="M0 0H100V100" stroke="#ddd" stroke-width="4" fill="none"/></pattern></defs><rect width="1000" height="1000" fill="url(#p)"/></svg>')).png().toBuffer();
  const generationId = randomUUID(); const historyIds = [generationId, ...Array.from({ length: 58 }, () => randomUUID())]; const slots = new Map();
  let review = { decision: "unreviewed", favourite: false, reasons: [], updatedAt: "" };
  const catalogue = {
    categories: [{ id: "suit", name: "Suits", description: "Synthetic local catalogue", sortOrder: 0 }, { id: "jackets", name: "Jackets", description: "Synthetic jacket", sortOrder: 1 }],
    designs: [
      ...["suit", "jackets"].map(categoryId => ({ id: categoryId === "suit" ? "SUIT_01_CLASSIC" : "JACKET_01_HUNTER", categoryId, name: categoryId === "suit" ? "Synthetic suit" : "Synthetic jacket", description: "Local fixture", intent: "Fixture", sortOrder: 0, cardImage: { state: "ready", url: "/api/local-fixture.png" }, generation: { state: "ready" } })),
      { id: "SUIT_02_TUXEDO", categoryId: "suit", name: "Synthetic variation", description: "Local variation fixture", intent: "Fixture", sortOrder: 1, cardImage: { state: "ready", url: "/api/local-fixture.png" }, generation: { state: "awaiting-approved-reference", unavailabilityReason: "storage-unavailable" }, variants: [
        { id: "approved-fixture", name: "Approved synthetic option", description: "Available reference", cardImage: { state: "ready", url: "/api/local-fixture.png" }, generation: { state: "ready" } },
        { id: "unapproved-fixture", name: "Unapproved synthetic option", description: "Not approved", cardImage: { state: "awaiting-approval" }, generation: { state: "awaiting-approved-reference", unavailabilityReason: "unapproved" } },
      ] },
    ],
  };
  let failSplitCatalogue = true; let failReviewSave = false; let splitSuccess = false; let failReviewLoad = true; let generations = 0; let statuses = 0; let submitted; let cancelMode = false; let heldChunk = false; let statusMode = "complete";
  const json = (route, value, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(value) });
  await page.route("**/*", async route => {
    const request = route.request(); const url = new URL(request.url());
    if (url.origin !== origin) return route.abort("blockedbyclient");
    const path = url.pathname;
    if (path === "/api/split-catalog" && failSplitCatalogue) { return json(route, { error: "Synthetic catalogue outage" }, 503); }
    if (path === "/api/level1-catalog") return json(route, catalogue);
    if (path.startsWith("/api/split-catalog-assets/") || path === "/api/local-fixture.png" || /^\/api\/history\/[^/]+\/asset\//.test(path)) return route.fulfill({ contentType: "image/png", body: path.endsWith("/fabric") ? cloth : png });
    if (/^\/api\/history\/[^/]+$/.test(path) && request.method() === "DELETE") {
      const index = historyIds.indexOf(path.split("/")[3]);
      if (index >= 0) historyIds.splice(index, 1);
      return json(route, { deleted: true });
    }
    if (path === "/api/history") return json(route, { events: historyIds.map((id, index) => ({ id, occurredAt: new Date().toISOString(), username: "assessment", status: "success", durationMs: 1000, provider: "fixture", model: "fixture", quality: "medium", device: { kind: "desktop", browser: "fixture", operatingSystem: "fixture" }, generation: { mode: "level1", categoryId: "suit", curatedDesignId: "SUIT_01_CLASSIC", curatedDesignName: "Synthetic suit" }, assets: { result: { contentType: "image/png" }, person: { contentType: "image/png" }, fabric: { contentType: "image/png" } }, review: index === 0 ? review : { decision: "unreviewed", favourite: false, reasons: [], updatedAt: "" } })), total: 59, retained: 59 });
    if (path.endsWith("/review")) {
      if (request.method() === "GET") {
        if (failReviewLoad) return json(route, { error: "Synthetic feedback outage" }, 503);
        return json(route, review);
      }
      if (failReviewSave) return json(route, { error: "Synthetic feedback save failure" }, 503);
      review = { ...request.postDataJSON(), updatedAt: new Date().toISOString() }; return json(route, review);
    }
    if (path === "/api/try-on/uploads") {
      const id = randomUUID(); slots.set(id, { ...request.postDataJSON(), id, status: "authorized" });
      return json(route, { id, expiresAt: new Date(Date.now() + 600000).toISOString() });
    }
    if (/^\/api\/try-on\/uploads\//.test(path)) {
      const slot = slots.get(path.split("/")[4]); assert.ok(slot);
      if (path.includes("/parts/")) {
        if (cancelMode) { heldChunk = true; await new Promise(resolve => { releaseChunk = resolve; }); }
        return json(route, { uploaded: true });
      }
      if (path.endsWith("/complete")) slot.status = "uploaded";
      return json(route, slot);
    }
    if (path === "/api/try-on/status") {
      statuses++;
      if (statusMode === "absent") return json(route, { state: "absent" });
      if (statusMode === "unauthenticated") { await context.clearCookies(); return json(route, { error: "Synthetic expired session" }, 401); }
      return json(route, { state: "complete", resultUrl: `/api/history/${generationId}/asset/result`, originalUrl: `/api/history/${generationId}/asset/person` });
    }
    if (path === "/api/try-on") {
      generations++; submitted = request.postDataJSON();
      if (splitSuccess) { const splitId = generations === 2 ? generationId : randomUUID(); return json(route, { resultUrl: `/api/history/${splitId}/asset/result`, originalUrl: `/api/history/${splitId}/asset/person` }); }
      // The client must recover this original key; never resubmit generation.
      return json(route, { error: "Synthetic proxy failure" }, 503);
    }
    return route.continue();
  });
  await page.goto(origin); await page.getByLabel("Username").fill("assessment"); await page.getByLabel("Password").fill(password);
  await Promise.all([page.waitForURL(origin + "/"), page.getByRole("button", { name: "Sign In", exact: true }).click()]);
  await page.getByRole("heading", { name: "Simple Visual Try-On" }).waitFor(); passed("Real local login and protected page");
  await page.getByText("References temporarily unavailable. Try again shortly.", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Inspect Synthetic variation in full screen", exact: true }).click();
  await page.getByRole("button", { name: "Choose a reference", exact: true }).click();
  const options = page.getByRole("dialog", { name: "Choose Synthetic variation", exact: true }).locator(".level1-variant-option");
  assert.equal(await options.nth(0).isEnabled(), false); assert.equal(await options.nth(2).isEnabled(), false);
  await options.nth(1).click(); passed("Catalogue distinguishes outages and requires a ready reference even through the design viewer");
  await page.locator("#customer-photo").setInputFiles({ name: "synthetic-person.png", mimeType: "image/png", buffer: png });
  await page.locator("#fabric-photo").setInputFiles({ name: "synthetic-cloth.png", mimeType: "image/png", buffer: cloth });
  await page.locator('.level1-design-card').filter({ hasText: "Synthetic suit" }).click();
  const controls = page.getByRole("region", { name: "Upper fabric reference controls" });
  await controls.getByLabel("Use full swatch plus selected detail").check();
  await controls.getByLabel("Measured repeat width (cm, optional)").fill("4");
  await controls.getByRole("img", { name: "Upper fabric selected fabric detail" }).waitFor();
  await page.locator("details").filter({ hasText: "Advanced · Background preservation" }).locator("summary").click();
  const background = page.getByRole("region", { name: "Background preservation controls" });
  await background.getByLabel("Preservation method").selectOption("composite");
  await page.getByRole("button", { name: "Generate Try-On", exact: true }).click();
  await page.getByRole("heading", { name: "Your Try-On", exact: true }).waitFor({ timeout: 30000 });
  assert.equal(generations, 1); assert.equal(statuses, 1);
  assert.equal(JSON.parse(submitted.fabricGuidance).fabric.repeatWidthCm, 4); assert.equal(JSON.parse(submitted.backgroundControl).mode, "composite");
  assert.equal(await page.evaluate(() => sessionStorage.getItem("nasir-pending-generation-v1:assessment")), null);
  passed("Full/detail controls, measured repeat, region settings and proxy-error recovery without duplicate generation");
  await page.getByText("Couldn't load your feedback.", { exact: false }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Save feedback" }).isEnabled(), false); passed("Failed feedback reads cannot overwrite existing feedback");
  failReviewLoad = false;
  await page.getByRole("button", { name: "Side by side" }).click();
  await page.getByLabel("Compare result with").selectOption("0");
  await page.getByLabel("Shared zoom:", { exact: false }).focus();
  await page.getByLabel("Shared zoom:", { exact: false }).press("End");
  const panes = page.locator(".result-comparison-pane");
  await panes.first().evaluate(element => { element.scrollTop = 120; element.scrollLeft = 80; });
  await page.waitForFunction(() => { const [a, b] = document.querySelectorAll(".result-comparison-pane"); return a.scrollTop === b.scrollTop && a.scrollLeft === b.scrollLeft && a.scrollLeft > 0; }, null, { timeout: 15000 });
  passed("Fabric/result comparison, shared zoom and synchronized scrolling");
  await mkdir(output, { recursive: true }); await page.screenshot({ path: new URL("desktop.png", output).pathname, fullPage: true });
  await page.getByRole("button", { name: "History", exact: true }).filter({ visible: true }).first().click();
  await page.getByRole("button", { name: "Open details for", exact: false }).first().click();
  const dialog = page.getByRole("dialog", { name: "Try-On History" });
  const detailsBox = await dialog.locator(".generation-details").boundingBox();
  assert.ok(detailsBox && detailsBox.y < 1000, "Selecting a thumbnail in 59-row history must bring details into the visible panel immediately");
  await dialog.getByRole("button", { name: "Preview Generated men's try-on result", exact: true }).click();
  const preview = page.getByRole("dialog", { name: "Preview", exact: true });
  await preview.waitFor();
  assert.ok(await page.evaluate(() => Boolean(document.elementFromPoint(innerWidth / 2, innerHeight / 2)?.closest(".result-preview-root"))), "The image preview must appear above History");
  await preview.getByRole("button", { name: "Close", exact: true }).click();
  await dialog.getByRole("button", { name: "Close generation details", exact: true }).click();
  await dialog.getByRole("button", { name: "Open details for", exact: false }).last().click();
  const lastDetailsBox = await dialog.locator(".generation-details").boundingBox();
  assert.ok(lastDetailsBox && lastDetailsBox.y < 1000, "A record at the bottom of long history must also open in view");
  await dialog.getByRole("button", { name: "Close generation details", exact: true }).click();
  await page.waitForFunction(() => [...document.querySelectorAll(".history-thumbnail-button")].at(-1) === document.activeElement, null, { timeout: 10000 });
  assert.ok(await dialog.evaluate(element => element.scrollTop > 0), "Back to history restores the previous list position");
  await dialog.getByRole("button", { name: "Open details for", exact: false }).first().click();
  passed("59-record history opens details and full-size preview immediately; Back restores list position and focus");
  await dialog.getByLabel("Decision", { exact: false }).selectOption("rejected");
  await dialog.getByLabel("Save as favourite").check(); await dialog.getByLabel("Pattern too large", { exact: true }).check();
  await dialog.getByRole("button", { name: "Save feedback" }).click(); await dialog.getByText("Your feedback is saved.").waitFor();
  await dialog.getByRole("button", { name: "Close history", exact: true }).click();
  await page.getByRole("button", { name: "History", exact: true }).filter({ visible: true }).first().click();
  await page.getByLabel("Favourites in loaded history").check(); await page.getByRole("button", { name: "Open details for", exact: false }).first().click();
  await page.waitForFunction(() => document.querySelector('.history-panel .generation-review select')?.value === "rejected", null, { timeout: 10000 });
  assert.equal(await dialog.getByLabel("Decision", { exact: false }).inputValue(), "rejected"); assert.equal(await dialog.getByLabel("Pattern too large", { exact: true }).isChecked(), true);
  await dialog.getByRole("button", { name: "Close history", exact: true }).click(); passed("Saved favourite/rejection reason survives closing and reloading History");
  const pendingKey = randomUUID();
  await page.evaluate(key => sessionStorage.setItem("nasir-pending-generation-v1:assessment", JSON.stringify({ key, createdAt: Date.now(), summary: { garment: "Synthetic suit", fabric: "Uploaded fabric", shoes: "Keep existing" } })), pendingKey);
  await page.reload(); await page.getByRole("heading", { name: "Your Try-On", exact: true }).waitFor();
  assert.equal(generations, 1); assert.equal(statuses, 2); passed("Refresh restores the original pending key without generation resubmission");
  await page.evaluate(key => sessionStorage.setItem("nasir-pending-generation-v1:other-account", JSON.stringify({ key, createdAt: Date.now(), summary: { garment: "Other account", fabric: "Uploaded fabric", shoes: "Keep existing" } })), randomUUID());
  await page.reload(); await page.getByRole("heading", { name: "Simple Visual Try-On" }).waitFor();
  await page.getByRole("tab", { name: "Suits", exact: true }).waitFor(); assert.equal(statuses, 2); passed("Other-account pending metadata does not trigger recovery");
  await page.locator("#customer-photo").setInputFiles({ name: "synthetic-person.png", mimeType: "image/png", buffer: png });
  await page.locator("#fabric-photo").setInputFiles({ name: "synthetic-new-cloth.png", mimeType: "image/png", buffer: Buffer.from(await sharp(cloth).tint("green").png().toBuffer()) });
  await page.locator('.level1-design-card').filter({ hasText: "Synthetic suit" }).click(); cancelMode = true;
  await page.getByRole("button", { name: "Generate Try-On", exact: true }).click();
  for (let attempt = 0; attempt < 50 && !heldChunk; attempt++) await new Promise(resolve => setTimeout(resolve, 50));
  assert.ok(heldChunk); await page.getByRole("button", { name: "Cancel upload", exact: true }).click(); releaseChunk?.();
  await page.getByRole("button", { name: "Generate Try-On", exact: true }).waitFor();
  await page.locator('.form-error[role="alert"]').waitFor(); assert.equal(generations, 1); passed("Upload cancellation stops before generation submission");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("region", { name: "Upper fabric reference controls" }).getByLabel("Use full swatch plus selected detail").check();
  const mobileLayout = await page.evaluate(() => ({ width: innerWidth, contentWidth: document.documentElement.scrollWidth, overflow: [...document.querySelectorAll('main *')].map(element => ({ element: element.tagName, className: element.className, right: element.getBoundingClientRect().right, width: element.getBoundingClientRect().width })).filter(item => item.right > innerWidth + 1 && item.width > 0).slice(0, 15) }));
  if (mobileLayout.contentWidth > mobileLayout.width + 1) console.log("MOBILE_LAYOUT", JSON.stringify(mobileLayout));
  assert.ok(mobileLayout.contentWidth <= mobileLayout.width + 1, "Mobile layout must fit the viewport.");
  await page.screenshot({ path: new URL("mobile.png", output).pathname, fullPage: true }); passed("Mobile controls fit a 390-pixel viewport");
  await page.getByRole("button", { name: "Log out", exact: true }).filter({ visible: true }).first().click(); await page.waitForURL(origin + "/login");
  assert.equal(await page.evaluate(() => Object.keys(sessionStorage).some(key => key.startsWith("nasir-pending-generation-v1:") || key.startsWith("nasir-upload-v1:"))), false);
  passed("Confirmed local logout removes account/job/upload browser checkpoints");
  await page.getByLabel("Username").fill("assessment"); await page.getByLabel("Password").fill(password);
  await Promise.all([page.waitForURL(origin + "/"), page.getByRole("button", { name: "Sign In", exact: true }).click()]);
  const unresolvedKey = randomUUID();
  await page.evaluate(key => sessionStorage.setItem("nasir-pending-generation-v1:assessment", JSON.stringify({ key, createdAt: Date.now(), summary: { garment: "Unconfirmed look", fabric: "Uploaded fabric", shoes: "Keep existing" } })), unresolvedKey);
  statusMode = "absent"; cancelMode = false;
  await page.goto(origin + "/catalogue-recovery"); await page.goBack();
  await page.getByRole("button", { name: "Check generation again", exact: true }).waitFor({ timeout: 40000 });
  const slotCount = slots.size;
  await page.locator("#customer-photo").setInputFiles({ name: "synthetic-person.png", mimeType: "image/png", buffer: png });
  await page.locator("#fabric-photo").setInputFiles({ name: "synthetic-cloth.png", mimeType: "image/png", buffer: cloth });
  await page.locator('.level1-design-card').filter({ hasText: "Synthetic suit" }).click();
  await page.getByRole("button", { name: "Generate Try-On", exact: true }).click();
  await page.getByText("Check the pending generation before starting another paid run.", { exact: true }).waitFor();
  assert.equal(generations, 1); assert.equal(slots.size, slotCount);
  statusMode = "complete"; await page.getByRole("button", { name: "Check generation again", exact: true }).click();
  await page.getByRole("heading", { name: "Your Try-On", exact: true }).waitFor();
  passed("Navigation back preserves an unknown outcome and prevents another upload/generation until reconciliation");
  await page.evaluate(key => sessionStorage.setItem("nasir-pending-generation-v1:assessment", JSON.stringify({ key, createdAt: Date.now(), summary: { garment: "Expired-session look", fabric: "Uploaded fabric", shoes: "Keep existing" } })), randomUUID());
  statusMode = "unauthenticated"; await page.reload(); await page.waitForURL(origin + "/login");
  assert.ok(await page.evaluate(() => sessionStorage.getItem("nasir-pending-generation-v1:assessment")));
  assert.equal(generations, 1); passed("Expired authentication redirects to login while retaining minimal job metadata for later recovery");
  statusMode = "complete"; cancelMode = false;
  await page.getByLabel("Username").fill("assessment"); await page.getByLabel("Password").fill(password);
  await Promise.all([page.waitForURL(origin + "/"), page.getByRole("button", { name: "Sign In", exact: true }).click()]);
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.getByRole("radio", { name: /SPLIT OUTFIT/ }).click();
  await page.getByRole("button", { name: "Retry loading catalogue", exact: true }).waitFor();
  failSplitCatalogue = false;
  await page.getByRole("button", { name: "Retry loading catalogue", exact: true }).click();
  const steps = page.getByRole("navigation", { name: "Outfit steps" });
  await steps.getByRole("button", { name: /^Jacket/ }).waitFor();
  const goStep = async name => { await steps.getByRole("button", { name }).click(); await page.locator("#split-step-heading").filter({ hasText: typeof name === "string" ? name : undefined }).waitFor(); };
  const rowSwatch = index => page.locator(".builder-step-row").nth(index).locator("img.builder-swatch");
  const openSettings = () => page.locator(".split-cloth-settings > summary").first().click();
  assert.equal(await page.getByRole("radio", { name: "Sherwani · Coming soon", exact: true }).isEnabled(), false);
  await page.locator("#customer-photo").setInputFiles({ name: "split-person.png", mimeType: "image/png", buffer: png });
  await goStep(/^Jacket/);
  await page.locator("#split-fabric-jacket").setInputFiles({ name: "split-cloth.png", mimeType: "image/png", buffer: cloth });
  await page.getByRole("img", { name: "Jacket cloth preview", exact: true }).waitFor();
  await openSettings();
  const jacketSettings = page.getByRole("region", { name: "jacket fabric reference controls", exact: true });
  await jacketSettings.getByLabel("Use full swatch plus selected detail").check();
  await jacketSettings.getByLabel("Measured repeat width (cm, optional)").fill("4");
  const nextButton = page.getByRole("button", { name: /^Next: Trousers/ });
  const nextBox = await nextButton.boundingBox();
  assert.ok(nextBox && nextBox.y + nextBox.height <= 1050, "Next stays reachable without scrolling");
  await nextButton.click();
  await page.getByRole("button", { name: "Same as jacket", exact: true }).click();
  assert.equal(await rowSwatch(1).getAttribute("src"), await rowSwatch(2).getAttribute("src"));
  await goStep("Review & generate");
  await page.getByText("2 uploaded cloth / 1 reference cloth.", { exact: false }).waitFor();
  await goStep(/^Jacket/);
  await page.locator("#split-fabric-jacket").setInputFiles({ name: "split-replacement.png", mimeType: "image/png", buffer: cloth });
  await page.waitForFunction(() => document.querySelectorAll(".builder-step-row")[1].querySelector("img")?.getAttribute("src") === document.querySelector("img[alt='Jacket cloth preview']")?.getAttribute("src"));
  assert.equal(await rowSwatch(1).getAttribute("src"), await rowSwatch(2).getAttribute("src"));
  await goStep(/^Trousers/);
  await page.getByRole("button", { name: "Unlink from jacket cloth", exact: true }).click();
  await page.getByRole("img", { name: "Trouser cloth preview", exact: true }).waitFor();
  assert.notEqual(await rowSwatch(1).getAttribute("src"), await rowSwatch(2).getAttribute("src"));
  await page.getByRole("button", { name: "Same as jacket", exact: true }).click();
  await goStep(/^Jacket/);
  await page.locator(".split-cloth-row").getByRole("button", { name: "Remove", exact: true }).click();
  assert.equal(await rowSwatch(2).count(), 0);
  await page.locator("#split-fabric-jacket").setInputFiles({ name: "split-final.png", mimeType: "image/png", buffer: cloth });
  await page.getByRole("img", { name: "Jacket cloth preview", exact: true }).waitFor();
  await openSettings();
  await jacketSettings.getByLabel("Use full swatch plus selected detail").check();
  await jacketSettings.getByLabel("Measured repeat width (cm, optional)").fill("4");
  await goStep(/^Trousers/);
  assert.equal(await page.getByRole("region", { name: "trousers fabric reference controls", exact: true }).count(), 0);
  await goStep("Review & generate");
  await page.getByRole("button", { name: "Edit trousers", exact: true }).click();
  await page.locator("#split-step-heading").filter({ hasText: "Trousers" }).waitFor();
  assert.equal(await page.evaluate(() => document.activeElement?.id), "split-step-heading");
  await mkdir(output, { recursive: true });
  for (const [width, height] of [[1180, 820], [820, 1180], [375, 812]]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(400);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `no horizontal scroll at ${width}`);
    await page.screenshot({ path: new URL(`split-builder-${width}x${height}.png`, output).pathname, style: "nextjs-portal { visibility: hidden !important; }" });
  }
  await page.getByRole("button", { name: /^Step 3 of 7/ }).click();
  await steps.getByRole("button", { name: /^Review & generate/ }).click();
  await page.getByRole("region", { name: "Review your modular outfit recipe", exact: true }).screenshot({ path: new URL("split-review-mobile.png", output).pathname, style: ".atelier-mobile-header, nextjs-portal { visibility: hidden !important; }" });
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.getByRole("region", { name: "Review your modular outfit recipe", exact: true }).screenshot({ path: new URL("split-review-desktop.png", output).pathname });
  passed("Split builder steps, linked cloth follows replacement/removal, unlink owns its preview, counts, focus and layouts at iPad/phone sizes");
  splitSuccess = true;
  await page.getByRole("button", { name: "Generate Split Try-On", exact: true }).click();
  await page.getByRole("heading", { name: "Your Try-On", exact: true }).waitFor();
  assert.equal(submitted.selectionMode, "split");
  const recipe = JSON.parse(submitted.splitRecipe);
  assert.deepEqual([recipe.upperId, recipe.lowerId, recipe.shirtId, recipe.footwearId], ["SUIT_UPPER_CLASSIC", "SUIT_LOWER_NON_PLEATED", "SUIT_SHIRT_CLASSIC_FORMAL", "SUIT_SHOE_OXFORD"]);
  assert.deepEqual(await page.locator(".builder-step-detail").allTextContents(), ["Classic", "Non-pleated", "Classic Formal", "Oxford"]);
  assert.deepEqual(Object.keys(submitted.uploads).sort(), ["fabric", "lowerFabric", "person"]);
  assert.equal(slots.get(submitted.uploads.fabric).filename, "split-final.png");
  assert.equal(slots.get(submitted.uploads.lowerFabric).filename, "split-final.png");
  assert.deepEqual(JSON.parse(submitted.fabricGuidance).fabric, JSON.parse(submitted.fabricGuidance).lowerFabric);
  await page.getByRole("definition").filter({ hasText: "Linked jacket cloth" }).waitFor();
  await page.getByLabel("Wrong fabric or material", { exact: true }).check();
  await page.getByLabel("Customer appearance changed", { exact: true }).check();
  await page.getByRole("button", { name: "Needs improvement", exact: true }).click();
  await page.getByText("Changes not saved. Choose Save feedback to store them.", { exact: true }).waitFor();
  failReviewSave = true;
  await page.getByRole("button", { name: "Save feedback", exact: true }).click();
  await page.getByText("Synthetic feedback save failure", { exact: true }).waitFor();
  assert.equal(review.reasons.includes("wrong-material"), false);
  failReviewSave = false;
  await page.getByRole("button", { name: "Save feedback", exact: true }).click();
  await page.getByText("Your feedback is saved.", { exact: true }).waitFor();
  assert.ok(review.reasons.includes("wrong-material") && review.reasons.includes("changed-customer"));
  await page.getByRole("button", { name: "History", exact: true }).filter({ visible: true }).first().click();
  await page.getByRole("button", { name: "Open details for", exact: false }).first().click();
  await page.waitForFunction(() => document.querySelector(".history-panel .generation-review select")?.value === "rejected");
  assert.equal(await page.getByRole("dialog", { name: "Try-On History" }).getByLabel("Wrong fabric or material", { exact: true }).isChecked(), true);
  await page.getByRole("dialog", { name: "Try-On History" }).getByRole("button", { name: "Close history", exact: true }).click();
  passed("Split request matches the builder's list and linked assignments, feedback round-trips through History");
  const firstResult = await page.locator(".result-frame img").first().getAttribute("src");
  await page.getByRole("button", { name: "Try Again", exact: true }).click();
  await page.waitForFunction(src => document.querySelector(".result-frame img")?.getAttribute("src") !== src, firstResult);
  await page.getByRole("button", { name: "Show customer", exact: true }).click();
  const customer = page.getByRole("dialog", { name: "Customer view of the try-on" });
  await customer.waitFor();
  assert.equal(await customer.locator(".show-customer-dots span").count(), 2);
  await customer.getByText("AI visual reference — not an exact match of the cloth.", { exact: true }).waitFor();
  for (const name of ["Save feedback", "Download", "History", "Log out", "Try Again", "Start Over"]) assert.equal(await customer.getByRole("button", { name, exact: true }).count(), 0, `${name} hidden from customer`);
  assert.equal(await customer.getByRole("link", { name: "Download", exact: true }).count(), 0);
  await customer.getByText("Classic jacket · your cloth", { exact: true }).waitFor();
  await customer.getByText("Non-pleated trousers · same cloth as jacket", { exact: true }).waitFor();
  const latestSrc = await customer.locator(".show-customer-photo img").first().getAttribute("src");
  await customer.getByRole("button", { name: "Previous result", exact: true }).click();
  await page.waitForFunction(src => document.querySelector(".show-customer-photo img")?.getAttribute("src") !== src, latestSrc);
  for (const [width, height] of [[1180, 820], [820, 1180], [375, 812]]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(400);
    await page.screenshot({ path: new URL(`split-customer-${width}x${height}.png`, output).pathname, style: "nextjs-portal { visibility: hidden !important; }" });
  }
  await page.setViewportSize({ width: 1440, height: 1050 });
  await customer.getByRole("button", { name: "Done", exact: true }).click();
  assert.equal(await customer.count(), 0);
  passed("Try Again keeps earlier results; Show customer swipes between them with customer wording, the disclaimer and no staff controls");
  await goStep(/^Jacket/);
  await page.getByRole("radio", { name: /Tuxedo/ }).first().click();
  await goStep("Review & generate");
  await page.getByText("The outfit has changed since this result", { exact: true }).waitFor();
  passed("Editing the outfit after a result keeps the result and marks it as changed");
  await page.getByRole("button", { name: "Start Over", exact: true }).click();
  assert.equal(await page.getByRole("button", { name: "Show customer", exact: true }).count(), 0);
  assert.equal(await page.locator("#split-step-heading").textContent(), "Customer photo");
  passed("Start Over clears session results, the link and returns the builder to the first step");
  await page.evaluate(key => sessionStorage.setItem("nasir-pending-generation-v1:assessment", JSON.stringify({ key, createdAt: Date.now(), summary: { garment: "Classic", lower: "Non-pleated", fabric: "Approved reference cloth", shoes: "Oxford", pieces: [{ label: "Jacket", design: "Classic", source: "Uploaded cloth", cloth: "uploaded", customerLabel: "Classic jacket · your cloth" }, { label: "Shoes", design: "Oxford", source: "Reference material", cloth: "reference", customerLabel: "Oxford shoes" }] } })), randomUUID());
  statusMode = "complete"; await page.reload();
  await page.getByRole("button", { name: "Show customer", exact: true }).click();
  await customer.waitFor();
  assert.equal(await customer.locator(".show-customer-swatch.is-house").count(), 2);
  assert.ok(await customer.evaluate(dialog => [...dialog.querySelectorAll("img")].every(img => img.complete && img.naturalWidth > 0)), "no broken images");
  await customer.getByRole("button", { name: "Done", exact: true }).click();
  passed("A Split result recovered after reload reopens Split at Review and shows house-cloth marks without broken images");
  await page.getByRole("button", { name: "History", exact: true }).click();
  await page.getByRole("button", { name: /Open details for/ }).first().click();
  const deleteButton = page.getByRole("button", { name: "Delete generation and photos", exact: true });
  page.once("dialog", dialog => dialog.dismiss());
  await deleteButton.click();
  assert.equal(await deleteButton.count(), 1);
  const beforeDelete = historyIds.length;
  page.once("dialog", dialog => dialog.accept());
  await deleteButton.click();
  await page.getByRole("button", { name: /Open details for/ }).first().waitFor();
  assert.equal(historyIds.length, beforeDelete - 1);
  assert.equal(await deleteButton.count(), 0);
  passed("History deletion can be cancelled; confirmed deletion removes the selected generation");
  assert.deepEqual(pageErrors, []);
  await writeFile(new URL("results.json", output), JSON.stringify({ checkedAt: new Date().toISOString(), scope: "Loopback browser interactions with synthetic service fixtures; real local authentication", paidImageCalls: 0, checks, pageErrors }, null, 2));
  console.log(`Passed ${checks.length} local browser workflow checks; screenshots/results in .cache/improvement-browser. No paid calls or live storage services used.`);
} catch (error) {
  await mkdir(output, { recursive: true });
  await page?.screenshot({ path: new URL("failure.png", output).pathname, fullPage: true }).catch(() => undefined);
  throw error;
} finally { await stop(); }
