# Image-quality evaluation protocol

Status: prepared, **not executed**. The owner permits **no paid image calls for now**. No automatic evaluation runner may invoke a provider under the current authorization. This protocol does not authorize customer-photo use, production access or deployment.

## What the local checks establish

`npm run quality:prepare` creates deterministic cloth references in ignored `.cache/quality-baseline`. Geometry, crop orientation, reference indices, masks, compositing and fallback requests are checked using procedural images and a mocked provider. The browser workflow uses solid-colour stand-ins and a check pattern. These checks cannot establish photorealism, correct garment-scale interpretation or acceptable edit boundaries.

The technical set contains ten cases/twenty PNGs: six original repeat-size cases, three close views paired with their wide views of the same declared 4 cm repeat, and one plain control. Stroke widths scale with capture context as well as repeat spacing. A 100 cm-wide field renders the 4 cm repeat at 40 pixels; a 40 cm-wide field renders that same repeat at 100 pixels. PNG checksums and Sharp/libvips versions freeze the recipe. These are simulated flat captures, not real cloth photographs or approved person/garment examples. Manifest version 2 explicitly leaves the pilot unauthorized and call count unplanned; expanding fixtures does not authorize or automatically enlarge a paid pilot.

`npm run quality:summary -- /absolute/path/to/scored-results.json` is entirely offline. It accepts an array of scored observations and reports each condition's sample count, acceptance rate, median/p95 duration, category means and cost per accepted output. All calls, including rejections and reruns, count toward cost. Missing billing evidence produces unknown cost rather than a guessed price.

## Inputs required before a visual pilot

- Approved synthetic people and garment/construction references. Current procedural swatches alone are insufficient. Customer photos are outside this pilot.
- A plain cloth control, checks, stripes and a larger motif; include wide/close photographs of the same repeat with the same measured repeat, plus different actual repeat sizes. The generated technical fixtures are a starting aid, not this complete case set.
- Suit and traditionalwear construction cases. Include slim/wide lapels, button spacing, collar height, pockets and short/long garments when applicable.
- Background cases with straight lines, high-contrast garment edges, changed sleeve/hem silhouettes, hands/face near the edit boundary and shadows.
- A frozen recipe for each run: case ID, controlled catalogue IDs/version, reference checksums, measured repeats/crop, prompt/preprocessing version/hash, background rectangle/feather, requested/reported settings, actual dimensions, timings, failures, usage and observed billing cost.
- Staff/tailor review availability and an explicitly authorized spending cap. No cap is currently authorized.

## Comparison sequence

1. Hold model, quality, canvas, person and construction fixed. Compare established centre crop with full swatch plus selected detail. Test measurements separately from the extra-reference change so their contribution is distinguishable.
2. Hold the reference treatment fixed. Compare construction instructions against the frozen earlier prompt and have a tailor review expected seam/grain changes. Do not infer physical body measurements from pixels.
3. Hold the accepted scale/construction recipe fixed. Compare prompt-only, masked and composite background methods. Inspect both unchanged regions and garment boundaries; a zero outside-region pixel difference does not prove a good composite.
4. Only then compare quality, supported canvas sizes, reference count and compatible model candidates one factor at a time. A model/default change requires its own documented evidence, measured latency/cost and fallback. Retain current defaults without that evidence.

The earlier six cases × two conditions × two repetitions proposal would require 24 calls. It was never run or approved. The complete sequence above may need a different case count and budget; do not silently reuse 24 as authorization. Randomize displayed condition labels for staff scoring; preserve the mapping privately for analysis. Repetitions are independent outputs, not evidence of deterministic model behavior.

## Scoring and decision record

Each produced-output observation must include `caseId`, `condition`, boolean `accepted`, nonnegative observed `durationMs`, observed `costUsd` or `null`, and all five integer scores from 1–5: `scale`, `colour`, `construction`, `background`, `identity`. A failed call with no output instead records `failed: true`, `accepted: false` and `scores: null`. Failures still count toward sample size, acceptance rate, latency and cost; category means exclude them rather than inventing visual scores. The summary rejects missing categories, fractional scores and string booleans. Do not put images, passwords, provider keys or free-form prompts in the scored-results file.

| Score | Interpretation |
| --- | --- |
| 1 | Severe defect; unusable for showing the intended look |
| 2 | Clear defect that needs another output |
| 3 | Noticeable mismatch; review before use |
| 4 | Minor difference acceptable to the reviewer |
| 5 | Faithful to the intended reference in that category |

Record pattern-too-large and pattern-too-small separately. Judge repeat size relative to the intended garment/body context and measured reference, rather than equating source pixels with centimetres. For construction, use the checklist in [CONSTRUCTION_REVIEW.md](CONSTRUCTION_REVIEW.md). For backgrounds, inspect straight lines, old-clothing remnants, clipped new clothing, halos, lighting discontinuities and face/hand changes. Composite mode's deterministic pixel check compares the resampled/normalized base to the final canvas, not the original file bytes.

Proposed acceptance rule, pending staff agreement: no material identity/body regression; no clipped garments or visible composite seams; all relevant categories at least 4 for an accepted output. Prefer a candidate only when matched cases show better scale/background consistency without worse colour/construction, and measured latency/cost fit owner-approved limits. Small pilots are directional evidence; report per-case failures and sample size rather than claiming a general success percentage for the system.

## Current decision

No paid calls, no observed image-quality scores, no claimed quality gain, and no model/quality default change. Visual acceptance for batches 2–5 and experimental tuning in batch 10 remains open. Continue deterministic verification and preserve the established centre-crop/prompt-only methods for comparison.
