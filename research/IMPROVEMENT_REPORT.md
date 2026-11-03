# Ten-batch improvement report

Date: 2026-11-02. Scope: this repository and isolated loopback environments only. No production access, deployment, customer-photo evaluation or paid image calls.

## Outcome and acceptance status

The engineering changes below are implemented. **The full ten-batch goal is not complete:** improved fabric-scale accuracy, garment construction and background appearance still require matched actual outputs and staff/tailor evaluation. The owner has prohibited paid image calls for now. Technical fixtures and mocked-provider/browser checks do not replace that evidence.

Acceptance is **blocked pending external evidence**. The final audit found no approved person/garment evaluation fixtures, observed output scores or tailor confirmation in the current records. The ten technical cloth cases and passing local checks remain available for review, but cannot satisfy the visual-quality requirements. Paid calls remain disabled, and the requested tailor review is pending. No further local implementation work was identified that would resolve this dependency without changing the agreed acceptance criteria.

The established centre-crop and prompt-only background treatments remain the defaults. The model alias, medium quality, PNG master format and existing resolution policy are unchanged by experimental quality tuning. Construction/pattern instructions have changed to resolve conflicting rules; their visual benefit remains unproven.

## Changes by batch

| Batch | Implemented behavior | Evidence and remaining gate |
| --- | --- | --- |
| 1. Image correctness/deadlines | Correct WebP dimensions; upright crop dimensions; bounded canvases; upload and recovery deadlines, including response bodies | Synthetic image/EXIF/canvas tests and timeout regressions. This fixes deterministic faults, not motif-scale interpretation. |
| 2. Provenance, feedback, baseline | Bounded metadata retains requested/reported settings, dimensions, usage, prompt hash/version, processing version, reference/region recipe, fallback attempts and stage timings. Account-isolated decisions/favourites/reasons survive reload. Failed feedback reads cannot overwrite prior reviews. | Metadata round-trip and API isolation/CSRF tests; browser save/reopen checks. Model snapshot stays unknown when unavailable. Technical swatches prepared; representative visual baseline and actual scores pending. |
| 3. Fabric scale | Opt-in full swatch plus selected upright detail; exact preview geometry; optional centimetre repeats; server-controlled image-index guidance | Crop/EXIF/schema/role-mapping tests and browser controls. Full/detail benefits, measurement interpretation and capture-distance consistency require matched outputs. |
| 4. Construction proportions | Separate repeat scale from lapels, collars, button spacing, pockets and length. Resolve universal seam-continuity conflicts in both shared and Split Outfit instructions. | Prompt regressions and source audit; [tailor checklist](CONSTRUCTION_REVIEW.md). Professional cutting/grain review and actual-output comparisons pending. |
| 5. Background preservation | Opt-in mask and composite methods with garment rectangle and inward feather; first PNG/mask dimensions remain matched across compatibility fallbacks. Reject incompatible output aspect ratios instead of stretching the customer. | Every-pixel synthetic outside-region preservation, alignment-rejection and mocked provider/fallback tests. Outside-region preservation refers to a normalized/resampled base. Halos, clipping, old-clothing remnants and face regressions need actual visual inspection. |
| 6. Generation continuity | Account-scoped minimal pending metadata, original-key reconciliation, explicit unknown-outcome guard and authentication-expiry handling. Temporary server errors reconcile rather than create another generation. | Recovery/unit and browser refresh/account checks. No photo bytes or session tokens are persisted for this feature. Pending keys expire after 15 minutes; status reads are bounded. |
| 7. Upload resilience | Same-slot fingerprinted checkpoints, acknowledged-part resume, bounded safe chunk retries and pre-generation cancellation. Completion is idempotent and cannot revive consumed uploads. Recheck slow parts around writes; reject expired slots. | Byte-exact resume/retry/cancel, ownership, duplicate parts/completion, late-part and consumption tests. PostgreSQL consumption locks the whole eligible set before all-or-none update; no live Neon/R2 integration was contacted. |
| 8. Staff tools | Aggregate active-file byte progress, upload/validation and generation/save labels, synchronized zoom/scroll, fabric/result comparison, favourites and controlled failure reasons | Browser interactions plus mobile overflow and History table reachability fixes. Master downloads remain private PNGs. A separate sharing export was conditional on staff need and has not been added. |
| 9. Catalogue loading | Bounded 30-second readiness cache, in-flight deduplication, storage-realm isolation, local write invalidation and uncached errors; distinguish outages/missing/unapproved references. Design viewer requires a ready reference/variant. | Probe-count tests establish avoided repeated checks, plus readiness/selection browser checks. No production latency claim; other instances observe changes after TTL. Generation still reads actual private references and rejects unavailable assets. |
| 10. Quality/cost tuning | Deterministic swatch preparation, offline scoring/latency/cost summaries, failed-run accounting without invented visual scores, current runtime documentation and controlled comparison protocol | Summary math/schema tests and offline CLI smoke check. No quality/model experiment was run; no changed default is justified. Costs remain unknown without observed billing evidence. |

