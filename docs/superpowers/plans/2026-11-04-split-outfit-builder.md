# Split Outfit Step-by-Step Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the long single-page Split Outfit workspace with an iPad-first step-by-step builder (combined step list/summary on the left) and add a "Show customer" result view, without changing what is sent to the image model.

**Architecture:** Pure helpers in `lib/` (step model, extended result summary, session result store) are built test-first with `node:test`. React components in `components/split-outfit/` render one step at a time from the existing `SplitOutfitState`, fabric state and catalogue view already owned by `TryOnApp.tsx`. UI behaviour is verified by extending the existing Playwright browser check, which uses synthetic fixtures and makes no paid calls.

**Tech Stack:** Next.js 16.3 App Router, React 19.2, TypeScript 5.9, plain CSS in `app/globals.css`, `node:test` via `tsx`, Playwright browser check (`scripts/check-improvement-browser.mjs`).

**Spec:** `docs/superpowers/specs/2026-11-04-split-outfit-builder-design.md`

## Global Constraints

- No change to the request sent to `/api/try-on`, the prompt, image order, upload roles, recipe validation, idempotency or History storage.
- Full Outfit flow unchanged except the shared top-of-page mode placement.
- Read the relevant guide in `node_modules/next/dist/docs/` before writing Next.js code (`AGENTS.md`).
- No new dependencies.
- Keep existing Midnight Atelier tokens in `app/globals.css`; no new palette.
- Touch targets at least 44×44 px with at least 8 px between adjacent targets; text contrast at least 4.5:1.
- Respect `prefers-reduced-motion` for every transition and highlight.
- Split Outfit stays behind the existing `splitOutfitEnabled` flag and `ModeSelector`.
- Customer view disclaimer copy, verbatim: `AI visual reference — not an exact match of the cloth.`
- Changed-draft note copy, verbatim: `The outfit has changed since this result`
- Session result cap: 6 (oldest released first).
- Paid image calls are not authorized; all tests and browser checks use synthetic fixtures.
- Work on branch `feat/split-outfit-builder`; never commit to `main`.

## Review Focus

1. **Family switched while on a later step:** the recipe resets (existing behaviour); the builder must jump to the Jacket step and every garment row must lose its tick. Pinned in Task 1 (`rows for an empty recipe have no ticks`) and Task 6 (browser step).
2. **Rules engine removes a waistcoat after the jacket changes:** the Shirt & waistcoat row must drop the waistcoat from its detail and stay ticked only if a shirt remains. Pinned in Task 1 (`inner row detail drops a removed waistcoat`).
3. **Cloth replaced or removed after a result:** the shown result and the customer card must keep the cloth swatches that were actually submitted. Pinned in Task 3 (`session swatches survive later fabric changes`).
4. **Older pending records saved before this change (no `cloth`, `customerLabel` or `accessories`):** they must still parse and display with today's wording. Pinned in Task 2 (`legacy pending summary still parses`).
5. **Recovered result after a reload with no local cloth files:** the customer view must show neutral "house cloth" marks, never a broken image. Pinned in Task 3 (`recovered results carry no swatches`) and Task 7 (browser step).

---

### Task 0: Branch

- [ ] **Step 1: Create the branch from up-to-date main**

```bash
git switch main && git pull --ff-only && git switch -c feat/split-outfit-builder
```

Expected: `Switched to a new branch 'feat/split-outfit-builder'`. Commit the spec and this plan as the first commit:

