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
import {
  CURATED_CATEGORY_IDS,
  CURATED_DESIGN_IDS,
  Level1CatalogueError,
  type CuratedDesignId,
} from "@/lib/catalog/level1-types";
import { redactUsageHistoryForClient } from "@/lib/usage-history";

beforeEach(() => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  resetLevel1CatalogueForTests();
});

test("Level 1 seeds exactly 8 categories, 40 designs, and 84 asset slots with 8 active categories", async () => {
  const catalogue = await getLevel1Catalogue();

  // 1. Categories
  assert.equal(catalogue.categories.length, 8);
  assert.deepEqual(catalogue.categories.map((c) => c.id), [
    "suit",
    "sherwani",
    "bandhgala",
    "nehru-jacket",
    "kurta-set",
    "indo-western",
    "achkan",
    "jackets",
  ]);

  // 2. Designs
  assert.equal(catalogue.designs.length, 40);
  assert.deepEqual(
    catalogue.designs.map((d) => d.id),
    CURATED_DESIGN_IDS,
  );

  // Each category has exactly 5 designs, except Nehru Jacket (7) and Jackets (2)
  for (const catId of CURATED_CATEGORY_IDS) {
    const catDesigns = catalogue.designs.filter((d) => d.categoryId === catId);
    const expectedCount = catId === "suit" ? 6 : catId === "nehru-jacket" ? 7 : catId === "jackets" ? 2 : 5;
    assert.equal(catDesigns.length, expectedCount, `Category ${catId} must have exactly ${expectedCount} designs`);
    assert.deepEqual(
      catDesigns.map((d) => d.sortOrder).sort(),
      Array.from({ length: expectedCount }, (_, i) => i + 1),
      `Category ${catId} designs must have deterministic sequential sort orders`,
    );
  }

  // 3. Asset Slots (84 total - all 84 active!)
  assert.equal(catalogue.assets.length, 84);
  const activeAssets = catalogue.assets.filter((a) => a.status === "active");
  const pendingAssets = catalogue.assets.filter((a) => a.status === "awaiting-upload");

  // 12 Suit base slots + 4 variant slots + 10 Sherwani + 10 Bandhgala + 14 Nehru + 10 Kurta + 10 Indo + 10 Achkan + 4 Jackets = 84 active
  assert.equal(activeAssets.length, 84);
  assert.ok(activeAssets.every((a) => a.checksum && a.privatePath && a.contentType));

  // 0 remaining designs awaiting-upload
  assert.equal(pendingAssets.length, 0);

  // 4. ID Uniqueness
  const designIdSet = new Set(catalogue.designs.map((d) => d.id));
  assert.equal(designIdSet.size, 40, "All 40 design IDs must be unique");

  const assetIdSet = new Set(catalogue.assets.map((a) => a.id));
  assert.equal(assetIdSet.size, 84, "All 84 asset IDs must be unique");

  // 5. Invariant: bodyFitPolicy for all 40 designs
  assert.ok(
    catalogue.designs.every((d) => d.blueprint.bodyFitPolicy === "adapt-garment-to-customer"),
    "Every design must enforce adapt-garment-to-customer body fit policy",
  );
  assert.ok(
    catalogue.designs.every((d) => d.blueprint.stylingPolicy === "preserve-existing-accessories"),
  );
});

