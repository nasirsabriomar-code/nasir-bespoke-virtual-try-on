# Research reconciliation — 2026-11-03

Compared IMAGE_QUALITY_REVIEW.md, the ten-batch roadmap, current implementation, test coverage and completed verification logs. This is a status reconciliation, not a new penetration test or image-quality benchmark. No code or provider settings were changed.

## Counts

- Ten of ten original improvement batches have been worked on. Batches 1–9 contain implementation changes; batch 10 has evaluation tools, fixtures and documentation, but its experiments have not run. This is not a ten-of-ten completion claim.
- Three of three reproduced image-format/rotation/canvas bugs were fixed. The independently reproduced stalled-recovery gap and related request deadlines were also addressed.
- Eight of eight subsequent instruction-review findings were addressed in code and offline packet/regression checks. These overlap the image-quality batches and must not be counted as eight additional independent product batches.
- Four of four earlier confirmed security findings were fixed and locally verified. They came from the local assessment, not a completed Shannon scan.

## Original batches

| Batch | Delivered | Still open |
| --- | --- | --- |
| 1 | WebP/crop/canvas correctness; bounded upload and recovery operations | No outstanding item identified in this batch's local correctness contract |
| 2 | Provenance, account-specific feedback/favourites, technical fixture preparation | Representative approved person/garment cases, actual baseline outputs and staff scoring |
| 3 | Full-swatch/detail controls, previews, measured-repeat guidance, mapped reference roles | Matched scale evaluation over capture distances/pattern types; no causal proof that the old crop caused reported failures |
| 4 | Garment-proportion guidance, seam/grain and closure/trim instruction conflict fixes | Professional tailor review and matched construction outputs |
| 5 | Opt-in masks/compositing, normalized-region preservation, boundary/alignment safeguards | Actual boundary, clipping, halo, lighting and identity review |
| 6 | Refresh/navigation recovery, original-key reconciliation, unknown-outcome guard and expired-session behavior | Real staging integration remains outside local fixture evidence |
| 7 | Retry/resume/cancel, byte/ownership/expiry protection, duplicate/completion/consumption race handling | Real staging database/storage integration; SQL locking source-reviewed rather than exercised against live infrastructure |
| 8 | Active-file progress, named processing labels, fabric/result zoom comparison, feedback and mobile/History fixes | Generation/save currently share a status rather than separate live stages. Result comparison uses full fabric plus zoom; a dedicated saved detail-crop/output comparison was not added. Smaller sharing export remains conditional/deferred; private PNG download exists. |
| 9 | Readiness cache, deduplication/invalidation, outage labels and ready-reference selection | Real staging latency/load measurements; local probe-count reduction is verified |
| 10 | Offline score/latency/cost summaries, failed-run accounting, ten technical cases/twenty PNGs, runtime docs | Actual quality/resolution/reference-count/model experiments and observed cost/latency acceptance |

## Research conclusions

The principal priorities remain repeat/design scale and background stability. Wrong image dimensions, rotated crop metadata and invalid requested canvases were reproducible defects, and are fixed. Crop magnification, absent physical context and conflicting instructions were plausible contributors to visual scale errors; no matched generated outputs establish their causal effect or the improvement percentage. Higher quality/resolution/model changes are not demonstrated remedies.

## Verification and limits

Latest completed instruction milestone: **210 passing tests**, lint, type checking, production build and local HTTP checks. The earlier improvement milestone included **13 passing browser workflows**; these were not rerun or presented as prompt-quality evidence. Older 174/180/188/204 counts in historical reports describe earlier milestones, not the latest total.

All output-quality and provider packet checks used synthetic fixtures/mocks. There are no observed visual scores. The current technical cloth set has no approved representative person/garment evaluation fixtures. Paid image calls remain disallowed, model/medium-quality defaults remain unchanged, Shannon is still blocked before analysis by provider approval, and no production deployment occurred. Changes remain uncommitted.

Remaining work therefore comprises visual/tailor acceptance, staging integration/performance evidence, the smaller batch-8 gaps above, the separate Shannon milestone, and final change review/release if authorized. No automatic paid correction loop or production test is authorized by this report.