```bash
git add docs/superpowers && git commit -m "docs: add split outfit builder design and plan

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 1: Builder step model

**Files:**
- Create: `lib/split-outfit/builder-steps.ts`
- Test: `tests/split-builder.test.ts`
- Modify: `package.json` (append `tests/split-builder.test.ts` to the `test:catalog` file list)

**Interfaces:**
- Consumes: `SplitOutfitState` from `lib/split-outfit/types.ts`.
- Produces:
  - `type BuilderStepId = "customer" | "jacket" | "trousers" | "inner" | "shoes" | "extras" | "review"`
  - `const BUILDER_STEPS: readonly { id: BuilderStepId; label: string }[]` with labels, in order: `Customer photo`, `Jacket`, `Trousers`, `Shirt & waistcoat`, `Shoes`, `Extras`, `Review & generate`
  - `type RowSwatch = { kind: "image"; url: string } | { kind: "linked"; url: string } | { kind: "reference" } | null`
  - `type BuilderRowInput = { state: SplitOutfitState; names: Partial<Record<"upper" | "lower" | "shirt" | "waistcoat" | "footwear", string>>; accessoryNames: string[]; personPreview: string | null; fabricPreviews: Record<"jacket" | "trousers" | "shirt" | "waistcoat", string | null>; trousersLinked: boolean; visited: ReadonlySet<BuilderStepId>; current: BuilderStepId }`
  - `type BuilderRow = { id: BuilderStepId; label: string; number: number; complete: boolean; current: boolean; detail: string | null; swatch: RowSwatch }`
  - `buildBuilderRows(input: BuilderRowInput): BuilderRow[]`
  - `missingSteps(state: SplitOutfitState, hasPerson: boolean): BuilderStepId[]`
  - `adjacentStep(current: BuilderStepId, direction: 1 | -1): BuilderStepId | null`

Rules the tests pin: complete = customer: person preview present; jacket: `upperId`; trousers: `lowerId`; inner: `shirtId`; shoes: `footwearId`; extras: visited or at least one accessory; review: never. A real waistcoat is any `waistcoatId` other than `null` and `SUIT_WAISTCOAT_NONE`.

- [ ] **Step 1: Write the failing tests**

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `NODE_ENV=test NODE_OPTIONS=--conditions=react-server node --import=tsx --test tests/split-builder.test.ts`
Expected: FAIL, cannot find module `@/lib/split-outfit/builder-steps`.

- [ ] **Step 3: Implement `lib/split-outfit/builder-steps.ts` with the signatures above**

Pure module, no React, no server-only imports. Inner detail is `"<shirt> + <waistcoat> waistcoat"` only when a real waistcoat is chosen. Extras detail is `accessoryNames.join(", ")` or `null`.

- [ ] **Step 4: Run tests to verify they pass**

Same command. Expected: all 10 pass.

- [ ] **Step 5: Register the file in `test:catalog` and run `npm run test:catalog`**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/split-outfit/builder-steps.ts tests/split-builder.test.ts package.json
git commit -m "feat(split): add builder step model

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Customer-ready result summary

**Files:**
- Modify: `lib/result-summary.ts`
- Modify: `lib/pending-generation.ts` (`parsePendingGeneration`)
- Test: `tests/client-flow.test.ts` (append)

**Interfaces:**
- Produces:
  - `type PieceCloth = "uploaded" | "linked-to-jacket" | "reference"`
  - `ResultSummary.pieces[]` gains optional `cloth?: PieceCloth` and `customerLabel?: string`
  - `ResultSummary` gains optional `accessories?: string[]`
  - `summaryDiffers(submitted: ResultSummary, draft: ResultSummary): boolean`, true when piece `label`/`design`/`cloth` lists or accessories differ.
- `buildResultSummary` split branch fills these. Customer labels: `"<design> <label lowercased>"`, plus `" · your cloth"` for uploaded and `" · same cloth as jacket"` for linked. Shoes become `"<design> shoes"`. Accessories are the catalogue names of `accessoryIds`.

- [ ] **Step 1: Write the failing tests**

```ts
test("split summary carries customer labels, cloth sources and accessories", () => {
  const summary = buildResultSummary({ mode: "split", splitOutfit: { ...DEFAULT_SPLIT_OUTFIT_STATE, upperId: "SUIT_UPPER_CLASSIC", lowerId: "SUIT_LOWER_NON_PLEATED", shirtId: "SUIT_SHIRT_CLASSIC_FORMAL", footwearId: "SUIT_SHOE_OXFORD", accessoryIds: ["SUIT_ACC_TIE"] }, hasUploadedFabric: true, fabrics: { jacket: true, trousers: true }, trousersLinked: true });
  assert.deepEqual(summary.pieces?.map(p => [p.cloth, p.customerLabel]), [["uploaded", "Classic jacket · your cloth"], ["linked-to-jacket", "Non-pleated trousers · same cloth as jacket"], ["reference", "Classic Formal shirt"], ["reference", "Oxford shoes"]]);
  assert.deepEqual(summary.accessories, ["Tie"]);
});