test("Suit, Sherwani, Bandhgala, Nehru Jacket, Kurta Set, Indo-Western, and Achkan blueprints and generation resolution remain active and operational", async () => {
  const catalogue = await getLevel1Catalogue();

  // Suit Checks
  assert.equal(catalogue.designs.find((d) => d.id === "SUIT_02_TUXEDO")?.blueprint.construction.lapel, "satin peak lapel");
  const resolvedSuit = await resolveLevel1Design("suit", "SUIT_01_CLASSIC");
  assert.equal(resolvedSuit.primaryAsset.status, "active");
  assert.ok(resolvedSuit.primaryAsset.privatePath);

  // Sherwani Checks
  assert.equal(catalogue.designs.find((d) => d.id === "SHERWANI_04_ASYMMETRIC")?.blueprint.garmentFamily, "Contemporary asymmetric overlap Sherwani");
  const resolvedSherwani = await resolveLevel1Design("sherwani", "SHERWANI_01_CLASSIC");
  assert.equal(resolvedSherwani.primaryAsset.status, "active");
  assert.ok(resolvedSherwani.primaryAsset.privatePath);

  // Bandhgala Checks
  assert.equal(catalogue.designs.find((d) => d.id === "BANDHGALA_01_CLASSIC")?.blueprint.garmentFamily, "Formal Bandhgala jacket");
  const resolvedBandhgala = await resolveLevel1Design("bandhgala", "BANDHGALA_01_CLASSIC");
  assert.equal(resolvedBandhgala.primaryAsset.status, "active");
  assert.ok(resolvedBandhgala.primaryAsset.privatePath);
  assert.equal(resolvedBandhgala.primaryAsset.checksum, "bf2064b0c1dd77be16a37d39a393577285b5ed21e63842fe1bce831b6652f8cc");

  // Nehru Jacket Checks
  assert.equal(catalogue.designs.find((d) => d.id === "NEHRU_01_CLASSIC")?.blueprint.garmentFamily, "Traditional Nehru jacket / sleeveless bandhgala waistcoat");
  const resolvedNehru = await resolveLevel1Design("nehru-jacket", "NEHRU_01_CLASSIC");
  assert.equal(resolvedNehru.primaryAsset.status, "active");
  assert.ok(resolvedNehru.primaryAsset.privatePath);
  assert.equal(resolvedNehru.primaryAsset.checksum, "3152976c51e3f99c47a964daf7ea0bb5971ae694b4e07f008f977fce88dfc27c");

  // Kurta Set Checks
  assert.equal(catalogue.designs.find((d) => d.id === "KURTA_01_CLASSIC")?.blueprint.garmentFamily, "Traditional Kurta Set");
  const resolvedKurta = await resolveLevel1Design("kurta-set", "KURTA_01_CLASSIC");
  assert.equal(resolvedKurta.primaryAsset.status, "active");
  assert.ok(resolvedKurta.primaryAsset.privatePath);
  assert.equal(resolvedKurta.primaryAsset.checksum, "121f7986b606c2b2cb0720dc8aed72423bd61734628af1b18ed51120b2c6ef6c");

  // Indo-Western Checks
  assert.equal(catalogue.designs.find((d) => d.id === "INDO_01_CLASSIC")?.blueprint.garmentFamily, "Deliberate Indian-Western hybrid suit");
  const resolvedIndo = await resolveLevel1Design("indo-western", "INDO_01_CLASSIC");
  assert.equal(resolvedIndo.primaryAsset.status, "active");
  assert.ok(resolvedIndo.primaryAsset.privatePath);
  assert.equal(resolvedIndo.primaryAsset.checksum, "80d01ff2629bad975d73dc36c3325212434aa4f9f431a91e36df5235594404b7");

  // Achkan Checks
  assert.equal(catalogue.designs.find((d) => d.id === "ACHKAN_01_CLASSIC")?.blueprint.garmentFamily, "Traditional long Achkan coat");
  const resolvedAchkan = await resolveLevel1Design("achkan", "ACHKAN_01_CLASSIC");
  assert.equal(resolvedAchkan.primaryAsset.status, "active");
  assert.ok(resolvedAchkan.primaryAsset.privatePath);
  assert.equal(resolvedAchkan.primaryAsset.checksum, "1612ea8836a1cef3096271f4b8b6e451d343f2edaffa475797d4e2fbd02650d1");
});

