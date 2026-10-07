import assert from "node:assert/strict";
import test from "node:test";
import { applyCatalogueAvailability } from "../lib/catalog/availability";
import { DEFAULT_LEVEL1_CATALOGUE } from "../lib/catalog/level1-seed";
import { getLevel1CatalogueView } from "../lib/catalog/level1-store";

test("availability checks deduplicate objects, bound concurrency, and preserve recovered variants", async () => {
  const catalogue = structuredClone(DEFAULT_LEVEL1_CATALOGUE);
  const before = JSON.stringify(catalogue);
  const view = await getLevel1CatalogueView();
  const calls = new Set<string>();
  let active = 0, peak = 0;
  const result = await applyCatalogueAvailability(catalogue, view, async path => {
    assert.equal(calls.has(path), false);
    calls.add(path); active++; peak = Math.max(peak, active);
    await new Promise(resolve => setImmediate(resolve)); active--;
    return path.includes("SUIT_06_THREE_BUTTON/") || path.includes("/variants/three-button.png");
  });
  assert.ok(peak <= 8);
  const classic = result.designs.find(d => d.id === "SUIT_01_CLASSIC")!;
  assert.equal(classic.cardImage.url, undefined);
  assert.equal(classic.generation.state, "awaiting-approved-reference");
  assert.equal(classic.variants?.find(v => v.id.includes("THREE_BUTTON") || v.id.includes("three-button"))?.generation.state, "ready");
  assert.equal(result.designs.find(d => d.id === "SUIT_06_THREE_BUTTON")?.generation.state, "ready");
  assert.equal(JSON.stringify(catalogue), before);
});

test("storage errors never advertise unavailable references as ready", async () => {
  const view = await getLevel1CatalogueView();
  const result = await applyCatalogueAvailability(DEFAULT_LEVEL1_CATALOGUE, view, async () => { throw new Error("AccessDenied"); });
  assert.ok(result.designs.every(d => !d.cardImage.url && d.generation.state === "awaiting-approved-reference"));
  assert.ok(result.designs.every(d => d.variants?.every(v => !v.cardImage.url && v.generation.state === "awaiting-approved-reference") ?? true));
});