test("summaryDiffers detects a changed piece, cloth or accessory", () => {
  const a = buildResultSummary({ mode: "split", splitOutfit: { ...DEFAULT_SPLIT_OUTFIT_STATE, upperId: "SUIT_UPPER_CLASSIC" }, hasUploadedFabric: false, fabrics: {} });
  assert.equal(summaryDiffers(a, a), false);
  assert.equal(summaryDiffers(a, buildResultSummary({ mode: "split", splitOutfit: { ...DEFAULT_SPLIT_OUTFIT_STATE, upperId: "SUIT_UPPER_TUXEDO" }, hasUploadedFabric: false, fabrics: {} })), true);
  assert.equal(summaryDiffers(a, buildResultSummary({ mode: "split", splitOutfit: { ...DEFAULT_SPLIT_OUTFIT_STATE, upperId: "SUIT_UPPER_CLASSIC" }, hasUploadedFabric: true, fabrics: { jacket: true } })), true);
});

test("pending summary round-trips the new fields", () => {
  const summary = buildResultSummary({ mode: "split", splitOutfit: { ...DEFAULT_SPLIT_OUTFIT_STATE, upperId: "SUIT_UPPER_CLASSIC", accessoryIds: ["SUIT_ACC_TIE"] }, hasUploadedFabric: true, fabrics: { jacket: true } });
  const now = Date.now();
  const parsed = parsePendingGeneration(JSON.stringify({ key: "123e4567-e89b-42d3-a456-426614174000", createdAt: now - 1000, summary }), now);
  assert.deepEqual(parsed?.summary, JSON.parse(JSON.stringify(summary)));
});

test("legacy pending summary still parses", () => {
  const now = Date.now();
  const legacy = { garment: "Classic", fabric: "Uploaded fabric", shoes: "Oxford", pieces: [{ label: "Jacket", design: "Classic", source: "Uploaded cloth" }] };
  const parsed = parsePendingGeneration(JSON.stringify({ key: "123e4567-e89b-42d3-a456-426614174000", createdAt: now - 1000, summary: legacy }), now);
  assert.deepEqual(parsed?.summary, legacy);
});

test("pending summary rejects an unknown cloth value or oversized accessories", () => {
  const now = Date.now();
  const make = (summary: unknown) => parsePendingGeneration(JSON.stringify({ key: "123e4567-e89b-42d3-a456-426614174000", createdAt: now - 1000, summary }), now);
  assert.equal(make({ garment: "g", fabric: "f", shoes: "s", pieces: [{ label: "Jacket", design: "C", source: "x", cloth: "silk" }] }), null);
  assert.equal(make({ garment: "g", fabric: "f", shoes: "s", accessories: ["a", "b", "c", "d", "e", "f"] }), null);
});
```

Add `summaryDiffers` and `parsePendingGeneration` to the test file's imports.

- [ ] **Step 2: Run to verify they fail**

Run: `NODE_ENV=test NODE_OPTIONS=--conditions=react-server node --import=tsx --test tests/client-flow.test.ts`
Expected: FAIL. `summaryDiffers` is not exported and the new fields are missing.

- [ ] **Step 3: Implement in `lib/result-summary.ts` and `lib/pending-generation.ts`**

Parser limits: `cloth` must be one of the three values. `customerLabel` is a string of at most 240 characters. `accessories` is an array of at most 5 strings, each at most 240 characters. Absent fields are omitted from the parsed result, so legacy records parse exactly as before.

- [ ] **Step 4: Run `npm run test:storage`**

Expected: PASS, including the existing pending and restore tests.

- [ ] **Step 5: Commit**

```bash
git add lib/result-summary.ts lib/pending-generation.ts tests/client-flow.test.ts
git commit -m "feat(split): carry customer labels and accessories in result summaries

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Session result store

**Files:**
- Create: `lib/session-results.ts`
- Test: `tests/session-results.test.ts`
- Modify: `package.json` (append the test to `test:storage`)

**Interfaces:**
- Consumes: `ResultSummary` (Task 2).
- Produces:
  - `type SwatchPiece = "jacket" | "trousers" | "shirt" | "waistcoat"`
  - `type SessionResult = { id: string; resultUrl: string; originalUrl: string; summary: ResultSummary; swatches: Partial<Record<SwatchPiece, string>>; ownedUrls: string[]; recovered: boolean }`
  - `const SESSION_RESULT_LIMIT = 6`
  - `addSessionResult(list: SessionResult[], item: SessionResult, revoke: (url: string) => void, limit?: number): SessionResult[]`: appends the newest last, drops the oldest beyond the limit and revokes the dropped item's `ownedUrls`
  - `releaseSessionResults(list: SessionResult[], revoke: (url: string) => void): SessionResult[]`: revokes every `ownedUrls` entry and returns `[]`
  - `submissionSwatches(input: { historyId?: string; files: Partial<Record<SwatchPiece, File | null>>; trousersLinked: boolean; createUrl: (file: File) => string }): { swatches: Partial<Record<SwatchPiece, string>>; ownedUrls: string[] }`. With a `historyId`, it uses `/api/history/<id>/asset/<fabric|lower-fabric|shirt-fabric|waistcoat-fabric>` and owns nothing. Without one, it creates one owned URL per present file. Linked trousers reuse the jacket entry and own nothing extra.

