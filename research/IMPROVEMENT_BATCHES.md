# Improvement batches

Updated: 2026-11-02. This is the roadmap consolidated from the exploratory review and the owner's feedback. It records proposed work, not a claim that every batch is implemented or that its visual benefits are proven.

The main priorities are fabric-pattern/design-detail scale and background stability. Face preservation remains a regression check rather than a separate improvement project.

## Overview and order

| Batch | Focus | Status | Depends on |
| --- | --- | --- | --- |
| 1 | Image-processing correctness and request deadlines | Completed locally | — |
| 2 | Generation provenance, staff feedback and evaluation baseline | Engineering verified; visual baseline pending | 1 |
| 3 | Fabric-reference and pattern-scale controls | Opt-in controls verified; output evaluation pending | 2 |
| 4 | Garment construction and design-detail proportions | Instruction conflicts fixed; tailor/output review pending | 2; coordinate with 3 |
| 5 | Background preservation | Opt-in mask/composite verified technically; visual acceptance pending | 2; keep scale changes separately measurable |
| 6 | Refresh recovery and pending-generation continuity | Implemented and locally verified | 1 |
| 7 | Upload resilience and resumability | Local fixture verification passed; live storage not tested | 1 |
| 8 | Staff progress, comparison and result-management tools | Implemented and browser-verified; optional sharing export deferred | 2; integrate with 6–7 |
| 9 | Catalogue readiness and loading performance | Cache/probe-count and browser checks passed | 1 |
| 10 | Generation quality, latency and cost tuning | Offline tools/documentation ready; paid experiments disallowed | 2; establish scale/background baselines first |

The order prioritizes visual quality. Batches 6–9 can be implemented independently while image experiments await suitable examples or an evaluation budget. Quality tuning must not obscure the results of reference-input experiments.

The owner has specified **no paid image calls for now**. No visual pilot has run, and the full goal remains open. See [implementation report](IMPROVEMENT_REPORT.md) for the current evidence and remaining acceptance gates; technical verification does not establish image-quality gains.

## Batch 1 — Image-processing correctness and request deadlines

**Completed:** correct lossy WebP dimension byte order; report actual dimensions after fabric-crop rotation; constrain canvas edges and pixel count; add 60-second upload-request deadlines covering response bodies; add 10-second recovery reads and a six-minute overall recovery deadline.

**Verified:** six additional regressions, all 180 tests, lint, type checking, production build and local HTTP security checks passed. No paid generations or production changes occurred. This batch does not establish that motif scale or background drift is solved.

## Batch 2 — Generation provenance, feedback and baseline

**Deliver:** retain requested/reported generation settings, actual output dimensions, model/snapshot information where available, prompt and preprocessing versions, fallback attempts, stage timings and usage metadata. Attach controlled staff feedback: accepted/rejected, pattern too large/small, wrong colour, incorrect construction or changed background. Record missing provider metadata explicitly rather than inventing values.

**Evaluate:** prepare consented or synthetic representative inputs and repeatable comparisons. Measure quality categories separately, plus median/slow latency, failures and cost per accepted output. Keep private assets and internal diagnostics behind existing access controls.

**Complete when:** a result can be traced to its input recipe and processing version, feedback survives reload, and baseline examples can be compared without exposing secrets or customer imagery in logs.

## Batch 3 — Fabric-reference and pattern-scale controls

**Deliver:** a full-swatch reference for context, a staff-selected detail crop for weave/colour, and a preview of the exact references submitted. Add optional measured repeat guidance and clear photography instructions. Assign full and detail references distinct roles in the server-controlled image mapping and prompt.

**Evaluate:** compare against the current centre-crop approach on identical difficult cases with model, quality and canvas held constant. Include different capture distances, checks, stripes, motifs and plain controls. The crop's contribution to current scale errors remains a hypothesis.

**Complete when:** crop selection and reference roles have deterministic tests and staff evaluation demonstrates better scale consistency without worse colour or construction. Measurements guide generation; they do not promise millimetre-accurate reproduction.

## Batch 4 — Garment construction and design-detail proportions

**Deliver:** distinguish fabric repeat size from lapel width, button spacing, collar height, pocket size and garment length. Review whether design metadata and reference photography communicate these proportions consistently. Have a tailor review seam alignment, pattern breaks and grain-direction instructions rather than demanding universal continuity across all panels.

**Evaluate:** assess selected details relative to the intended blueprint and the customer's visible body, across suit and traditionalwear examples. Do not infer physical measurements from reference-image pixel size alone.