test("Classic and Double-Breasted variant references resolve to their own approved construction assets", async () => {
  const classic = await resolveLevel1Design("suit", "SUIT_01_CLASSIC", "SUIT_01_CLASSIC_THREE_BUTTON");
  assert.equal(classic.variant?.name, "Three-Button Classic");
  assert.equal(classic.primaryAsset.id, "SUIT_01_CLASSIC_THREE_BUTTON_PRIMARY_V1");
  assert.match(buildLevel1TryOnPrompt(classic), /three-button closure/i);

  const doubleBreasted = await resolveLevel1Design("suit", "SUIT_04_DOUBLE_BREASTED", "SUIT_04_DOUBLE_BREASTED_BROAD_COLLAR");
  assert.equal(doubleBreasted.variant?.name, "Broad-Collar Double-Breasted");
  assert.equal(doubleBreasted.primaryAsset.id, "SUIT_04_DOUBLE_BREASTED_BROAD_COLLAR_PRIMARY_V1");
  assert.match(buildLevel1TryOnPrompt(doubleBreasted), /broad peak lapels/i);

  await assert.rejects(
    () => resolveLevel1Design("suit", "SUIT_02_TUXEDO", "SUIT_01_CLASSIC_THREE_BUTTON"),
    (error: unknown) => error instanceof Level1CatalogueError && error.code === "unknown_selection",
  );
});

test("sanitized Level 1 catalogue view returns active categories and never leaks blueprints or private metadata", async () => {
  const view = await getLevel1CatalogueView();
  // Active categories returned in customer view (all 8 categories)
  assert.deepEqual(view.categories.map((category) => category.id), [
    "suit",
    "sherwani",
    "bandhgala",
    "nehru-jacket",
    "kurta-set",
    "indo-western",
    "achkan",
    "jackets",
  ]);
  assert.equal(view.designs.length, 40);
  assert.equal(view.designs.filter((d) => d.categoryId === "suit").length, 6);
  assert.equal(view.designs.filter((d) => d.categoryId === "sherwani").length, 5);
  assert.equal(view.designs.filter((d) => d.categoryId === "bandhgala").length, 5);
  assert.equal(view.designs.filter((d) => d.categoryId === "nehru-jacket").length, 7);
  assert.equal(view.designs.filter((d) => d.categoryId === "kurta-set").length, 5);
  assert.equal(view.designs.filter((d) => d.categoryId === "indo-western").length, 5);
  assert.equal(view.designs.filter((d) => d.categoryId === "achkan").length, 5);
  assert.equal(view.designs.filter((d) => d.categoryId === "jackets").length, 2);
  assert.ok(view.designs.every((design) => design.cardImage.state === "ready"));
  assert.ok(view.designs.every((design) => design.generation.state === "ready"));
  const classicView = view.designs.find((design) => design.id === "SUIT_01_CLASSIC");
  assert.equal(classicView?.variants?.length, 1);
  assert.equal(classicView?.variants?.[0]?.name, "Three-Button Classic");
  assert.equal(classicView?.variants?.[0]?.cardImage.state, "ready");
  const doubleBreastedView = view.designs.find((design) => design.id === "SUIT_04_DOUBLE_BREASTED");
  assert.equal(doubleBreastedView?.variants?.[0]?.name, "Broad-Collar Double-Breasted");
  assert.equal(doubleBreastedView?.variants?.[0]?.generation.state, "ready");

  const serialized = JSON.stringify(view);
  assert.doesNotMatch(serialized, /promptFragments|negativeConstraints|privatePath|bodyFitPolicy|construction/i);
});

