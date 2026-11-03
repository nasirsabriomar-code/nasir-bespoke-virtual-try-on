# Split Outfit: product and model-input review

Reviewed 3 November 2026 against local main at 8ffcf1a. This is a recommendation document, not an implementation or a production image-quality benchmark.

## Recommendation

Keep the existing modular concept and Sunburst provider. Prioritize clearer source assignments, cleaner construction references, garment-aware edit regions, and measured output review. Expand customization after those controls are dependable. Additional prompt text or higher resolution alone should not be treated as an accuracy solution.

## What the implementation actually does

- Slots are jacket, trousers, shirt, optional waistcoat, footwear, and accessories. There is no distinct shorts slot in the inspected schema. Suit is the populated family; other family buttons can lead to a coming-soon state.
- Jacket, trouser, shirt, and waistcoat fabrics can be assigned separately. Without an uploaded fabric, appearance comes from the construction reference.
- Shoes have a photographed construction/material source, but no independent material upload in the current UI. Accessories are text-only instructions, not exact reference transfers.
- The model receives the customer photo first, selected construction references, assigned fabrics, and optional fabric-detail crops. Image numbering is shared between the prompt and input layout.
- Construction references with assigned fabrics are converted to grayscale. This removes color but leaves pattern, texture, and any unrelated garments in the reference. The prompt explicitly anticipates construction images showing complete mannequin looks.
- Full-plus-detail fabric guidance is available, but the default for an unset fabric control is the legacy centre crop. The original upload is retained separately; the model's working reference is what changes.
- Background editing supports prompt-only, a rectangular mask, and compositing outside that rectangle. It does not currently produce semantic garment masks.
- Shared compatibility rules, server-side validation, approved assets, checksums, private storage, idempotency, and recovery are valuable foundations to preserve.

Relevant code: `lib/split-outfit/{types,generation,image-map,prompt,compatibility}.ts`, `lib/tryon/{fabric-guidance,background-preservation,neutralize-construction}.ts`, `lib/tryon/providers/openai.ts`, and `components/split-outfit/`.

## 1. Make every piece's source explicit

For each piece show three independent controls:

1. Design: selected approved garment, including its supported construction details.
2. Appearance: reference material, uploaded fabric, or an approved material library entry.
3. Treatment: preserve existing, replace, or remove where that operation is supported.

Example: “Jacket: double-breasted / uploaded navy check / closed. Trousers: two pleats / linked to jacket fabric / full break.” A customer should be able to inspect this before paying for generation.

Use a fabric asset linked to multiple pieces rather than a one-time copy. Today “Use jacket fabric on trousers” copies the file into a second state slot; later changing jacket fabric does not establish a continuing relationship. Let staff explicitly link or unlink them, and keep crop and repeat measurements consistent while linked.

Correct the review's material count to use actual assignments: its current aggregate reads catalogue default sources rather than whether cloth was actually uploaded. Replace “exact colour, shade, and texture” in upload copy with an aim that requires result review.

## 2. Give the UI a tailoring workflow

Desktop: customer/preview in a persistent central area, piece navigation on the left, focused controls on the right, and a persistent outfit summary and Generate action. Mobile: one piece at a time with a compact summary drawer.

Keep fabric crop settings beside their piece. Put mask/compositing experiments behind an Advanced panel. Use plain labels such as “Whole fabric + detail” and “Centre sample only.” Before generation, show an assembled reference board clearly identified as references, not an accurate preview of the final fit.

Offer approved starting looks such as a business two-piece or evening three-piece. Save named recipes and revisions. Show unavailable choices with an explanation when that helps understanding; announce automatic removals and offer Undo. Freeze the submitted recipe during generation and let later edits become a separate draft.

Suitsupply documents a stepwise configurator with controls for closures, pockets, buttons, waistband, lining, and construction. That is a useful product precedent, not evidence that copying its layout improves this app's conversion or accuracy. [Official customization overview](https://suitsupply.com/en-us/journal/custom-made.html).

## 3. Improve ingestion before changing models

For customer photos, add a framing guide and checks for blur, exposure, multiple people, occluded torso/hands, and missing feet when shoes are being changed. Ask for a retake only when the selected operation needs the missing information. A single photo cannot establish precise body dimensions or physical garment fit.

For construction assets, maintain an approved piece-specific crop or cutout, with optional detail images for distinguishing lapels, closures, pockets, and shoes. Remove unrelated pieces from the model reference rather than relying entirely on instructions to ignore them. Preserve the full original as the audit source. Compare grayscale and color/cutout treatments; grayscale alone cannot remove a reference cloth's pattern or sheen.

For cloth, guide staff to photograph a flat, evenly lit, minimally reflective sample. Preserve full context plus a representative detail as a candidate default for patterned materials. Allow measured repeat width/height and grain direction; do not infer centimetres from pixels or label the result physically calibrated without calibration. A color reference and controlled capture can help a measured workflow, but exact output color remains unverified.

Compile one authoritative recipe into the request: piece IDs, asset versions, role/authority, appearance assignments, layout, mask, prompt version, provider settings, and input hashes. Keep the existing deterministic numbering. Send only relevant references, with detail crops for features that need them; more images are not automatically better.

## 4. Treat layering and preservation as explicit controls

Add jacket open/closed, shirt tucked/untucked, waistcoat visibility, sleeve/cuff exposure, trouser break, and shoe visibility. Represent the layer order explicitly: shirt, waistcoat, jacket; trousers overlap shoes according to break. Add other family-specific controls only when approved references support them.

M&M VTO treats layout instructions and identity/detail preservation as distinct parts of multi-garment generation [1]. An occlusion-focused study explicitly models garment parts and overlap relationships [2]. These findings support testing explicit layout controls; they do not validate a particular prompt or prove a gain for this application.