- [ ] **Step 1: Write the failing tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { addSessionResult, releaseSessionResults, submissionSwatches, SESSION_RESULT_LIMIT, type SessionResult } from "@/lib/session-results";

const item = (id: string, owned: string[] = []): SessionResult => ({ id, resultUrl: `r${id}`, originalUrl: `o${id}`, summary: { garment: "g", fabric: "f", shoes: "s" }, swatches: {}, ownedUrls: owned, recovered: false });

test("results append newest last and drop the oldest beyond the limit", () => {
  const revoked: string[] = [];
  let list: SessionResult[] = [];
  for (let i = 0; i <= SESSION_RESULT_LIMIT; i++) list = addSessionResult(list, item(String(i), [`blob:${i}`]), u => revoked.push(u));
  assert.equal(list.length, 6);
  assert.deepEqual([list[0].id, list[5].id, revoked], ["1", "6", ["blob:0"]]);
});

test("release revokes every owned url", () => {
  const revoked: string[] = [];
  assert.deepEqual(releaseSessionResults([item("a", ["blob:a"]), item("b", ["blob:b1", "blob:b2"])], u => revoked.push(u)), []);
  assert.deepEqual(revoked, ["blob:a", "blob:b1", "blob:b2"]);
});

test("stored history assets are used when a history id exists", () => {
  const out = submissionSwatches({ historyId: "h1", files: { jacket: new File([], "j"), shirt: new File([], "s") }, trousersLinked: true, createUrl: () => "blob:x" });
  assert.deepEqual(out, { swatches: { jacket: "/api/history/h1/asset/fabric", trousers: "/api/history/h1/asset/fabric", shirt: "/api/history/h1/asset/shirt-fabric" }, ownedUrls: [] });
});

test("session swatches survive later fabric changes", () => {
  let n = 0;
  const out = submissionSwatches({ files: { jacket: new File([], "j") }, trousersLinked: false, createUrl: () => `blob:own${n++}` });
  assert.deepEqual(out, { swatches: { jacket: "blob:own0" }, ownedUrls: ["blob:own0"] });
});