test("development mode preview exposes all 8 categories and 40 designs, with all designs ready", async () => {
  // 1. In production / test environment: 8 active categories (40 designs)
  const prodView = await getLevel1CatalogueView();
  assert.equal(prodView.categories.length, 8);
  assert.deepEqual(prodView.categories.map((c) => c.id), [
    "suit",
    "sherwani",
    "bandhgala",
    "nehru-jacket",
    "kurta-set",
    "indo-western",
    "achkan",
    "jackets",
  ]);
  assert.equal(prodView.designs.length, 40);

  // 2. In development preview mode: all 8 categories and 40 designs
  const prevEnv = process.env.NODE_ENV;
  try {
    (process.env as Record<string, string | undefined>).NODE_ENV = "development";
    const devView = await getLevel1CatalogueView();
    assert.equal(devView.categories.length, 8);
    assert.deepEqual(devView.categories.map((c) => c.id), [
      "suit",
      "sherwani",
      "bandhgala",
      "nehru-jacket",
      "kurta-set",
      "indo-western",
      "achkan",
      "jackets",
    ]);
    assert.equal(devView.designs.length, 40);

    // All 40 designs across all 8 categories are ready
    assert.ok(devView.designs.every((d) => d.cardImage.state === "ready" && Boolean(d.cardImage.url)));
    assert.ok(devView.designs.every((d) => d.generation.state === "ready"));
  } finally {
    (process.env as Record<string, string | undefined>).NODE_ENV = prevEnv;
  }
});

test("unknown, cross-category mismatched, and pending selections fail closed for all categories", async () => {
  // Unknown selection
  await assert.rejects(
    () => resolveLevel1Design("suit", "SUIT_99_UNKNOWN"),
    (error: unknown) => error instanceof Level1CatalogueError && error.code === "unknown_selection",
  );
  await assert.rejects(
    () => resolveLevel1Design("achkan", "ACHKAN_99_UNKNOWN"),
    (error: unknown) => error instanceof Level1CatalogueError && error.code === "unknown_selection",
  );

  // Cross-category mismatches across categories
  await assert.rejects(
    () => resolveLevel1Design("suit", "SHERWANI_01_CLASSIC"),
    (error: unknown) => error instanceof Level1CatalogueError && error.code === "category_design_mismatch",
  );
  await assert.rejects(
    () => resolveLevel1Design("achkan", "INDO_01_CLASSIC"),
    (error: unknown) => error instanceof Level1CatalogueError && error.code === "category_design_mismatch",
  );

  // Inactive / draft category selection rejected (if inactive category exists)
  const deactivatedCat = structuredClone(DEFAULT_LEVEL1_CATALOGUE);
  const achkanCat = deactivatedCat.categories.find((c) => c.id === "achkan");
  if (achkanCat) achkanCat.status = "draft";
  const achkanDesign = deactivatedCat.designs.find((d) => d.id === "ACHKAN_01_CLASSIC");
  if (achkanDesign) achkanDesign.status = "draft";
  await replaceLevel1Catalogue(deactivatedCat);

  await assert.rejects(
    () => resolveLevel1Design("achkan", "ACHKAN_01_CLASSIC"),
    (error: unknown) => error instanceof Level1CatalogueError && error.code === "inactive_design",
  );

  // When activated with pending asset, rejects with asset_pending
  const pendingCat = structuredClone(DEFAULT_LEVEL1_CATALOGUE);
  const achkanAsset = pendingCat.assets.find((a) => a.id === "ACHKAN_01_CLASSIC_PRIMARY_V1");
  if (achkanAsset) {
    achkanAsset.status = "awaiting-upload";
    achkanAsset.privatePath = undefined;
    achkanAsset.checksum = undefined;
  }
  await replaceLevel1Catalogue(pendingCat);

  await assert.rejects(
    () => resolveLevel1Design("achkan", "ACHKAN_01_CLASSIC"),
    (error: unknown) => error instanceof Level1CatalogueError && error.code === "asset_pending",
  );
});

