# Stripe Fidelity and Image-Model Evaluation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make fine stripes (pinstripes, chalk stripes) render as clean, continuous lines like the ChatGPT app does, and pick the image model (2.5 Sunburst, 2.6 Sunburst or 2.6 Flare) from measured evidence instead of assumption.

**Architecture:** Every generation setting that might cause the defect (model, quality, canvas size, complexity, fabric-photo treatment) moves out of hard-coded constants into one validated config, with today's behaviour as the default. A gated, paid comparison runner then generates the same cases under several configs. Staff score the results, and the defaults change by environment variable only, so rollback means changing one value.

**Tech Stack:** Next.js (webpack build), TypeScript, `openai` 7.4.0 SDK `images.edit`, `sharp`, `node:test` + `tsx`.

**Spec:** the Background section below, summarising the 2026-11-10 investigation of the navy dotted-pinstripe case (swatch `IMG_2647.HEIC`).

## Background (investigation findings)

- Stripe density matched in both outputs (about 13 stripes across a trouser leg). The defect is line quality. In the system output, lines break into dashes, kink on flat panels, look chalky and uneven, and some cross diagonally on the jacket front. Lapel and pocket-flap stripes ignore the construction.
- The swatch is a *dotted* pinstripe. Up close it is a row of dots; at body distance it reads as one fine line. The system reproduced the close-up dots as dashes.
- Suspects, ranked:
  1. By default, `centerFabricRepeat` sends only the centre 50% of the swatch. On this swatch that is the region with the biggest fold and shadow, at twice the zoom.
  2. Quality is fixed at `medium` on a 2160×3840 canvas. OpenAI calls anything above 2560×1440 experimental.
  3. The ChatGPT app has likely run Images 2.6 since 2026-11-04, while the system is pinned to 2.5 Sunburst, and ChatGPT rewrites prompts.
  4. Split's per-fabric role line says only "exact colour, shade, and texture" and omits pattern, which conflicts with the later override.
  5. The system sample was a 1490×2000 WebP, so check the PNG master before blaming the model.

## Global Constraints

- No paid OpenAI call runs without the owner's explicit go-ahead for that run. The runner refuses to start without `--confirm-paid`.
- With no new env vars set, production behaviour stays byte-for-byte the same: model `gpt-image-2.5-sunburst`, quality `medium`, experimental canvas, `legacy-crop` fabric default.
- Allowed models: `gpt-image-2.5-sunburst`, `gpt-image-2.6-sunburst`, `gpt-image-2.6-flare`. Anything else fails fast at startup with a clear error.
- Allowed quality values: `medium`, `high`. Allowed canvas profiles: `experimental` (3840×2160 pixel budget), `stable` (2560×1440 budget).
- Never send `input_fidelity`. Send `complexity` (`low|medium|high`) only to 2.6 models, and only when configured.
- Tests use `node:test` + `tsx` and are registered in the matching `npm run test:*` script. `npm run lint`, `npm run typecheck` and `npm test` must pass after every task.
- Customer photos and generated outputs stay outside Git (under `.cache/`).

## Review Focus

1. A typo'd or retired model name in the env should fail at boot, not on the first customer's paid call. Owner: Task 1, test `rejects unknown model at config load`.
2. A 2.6-only parameter (`complexity`) sent to 2.5 would probably be rejected and waste a call. Owner: Task 1, test `never sends complexity to 2.5`.
3. Old history and recovery records carry `quality: "medium"` and the 2.5 model. After a switch they must still render and summarise. Owner: Task 1, test `history metadata falls back to configured model`.
4. A full swatch photographed with a ruler or label must not have the label copied onto the cloth. Owner: Task 2, test `full-swatch manifest keeps the label/ruler instruction`.
5. A comparison run interrupted halfway must not re-bill finished cells when re-run. Owner: Task 4, test `runner skips cells whose output already exists`.

---

### Task 1: Central image-generation config

**Files:**
- Create: `lib/tryon/model-config.ts`
- Modify: `lib/tryon/providers/openai.ts:13-19,215,236-246,296-297` (use config instead of `MODEL` and `DEFAULT_QUALITY`; choose the canvas function by profile)
- Modify: `lib/try-on-handler.ts:366-367,1130-1131,1173,1187` (replace the hard-coded model and quality strings with the resolved config)
- Modify: `.env.example` (document `IMAGE_MODEL`, `IMAGE_QUALITY`, `IMAGE_CANVAS_PROFILE`, `IMAGE_COMPLEXITY`, `FABRIC_TREATMENT_DEFAULT`)
- Test: `tests/image-model-config.test.ts`, registered in `test:storage`

**Interfaces:**
- Produces:
  - `type ImageModelId = "gpt-image-2.5-sunburst" | "gpt-image-2.6-sunburst" | "gpt-image-2.6-flare"`
  - `type ImageGenerationConfig = { model: ImageModelId; quality: "medium" | "high"; canvasProfile: "experimental" | "stable"; complexity?: "low" | "medium" | "high"; fabricTreatmentDefault: FabricTreatment }`
  - `resolveImageGenerationConfig(env?: NodeJS.ProcessEnv): ImageGenerationConfig` (throws `Error("Unsupported IMAGE_MODEL: <value>")` and equivalents)
  - `new OpenAITryOnProvider(clientFactory?, config?: ImageGenerationConfig)`. Defaults to `resolveImageGenerationConfig()`.
