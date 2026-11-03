# Split Outfit implementation audit

Scope: all eight tasks approved in `split-outfit-short-term-implementation.md`. Implementation branch: `feat/split-outfit-workflow`. Tests use synthetic fixtures and isolated local services; no paid calls or production data mutations.

## Requirement evidence

| Task | Implemented behavior | Evidence |
|---|---|---|
| 1. Accurate summary | Selected garment assignments are counted from effective files, not catalogue material defaults. Shoes and text-only accessories are described separately. | `SplitOutfitReview.tsx`; browser asserts two uploaded/one reference assignment while linked; targeted client-flow tests |
| 2. Linked fabrics | Explicit link/unlink; jacket changes and removal propagate; unlink creates independent preview and guidance; independent upload unlinks only after successful preparation; reset/restore clear link; stale async preparation is discarded. Roles remain separate authorized uploads. | `TryOnApp.tsx`, `client-fabrics.ts`; browser compares preview URLs and submitted upload filenames/guidance; pure replacement/removal tests |
| 3. Review/results/history | Per-piece design, material source, cloth thumbnail and Edit anchors; unavailable-reference/incomplete guidance; submitted per-piece result summary survives pending recovery. Stored results compare against History assets rather than changing draft previews. History uses server-recorded fabric flags, preserved by recent-history sanitization; older records show unrecorded source explicitly. | `SplitOutfitReview.tsx`, `result-summary.ts`, `pending-generation.ts`, `TryOnApp.tsx`, `UsageHistory.tsx`, `usage-history.ts`; pending legacy/new tests, History round-trip regression and browser submission assertions |
| 4. Contextual controls | Each piece owns its fabric editor. Linked trousers point to jacket guidance. Background controls live under Advanced, with current mode in the summary. Full Outfit keeps its controls/defaults. | Workspace/Materials/App components; browser checks linked editor absence, Full Outfit settings/recovery and desktop/mobile screenshots |
| 5. Availability | Server-owned configured-family metadata marks six empty families Coming soon. Approval remains per reference, distinct from configuration. Fetch failures show Retry; aborted/superseded responses cannot replace state. | `view.ts`, workspace; catalogue projection test and browser persistent-failure/retry scenario |
| 6. Guidance | Customer framing, lighting, hands and visible-feet advice; fabric flatness, repeat and glare advice. No automatic vision scoring or exact-color promise. | App and Materials component copy; desktop/mobile visual review and existing upload validation/cancellation scenarios |
| 7. Feedback | Existing store/API extended with wrong-material and changed-customer categories and quick decision buttons. Explicit save, unsaved-change status, server-confirmed success, retryable errors, and unsaved-image explanation. Legacy reasons and per-staff isolation preserved. | GenerationReview/review-types/Result; API isolation/persistence tests; browser save failure then retry and History readback |
| 8. Comparisons | Validated cases and single-factor conditions; confined local image paths; production packet compiler; original/processed image hashes and final prompt; immutable run folders; blinded side-by-side HTML and scoring template; existing summary retains failed-run and unknown-cost handling. | `manifest.ts`, shared provider compiler, prepare/report scripts, `docs/outfit-comparison.md`; CLI end-to-end test with a network-denying preload, overwrite and symlink-escape tests |

## Validation commands

- `npm run verify`: lint, TypeScript and the complete test suite, including real loopback integration tests with synthetic services.
- Production `npm run build` in `/private/tmp/bespoke-workflow-build`, a source copy without `.env` files, with service credentials excluded from its process environment.
- `npm run test:improvements:browser` in `/private/tmp/bespoke-workflow-browser`, without `.env` files, with temporary Playwright and installed Chrome. Real local authentication; fixture image/storage/provider/review responses; actual Split Outfit catalogue projection.
- `git diff --check`.

Latest final-run outcome is recorded in `split-outfit-implementation-progress.md`. Browser evidence is copied to `.cache/split-outfit-validation/`. Screenshot assets are synthetic technical fixtures, not generated customer results.

## Practical limits

This implementation improves configuration reliability and supplies evaluation infrastructure. It does not establish a measured improvement in image fidelity. The offline comparison tools do not execute paid model calls; authorized real-photo experiments are a separate step. Live production storage/database/provider behavior and deployment are outside this local implementation. Generation model, quality default, and fabric-treatment default remain unchanged.
