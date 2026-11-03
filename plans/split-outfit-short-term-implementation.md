# Split Outfit: eight-task implementation plan

Date: 3 November 2026

Status: proposed, awaiting owner approval. This document authorizes no implementation, paid model calls, production data changes, push, or deployment by itself.

Baseline: local `main` at `8ffcf1a`, including the previously validated generation-flow fixes. Recheck the branch and local changes when implementation starts. Preserve the existing research document.

## Objective and scope

Make the existing Split Outfit workflow easier to configure, accurately describe what will be generated, reduce accidental fabric mismatches, and provide useful feedback and comparison tools. There are **eight top-level tasks**. Tasks 1–6 concern configuration and presentation; task 7 improves existing feedback; task 8 extends existing evaluation tooling.

This release uses the existing garment catalogue and image-generation provider. It does not add garment families, shorts, new construction options, automatic segmentation, localized AI repairs, automatic photographic quality scoring, or a new model. It does not change fabric-treatment defaults or generation quality based on unmeasured assumptions. Any shared component change must preserve Full Outfit behavior.

## Inventory: what already exists

| ID | Task | Current state | Work remaining |
|---|---|---|---|
| 1 | Accurate material summary | Individual cards distinguish uploaded/reference cloth; aggregate totals use catalogue defaults | Derive totals and labels from actual effective assignments |
| 2 | Persistent jacket–trouser fabric link | One-time file copy exists | Add explicit link state and defined update/unlink behavior |
| 3 | Clear design and fabric review | Review cards exist; result summary is generic | Provide a consistent per-piece review and submitted-result snapshot |
| 4 | Contextual fabric controls and Advanced preservation | Both control components exist below the workspace | Place fabric controls beside each piece; make preservation an accessible disclosure |
| 5 | Clear unavailable-family presentation | Empty families show a coming-soon message after selection | Identify unavailable families before selection and handle loading/retry cleanly |
| 6 | Better upload guidance | Generic guidance and camera/upload controls exist | Add concise, operation-specific customer/fabric guidance |
| 7 | Quick staff feedback | Review UI, API, persistence, favourites, and validation already exist in History and results | Add missing issue categories and clearer quick actions using the same system |
| 8 | Comparison test harness | Synthetic baseline generator, scoring summary, and browser checks exist | Connect them with validated cases, controlled variants, reproducible preparation and comparison artifacts |

None is impossible to implement in this repository. No task is fully complete to the proposed acceptance criteria. Tasks 7 and 8 already have substantial infrastructure and must be extended rather than rebuilt. Availability of production services has not been revalidated as part of this planning-only pass.

## Common design decisions

- Keep a single source of truth for effective fabric assignments. Both request building and review must read it.
- Preserve the distinction between a garment's design reference and its material source. Shoes remain reference-based, and accessories remain text-only in this release.
- Separate the live draft from the immutable summary of a submitted generation. Later edits must not relabel a previous result.
- Keep the existing role-specific upload-slot contract. A shared local cloth can still require separate authorized role-specific slots; this plan does not deduplicate storage ownership or reuse consumed upload IDs.
- Preserve existing authentication, private History access, same-origin checks, idempotency, pending recovery, and unsaved paid-result download behavior.
- Use the current design system. The initial release reorganizes the existing workflow; it is not a complete three-column redesign.

## Task 1 — Make material summaries accurate

**Outcome:** The review tells staff what each piece will actually use and reports correct totals.

**Implementation:**

1. Introduce a small pure assignment helper in `lib/split-outfit/` that accepts the selected pieces and effective fabric presence. Keep it usable without importing server-only catalogue data into client code.
2. Return per-piece appearance sources: uploaded cloth, linked uploaded cloth, approved reference, or text-only detail where applicable. Exclude an absent waistcoat and stale inactive uploads.
3. Update `SplitOutfitReview.tsx` and `SplitMaterialsSection.tsx` to use this result rather than `materialRequirements.defaultFabricSource` for actual upload counts.
4. Label counts as garment-piece assignments, so one cloth linked to two pieces counts as two assignments, not two distinct uploaded photos. List text-only accessories separately.

**Acceptance:** No uploads, one upload, mixed uploads, linked jacket/trousers, and a removed waistcoat all produce accurate rows and totals. Shoes never appear as uploaded fabric in this release.