test("prompt compiler creates valid deterministic prompts for all designs", async () => {
  const catalogue = structuredClone(DEFAULT_LEVEL1_CATALOGUE);

  for (const design of catalogue.designs) {
    const category = catalogue.categories.find((c) => c.id === design.categoryId)!;
    const primaryAsset = {
      id: design.assetIds.primaryConstruction,
      designId: design.id,
      purpose: "primary-construction" as const,
      status: "active" as const,
      privatePath: `nasir-bespoke/catalogue/level1/v1/${design.id}/approved.jpg`,
      contentType: "image/jpeg" as const,
      checksum: "0000000000000000000000000000000000000000000000000000000000000000",
      sortOrder: 2,
    };

    const prompt = buildLevel1TryOnPrompt({ category, design, primaryAsset, detailAssets: [] }, category.id === "jackets" ? "jacket" : "both");

    // Permanent 3-authority invariant assertions
    assert.match(prompt, /sole authority for the customer's identity/i);
    assert.match(prompt, /Never slim, enlarge, reshape, lengthen, shorten/i);
    assert.match(prompt, /Image 2 is authoritative only for (the )?base colour/i);
    assert.match(prompt, /authoritative only for garment construction/i);
    assert.match(prompt, new RegExp(design.customer.name, "i"));
    assert.match(prompt, new RegExp(design.blueprint.garmentFamily, "i"));
    assert.ok(prompt.length > 200);
  }
});

test("fabric-region prompts correctly name pieces and preserve the unselected region for all designs", async () => {
  const catalogue = structuredClone(DEFAULT_LEVEL1_CATALOGUE);

  for (const design of catalogue.designs) {
    const category = catalogue.categories.find((c) => c.id === design.categoryId)!;
    const primaryAsset = {
      id: design.assetIds.primaryConstruction,
      designId: design.id,
      purpose: "primary-construction" as const,
      status: "active" as const,
      privatePath: `nasir-bespoke/catalogue/level1/v1/${design.id}/approved.jpg`,
      contentType: "image/jpeg" as const,
      checksum: "0000000000000000000000000000000000000000000000000000000000000000",
      sortOrder: 2,
    };
    const resolved = { category, design, primaryAsset, detailAssets: [] };

    if (category.id === "jackets") {
      assert.ok(design.blueprint.fabricRegions.upper.length > 0, `${design.id} is missing upper fabricRegions`);
      assert.equal(design.blueprint.fabricRegions.lower.length, 0, `${design.id} must not define a lower fabric region`);
      const jacketPrompt = buildLevel1TryOnPrompt(resolved, "jacket");
      assert.match(jacketPrompt, /Image 2 — physical showroom jacket fabric photograph/);
      assert.match(jacketPrompt, /jacket-only selection/i);
      assert.match(jacketPrompt, /No lower garment fabric input is accepted/i);
      assert.doesNotMatch(jacketPrompt, /Image 3 — physical showroom lower-garment fabric photograph/);
      assert.doesNotMatch(jacketPrompt, /UNCHANGED REGION/);
      continue;
    }

    // Every full-outfit design must have non-empty upper and lower fabricRegions.
    assert.ok(design.blueprint.fabricRegions.upper.length > 0, `${design.id} is missing upper fabricRegions`);
    assert.ok(design.blueprint.fabricRegions.lower.length > 0, `${design.id} is missing lower fabricRegions`);

    const bothPrompt = buildLevel1TryOnPrompt(resolved, "both");
    const noArgPrompt = buildLevel1TryOnPrompt(resolved);
    assert.equal(bothPrompt, noArgPrompt, `${design.id}: default parameter must match explicit "both"`);
    assert.doesNotMatch(bothPrompt, /UNCHANGED REGION/, `${design.id}: "both" must not include an unchanged-region sentence`);
    assert.match(bothPrompt, /Apply these fabric characteristics faithfully to every selected garment piece/, `${design.id}: "both" must keep the explicit all-pieces wording`);

    const upperPrompt = buildLevel1TryOnPrompt(resolved, "upper");
    for (const piece of design.blueprint.fabricRegions.upper) {
      assert.ok(upperPrompt.includes(piece), `${design.id}: "upper" prompt must name "${piece}"`);
    }
    for (const piece of design.blueprint.fabricRegions.lower) {
      assert.ok(upperPrompt.includes(piece), `${design.id}: "upper" prompt must still name the preserved lower piece "${piece}"`);
    }
    assert.match(upperPrompt, /UNCHANGED REGION — CRITICAL: The lower garment piece/, `${design.id}: "upper" must include the unchanged-region sentence for the lower pieces`);

    const lowerPrompt = buildLevel1TryOnPrompt(resolved, "lower");
    for (const piece of design.blueprint.fabricRegions.lower) {
      assert.ok(lowerPrompt.includes(piece), `${design.id}: "lower" prompt must name "${piece}"`);
    }
    for (const piece of design.blueprint.fabricRegions.upper) {
      assert.ok(lowerPrompt.includes(piece), `${design.id}: "lower" prompt must still name the preserved upper piece "${piece}"`);
    }
    assert.match(lowerPrompt, /UNCHANGED REGION — CRITICAL: The upper garment piece/, `${design.id}: "lower" must include the unchanged-region sentence for the upper pieces`);

    // Every other sentence must stay byte-identical across all 3 region values.
    const stripFabricLines = (text: string) => text
      .split("\n\n")
      .filter((line) => !line.startsWith("FABRIC PHOTO AUTHORITY") && !line.startsWith("UNCHANGED REGION") && !line.startsWith("FINAL FABRIC APPLICATION OVERRIDE"))
      .join("\n\n");
    assert.equal(stripFabricLines(bothPrompt), stripFabricLines(upperPrompt), `${design.id}: only fabric-region sentences may differ between "both" and "upper"`);
    assert.equal(stripFabricLines(bothPrompt), stripFabricLines(lowerPrompt), `${design.id}: only fabric-region sentences may differ between "both" and "lower"`);

    const customPrompt = buildLevel1TryOnPrompt(resolved, "custom");
    assert.match(customPrompt, /Image 2 — physical showroom upper-garment fabric photograph/);
    assert.match(customPrompt, /Image 3 — physical showroom lower-garment fabric photograph/);
    assert.match(customPrompt, /Apply every visible portion of the named lower garment pieces/);
    assert.match(customPrompt, /Customization requires two independently coloured fabric regions/);
    assert.match(customPrompt, /must never make the upper and lower fabrics identical/);
    assert.match(customPrompt, /the two uploaded fabric photographs control fabric appearance/);
    assert.doesNotMatch(customPrompt, /UNCHANGED REGION/);
    for (const piece of design.blueprint.fabricRegions.upper) assert.ok(customPrompt.includes(piece), `${design.id}: custom prompt must name upper piece "${piece}"`);
    for (const piece of design.blueprint.fabricRegions.lower) assert.ok(customPrompt.includes(piece), `${design.id}: custom prompt must name lower piece "${piece}"`);
  }
});

test("history metadata retains Level 1 selection details without exposing private asset paths", () => {
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
        categoryId: "achkan",
        categoryName: "Achkans",
        curatedDesignId: "ACHKAN_01_CLASSIC" as CuratedDesignId,
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
  assert.match(serialized, /ACHKAN_01_CLASSIC/);
  assert.match(serialized, /Achkans/);
  assert.doesNotMatch(serialized, /nasir-bespoke\/generations\/private-id/);
  assert.deepEqual(clientHistory.events[0]?.assets?.result, { contentType: "image/jpeg" });
});

test("catalogue assets cannot be read without an authenticated application session", async () => {
  const { GET } = await import("@/app/api/catalog-assets/[assetId]/route");
  const response = await GET(
    new Request("https://atelier.example/api/catalog-assets/ACHKAN_01_CLASSIC_CARD_V1"),
    { params: Promise.resolve({ assetId: "ACHKAN_01_CLASSIC_CARD_V1" }) },
  );

  assert.equal(response.status, 404);
  assert.equal(response.headers.get("cache-control"), "no-store");
});