- Consumes: `FabricTreatment` from Task 2. Until Task 2 lands, declare it here as `"legacy-crop" | "full-detail"` and widen it in Task 2.

- [ ] **Step 1: Write failing tests** in `tests/image-model-config.test.ts`:
  - `defaults reproduce current production`: `resolveImageGenerationConfig({})` deep-equals `{ model: "gpt-image-2.5-sunburst", quality: "medium", canvasProfile: "experimental", fabricTreatmentDefault: "legacy-crop" }` with no `complexity` key.
  - `rejects unknown model at config load`: `{ IMAGE_MODEL: "gpt-image-2.6-flair" }` throws `/Unsupported IMAGE_MODEL/`. Same pattern for bad `IMAGE_QUALITY`, `IMAGE_CANVAS_PROFILE` and `IMAGE_COMPLEXITY`.
  - `rejects complexity for 2.5`: `{ IMAGE_COMPLEXITY: "medium" }` with the default model throws `/complexity requires a 2.6 model/`.
  - `edit call carries configured values`: build the provider with a fake client (pattern from `tests/fabric-background.test.ts:153`) and config `{ model: "gpt-image-2.6-flare", quality: "high", canvasProfile: "stable", complexity: "medium", ... }`. Assert the recorded request has `model === "gpt-image-2.6-flare"`, `quality === "high"`, `complexity === "medium"`, size equal to `resolveFallbackCanvas(w,h)` for the person fixture, and no `input_fidelity` key. Assert `output.metadata.model === "gpt-image-2.6-flare"`.
  - `never sends complexity to 2.5`: with the default config, the recorded request has no `complexity` key.
  - `history metadata falls back to configured model`: the handler's metadata fallback (`try-on-handler.ts:366`) reports the configured model when the provider metadata is missing. Export the small fallback helper so it can be tested.
