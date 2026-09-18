import assert from "node:assert/strict";
import test from "node:test";
import { restoreLookFromGeneration } from "@/lib/history/restore-look";

test("restores a split history row into workspace state", () => {
  const look = restoreLookFromGeneration({
    mode: "split",
    splitFamily: "suit",
    splitUpperId: "SUIT_UPPER_CLASSIC",
    splitLowerId: "SUIT_LOWER_CLASSIC_STRAIGHT",
    splitShirtId: "SUIT_SHIRT_CLASSIC_FORMAL",
    splitWaistcoatId: "SUIT_WAISTCOAT_NONE",
    splitFootwearId: "SUIT_SHOE_OXFORD",
    splitAccessoryIds: ["SUIT_ACC_POCKET_SQUARE"],
    fabricRegion: "upper",
  });
  assert.equal(look.kind, "split");
  if (look.kind !== "split") return;
  assert.deepEqual(look.state, {
    family: "suit",
    upperId: "SUIT_UPPER_CLASSIC",
    lowerId: "SUIT_LOWER_CLASSIC_STRAIGHT",
    shirtId: "SUIT_SHIRT_CLASSIC_FORMAL",
    waistcoatId: "SUIT_WAISTCOAT_NONE",
    footwearId: "SUIT_SHOE_OXFORD",
    accessoryIds: ["SUIT_ACC_POCKET_SQUARE"],
  });
  assert.equal(look.fabricRegion, "upper");
});

test("restores a Level 1 history row, forcing jacket region for the Jackets category", () => {
  const look = restoreLookFromGeneration({
    mode: "level1",
    categoryId: "jackets",
    curatedDesignId: "JACKET_01_HUNTER",
    curatedVariantId: "any-variant",
    fabricRegion: "both",
  });
  assert.equal(look.kind, "level1");
  if (look.kind !== "level1") return;
  assert.equal(look.categoryId, "jackets");
  assert.equal(look.designId, "JACKET_01_HUNTER");
  assert.equal(look.variantId, "any-variant");
  assert.equal(look.fabricRegion, "jacket");
});

test("rejects incomplete or unknown history rows rather than inventing a look", () => {
  assert.equal(restoreLookFromGeneration(undefined).kind, "unsupported");
  assert.equal(restoreLookFromGeneration({ mode: "outfit" }).kind, "unsupported");
  assert.equal(restoreLookFromGeneration({ mode: "split", splitFamily: "suit" }).kind, "unsupported");
  assert.equal(restoreLookFromGeneration({
    mode: "split",
    splitFamily: "not-a-family",
    splitUpperId: "SUIT_UPPER_CLASSIC",
    splitLowerId: "SUIT_LOWER_CLASSIC_STRAIGHT",
    splitShirtId: "SUIT_SHIRT_CLASSIC_FORMAL",
    splitFootwearId: "SUIT_SHOE_OXFORD",
  }).kind, "unsupported");
  assert.equal(restoreLookFromGeneration({ mode: "level1", categoryId: "suit" }).kind, "unsupported");
});