**Validation:** Table-driven assignment tests and a browser scenario comparing displayed sources with the submitted upload roles. Avoid tests that merely match source-code strings.

## Task 2 — Link jacket and trouser fabrics

**Outcome:** A user can deliberately keep both pieces on the same cloth and separate them when needed.

**Implementation:**

1. Add explicit link state to Split Outfit's client fabric state, using a reducer or equivalent atomic update helper. Derive effective trouser cloth from the jacket while linked.
2. Replace the ambiguous copy action with “Link trousers to jacket fabric.” Disable it until jacket cloth exists. Show a linked indicator on the trouser card.
3. Linking replaces a separate trouser assignment; make that behavior explicit before the action. Replacing jacket cloth updates the effective trouser cloth immediately. Removing jacket cloth clears both effective assignments while preserving the link intent until the user unlinks or chooses a separate trouser cloth.
4. Unlinking retains the currently effective cloth as an independent trouser assignment. Choosing an independent trouser upload breaks the link only after the new file is prepared successfully; a failed replacement leaves the prior state intact.
5. While linked, share fabric crop/detail treatment and repeat measurements. Prevent contradictory guidance for two uses of the same linked cloth. Unlinking copies current guidance so later edits become independent.
6. Make preview URL ownership explicit. Revoke an owned URL only when no active preview uses it. Reset clears the link. Restoring a historical recipe does not fabricate missing photos or restore single-use upload IDs.
7. Build requests from effective assignments. Preserve existing separate `fabric` and `lowerFabric` roles and the atomic consumption rules.

**Acceptance:** Link, replace, remove, re-add, unlink, independent replacement, failed upload, start-over, and history restore behave consistently. Both review and model request use the same cloth while linked. No broken previews or stale crop coordinates.

**Validation:** State-transition tests, a browser sequence exercising the controls, and request-payload assertions. Include cleanup, failed replacement, and repeated reset.

## Task 3 — Improve pre-generation and result review

**Outcome:** Staff can check the selected design and material for every piece before generating and see the actual submitted configuration afterward.

**Implementation:**

1. Extend the existing review cards with design name, appearance-source badge, cloth thumbnail when available, link indicator, and an Edit action targeting that piece.
2. Display shirt and waistcoat separately where needed. Identify shoes as reference material and accessories as text instructions. Remove undefined subtitle fragments.
3. Disable submission for missing/incompatible required selections and explain the missing step. Do not treat catalogue loading, unavailable references, and incomplete selection as the same condition.
4. Capture a serializable summary at submission. Preserve it through pending/recovered results. Reuse the existing `splitFabricSlots` and server-resolved names where possible; add a bounded optional versioned summary only if necessary.
5. Keep any persisted summary server-derived from validated recipe IDs and actual upload roles. Do not trust client labels or persist `File` objects, blob URLs, or private storage paths as presentation data.
6. In History, show submitted configuration when available and a truthful fallback for older events. Draft changes after generation must not change the result's labels or reference thumbnails.

**Likely files:** `SplitOutfitReview.tsx`, `TryOnResult.tsx`, `TryOnApp.tsx`, `lib/result-summary.ts`, and, if needed, pending/history serialization and `lib/try-on-handler.ts`.

**Acceptance:** The final review and submitted request agree per piece. Changing a draft later cannot misdescribe an existing result. Old history and pending records still load.

**Validation:** Summary serialization/backward-compatibility tests and browser checks covering delayed response, pending recovery, and subsequent draft edits.

## Task 4 — Put controls where they are used

**Outcome:** Staff do not need to scroll to a separate global fabric-controls section to adjust a particular garment.

**Implementation:**

1. Wire each active fabric reference control into its corresponding jacket, trouser, shirt, or waistcoat section, using existing components and unique accessible control IDs.
2. For linked trousers, show “Controlled by jacket fabric” and an action to edit the jacket guidance; do not render a second contradictory editor.
3. Show selected treatment in the piece summary. Use labels such as “Whole fabric + detail” and “Centre sample only,” keeping explanatory text about the actual provider input.
4. Wrap `BackgroundControls` in a keyboard-accessible Advanced disclosure. If an advanced method is already selected, show a visible summary even when collapsed. Collapsing the panel must not reset its value.
5. Remove duplicate Split Outfit controls from the global section. Preserve Full Outfit controls and their current defaults.
6. Verify narrow-screen layout, focus order, disabled states during generation, and thumbnail sizing with the existing CSS system.

