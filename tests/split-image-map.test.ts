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

test("jacket fabric only shifts construction numbers by one", async () => {
  const resolved = await resolveSplitOutfitRecipe(JSON.stringify(DEFAULT_SPLIT_OUTFIT_STATE));
  const map = buildSplitImageMap(resolved, { ...none, jacket: true });
  assert.equal(map.fabrics.jacket, 2);
  assert.deepEqual(map.construction, { jacket: 3, trousers: 4, shirt: 5, waistcoat: null, shoes: 6 });
});

test("all four fabrics plus waistcoat freeze a 10-image map", async () => {
  const state: SplitOutfitState = {
    ...DEFAULT_SPLIT_OUTFIT_STATE,
    upperId: "SUIT_UPPER_THREE_PIECE",
    waistcoatId: "SUIT_WAISTCOAT_CLASSIC",
  };
  const resolved = await resolveSplitOutfitRecipe(JSON.stringify(state));
  const map = buildSplitImageMap(resolved, { jacket: true, trousers: true, shirt: true, waistcoat: true });
  assert.equal(map.fabrics.jacket, 2);
  assert.equal(map.fabrics.trousers, 3);
  assert.equal(map.fabrics.shirt, 4);
  assert.equal(map.fabrics.waistcoat, 5);
  assert.deepEqual(map.construction, { jacket: 6, trousers: 7, shirt: 8, waistcoat: 9, shoes: 10 });
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
  assert.match(withFabric, /Trousers \[Image 4 = cut; Image 2 = cloth — exact shade and texture of Image 2/);
  assert.ok(withFabric.includes(fabricFidelityOverride("trousers", 2, 4)));
  assert.match(withFabric, /weave, yarn, nap, pile, slub, pattern, pattern scale, sheen, finish/);
  assert.doesNotMatch(withFabric, /FINAL FABRIC APPLICATION OVERRIDE — SHIRT/);
});

test("jacket fabric override names the jacket only and does not recolour shoes", async () => {
  const resolved = await resolveSplitOutfitRecipe(JSON.stringify(DEFAULT_SPLIT_OUTFIT_STATE));
  const prompt = buildSplitOutfitPrompt(resolved, { ...none, jacket: true });
  assert.ok(prompt.includes(fabricFidelityOverride("jacket", 2, 3)));
  assert.match(prompt, /Footwear \[Image 6 = cut and cloth\]/);
  assert.doesNotMatch(prompt, /FINAL FABRIC APPLICATION OVERRIDE — FOOTWEAR/);
  assert.doesNotMatch(prompt, /the jacket and the trousers only/);
});
