import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_LEVEL1_CATALOGUE } from "@/lib/catalog/level1-seed";

test("authoritative seed contains all 10 active Suit, 10 active Sherwani, 10 active Bandhgala, 12 active Nehru Jacket, 10 active Kurta Set, 10 active Indo-Western, and 10 active Achkan asset records with valid 64-char SHA-256 hashes", () => {
  const targetSuitIds = [
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

  const targetSherwaniIds = [
    "SHERWANI_01_CLASSIC_CARD_V1",
    "SHERWANI_01_CLASSIC_PRIMARY_V1",
    "SHERWANI_02_LAYERED_CARD_V1",
    "SHERWANI_02_LAYERED_PRIMARY_V1",
    "SHERWANI_03_JODHPURI_CARD_V1",
    "SHERWANI_03_JODHPURI_PRIMARY_V1",
    "SHERWANI_04_ASYMMETRIC_CARD_V1",
    "SHERWANI_04_ASYMMETRIC_PRIMARY_V1",
    "SHERWANI_05_ROYAL_CARD_V1",
    "SHERWANI_05_ROYAL_PRIMARY_V1",
  ];

  const targetBandhgalaIds = [
    "BANDHGALA_01_CLASSIC_CARD_V1",
    "BANDHGALA_01_CLASSIC_PRIMARY_V1",
    "BANDHGALA_02_DOUBLE_BREASTED_CARD_V1",
    "BANDHGALA_02_DOUBLE_BREASTED_PRIMARY_V1",
    "BANDHGALA_03_VELVET_CARD_V1",
    "BANDHGALA_03_VELVET_PRIMARY_V1",
    "BANDHGALA_04_TEXTURED_CARD_V1",
    "BANDHGALA_04_TEXTURED_PRIMARY_V1",
    "BANDHGALA_05_STATEMENT_CARD_V1",
    "BANDHGALA_05_STATEMENT_PRIMARY_V1",
  ];

  const targetNehruIds = [
    "NEHRU_01_CLASSIC_CARD_V1",
    "NEHRU_01_CLASSIC_PRIMARY_V1",
    "NEHRU_02_FORMAL_CARD_V1",
    "NEHRU_02_FORMAL_PRIMARY_V1",
    "NEHRU_03_TEXTURED_CARD_V1",
    "NEHRU_03_TEXTURED_PRIMARY_V1",
    "NEHRU_04_CONTEMPORARY_CARD_V1",
    "NEHRU_04_CONTEMPORARY_PRIMARY_V1",
    "NEHRU_05_STATEMENT_CARD_V1",
    "NEHRU_05_STATEMENT_PRIMARY_V1",
    "NEHRU_06_CARD_V1",
    "NEHRU_06_PRIMARY_V1",
  ];

  const targetKurtaIds = [
    "KURTA_01_CLASSIC_CARD_V1",
    "KURTA_01_CLASSIC_PRIMARY_V1",
    "KURTA_02_PATHANI_CARD_V1",
    "KURTA_02_PATHANI_PRIMARY_V1",
    "KURTA_03_LAYERED_CARD_V1",
    "KURTA_03_LAYERED_PRIMARY_V1",
    "KURTA_04_FESTIVE_CARD_V1",
    "KURTA_04_FESTIVE_PRIMARY_V1",
    "KURTA_05_CONTEMPORARY_CARD_V1",
    "KURTA_05_CONTEMPORARY_PRIMARY_V1",
  ];

  const targetIndoIds = [
    "INDO_01_CLASSIC_CARD_V1",
    "INDO_01_CLASSIC_PRIMARY_V1",
    "INDO_02_ASYMMETRIC_CARD_V1",
    "INDO_02_ASYMMETRIC_PRIMARY_V1",
    "INDO_03_LAYERED_CARD_V1",
    "INDO_03_LAYERED_PRIMARY_V1",
    "INDO_04_DRAPED_CARD_V1",
    "INDO_04_DRAPED_PRIMARY_V1",
    "INDO_05_STATEMENT_CARD_V1",
    "INDO_05_STATEMENT_PRIMARY_V1",
  ];

  const targetAchkanIds = [
    "ACHKAN_01_CLASSIC_CARD_V1",
    "ACHKAN_01_CLASSIC_PRIMARY_V1",
    "ACHKAN_02_JODHPURI_CARD_V1",
    "ACHKAN_02_JODHPURI_PRIMARY_V1",
    "ACHKAN_03_ASYMMETRIC_CARD_V1",
    "ACHKAN_03_ASYMMETRIC_PRIMARY_V1",
    "ACHKAN_04_EMBROIDERED_CARD_V1",
    "ACHKAN_04_EMBROIDERED_PRIMARY_V1",
    "ACHKAN_05_ROYAL_CARD_V1",
    "ACHKAN_05_ROYAL_PRIMARY_V1",
  ];

  const allTargetIds = [
    ...targetSuitIds,
    ...targetSherwaniIds,
    ...targetBandhgalaIds,
    ...targetNehruIds,
    ...targetKurtaIds,
    ...targetIndoIds,
    ...targetAchkanIds,
  ];

  const assetMap = new Map(DEFAULT_LEVEL1_CATALOGUE.assets.map((a) => [a.id, a]));
  for (const id of allTargetIds) {
    const asset = assetMap.get(id);
    assert.ok(asset, `Asset ${id} must exist in default catalogue.`);
    assert.equal(asset.status, "active");
    assert.ok(asset.contentType === "image/png" || asset.contentType === "image/jpeg");
    assert.ok(asset.privatePath?.startsWith("nasir-bespoke/catalogue/level1/v1/"));
    assert.ok(asset.checksum, `Asset ${id} must have a checksum.`);
    assert.equal(asset.checksum.length, 64, `Asset ${id} checksum must be exactly 64 characters.`);
    assert.match(asset.checksum, /^[0-9a-f]{64}$/i, `Asset ${id} checksum must be valid hexadecimal.`);
  }

  // Specifically verify Double-Breasted Suit checksum
  const dbCard = assetMap.get("SUIT_04_DOUBLE_BREASTED_CARD_V1");
  assert.equal(dbCard?.checksum, "6f34662fb556da3a55f3a214955d5d21e0fd4020d5172433bad0e3ee9ddb958d");

  // Verify Sherwani checksums
  const classicSherwaniCard = assetMap.get("SHERWANI_01_CLASSIC_CARD_V1");
  assert.equal(classicSherwaniCard?.checksum, "6367319e1185577bf90b186dfd163644287a62edf3fa24347b993a1d13b22eca");

  // Verify Bandhgala checksums
  const classicBandhgalaCard = assetMap.get("BANDHGALA_01_CLASSIC_CARD_V1");
  assert.equal(classicBandhgalaCard?.checksum, "bf2064b0c1dd77be16a37d39a393577285b5ed21e63842fe1bce831b6652f8cc");

  // Verify Nehru Jacket checksums
  const classicNehruCard = assetMap.get("NEHRU_01_CLASSIC_CARD_V1");
  assert.equal(classicNehruCard?.checksum, "3152976c51e3f99c47a964daf7ea0bb5971ae694b4e07f008f977fce88dfc27c");

  // Verify Kurta Set checksums
  const classicKurtaCard = assetMap.get("KURTA_01_CLASSIC_CARD_V1");
  assert.equal(classicKurtaCard?.checksum, "121f7986b606c2b2cb0720dc8aed72423bd61734628af1b18ed51120b2c6ef6c");

  // Verify Indo-Western checksums
  const classicIndoCard = assetMap.get("INDO_01_CLASSIC_CARD_V1");
  assert.equal(classicIndoCard?.checksum, "80d01ff2629bad975d73dc36c3325212434aa4f9f431a91e36df5235594404b7");

  // Verify Achkan checksums
  const classicAchkanCard = assetMap.get("ACHKAN_01_CLASSIC_CARD_V1");
  assert.equal(classicAchkanCard?.checksum, "1612ea8836a1cef3096271f4b8b6e451d343f2edaffa475797d4e2fbd02650d1");
  const jodhpurAchkanCard = assetMap.get("ACHKAN_02_JODHPURI_CARD_V1");
  assert.equal(jodhpurAchkanCard?.checksum, "aaa5c6470613edd7c01e31f9b238da6937a4ce3d06eba52553bf910df273f88b");
  const royalAchkanCard = assetMap.get("ACHKAN_05_ROYAL_CARD_V1");
  assert.equal(royalAchkanCard?.checksum, "1b8acde57768b600ae6b697d51aaf52c135364e5ec4fa5751161a345235a3f2d");
});

test("migration patch correctly transforms awaiting-upload assets to active without touching unrelated categories", () => {
  const prototypeCatalogue = structuredClone(DEFAULT_LEVEL1_CATALOGUE);
  prototypeCatalogue.assets = prototypeCatalogue.assets.map((asset) => ({
    ...asset,
    status: "awaiting-upload" as const,
    privatePath: undefined,
    contentType: undefined,
    checksum: undefined,
    provenance: undefined,
  }));

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

  // Verify all 72 target assets became active with correct paths
  assert.equal(patched.assets.filter((a) => a.status === "active").length, 72);
  assert.equal(patched.categories.length, prototypeCatalogue.categories.length);
  assert.deepEqual(
    patched.categories.map((c) => c.id),
    prototypeCatalogue.categories.map((c) => c.id),
  );
  assert.deepEqual(patched.designs, prototypeCatalogue.designs);
});

test("all 7 categories are fully active with 70 active assets and 0 remaining draft slots", () => {
  const activeCategories = DEFAULT_LEVEL1_CATALOGUE.categories.filter((c) => c.status === "active");
  assert.equal(activeCategories.length, 7, "All 7 categories must be active");

  const draftCategories = DEFAULT_LEVEL1_CATALOGUE.categories.filter((c) => c.status === "draft");
  assert.equal(draftCategories.length, 0, "There should be 0 draft categories remaining");

  const activeDesigns = DEFAULT_LEVEL1_CATALOGUE.designs.filter((d) => d.status === "active");
  assert.equal(activeDesigns.length, 36, "All 36 designs must be active");

  const activeAssets = DEFAULT_LEVEL1_CATALOGUE.assets.filter((a) => a.status === "active");
  assert.equal(activeAssets.length, 72, "All 72 assets must be active");

  const awaitingAssets = DEFAULT_LEVEL1_CATALOGUE.assets.filter((a) => a.status === "awaiting-upload");
  assert.equal(awaitingAssets.length, 0, "No assets should be awaiting upload");
});
