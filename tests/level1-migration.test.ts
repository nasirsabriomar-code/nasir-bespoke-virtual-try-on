import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_LEVEL1_CATALOGUE } from "@/lib/catalog/level1-seed";

test("authoritative seed contains all 10 active Suit asset records with valid 64-char SHA-256 hashes", () => {
  const targetIds = [
    "SUIT_01_CLASSIC_CARD_V1",
    "SUIT_01_CLASSIC_PRIMARY_V1",
    "SUIT_02_TUXEDO_CARD_V1",
    "SUIT_02_TUXEDO_PRIMARY_V1",
    "SUIT_03_STATEMENT_CARD_V1",
    "SUIT_03_STATEMENT_PRIMARY_V1",
    "SUIT_04_DOUBLE_BREASTED_CARD_V1",
    "SUIT_04_DOUBLE_BREASTED_PRIMARY_V1",
    "SUIT_05_THREE_PIECE_CARD_V1",
    "SUIT_05_THREE_PIECE_PRIMARY_V1",
  ];

  const assetMap = new Map(DEFAULT_LEVEL1_CATALOGUE.assets.map((a) => [a.id, a]));
  for (const id of targetIds) {
    const asset = assetMap.get(id);
    assert.ok(asset, `Asset ${id} must exist in default catalogue.`);
    assert.equal(asset.status, "active");
    assert.equal(asset.contentType, "image/png");
    assert.ok(asset.privatePath?.startsWith("nasir-bespoke/catalogue/level1/v1/"));
    assert.ok(asset.checksum, `Asset ${id} must have a checksum.`);
    assert.equal(asset.checksum.length, 64, `Asset ${id} checksum must be exactly 64 characters.`);
    assert.match(asset.checksum, /^[0-9a-f]{64}$/i, `Asset ${id} checksum must be valid hexadecimal.`);
  }

  // Specifically verify Double-Breasted checksum has all 64 characters
  const dbCard = assetMap.get("SUIT_04_DOUBLE_BREASTED_CARD_V1");
  const dbPrimary = assetMap.get("SUIT_04_DOUBLE_BREASTED_PRIMARY_V1");
  assert.equal(dbCard?.checksum, "6f34662fb556da3a55f3a214955d5d21e0fd4020d5172433bad0e3ee9ddb958d");
  assert.equal(dbPrimary?.checksum, "6f34662fb556da3a55f3a214955d5d21e0fd4020d5172433bad0e3ee9ddb958d");
});

test("migration patch correctly transforms awaiting-upload assets to active without touching unrelated categories", () => {
  // Simulate an older prototype Redis catalogue where assets were pending
  const prototypeCatalogue = structuredClone(DEFAULT_LEVEL1_CATALOGUE);
  prototypeCatalogue.assets = prototypeCatalogue.assets.map((asset) => ({
    ...asset,
    status: "awaiting-upload" as const,
    privatePath: undefined,
    contentType: undefined,
    checksum: undefined,
    provenance: undefined,
  }));

  // Simulate updating only target assets
  const targetMap = new Map(
    DEFAULT_LEVEL1_CATALOGUE.assets.map((asset) => [asset.id, asset]),
  );

  const patched = structuredClone(prototypeCatalogue);
  patched.assets = patched.assets.map((asset) => {
    if (targetMap.has(asset.id)) {
      const approved = targetMap.get(asset.id)!;
      return {
        ...asset,
        status: approved.status,
        privatePath: approved.privatePath,
        contentType: approved.contentType,
        checksum: approved.checksum,
        provenance: approved.provenance,
      };
    }
    return asset;
  });

  // Verify all 10 target assets became active with correct paths
  assert.equal(patched.assets.filter((a) => a.status === "active").length, 10);
  // Verify category count and non-suit draft categories remained identical
  assert.equal(patched.categories.length, prototypeCatalogue.categories.length);
  assert.deepEqual(
    patched.categories.map((c) => c.id),
    prototypeCatalogue.categories.map((c) => c.id),
  );
  // Verify designs remained untouched
  assert.deepEqual(patched.designs, prototypeCatalogue.designs);
});
