import assert from "node:assert/strict";
import test from "node:test";
import { adjacentStep, buildBuilderRows, missingSteps, type BuilderRowInput } from "@/lib/split-outfit/builder-steps";
import { DEFAULT_SPLIT_OUTFIT_STATE } from "@/lib/split-outfit/catalogue";

const empty = { ...DEFAULT_SPLIT_OUTFIT_STATE, upperId: null, lowerId: null, shirtId: null, waistcoatId: null, footwearId: null, accessoryIds: [] };
const base: BuilderRowInput = { state: empty, names: {}, accessoryNames: [], personPreview: null, fabricPreviews: { jacket: null, trousers: null, shirt: null, waistcoat: null }, trousersLinked: false, visited: new Set(), current: "jacket" };

test("rows follow the approved step order and labels", () => {
  assert.deepEqual(buildBuilderRows(base).map(r => [r.number, r.label]), [[1, "Customer photo"], [2, "Jacket"], [3, "Trousers"], [4, "Shirt & waistcoat"], [5, "Shoes"], [6, "Extras"], [7, "Review & generate"]]);
});

test("rows for an empty recipe have no ticks", () => {
  assert.ok(buildBuilderRows(base).every(r => !r.complete));
});

test("only the current step is marked current", () => {
  assert.deepEqual(buildBuilderRows({ ...base, current: "trousers" }).filter(r => r.current).map(r => r.id), ["trousers"]);
});

test("a jacket with uploaded cloth shows its name and image swatch", () => {
  const row = buildBuilderRows({ ...base, state: { ...empty, upperId: "SUIT_UPPER_CLASSIC" }, names: { upper: "Classic" }, fabricPreviews: { ...base.fabricPreviews, jacket: "blob:j" } }).find(r => r.id === "jacket")!;
  assert.deepEqual([row.complete, row.detail, row.swatch], [true, "Classic", { kind: "image", url: "blob:j" }]);
});

test("linked trousers borrow the jacket swatch", () => {
  const row = buildBuilderRows({ ...base, state: { ...empty, lowerId: "SUIT_LOWER_NON_PLEATED" }, trousersLinked: true, fabricPreviews: { ...base.fabricPreviews, jacket: "blob:j" } }).find(r => r.id === "trousers")!;
  assert.deepEqual(row.swatch, { kind: "linked", url: "blob:j" });
});

test("a chosen piece without cloth shows the reference mark", () => {
  const row = buildBuilderRows({ ...base, state: { ...empty, shirtId: "SUIT_SHIRT_CLASSIC_FORMAL" } }).find(r => r.id === "inner")!;
  assert.deepEqual(row.swatch, { kind: "reference" });
});

test("inner row detail drops a removed waistcoat", () => {
  const withWaistcoat = buildBuilderRows({ ...base, state: { ...empty, shirtId: "SUIT_SHIRT_CLASSIC_FORMAL", waistcoatId: "SUIT_WAISTCOAT_CLASSIC" }, names: { shirt: "Classic Formal", waistcoat: "Classic" } }).find(r => r.id === "inner")!;
  const without = buildBuilderRows({ ...base, state: { ...empty, shirtId: "SUIT_SHIRT_CLASSIC_FORMAL", waistcoatId: "SUIT_WAISTCOAT_NONE" }, names: { shirt: "Classic Formal", waistcoat: "None" } }).find(r => r.id === "inner")!;
  assert.equal(withWaistcoat.detail, "Classic Formal + Classic waistcoat");
  assert.deepEqual([without.detail, without.complete], ["Classic Formal", true]);
});

test("extras tick once visited or chosen", () => {
  assert.equal(buildBuilderRows({ ...base, visited: new Set(["extras"]) }).find(r => r.id === "extras")!.complete, true);
  const chosen = buildBuilderRows({ ...base, state: { ...empty, accessoryIds: ["SUIT_ACC_TIE"] }, accessoryNames: ["Tie"] }).find(r => r.id === "extras")!;
  assert.deepEqual([chosen.complete, chosen.detail], [true, "Tie"]);
});

test("missing steps lists required gaps in step order", () => {
  assert.deepEqual(missingSteps(empty, false), ["customer", "jacket", "trousers", "inner", "shoes"]);
  assert.deepEqual(missingSteps({ ...empty, upperId: "a", lowerId: "b", shirtId: "c", footwearId: "d" }, true), []);
});

test("adjacent step stops at both ends", () => {
  assert.deepEqual([adjacentStep("customer", -1), adjacentStep("customer", 1), adjacentStep("review", 1)], [null, "jacket", null]);
});