**Acceptance:** Each fabric has one authoritative editor; active advanced settings are discoverable; all existing choices remain reachable with keyboard and mobile layouts. No default generation-setting changes.

**Validation:** Browser interaction and screenshot review at representative desktop/mobile widths, plus existing request-mapping tests.

## Task 5 — Show unavailable families clearly

**Outcome:** Staff see what can be configured before opening an empty family.

**Implementation:**

1. Add client-safe family availability metadata derived from server-owned catalogue data. Distinguish an unimplemented/empty family from a configured family with temporarily unavailable storage references.
2. Mark empty families “Coming soon” before selection. Keep them visible for roadmap context without presenting them as usable choices. Do not disable the whole family merely because one option's reference is unavailable.
3. Keep option-level approval/readiness checks and server validation. Never advertise a family as generation-ready solely because an options array is nonempty.
4. Reset stale error state on a new request, cancel/ignore superseded responses, and add a real Retry action. Retain the current draft on a transient fetch failure.
5. Preserve sensible keyboard navigation and the selected state when availability changes. Use server metadata rather than hardcoding “only Suit forever” in the component.

**Acceptance:** The six currently empty non-suit families are clearly identified. Network failure is displayed as Retry, not “Coming soon.” A late response cannot replace the current family's view.

**Validation:** Catalogue projection tests plus browser cases for empty, populated, partially unavailable, failed, retried, and out-of-order responses.

## Task 6 — Improve photo and fabric guidance

**Outcome:** Staff know which photo is suitable for their intended edit before uploading or generating.

**Implementation:**

1. Add a concise customer-photo checklist near the upload: one person, clear lighting, readable face, visible clothing area, and minimal hand/body occlusion where practical.
2. Explain why feet should be visible when shoes are changed and why cropped-away areas cannot be faithfully preserved. Use guidance, not a claim that the app automatically detects every problem.
3. Add fabric guidance next to each upload: flat cloth, even light, minimal folds/glare, enough area to show repeat, and a representative detail crop where useful.
4. Explain optional measured pattern-repeat fields without inferring physical dimensions from pixels.
5. Replace unconditional “exact colour, shade, and texture” wording with a clear rendering aim and instruction to inspect the result.
6. Reuse `ImageUpload` for camera, file-picker, drag/drop, and disabled behavior. Avoid new camera permissions or an automatic vision-analysis service.

**Acceptance:** Guidance is concise and specific to customer versus cloth inputs, remains usable on mobile, and does not block valid uploads with speculative rules.

**Validation:** Manual/browser review of empty, uploaded, error, and mobile states. Retain existing file-validation tests; no tests for individual copy sentences.

## Task 7 — Extend staff feedback

**Outcome:** Staff can quickly identify whether a result is acceptable and classify why it is not, with the same feedback visible in results and History.

**Existing foundation:** `GenerationReview.tsx`, `lib/history/review-types.ts`, `lib/history/reviews.ts`, and `/api/history/[id]/review` already implement review, persistence, and per-staff isolation. Both `TryOnResult` and History render this component.

**Implementation:**

1. Improve the existing decision UI into clear Accept / Needs improvement actions. Keep explicit Save feedback to avoid unnoticed writes; keep favourites independent.
2. Preserve existing reason values. Add categories for wrong fabric/material and changed customer appearance, while retaining wrong colour, incorrect tailoring, pattern scale, and background categories.
3. Continue using the existing validated API and per-staff storage. Keep authentication, same-origin protection, bounded request bodies, timeouts, and failure handling.
4. Ensure old reviews remain readable. Prevent double submissions and never display a saved confirmation until persistence succeeds.
5. For the unsaved inline-result fallback, explain that persistent feedback requires a stored generation rather than posting to a nonexistent history event.

**Acceptance:** Existing and new reasons survive save/reopen; result and History show the same stored review for the same staff account. One staff member's review remains separate from another's.

**Validation:** Extend existing feedback parsing/persistence and isolation tests. Browser-check successful saves, load/save failures, retry, and legacy reviews.

## Task 8 — Complete the comparison workflow