## Additional defects found while verifying

- A failed feedback load could enable saving empty default feedback. Saving now requires a successful load for the current generation.
- Progress could include a fabric not used by the active outfit, and a stale custom lower fabric could leak into jacket-only preparation. The same active-role list now drives controls, bytes and uploads.
- A generation response could hang after headers, or a proxy error could permit abandoning the original key. The response body is bounded and ambiguous outcomes reconcile first.
- History details could shrink the table until controls were unclickable. Panel children retain their size within the scrolling panel, and reopening starts at the list.
- Mobile fieldsets/selects, fabric-region choices and negative header margins caused horizontal overflow. Layout now fits the checked 390-pixel viewport; the mobile logout icon has an explicit accessible name.
- Successful logout could redirect a browser fetch to the framework's internal `localhost` host. A relative `/login` redirect preserves the 303 contract, cookie clearing and revocation while remaining on the browser's origin.
- Failed evaluation calls had no truthful way to supply mandatory visual scores. They now use `failed: true`, `scores: null`, and still count toward cost, latency and acceptance rate.

## Verification record

Final local verification: **204 tests passed, 0 failed** (54 security, 67 catalogue, 4 bespoke, 8 rendered-source and 71 storage/client/pipeline tests). **13 browser workflow checks passed with zero page errors.** Lint, type checking, production build and local HTTP security checks passed. Additional edge cases cover navigation back, unknown-outcome blocking, authentication expiry, expired uploads and background alignment rejection. Offline fixture preparation and the summary CLI smoke check passed. `git diff --check` passed.

The browser run finished at 2026-11-02 17:54 UTC. The final server/image alignment guard was subsequently verified through the complete test/build/HTTP sequence; it does not alter browser controls. A durable machine-readable summary is in [verification-2026-11-02.json](verification-2026-11-02.json).

Offline fixture follow-up: added the missing plain-cloth control and three wide/close pairs representing the same declared 4 cm cloth repeat. The technical set now contains ten cases/twenty PNGs with reference checksums and renderer versions. Checked every reference's dimensions/checksum, measured the checks/stripe pixel periods (40 wide versus 100 close), verified uniform plain pixels and reproduced an identical manifest/checksum set on regeneration. Lint passed. This changed fixture preparation/documentation only; the 204 application tests and 13 browser checks above were not unnecessarily repeated. No actual model outputs or visual scores were added. The manifest explicitly authorizes no pilot and leaves paid call planning unset.

The browser uses the actual local application and real synthetic staff login/logout. Catalogue, image storage, generation and status responses are synthetic service fixtures. Provider tests inject a mock SDK and procedural images. Session tests use two isolated Node processes and a loopback Redis REST fixture; this is not live Upstash validation. Upload tests use the in-memory ledger and mocked object storage; PostgreSQL locking changes were source-reviewed, not exercised against live Neon infrastructure. These boundaries limit the claims above.

Repeatable commands:

```
npm run verify
npm run build
npm run test:security:http
npm run test:improvements:browser
npm run quality:prepare
npm run quality:summary -- /absolute/path/to/scored-results.json
```

Run browser/HTTP checks and builds sequentially because development servers regenerate Next build artifacts. The browser checker requires installed Playwright and Chrome; see README for the optional test-only module path. Both local server scripts refuse environment files and pass no external-service credentials. Servers and browser contexts are stopped in cleanup paths; screenshots/results remain under ignored `.cache/improvement-browser`.

The change set includes no dependency upgrades, SQL migration, production configuration change or deployment. `.env.example` now documents the R2 variables already required by existing runtime code. A pattern-based review of changed/new text files found no high-confidence credential/private-key matches; this is not a guarantee against every secret format. Generated caches/build output and local credentials are not included in the reviewable change set.

## Expected improvements and limits

Deterministic image bugs, bounded waits, interrupted uploads and recovery guards should reduce avoidable failures and accidental repeat submissions. Staff can inspect references/results and record actionable feedback. Repeated catalogue reads avoid redundant readiness probes during the cache window. None of this proves a percentage improvement in image quality or operating cost.

Full/detail guidance may improve scale consistency, proportion instructions may improve construction and compositing deterministically retains normalized pixels outside its selected region. Actual appearance can still worsen at boundaries or misinterpret scale. Keep the established methods available and inspect outputs before staff acceptance.

See [QUALITY_EVALUATION_PROTOCOL.md](QUALITY_EVALUATION_PROTOCOL.md) for the remaining input, scoring, budget and comparison gates. Paid calls remain disallowed; no customer data is authorized for that pilot. Retain current model/quality defaults until evidence justifies a change. Redis outages intentionally deny session-dependent access temporarily. Completed-image/review retention and the intentional shared-staff asset policy remain unchanged.

Shannon remains a separate open assessment milestone, blocked at provider cyber-access approval before analysis. No Shannon finding or completed autonomous retest is claimed.
