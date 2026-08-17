import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { DEFAULT_LEVEL1_CATALOGUE } from "@/lib/catalog/level1-seed";
import { buildLevel1TryOnPrompt } from "@/lib/catalog/level1-prompt";
import {
  getLevel1Catalogue,
  getLevel1CatalogueView,
  replaceLevel1Catalogue,
  resetLevel1CatalogueForTests,
  resolveLevel1Design,
} from "@/lib/catalog/level1-store";
import { Level1CatalogueError } from "@/lib/catalog/level1-types";
import { redactUsageHistoryForClient } from "@/lib/usage-history";

beforeEach(() => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  resetLevel1CatalogueForTests();
});

test("Level 1 seeds exactly the five approved Suit and five approved Sherwani designs", async () => {
  const catalogue = await getLevel1Catalogue();
  assert.deepEqual(catalogue.designs.map((design) => design.id), [
    "SUIT_01_CLASSIC",
    "SUIT_02_TUXEDO",
    "SUIT_03_STATEMENT",
    "SUIT_04_DOUBLE_BREASTED",
    "SUIT_05_THREE_PIECE",
    "SHERWANI_01_CLASSIC",
    "SHERWANI_02_LAYERED",
    "SHERWANI_03_JODHPURI",
    "SHERWANI_04_ASYMMETRIC",
    "SHERWANI_05_ROYAL",
  ]);
  assert.equal(catalogue.designs.length, 10);
  assert.equal(catalogue.assets.length, 20);
  assert.ok(catalogue.assets.every((asset) => asset.status === "active"));
  assert.ok(catalogue.assets.every((asset) => asset.checksum && (asset.contentType === "image/png" || asset.contentType === "image/jpeg")));
  assert.equal(catalogue.designs.find((design) => design.id === "SUIT_02_TUXEDO")?.blueprint.construction.lapel, "satin peak lapel");
  assert.equal(catalogue.designs.find((design) => design.id === "SHERWANI_04_ASYMMETRIC")?.blueprint.garmentFamily, "Contemporary asymmetric overlap Sherwani");
  assert.equal(catalogue.designs.find((design) => design.id === "SHERWANI_02_LAYERED")?.blueprint.garmentFamily, "Layered ceremonial Sherwani");
});

test("sanitized Level 1 catalogue view returns both active categories and never leaks blueprints", async () => {
  const view = await getLevel1CatalogueView();
  assert.deepEqual(view.categories.map((category) => category.id), ["suit", "sherwani"]);
  assert.equal(view.designs.length, 10);
  assert.equal(view.designs.filter((d) => d.categoryId === "suit").length, 5);
  assert.equal(view.designs.filter((d) => d.categoryId === "sherwani").length, 5);
  assert.ok(view.designs.every((design) => design.cardImage.state === "ready"));
  assert.ok(view.designs.every((design) => design.generation.state === "ready"));

  const serialized = JSON.stringify(view);
  assert.doesNotMatch(serialized, /promptFragments|negativeConstraints|privatePath|bodyFitPolicy|construction/i);
});