**Outcome:** We can prepare controlled experiments, compare results, and distinguish technical correctness from visual accuracy.

**Existing foundation:** `scripts/prepare-quality-baseline.mjs` creates deterministic synthetic swatches; `lib/evaluation/summary.ts` and `scripts/summarize-quality-evaluation.mts` summarize manually scored results. `scripts/check-improvement-browser.mjs` exercises the app with service fixtures. These are not real-world model-accuracy results.

**Implementation:**

1. Define a versioned, validated case manifest: case ID, consented/local customer-image reference, recipe, fabric assets/hashes, preprocessing version, condition, repetition, model, quality, and size. Validate paths and keep personal images/artifacts outside committed fixtures.
2. Add an offline preparation/dry-run command. Render the exact proposed reference order, crop previews, and effective settings for inspection. Validate required files, recipe compatibility, duplicate run IDs, and condition overrides before execution.
3. Prepare two experiment types: centre-crop versus whole-plus-detail, and medium versus high quality at the same output dimensions. Change one factor at a time and record exact settings. Production UI defaults stay unchanged.
4. Use the production input-preparation functions and bounded test-only adapters rather than maintaining a second prompt pipeline. Synthetic smoke tests run without provider credentials and must make zero paid calls.
5. Add an offline side-by-side comparison report and scoring template using the existing five dimensions: scale, colour, construction, background, identity. Blind condition labels in the review artifact and keep a separate run-key mapping.
6. Feed scored rows into the existing summary. Count failed/rejected runs and retries. Preserve unknown cost as unknown; do not derive billing from guessed prices or present latency from mocks as production performance.
7. Include fixtures and documentation for technical smoke validation. A live execution adapter may be prepared with a default dry-run and explicit case/attempt limits, but no paid experiment is run under this approval alone. Before a paid pilot, present a concrete case list, planned call count, settings, and cost basis for separate approval.

**Acceptance:** Offline preparation, comparison artifacts, score validation, and summary run reproducibly. A run cannot silently change the baseline or overwrite previous outputs. No accuracy improvement is claimed without an actual reviewed experiment.

**Validation:** Manifest and path validation, input-role mapping, controlled override, no-network dry-run, run-ID collision, missing-cost, failed-run, and summary tests. Verify app browser fixtures remain independent of provider credentials.

## Execution order and review boundaries

1. **Foundation:** Implement task 2's effective fabric state, then task 1's assignment helper. Validate them together before integrating the UI.
2. **Core UI:** Implement tasks 3 and 4 using that shared state, then tasks 5 and 6. Capture desktop/mobile screenshots and run request-mapping checks.
3. **Feedback:** Extend task 7 after review/result rendering stabilizes. Confirm backward compatibility and account isolation.
4. **Evaluation:** Extend task 8 against the final effective assignment and input-preparation functions.
5. **Final validation and handoff:** Run the existing verification suite, production build, and updated browser scenarios in an isolated environment. Review the complete diff and deliver a summary with evidence and remaining limits.

Use a dedicated implementation branch. Keep cohesive commits so each stage can be reviewed or reverted. Do not silently include unrelated fixes. If a pre-existing issue prevents a planned acceptance criterion, document it and make only the narrowly necessary correction.

## Definition of done

- All eight tasks meet their acceptance criteria, or any explicitly excluded task is clearly identified by the owner's approval.
- The displayed design/material assignments match the actual submitted request.
- Linking cannot introduce stale cloth, guidance, or broken preview URLs.
- Existing Full Outfit generation, Split Outfit compatibility, History, recovery, and paid-result fallback remain functional.
- Existing old reviews/history/pending records are compatible with new optional metadata.
- Lint, type checks, relevant tests, full regression checks, and production build pass. Browser screenshots and interaction checks cover desktop and mobile. If a check is blocked, report it rather than treating it as passed.
- Offline comparison tooling makes no paid calls and clearly distinguishes synthetic validation from visual evidence.
- Provide final diff, checks, screenshots, and limitations. Push, merge of the implementation branch, and deployment follow the user's subsequently authorized scope.

## Approval scope

Approving this plan means implementing the eight tasks on a local branch and validating them with offline/mocked checks and a production build. It does not approve paid model experiments, provider changes, new production resources, or deployment. Actual accuracy measurement will require representative approved photos and separately authorized paid calls.