- [ ] **Step 2: Run** `NODE_ENV=test NODE_OPTIONS=--conditions=react-server node --import=tsx --test tests/image-model-config.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement `resolveImageGenerationConfig` and wire it in.** Resolve the config once at module load in the handler, so a bad env fails at boot. Keep `"gpt-image-2.5-sunburst-2026-09-08"` as a documented rollback comment. Before passing `complexity`, check whether the SDK 7.4.0 `ImageEditParams` type has it. If not, upgrade `openai` to the first version that does (pin the exact version) rather than casting.
- [ ] **Step 4: Run** the new test, then `npm run lint && npm run typecheck && npm test`. Expected: all PASS. The existing `tests/image-pipeline.test.ts` canvas assertions are unchanged.
- [ ] **Step 5: Commit** `feat: configurable image model, quality, canvas and complexity`.

### Task 2: Full-swatch fabric treatment

**Files:**
- Modify: `lib/tryon/fabric-guidance.ts` (add `"full-swatch"` to `mode`; export `type FabricTreatment = FabricReferenceOptions["mode"]`)
- Modify: `lib/tryon/providers/openai.ts:148-169` (`prepareProviderReferences`: mode, else `config.fabricTreatmentDefault`; `full-swatch` sends `uprightImage(image)` only, with no centre crop and no detail crop)
- Modify: `components/FabricReferenceControls.tsx` (replace the checkbox with a three-option select: "Centre crop (current)", "Whole swatch", "Whole swatch + detail")
- Test: `tests/fabric-background.test.ts` (extend)

**Interfaces:**
- Consumes: `ImageGenerationConfig.fabricTreatmentDefault` (Task 1).
- Produces: `FabricTreatment = "legacy-crop" | "full-swatch" | "full-detail"`, `prepareProviderReferences(input, defaultTreatment: FabricTreatment)` and `prepareProviderPacket(input, config: ImageGenerationConfig)`. Update the existing caller in `scripts/prepare-outfit-comparison.mts` to match.

- [ ] **Step 1: Write failing tests:**
  - `full-swatch sends the whole upright swatch`: for an 800×1200 fabric fixture with `{ mode: "full-swatch" }`, the fabric part's dimensions are 800×1200 and there is no `-detail` part.
  - `default treatment comes from config`: with no guidance and `defaultTreatment: "full-swatch"`, the same result. With `"legacy-crop"`, 400×600 (current behaviour).
  - `parseFabricGuidance accepts full-swatch and still rejects unknown modes`.
  - `full-swatch manifest keeps the label/ruler instruction`: the provider prompt still contains `"Do not reproduce reference labels or calibration marks."`.
- [ ] **Step 2: Run** `npm run test:storage`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** the mode handling, parser and select.
- [ ] **Step 4: Run** `npm run lint && npm run typecheck && npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: whole-swatch fabric treatment with configurable default`.

### Task 3: Stripe-aware prompt fixes

**Files:**
- Modify: `lib/split-outfit/prompt.ts:23-26` (role lines: change "exact colour, shade, and texture" to "exact colour, shade, texture, pattern and pattern scale")
- Modify: `lib/tryon/pattern-geometry.ts` (append the stripe rule below to `FABRIC_SCALE_POLICY` and `PATTERN_GEOMETRY`)
- Test: `tests/split-outfit.test.ts`, `tests/level1-try-on.test.ts` (extend)

Exact stripe rule copy:

> STRIPE RENDERING: Judge the cloth as it reads at the customer's viewing distance. A pinstripe made of tiny dots or slubs in the close-up swatch renders on the garment as one fine, continuous, unbroken line of constant width. Never draw dashed, broken, chalky, zig-zag or crossing stripe lines. Stripes run with the grain of each panel, follow the lapel roll on lapels, and bend only where the cloth visibly folds.

- [ ] **Step 1: Write failing tests:** the built split prompt for a recipe with a jacket fabric contains `"pattern and pattern scale"` on the jacket-fabric role line, and contains `"STRIPE RENDERING:"` exactly once. Same for the full and Level 1 provider prompt (`prepareProviderPacket(...).providerPrompt`).
- [ ] **Step 2: Run** `npm run test:catalog`. Expected: FAIL.
- [ ] **Step 3: Implement** the copy changes. Bump `promptVersion` in provider metadata to `"atelier-v5-stripe-rendering"`.
- [ ] **Step 4: Run** `npm run lint && npm run typecheck && npm test`. Expected: PASS. The prompt length check (32000 characters) still passes for the largest split recipe.
- [ ] **Step 5: Commit** `fix: stripe rendering rule and pattern in split fabric roles`.

### Task 4: Gated paid comparison runner

**Files:**
- Modify: `lib/evaluation/manifest.ts` (add the `"matrix"` experiment, where the manifest carries `conditions: { id: string; config: Partial<ImageGenerationConfig> }[]` with 2 to 8 conditions)
- Create: `scripts/run-outfit-comparison.mts` (npm script `quality:run`)
- Modify: `scripts/summarize-quality-evaluation.mts` (per condition: median and p90 latency, mean input and output tokens, estimated cost at a `--price-per-mtok-out` argument)
- Modify: `lib/history/review-types.ts` (add the `"broken-or-wavy-stripes"` review reason)
- Modify: `docs/outfit-comparison.md` (document the matrix manifest and the paid run)
- Test: `tests/improvement-workflows.test.ts` (extend)

**Interfaces:**
- Consumes: `prepareProviderPacket`, `OpenAITryOnProvider(clientFactory, config)` (Task 1), `FabricTreatment` (Task 2).
- Produces: output layout `<out>/<caseId>/<conditionId>/<rep>.png` plus `metadata.json`.

- [ ] **Step 1: Write failing tests:**
  - `matrix manifest validates conditions`: rejects an unknown model or more than 8 conditions.
  - `runner refuses without --confirm-paid`: exits non-zero before building any client, and prints `cases × conditions × repetitions` calls.
  - `runner skips cells whose output already exists`: with a fake client, a second run makes 0 calls.
  - `review reasons include broken-or-wavy-stripes`.
- [ ] **Step 2: Run** `npm run test:storage`. Expected: FAIL.
- [ ] **Step 3: Implement.** Run cells one at a time, sequentially. Write each PNG and its metadata immediately. A failed cell is recorded and not retried.
- [ ] **Step 4: Run** `npm run lint && npm run typecheck && npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: gated matrix comparison runner and stripe review reason`.

### Task 5: Evidence run and decision (owner-approved, not code)

- [ ] **Step 1: Free checks first.** Re-run this pinstripe case in the current app with "Whole swatch" (after Task 2), or with today's "Use full swatch plus selected detail" box ticked. Pull the PNG master from History. Send the *same* customer photo through ChatGPT.
- [ ] **Step 2: Build the case set** under `.cache/stripe-eval/`: this dotted pinstripe, one chalk stripe, one fine check, one herringbone, one plain control, and two consented customer photos. That is 10 cases.
- [ ] **Step 3: Get owner approval** for the call count and estimated cost printed by the runner. Proposed conditions, all with `quality: high`, `canvasProfile: stable`, `fabricTreatment: full-swatch` unless noted:

  | id | model | other |
  |---|---|---|
  | A | 2.5 Sunburst | current production (medium, experimental, legacy-crop) |
  | B | 2.5 Sunburst | fixes only |
  | C | 2.6 Sunburst | fixes |
  | D | 2.6 Flare | fixes |
  | E | 2.6 Flare | fixes, `quality: medium` |

  This is 10 cases × 5 conditions × 1 repetition = 50 calls.
- [ ] **Step 4: Score blind.** Staff mark each output pass or fail on stripe continuity, straightness, scale, lapel and pocket behaviour, and identity preservation, using the review reasons.
- [ ] **Step 5: Apply the decision rule.** Pick the cheapest and fastest condition whose stripe pass rate is within one case of the best condition and which has zero identity failures. Set it through env vars only, and record the result in `research/IMPROVEMENT_PROGRESS.md`. Rollback means restoring the previous env values.
