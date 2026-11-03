# Image quality and workflow exploration

Research date: 2026-11-02. Application: Nasir Bespoke virtual try-on.

## Recommendation

Prioritize **fabric repeat/design scale**, then **background stability**, matching the owner's reported problems. Face changes are not a significant reported pain point. Fix the independently reproduced image-metadata and canvas bugs first, then establish a measured baseline before changing prompts, quality settings, or models.

This is research, not an implementation change. No production system, customer image, storage service, or paid generation was accessed. Existing security patches remain intact. No actual generated output examples were supplied, so explanations for the reported visual symptoms remain hypotheses rather than confirmed causal diagnoses.

## 1. Fabric/design scale: the main investigation

The owner reports both directions of error: a large-looking reference detail becomes small in the output, or a small-looking reference detail becomes large. This review interprets this as motif/repeat size or garment-detail proportion, rather than output pixel dimensions. If the symptom concerns garment length or silhouette instead, add a separate garment-proportion evaluation.

Observed implementation:

- `centerFabricRepeat` in `lib/tryon/providers/openai.ts` always extracts the central 50% of width and height for sufficiently large fabrics. That retains 25% of the photograph's area. Staff cannot review or select that generated crop.
- Prompt instructions ask to preserve scale, but no measured repeat size or physical swatch calibration is supplied to the provider.
- The centre crop is the fabric reference sent for generation; the original stored asset alone does not tell the model what was removed.
- The prompt asks stripes and checks to continue across seams, pockets and jacket-to-trouser boundaries. That is a design-policy assumption, not a universal construction rule. A tailor should review whether particular panels should align, rotate or legitimately break a pattern.

**Working hypothesis:** cropping changes how much of the repeat is visible, while camera distance, perspective and absent calibration leave the intended garment-scale repeat ambiguous. A larger output canvas does not supply missing physical scale information. We have not demonstrated that the crop causes the owner's specific failures.

Recommended experiment:

1. Keep the full swatch as the scale/context reference. Let staff select a flat detail region for weave and colour; show both previews before Generate. Give each input an explicit role in the server-generated instruction and image mapping.
2. For patterned fabrics, optionally record a known repeat width/height, such as a measured check width, alongside a ruler photographed in the same plane. Keep calibration markers outside the detail crop. Treat this as guidance, not a promise of millimetre-accurate cloth rendering.
3. Offer a controlled correction such as “pattern appeared too large / too small,” attached to the output. Preserve the submitted recipe and evaluation metadata; never turn staff feedback into an unrestricted prompt field.
4. For design details, distinguish motif scale from garment architecture. Evaluate lapel width, button spacing, pocket size, collar height and hem length relative to the customer's visible body and intended blueprint. Do not infer physical dimensions from the reference's pixel size alone.

Expected benefit: better scale context and useful staff feedback. Actual improvement must be established on matched examples.

## 2. Confirmed bugs reproduced without image API calls

| Finding | Local observation | Effect and proposed correction |
| --- | --- | --- |
| Lossy WebP dimension parsing | A real Sharp-generated 640×480 lossy WebP is reported as **2×8193** by `detectImageDimensions`. | VP8 width/height use little-endian values; the parser reads them big-endian. Wrong dimensions can affect canvas selection and stored metadata. Correct byte order; test several VP8 dimensions plus existing VP8L/VP8X paths. |
| Rotated fabric crop metadata | An 800×1200 JPEG with EXIF orientation 6 produces a crop reported as **400×600**, while the resulting PNG is **600×400**. | The returned dimensions are calculated before rotation. Return actual output dimensions from Sharp. Test EXIF orientations and non-square crops. This metadata mismatch is proven; a visible output-quality impact has not been measured. |
| Custom canvas exceeds edge limit | A 1000×3000 input requests **1648×4976**. Normal 900×1600 input requests 2160×3840. | The calculation constrains total pixels/aspect ratio but not each edge. Enforce both edge and pixel limits before submission, keeping dimensions divisible by 16. The current size-error fallback can hide the invalid first request. |

Sources: `lib/validation.ts:83–85`; `lib/tryon/providers/openai.ts:18–38,60–87`.