Replace the rectangular edit selection with editable segmentation, retaining hands and protected body areas where appropriate. Include room for the new garment silhouette and necessary background reconstruction; a mask limited to the old clothing silhouette can clip a wider jacket. Compositing should retain the normalized original outside the approved edit region, with seam and shadow inspection.

OpenAI documents that masks guide generation and need not be followed exactly. Therefore mask-based prompting alone is not a pixel-preservation guarantee. [Image editing documentation](https://developers.openai.com/api/docs/guides/image-generation).

## 5. Evaluate quality and support controlled repairs

Start with a proposed benchmark of 30–50 representative cases, including solid cloth, checks, stripes, dark-on-dark layers, three-piece looks, hands over garments, varied body shapes, and visible footwear. Use consented images and a held-out subset for final comparisons.

Have staff compare variants blind and score separately: customer identity/body, selected design, assigned cloth and repeat, layer boundaries, anatomy, background preservation, and overall realism. Record pass rate, first-pass acceptance, latency, paid attempts, and cost per accepted image. Check original/result differences outside aligned protected regions; use automated vision review as triage, not the sole judge.

First experiments: current inputs versus isolated construction assets; crop-only versus full-plus-detail; rectangular versus editable garment masks; medium versus high quality at the same output dimensions. Change one factor at a time. Repeat a subset to capture generation variability. Set promotion thresholds before examining results; do not invent an accuracy percentage.

Keep Sunburst as the baseline: the app already uses it, and current official documentation positions it for editing precision. Higher quality settings should be benchmarked rather than automatically enabled. Legacy `input_fidelity` advice should not be copied blindly across models. [Current provider guide](https://developers.openai.com/api/docs/guides/image-generation).

Prefer an initial whole-outfit generation to establish coherence. If review finds one defect, offer a localized correction with explicit preserved regions. Repeated full-image regeneration can change approved elements; successive local edits can also accumulate drift. Compare both routes against the original and saved recipe.

## 6. Make generation durable and reviewable

Build on existing idempotency and recovery with a durable job record and explicit stages: validating, preparing references, generating, saving, reviewing, complete. Cache safe derivatives by source hash plus preprocessing version. Persist the paid output before optional review and secondary derivatives. Show a useful partial state if review or secondary saving fails.

Record the submitted recipe and source manifest immutably. Resume the same job rather than silently starting another paid call. Keep a bounded retry policy and visible cost implications. Background job infrastructure should be chosen for the actual hosting limits; this report does not prescribe an unverified provider integration.

## Suggested order

1. Correct source summaries, fabric linking, unavailable-family presentation, and misplaced advanced controls.
2. Establish capture guidance, approved piece crops, and the visual benchmark.
3. Test full-plus-detail, segmentation, and quality settings against the baseline.
4. Add supported construction controls, independently selected shoe materials, and photographed accessories.
5. Add durable job execution, controlled repair, and operational quality dashboards.

## Evidence assessment

| Claim | Verdict | Confidence and limit |
|---|---|---|
| Current accessories are text-only and shoe appearance follows its reference | Verified in repository | High for inspected commit; not a check of the deployed site |
| Layout and occlusion deserve distinct handling | Supported by task-specific research [1][2] | Moderate applicability; the studies use different architectures/data |
| Masks guarantee unchanged surroundings | Contradicted by provider guidance | High for documented mask semantics; compositing is a separate implementation mechanism |
| Full-plus-detail or isolated references improve this app's accuracy | Unverified hypothesis | Must be tested on the app's actual photos and provider |
| More output pixels or a different provider necessarily improves correctness | Unverified | Do not equate resolution with design/material fidelity |
| A stepwise configurator is a credible tailoring product pattern | Verified product precedent | Does not establish a causal UX improvement here |

The strongest boundary condition is that improved reference preparation and controls cannot recover information absent from the photo, guarantee exact fit, or eliminate generative variability. Independent shoe/accessory fidelity also requires actual appearance references.

## Sources and audit trail

Seven Exa searches requested 35 results across provider documentation, multi-garment research, and tailoring configurators. Selected official provider and Suitsupply pages and the CVPR paper landing page were fetched. Two Consensus searches were run, and two decisive paper records/abstracts were fetched. No full-paper method audit, live visual benchmark, paid model calls, or new provider integration was performed. One Google documentation URL failed; a current official capability page was fetched instead. Google's person/product-image interface is a comparison candidate, not evidence that it supports this app's fabric-to-bespoke-recipe task better. [Google capability documentation](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/capabilities/generate-virtual-try-on-images).

[1] Luyang Zhu et al. (2024), *M&M VTO: Multi-Garment Virtual Try-On and Editing*, CVPR, pp. 1346–1356. Fetched Consensus record/abstract; publication confirmed on the [CVPR proceedings page](https://openaccess.thecvf.com/content/CVPR2024/html/Zhu_MM_VTO_Multi-Garment_Virtual_Try-On_and_Editing_CVPR_2024_paper.html). [Consensus record](https://consensus.app/papers/mm-vto-multigarment-virtual-tryon-and-editing-zhu-li/186a80fd38fb58259d724517c008dad7/?utm_source=chatgpt).

[2] Zhen Xing et al. (2023), *Virtual Try-On With Garment Self-Occlusion Conditions*, IEEE Transactions on Multimedia, vol. 25, pp. 7323–7336. Fetched record/abstract; reports evaluation on VITON, not this app's data. [Consensus record](https://consensus.app/papers/virtual-tryon-with-garment-selfocclusion-conditions-xing-wu/5d492de0097c5c53b52a759e6eaf1fff/?utm_source=chatgpt).
