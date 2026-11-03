# Image pipeline improvement progress

Updated: 2026-11-02. Current status and evidence are in [IMPROVEMENT_REPORT.md](IMPROVEMENT_REPORT.md). The full goal remains open; the owner permits **no paid image calls**. All ten engineering work areas now have code/tools/documentation, while visual acceptance and tailor review remain pending. The first-batch record below is historical.

## Completed first batch

- Corrected lossy WebP dimensions to use the format's little-endian width/height fields.
- Fabric crops now report the actual dimensions produced after EXIF rotation.
- Canvas selection now satisfies both total-pixel and 3,840-pixel edge limits while keeping dimensions divisible by 16. Normal 9:16 portraits retain 2160×3840 output requests.
- Upload initiation, chunk transfer and completion requests have 60-second deadlines, including reading their response bodies.
- Generation recovery has 10-second per-status-read deadlines and a six-minute overall deadline. A stalled read cannot keep recovery open indefinitely. Recovery continues using the original generation key and does not submit another paid generation.

Six additional tests cover actual lossy/lossless/extended WebP files, all eight EXIF orientations for fabric crops, extreme canvas aspect ratios, recovery after a stalled read, overall recovery expiry and stalled upload response bodies.

Validation: lint, type checking, all **180 tests**, production build, local HTTP security checks and diff whitespace checks passed. All work used synthetic images or local fixtures. No paid image call or production access occurred.

## Research and experiments after the first batch

The first batch left fabric guidance, background masks/compositing, refresh recovery, provenance and staff feedback as separate work items. They have since been implemented as recorded below. Correct metadata and valid canvases do not establish that fabric motif scale or background fidelity is solved; those require matched outputs and evaluation.

Shannon remains a separate provider-blocked assessment milestone. Earlier security fixes are preserved.

## Active all-batches goal — engineering progress

Final acceptance is **blocked on external evidence**: approved matched image outputs and staff/tailor review are still missing, and paid image calls remain disallowed. The [implementation report](IMPROVEMENT_REPORT.md) distinguishes completed local engineering from these remaining acceptance gates. The objective has not been marked complete.

- **Batch 2:** sanitized provenance persistence, account-isolated feedback/favourites, safe load-before-save behavior, technical records, swatch preparation and offline summaries. API and browser checks passed; representative visual baseline/scoring remains outstanding.
- **Batch 3:** opt-in full/detail reference previews, upright crop controls, optional measured repeats and explicit server image roles. Schema, crop/EXIF, provider mapping and browser checks passed; scale improvements remain unproven.
- **Batch 4:** separate detail-proportion guidance and corrected seam/grain instructions in both shared and Split Outfit prompts. Source audit and regressions complete; professional tailor and output review pending.
- **Batch 5:** opt-in mask/composite rectangle, inward feather, matching first-image PNG/mask across fallbacks and normalized outside-region pixel preservation. Synthetic/provider tests passed; real appearance/boundary acceptance pending. A final aspect-ratio guard rejects unsafe stretching.
- **Batch 6:** refresh/navigation/account-scoped recovery, original-key reconciliation, explicit unknown-outcome guard, authentication expiry and logout cleanup. Browser checks cover refresh, navigation back, temporary failure, unconfirmed outcome, expired authentication and cross-account metadata.
- **Batch 7:** fingerprinted checkpoints, same-slot resumption, bounded safe retries and cancellation. Tests cover exact bytes, ownership, expiry, duplicate parts/completion, late parts, consumed-slot protection and overlapping memory-ledger sets. PostgreSQL locking is source-reviewed; live Neon/R2 was not tested.
- **Batch 8:** active-file aggregate progress, stage labels, synchronized fabric/result comparison, favourites/reasons, reachable History controls and mobile layout/accessibility fixes. Browser checks passed. Smaller sharing exports were conditional on staff need and remain deferred.
- **Batch 9:** bounded 30-second realm-isolated readiness cache, in-flight deduplication, write invalidation, uncached errors and differentiated availability labels. Probe-count and browser reference/variant selection checks passed; no production latency claim.
- **Batch 10:** deterministic fixtures, strict offline summaries (including failed calls without invented scores), current runtime docs and controlled evaluation protocol. Paid model/quality comparisons remain disallowed; model/quality defaults stay unchanged.

Final local verification: lint, type checking, **204 tests**, **13 browser workflow checks**, build, local HTTP security checks, offline fixture/summary commands and diff whitespace checks passed. The final alignment guard is included. No paid calls or production access. Shannon remains separately blocked; all prior security regressions remain green. See [verification-2026-11-02.json](verification-2026-11-02.json).

Offline follow-up closed a preparation gap: ten technical cases/twenty reference PNGs now include a plain control and three same-cloth wide/close pairs. Their dimensions, checksums, observed checks/stripe pixel periods, plain uniformity and deterministic regeneration were verified; lint passed. Application code is unchanged in this follow-up. Representative people/garment cases and actual-output evaluation are still outstanding, and the manifest authorizes no pilot.

Remaining acceptance work: representative approved synthetic people/garment cases, tailor review and actual matched output comparisons under a separately authorized budget. The owner has declined paid calls for now; do not retry the budget question or run them implicitly. Use [QUALITY_EVALUATION_PROTOCOL.md](QUALITY_EVALUATION_PROTOCOL.md) and retain the established methods until evidence supports a change. Do not mark the full goal achieved from code or mock tests alone.

Acceptance audit: the current manifest contains ten technical cloth cases, zero person/garment fixtures and zero observed scores. No scored-result files or tailor confirmation have been supplied. This same visual/human-evidence dependency has persisted through three consecutive goal turns; local engineering, fixture preparation, verification and reporting have been completed as far as the present authorization permits. Further automated test reruns or additional procedural swatches would not satisfy the remaining visual gates.