The current provider documentation specifies an edge limit of 3,840 pixels; larger-than-standard resolutions are experimental. This confirms the third result is outside the documented contract, without requiring a paid rejection test. [Official image-generation guide](https://developers.openai.com/api/docs/guides/image-generation).

## 3. Background stability

Current scene protection is textual: `SCENE_LOCK` says every unrelated pixel must remain unchanged, but the request uses no mask and performs no compositing. Strong wording is not a pixel-preservation mechanism.

Explore two increasingly controlled approaches:

- **Garment edit mask:** restrict the intended edit region while allowing sufficient space for new sleeves, hems and silhouette changes. Masks are advisory in GPT Image, not exact boundaries. [Official masking guidance](https://developers.openai.com/api/docs/guides/image-generation).
- **Composite outside the approved edit region:** preserve the aligned original outside a reviewed garment/occlusion/shadow region, with careful boundary blending. Establish a common canvas before comparison. Incorrect masks can preserve old sleeves, cut off new garments or create halos. This should be an experiment, not an automatic deployment.

OpenAI's prompting documentation specifically recommends compositing when a region must remain pixel-identical. Evaluate background drift separately from garment quality, and inspect faces for regression without making a new face-processing pipeline the priority. [Official prompting guide](https://developers.openai.com/api/docs/guides/image-prompting).

## 4. Reliability, staff effort and observability

| Priority | Observed gap | Proposed improvement | Evidence status |
| --- | --- | --- | --- |
| High | `readGenerationStatus` has no fetch deadline. The recovery loop limits read count, not the duration of a read. A never-resolving status dependency remains blocked in the first read. | Per-read timeout plus an overall recovery deadline; distinguish expired sign-in from transient failures. Preserve the same generation key. | Confirmed control-flow gap, reproduced with a hanging local dependency; no real network outage measured. |
| High | The active generation key lives only in a React ref. Refresh discards it. | Recoverable pending-job metadata scoped to the signed-in account, with expiry and cleanup. Store no customer photo bytes in browser persistence. Reconcile server state after reload before allowing a new paid run. | Code-confirmed gap; tab-refresh UX not browser-tested in this review. |
| High | Upload initiation, chunk transfer and completion have no explicit client deadline; chunks run sequentially and one failure ends the upload. | Deadlines, cancellation before paid generation, bounded retries of safe same-slot/same-index chunk PUTs, and resumability only after status/race semantics are verified. Never blindly retry generation. | Code-confirmed; prevalence on showroom Wi-Fi unknown. |
| Medium | Upload percentage resets for each file. There is no aggregate byte progress. | “Customer 2 MB / 8 MB”, total progress, and separate upload/validation/generation/save stages. Avoid invented time estimates. | Code-confirmed UX limitation. |
| High | Provider response metadata includes usage, actual dimensions and reported quality, but `recordUsageSafely` saves only a subset. | Store prompt version, exact model/snapshot where available, requested/actual size, reported quality, preprocessing version, fallback attempts, timings, token usage and staff acceptance. | Code-confirmed instrumentation gap. |
| Medium | Catalogue readiness probes every active path each request; failures are shown as awaiting approval. | Short-lived readiness cache with invalidation; distinguish temporary storage outage from genuinely missing/unapproved assets. Continue failing closed for generation. | Code-confirmed behavior; performance benefit not measured. |
| Medium | Current result comparison toggles the whole image and exposes one PNG master. | Synchronized zoom/side-by-side inspection, a fabric-detail crop, saved favourites and explicit failure reasons; retain PNG master and optionally offer a smaller derived share export. | Product proposals; staff evaluation required. |

Relevant sources: `lib/generation-recovery.ts:23–26,46–65`, `components/TryOnApp.tsx:81–106,146,308–325,383`, `lib/try-on-handler.ts:322–334`, `lib/catalog/availability.ts`, `components/TryOnResult.tsx`.

## 5. Quality and cost optimization: measure before changing defaults

The application already uses **GPT Image 2.5 Sunburst**, fixed **medium** effort, PNG output, explicit reference roles, orientation handling, private masters and duplicate-generation guards. Preserve these strengths. README references to GPT Image 2 and JPEG are stale and should be reconciled with actual code.

The current prompting guide recommends testing quality and latency on the application's own examples, one variable at a time. Higher effort is not guaranteed to improve each result. Do not assume a switch to max effort, another model, or more reference images fixes scale. [Official prompting guide](https://developers.openai.com/api/docs/guides/image-prompting).

Recommended evaluation workflow:

- Create a consented/synthetic fixture set covering checks, stripes, motifs, plain controls, full outfits and jacket-only edits; include known repeat measurements and wide versus close fabric captures.
- Start with six difficult cases, two preprocessing conditions and two repetitions: **24 proposed image calls**, only after a separate budget and data-use approval. No calls were made in this review. Expand the sample if results are variable.
- First compare the existing crop against full-swatch-plus-detail inputs. Hold model, quality, dimensions and prompt version fixed apart from the reference-role changes necessary for the experiment.
- Score motif scale/density, colour, tailoring details, background drift and staff acceptance separately. Use blinded staff comparisons. For scale, compare repeat spacing on designated approximately flat garment regions; folds, perspective and garment changes limit direct pixel comparisons.
- Track median and slow-response latency, failure/fallback rate and **cost per staff-accepted result**, including rejections and reruns. Token counts alone do not capture staff effort or retry cost.
- Only after establishing a baseline, test medium versus higher effort. Test another supported model only if it meets the same garment-quality requirements. Keep automatic retries of uncertain paid requests disabled.

Proposed acceptance: no identity regression, no new garment-construction errors, staff agreement that scale improves on the target cases, and an agreed cost/latency ceiling. Do not invent a universal physical-scale tolerance without a measurement protocol.

## 6. Evidence ledger and boundaries

| Claim | Verdict / confidence | Decisive evidence / limitation |
| --- | --- | --- |
| The three metadata/canvas bugs exist | Supported / high | Synthetic local execution of the current functions; no provider calls. |
| The centre crop is responsible for reported scale errors | Unverified / low | Crop behavior is confirmed, but no matched failed outputs or causal experiment exists. |
| A measured swatch plus explicit input roles will improve this app's pattern scale | Hypothesis / moderate rationale | More scale context is available, but the visual improvement is unmeasured. |
| A mask alone guarantees the original background | Contradicted / high | Official documentation describes masks as guidance. |
| Texture-preserving conditioning and localized edits merit investigation | Partially supported / moderate | Two fetched research records discuss texture transfer, masks and difficult geometry; their models and benchmark garment inputs differ from this application. |
| Raising quality always fixes scale or identity | Unsupported / high confidence in the limitation | Provider guidance requires workload evaluation and explicitly avoids a universal guarantee. |

Scientific records audited through Consensus:

[1] Xu Yang et al., 2024, **Texture-Preserving Diffusion Models for High-Fidelity Virtual Try-On**, CVPR, pp. 7017–7026. Fetched abstract/record describes texture-preserving conditioning and mask prediction, evaluated on VITON/VITON-HD. The CVF search record confirms conference publication. This does not establish performance on flat fabric swatches, bespoke suits, sherwanis or this provider. [Fetched paper record](https://consensus.app/papers/texturepreserving-diffusion-models-for-highfidelity-yang-ding/9ed0e562bb425194b9cd21107afe9ecf/).

[2] **GP-VTON: Towards General Purpose Virtual Try-On via Collaborative Local-Flow Global-Parsing Learning**, 2023, CVPR, pp. 23550–23559. Fetched record discusses texture distortion under difficult poses/garments and benchmark-specific local warping. Applicability is methodological, not evidence to replace this application's model. The returned author string appears malformed, so it is not reproduced as verified bibliographic metadata. [Fetched paper record](https://consensus.app/papers/gpvton-towards-general-purpose-virtual-tryon-via-xiel-huang/2de77ddadf835bb49854d43f2a55b087/).

Counterevidence/boundaries: improved reference detail does not establish correct physical scale; masks can be imprecise; segmentation/compositing can introduce visible boundaries; benchmark garment transfer differs from applying flat cloth to constructed tailoring; a newer model or higher setting need not improve a particular case.

## 7. Suggested order

1. Correct the three reproduced image bugs and bound recovery/upload waits; add synthetic regressions.
2. Add generation provenance and staff feedback before changing visual defaults.
3. Prototype full-swatch/detail previews and measured repeat guidance; run the scale-focused pilot under an explicit budget.
4. Prototype garment masking/compositing on the same difficult examples for background preservation.
5. Add refresh recovery, upload resumability, aggregate progress and comparison tools; evaluate catalogue caching after timing its current path.

## Research audit

Repository inspection and synthetic fixtures were read-only with respect to application code. Exa ran one successful documentation discovery query (four returned sources; one earlier schema-validation error yielded no evidence). Consensus ran two searches (ten results each; overlap not deduplicated into a claimed unique count), then two paper-record fetches. A separate web search located primary CVF proceedings records; direct opens returned 403. No paper full text was read. Official OpenAI pages read: image-generation guide, image-prompting guide and image-edit API reference, including focused sections on dimensions, masks and editing. Exa extracts included an older inconsistent API description; current opened official documentation was used for decisive vendor facts.

This is a bounded exploratory review, not a systematic literature review, live production performance assessment, output-quality benchmark or complete bug audit. Measured production latency, spend, failure frequency, consented example outputs and staff ratings remain unavailable. No functional changes or new image-generation requests were made.