test("unknown, mismatched, and asset-pending Level 1 selections are rejected for all categories", async () => {
  await assert.rejects(
    () => resolveLevel1Design("suit", "SUIT_99_UNKNOWN"),
    (error: unknown) => error instanceof Level1CatalogueError && error.code === "unknown_selection",
  );
  await assert.rejects(
    () => resolveLevel1Design("sherwani", "SHERWANI_99_UNKNOWN"),
    (error: unknown) => error instanceof Level1CatalogueError && error.code === "unknown_selection",
  );
  // Cross-category mismatches
  await assert.rejects(
    () => resolveLevel1Design("suit", "SHERWANI_01_CLASSIC"),
    (error: unknown) => error instanceof Level1CatalogueError && error.code === "category_design_mismatch",
  );
  await assert.rejects(
    () => resolveLevel1Design("sherwani", "SUIT_01_CLASSIC"),
    (error: unknown) => error instanceof Level1CatalogueError && error.code === "category_design_mismatch",
  );
  await assert.rejects(
    () => resolveLevel1Design("achkan", "SHERWANI_01_CLASSIC"),
    (error: unknown) => error instanceof Level1CatalogueError && error.code === "category_design_mismatch",
  );

  const pendingCatalogue = structuredClone(DEFAULT_LEVEL1_CATALOGUE);
  pendingCatalogue.assets = pendingCatalogue.assets.map((asset) => ({
    ...asset,
    status: "awaiting-upload" as const,
    privatePath: undefined,
    contentType: undefined,
    checksum: undefined,
    provenance: undefined,
  }));
  await replaceLevel1Catalogue(pendingCatalogue);
  await assert.rejects(
    () => resolveLevel1Design("sherwani", "SHERWANI_01_CLASSIC"),
    (error: unknown) => error instanceof Level1CatalogueError && error.code === "asset_pending",
  );
});

test("compiled Level 1 instruction keeps the customer body, fabric, and Sherwani design authorities separate", async () => {
  const resolved = await resolveLevel1Design("sherwani", "SHERWANI_04_ASYMMETRIC");
  const prompt = buildLevel1TryOnPrompt(resolved);
  assert.match(prompt, /sole authority for the customer's identity/i);
  assert.match(prompt, /Never slim, enlarge, reshape, lengthen, shorten/i);
  assert.match(prompt, /Image 2 is authoritative only for base colour/i);
  assert.match(prompt, /authoritative only for garment construction/i);
  assert.match(prompt, /Contemporary asymmetric overlap Sherwani/i);
  assert.match(prompt, /diagonal front panel closure/i);
  assert.match(prompt, /Do not normalize the front into a centered vertical button closure/i);
});

test("history metadata retains Level 1 Sherwani selection details without exposing private asset paths", () => {
  const clientHistory = redactUsageHistoryForClient({
    total: 1,
    retained: 1_000,
    events: [{
      id: "00000000-0000-4000-8000-000000000000",
      occurredAt: "2026-08-17T00:00:00.000Z",
      username: "showroom",
      status: "success",
      device: { kind: "desktop", browser: "Safari", operatingSystem: "macOS" },
      durationMs: 1,
      provider: "openai",
      model: "gpt-image-2",
      quality: "medium",
      generation: {
        mode: "level1",
        categoryId: "sherwani",
        categoryName: "Sherwanis",
        curatedDesignId: "SHERWANI_01_CLASSIC",
        curatedDesignName: "Classic",
        curatedDesignVersion: 1,
        curatedAssetStatus: "ready",
      },
      assets: {
        result: { pathname: "nasir-bespoke/generations/private-id/result.jpg", contentType: "image/jpeg" },
        "curated-design": { pathname: "nasir-bespoke/generations/private-id/curated-design.jpg", contentType: "image/jpeg" },
      },
    }],
  });

  const serialized = JSON.stringify(clientHistory);
  assert.match(serialized, /SHERWANI_01_CLASSIC/);
  assert.match(serialized, /Sherwanis/);
  assert.doesNotMatch(serialized, /nasir-bespoke\/generations\/private-id/);
  assert.deepEqual(clientHistory.events[0]?.assets?.result, { contentType: "image/jpeg" });
});

test("catalogue assets cannot be read without an authenticated application session", async () => {
  const { GET } = await import("@/app/api/catalog-assets/[assetId]/route");
  const response = await GET(
    new Request("https://atelier.example/api/catalog-assets/SHERWANI_01_CLASSIC_CARD_V1"),
    { params: Promise.resolve({ assetId: "SHERWANI_01_CLASSIC_CARD_V1" }) },
  );

  assert.equal(response.status, 404);
  assert.equal(response.headers.get("cache-control"), "no-store");
});