test("recovered results carry no swatches", () => {
  assert.deepEqual(submissionSwatches({ files: {}, trousersLinked: false, createUrl: () => "blob:never" }), { swatches: {}, ownedUrls: [] });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `NODE_ENV=test NODE_OPTIONS=--conditions=react-server node --import=tsx --test tests/session-results.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `lib/session-results.ts` with the signatures above.** Pure, no React.

- [ ] **Step 4: Register in `test:storage` and run `npm run test:storage`.** Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/session-results.ts tests/session-results.test.ts package.json
git commit -m "feat(split): add session result store

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Keep results across edits and Try Again (Split mode)

**Files:**
- Modify: `components/TryOnApp.tsx`: `clearResult` (≈L189), `reconcilePending` (≈L211), `generate`/`showResult` (≈L336–362), `changeSplitFabric`/`removeSplitFabric`/`reuseJacketOnTrousers` (≈L480–523), `restoreLook` (≈L525), `startOver` (≈L550)
- Modify: `components/TryOnResult.tsx` (accept an optional `notice?: string` rendered above the image)

**Interfaces:**
- Consumes: `addSessionResult`, `releaseSessionResults`, `submissionSwatches` (Task 3) and `summaryDiffers` (Task 2).
- Produces, used by Tasks 6 and 7, held in `TryOnApp`:
  - `sessionResults: SessionResult[]` state
  - `latestResult = sessionResults.at(-1) ?? null`
  - `draftChanged: boolean`, which is `summaryDiffers(latestResult.summary, <summary built from the current draft>)` in Split mode

Behaviour:
- **Split mode:** `generate` no longer calls `clearResult()`. On success it appends a `SessionResult`. Its id is the generation id, or the history id parsed from `resultUrl`. Its swatches come from `submissionSwatches`, using the files submitted for that generation.
- **Split fabric handlers:** they no longer clear the result.
- **Restoring a look from History:** it no longer clears session results and is never added to them.
- **Pending recovery:** it appends with `recovered: true` and empty swatches.
- **Start Over and Logout:** both call `releaseSessionResults`. Logout goes through `startOver` before navigation. If `LogoutButton` navigates first, release on `pagehide`.
- **Full mode:** unchanged. Generating releases previous session results first and shows only the newest.
- **Shown result:** `TryOnResult` renders `latestResult`. In Split mode it passes `notice="The outfit has changed since this result"` when `draftChanged`.

- [ ] **Step 1: Make the changes above**

- [ ] **Step 2: Run `npm run verify`**

Expected: lint, typecheck and all tests pass.

- [ ] **Step 3: Commit**

```bash
git add components/TryOnApp.tsx components/TryOnResult.tsx
git commit -m "feat(split): keep session results across edits and Try Again

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Scannable option cards

**Files:**
- Modify: `components/split-outfit/SplitComponentCard.tsx`
- Modify: `app/globals.css` (card styles)

**Interfaces:**
- Props are unchanged. Visible: photo, name, subtitle, selected state and compatibility badge. `customer.description` and `customer.details` move into a `<details>` labelled "Details", which sits outside the select button so opening it never selects the card.
- If the reference image is missing or fires `onError`, render a neutral placeholder block showing the piece name. Never show alt text over an empty box.

- [ ] **Step 1: Implement**
- [ ] **Step 2: Run `npm run verify`.** Expected: PASS.
- [ ] **Step 3: Commit** with message `feat(split): simplify option cards with details disclosure`.

---

### Task 6: Step-by-step builder

**Files:**
- Create: `components/split-outfit/BuilderStepList.tsx`. Left list on wide screens. A collapsed bar plus sheet on narrow screens.
- Create: `components/split-outfit/SplitClothRow.tsx`. Compact cloth row for one piece: swatch, Upload, and for trousers Same as jacket / Unlink, plus a "Cloth settings" disclosure wrapping the existing `fabricControls(piece)`.
- Modify: `components/split-outfit/SplitOutfitWorkspace.tsx`. Render only the current step's content with a sticky Back / Next footer, using the rows from Task 1.
- Modify: `components/split-outfit/SplitMaterialsSection.tsx`. Remove `SplitPieceFabricSlot` usages replaced by `SplitClothRow`.
- Modify: `components/TryOnApp.tsx`. In Split mode, move `ModeSelector` and the family selector above everything. Render the person `ImageUpload` inside the builder's Customer step. Move the Advanced background disclosure and `TryOnResult` into the Review step. Full mode keeps its current layout below the mode selector.
- Modify: `app/globals.css`. Builder grid, list, collapsed bar, sticky footer and reduced-motion rules.

**Interfaces:**
- Consumes: `buildBuilderRows`, `missingSteps` and `adjacentStep` (Task 1), plus `latestResult` and `draftChanged` (Task 4).
- `SplitOutfitWorkspace` gains props `step: BuilderStepId`, `onStepChange(step: BuilderStepId): void`, `personSlot: ReactNode`, `reviewExtras: ReactNode`. Step state and the `visited` set live in `TryOnApp`.
- `BuilderStepList` props: `rows: BuilderRow[]`, `onSelect(id: BuilderStepId): void`, `flashIds: BuilderStepId[]`. Rows are `<button>` elements inside `<nav aria-label="Outfit steps">`, and the current row has `aria-current="step"`.
- Keep these selectors stable for the browser check: input ids `customer-photo` and `split-fabric-<piece>`, and the review region label `Review your modular outfit recipe`.

Behaviour:
- **Changing step:** moves focus to the step heading (`tabIndex={-1}`) and scrolls the main column to its top.
- **Repair notices:** when `reconcile` returns notices, the affected rows are passed in `flashIds` for 1.5 s. Under reduced motion this is a static highlight. Notice text shows in the current step.
- **Family change:** returns to the `jacket` step.
- **Review step:** lists `missingSteps` as links to their steps. Generate stays disabled until nothing is missing.
- **Breakpoint:** collapse to the bar when the viewport is under 1024 px wide, or when two columns would make cards narrower than 160 px.
- **During generation:** all controls are disabled and the list stays visible.

- [ ] **Step 1: Implement**
- [ ] **Step 2: Run `npm run verify`.** Expected: PASS.
- [ ] **Step 3: Manual check on the local dev server with synthetic login (see Task 9 Step 1).** At 1180×820, 820×1180 and 375×812, step through all 7 steps. Confirm no page scroll is needed to reach Back/Next on iPad sizes, and that switching family returns to Jacket with no ticks.
- [ ] **Step 4: Commit** with message `feat(split): step-by-step outfit builder`.

---

### Task 7: Show customer view

**Files:**
- Create: `components/split-outfit/ShowCustomerView.tsx`
- Modify: `components/TryOnApp.tsx` (add the "Show customer" button in the Review step when `latestResult` exists, and hold the open/closed state)
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `SessionResult[]` (Task 3), `ResultSummary.pieces[].customerLabel`, `cloth` and `accessories` (Task 2), and the existing `ZoomableImage`.
- Props: `results: SessionResult[]`, `initialIndex: number`, `onClose(): void`.

Behaviour (spec, "Show customer view"):
- **Layout:** a full-screen `role="dialog" aria-modal="true"` overlay. Landscape puts the photo left and the card right. Portrait (`orientation: portrait`) puts the card below the photo.
- **Card rows:** one per `pieces` entry, using `customerLabel`, with `design + label` as the fallback for legacy summaries. Each row has a large swatch from `swatches[piece]`. A missing swatch shows a neutral "house cloth" mark. Accessories go on a small line beneath.
- **Photo controls:** a Before / After toggle switches between `originalUrl` and `resultUrl`. Previous / next arrows, swipe and position dots move through `results`, and only appear when `results.length > 1`.
- **Disclaimer:** shown verbatim and always visible: `AI visual reference — not an exact match of the cloth.`
- **What it never renders:** feedback, favourites, download, History, staff name, logout or builder controls.
- **Closing:** **Done** and Escape close it. Focus is trapped while open and returns to the Show customer button on close. Opening it sends no requests other than image loads.

- [ ] **Step 1: Implement**
- [ ] **Step 2: Run `npm run verify`.** Expected: PASS.
- [ ] **Step 3: Commit** with message `feat(split): show customer result view`.

---

### Task 8: Small fixes from the UI review

**Files:**
- Modify: `components/ImageUpload.tsx` and/or `app/globals.css`. At 375 px width the format line must stay inside the frame and the arrow icon must not overlap the border.
- Modify: `components/split-outfit/ModeSelector.tsx:34`. Replace `Complete curated looks across 7 bespoke categories` with `Complete curated looks across 8 bespoke categories`, or derive the number from the catalogue when it is available to that component.

- [ ] **Step 1: Implement both fixes**
- [ ] **Step 2: Manual check at 375×812 on the customer photo and the cloth upload**
- [ ] **Step 3: Run `npm run verify`, then commit** with message `fix(ui): mobile upload overflow and category count`.

---

### Task 9: Browser check and final verification

**Files:**
- Modify: `scripts/check-improvement-browser.mjs` (Split Outfit section, ≈L225–270)

- [ ] **Step 1: Update the Split Outfit scenario to drive the builder.** Do this without weakening any existing assertion:
  - Select rows in the "Outfit steps" nav before uploading into `#customer-photo` and `#split-fabric-jacket`.
  - Keep the existing link/replace/remove and submitted-upload assertions.
  - Add:
    - (a) Each left-list row's detail matches the submitted `splitRecipe` and upload roles.
    - (b) After switching family to Suit and back, the current step is Jacket and no garment row is ticked.
    - (c) A second synthetic generation keeps the first. Show customer then shows 2 dots, and swiping changes the image.
    - (d) The Show customer dialog contains no buttons named Save feedback, Download, History or Log out, and contains the exact disclaimer text.
    - (e) Editing the jacket after a result shows `The outfit has changed since this result`.
    - (f) A pending-recovered result opened in Show customer renders the house-cloth mark and no broken images. Assert that every `img` in the dialog has `naturalWidth > 0`.
  - Run all of this at 1180×820, 820×1180 and 375×812. Save screenshots `split-builder-<size>.png` and `split-customer-<size>.png` under `.cache/improvement-browser/`.

- [ ] **Step 2: Run `npm run verify`**

Expected: lint, typecheck and all tests pass.

- [ ] **Step 3: Run `npm run build` from a checkout without `.env` files, then `npm run test:improvements:browser`**

Expected: build succeeds and every browser check prints PASS with zero page errors.

- [ ] **Step 4: Review the six screenshots by eye.** Check contrast, 44 px targets, no horizontal scroll, and that Back/Next are visible without scrolling on the iPad sizes.

- [ ] **Step 5: Commit** with message `test(split): drive builder and customer view in browser check`.
