import assert from "node:assert/strict";
import test from "node:test";
import { resolveSplitOutfitRecipe } from "@/lib/split-outfit/generation";
import { buildSplitImageMap, fabricFidelityOverride } from "@/lib/split-outfit/image-map";
import { buildSplitOutfitPrompt } from "@/lib/split-outfit/prompt";
import { DEFAULT_SPLIT_OUTFIT_STATE } from "@/lib/split-outfit/catalogue";
import type { SplitOutfitState } from "@/lib/split-outfit/types";

const none = { jacket: false, trousers: false, shirt: false, waistcoat: false };

test("no extra fabrics and no waistcoat numbers person then construction only", async () => {
  const resolved = await resolveSplitOutfitRecipe(JSON.stringify(DEFAULT_SPLIT_OUTFIT_STATE));
  const map = buildSplitImageMap(resolved, none);
  assert.equal(map.person, 1);
  assert.deepEqual(map.fabrics, { jacket: null, trousers: null, shirt: null, waistcoat: null });
  assert.deepEqual(map.construction, { jacket: 2, trousers: 3, shirt: 4, waistcoat: null, shoes: 5 });
  assert.equal(map.totalImages, 5);
});

test("jacket fabric is numbered after construction, not before it", async () => {
  const resolved = await resolveSplitOutfitRecipe(JSON.stringify(DEFAULT_SPLIT_OUTFIT_STATE));
  const map = buildSplitImageMap(resolved, { ...none, jacket: true });
  assert.equal(map.fabrics.jacket, 6);
  assert.deepEqual(map.construction, { jacket: 2, trousers: 3, shirt: 4, waistcoat: null, shoes: 5 });
});

test("all four fabrics plus waistcoat freeze a 10-image map with fabrics last", async () => {
  const state: SplitOutfitState = {
    ...DEFAULT_SPLIT_OUTFIT_STATE,
    upperId: "SUIT_UPPER_THREE_PIECE",
    waistcoatId: "SUIT_WAISTCOAT_CLASSIC",
  };
  const resolved = await resolveSplitOutfitRecipe(JSON.stringify(state));
  const map = buildSplitImageMap(resolved, { jacket: true, trousers: true, shirt: true, waistcoat: true });
  assert.deepEqual(map.construction, { jacket: 2, trousers: 3, shirt: 4, waistcoat: 5, shoes: 6 });
  assert.equal(map.fabrics.jacket, 7);
  assert.equal(map.fabrics.trousers, 8);
  assert.equal(map.fabrics.shirt, 9);
  assert.equal(map.fabrics.waistcoat, 10);
  assert.equal(map.totalImages, 10);
});

test("waistcoat fabric is omitted from the map when the recipe has no waistcoat", async () => {
  const resolved = await resolveSplitOutfitRecipe(JSON.stringify(DEFAULT_SPLIT_OUTFIT_STATE));
  const map = buildSplitImageMap(resolved, { ...none, waistcoat: true });
  assert.equal(map.fabrics.waistcoat, null);
  assert.equal(map.construction.waistcoat, null);
  assert.equal(map.totalImages, 5);
});

test("shirt with no fabric binds to the shirt construction image including white default", async () => {
  const resolved = await resolveSplitOutfitRecipe(JSON.stringify(DEFAULT_SPLIT_OUTFIT_STATE));
  const prompt = buildSplitOutfitPrompt(resolved, none);
  assert.match(prompt, /Shirt \[Image 4 = cut and cloth\] — including white/);
  assert.doesNotMatch(prompt, /physical showroom fabric for the shirt/);
});

test("denim without trouser fabric keeps jean cloth; with fabric gets a per-piece shade/texture override", async () => {
  const denimState: SplitOutfitState = { ...DEFAULT_SPLIT_OUTFIT_STATE, lowerId: "SUIT_LOWER_DENIM" };
  const resolved = await resolveSplitOutfitRecipe(JSON.stringify(denimState));
  const without = buildSplitOutfitPrompt(resolved, none);
  const withFabric = buildSplitOutfitPrompt(resolved, { ...none, trousers: true });
  assert.match(without, /Denim jeans — not tailored suit trousers/);
  assert.match(without, /Trousers \[Image 3 = cut and cloth\]/);
  assert.doesNotMatch(without, /FINAL FABRIC APPLICATION OVERRIDE — TROUSERS/);
  assert.match(withFabric, /Trousers \[Image 3 = cut; Image 6 = cloth — exact shade and texture of Image 6/);
  assert.ok(withFabric.includes(fabricFidelityOverride("trousers", 6, 3)));
  assert.match(withFabric, /CUT TEMPLATE/);
  assert.match(withFabric, /discard its original colour, wash, and cloth entirely/i);
  assert.match(withFabric, /weave, yarn, nap, pile, slub, pattern, pattern scale, sheen, finish/);
  assert.doesNotMatch(withFabric, /FINAL FABRIC APPLICATION OVERRIDE — SHIRT/);
});

test("jacket fabric override names the jacket only and does not recolour shoes", async () => {
  const resolved = await resolveSplitOutfitRecipe(JSON.stringify(DEFAULT_SPLIT_OUTFIT_STATE));
  const prompt = buildSplitOutfitPrompt(resolved, { ...none, jacket: true });
  assert.ok(prompt.includes(fabricFidelityOverride("jacket", 6, 2)));
  assert.match(prompt, /Footwear \[Image 5 = cut and cloth\]/);
  assert.doesNotMatch(prompt, /FINAL FABRIC APPLICATION OVERRIDE — FOOTWEAR/);
  assert.doesNotMatch(prompt, /the jacket and the trousers only/);
});

test("three-piece jacket prompt isolates jacket buttons from the full-ensemble construction photo", async () => {
  const state: SplitOutfitState = {
    ...DEFAULT_SPLIT_OUTFIT_STATE,
    upperId: "SUIT_UPPER_THREE_PIECE",
    waistcoatId: "SUIT_WAISTCOAT_CLASSIC",
  };
  const resolved = await resolveSplitOutfitRecipe(JSON.stringify(state));
  const prompt = buildSplitOutfitPrompt(resolved, none);
  assert.match(prompt, /CONSTRUCTION PHOTO ISOLATION/);
  assert.match(prompt, /exactly two front buttons in one vertical column/);
  assert.match(prompt, /never two buttons stacked in the same spot/);
  assert.match(prompt, /one button per hole/);
});