**Complete when:** the problematic detail categories are documented, conflicting instructions are resolved, and targeted comparisons show improved construction without changing the customer's body. This remains a visualization tool, not a sizing or fit guarantee.

## Batch 5 — Background preservation

**Deliver:** prototype garment-region edit masks, then evaluate compositing unaffected regions from an aligned original if stronger preservation is needed. Include space for changed sleeves, hems, occlusions and shadows; handle boundary blending carefully.

**Evaluate:** score background drift separately from garment quality. Check old-clothing remnants, clipped garments, halos, lighting discontinuities and face regressions. Masks alone are advisory and cannot guarantee pixel-identical backgrounds.

**Complete when:** the selected method reduces background changes without visible composition defects. Keep the current approach available while evaluating the prototype.

## Batch 6 — Refresh recovery and pending-generation continuity

**Deliver:** retain minimal pending-job information across refresh, scoped to the signed-in account, with expiry and logout cleanup. Reconcile the existing generation key with server status before offering a new paid run. Distinguish expired authentication, temporary status outages and genuinely unknown outcomes.

**Complete when:** refresh, navigation, reconnect and account-change scenarios recover or clearly explain the existing job without duplicating generation. Do not persist photo bytes or session tokens for this feature.

## Batch 7 — Upload resilience and resumability

**Deliver:** bounded retries for verified-safe chunk transfers, interruption recovery within the same upload slot, and cancellation before paid generation. First verify server behavior for duplicate chunks, overlapping requests, expired slots and completion races. Reuse the existing request deadlines.

**Complete when:** interrupted transfers can resume without corrupting bytes, bypassing ownership checks or consuming an upload twice. Do not apply upload-retry behavior to uncertain paid generation requests. Stopping local waiting must not be represented as cancellation of a provider job already running.

## Batch 8 — Staff progress, comparison and result management

**Deliver:** aggregate byte progress across files, named upload/validation/generation/save stages, synchronized zoom or side-by-side inspection, and fabric-detail comparisons. Add favourites and useful failure reasons. Preserve the private PNG master; evaluate a separate smaller sharing/download export if staff need it.

**Complete when:** progress does not misleadingly reset per file, staff can compare the same detail easily, and exports remain private and correctly labelled. Avoid fabricated completion-time estimates. Integrate the feedback controls from batch 2 rather than creating a second feedback system.

## Batch 9 — Catalogue readiness and loading performance

**Deliver:** measure current readiness checks and request frequency; introduce a short-lived readiness cache with invalidation when assets change. Distinguish temporary storage failures from missing or unapproved references.

**Complete when:** measured loading behavior improves, restored assets become usable promptly, and unavailable references cannot enter generation. Retain server-side readiness checks and private asset access.

## Batch 10 — Generation quality, latency and cost tuning

**Deliver:** controlled comparisons of the current medium-quality baseline with higher settings, suitable output dimensions, reference counts and compatible model candidates. Preserve PNG masters and evaluate derived export formats separately. Reconcile stale documentation with actual runtime settings.

**Evaluate:** change one factor at a time. First establish acceptable scale and construction; then assess latency and cost per accepted result, including rejected outputs and reruns. Higher quality, more pixels or a different model are not guaranteed improvements.

**Complete when:** any changed default meets agreed visual criteria and latency/cost limits with a documented fallback. Leave existing defaults unchanged if experiments do not justify a change.

## Shared delivery and verification rules

- Use isolated local environments, synthetic fixtures and appropriately consented evaluation data. Production testing and deployment remain outside the current scope.
- Preserve authentication, request limits, private assets, upload ownership, shared-staff history policy and paid-generation idempotency.
- Add focused regressions for behavior changes, then run lint, type checking, the full suite, build and relevant local HTTP checks. Use actual output comparisons for visual claims; mocked API tests do not establish image quality.
- Agree the paid pilot budget and permitted data before making evaluation calls. The earlier proposal was six cases × two conditions × two repetitions: 24 calls, not an executed benchmark or a cost estimate.
- After each batch, record what changed, evidence, limitations and status in the implementation progress document. Do not label experimental benefits as proven before evaluation.

## Separate milestone: Shannon

The broader Shannon assessment remains provider-blocked and separate from these improvement batches. It is not a prerequisite for completing independently verified improvements. No bypass of its cyber-access gate is planned.

## Related records

- [Exploratory research and evidence](IMAGE_QUALITY_REVIEW.md)
- [Implementation progress](IMPLEMENTATION_PROGRESS.md)
- [Security assessment](../security/ASSESSMENT.md)
