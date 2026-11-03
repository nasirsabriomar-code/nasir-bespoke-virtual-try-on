# Instruction engine review

Date: 2026-11-02. Read-only application audit; no generation calls, provider-setting changes, deployment or runtime prompt edits.

Subsequent authorized implementation: see [INSTRUCTION_ENGINE_PROGRESS.md](INSTRUCTION_ENGINE_PROGRESS.md). The findings below preserve the original audit evidence; they are not a statement that those original runtime instructions remain in place.

## Scope and evidence

Searched application routes, components, libraries, scripts and tests for prompt/instruction construction and provider calls. Traced the three builders (`lib/tryon/prompt.ts`, `lib/catalog/level1-prompt.ts`, `lib/split-outfit/prompt.ts`), catalogue/profile fragments, bespoke compiler, handler image preparation and final SDK request. Agent/repository instructions govern development; they are not automatically included in the image API prompt. Shannon's separate agent instructions are not part of this application image-generation chain.

Offline assembly reproduced a double-breasted Split recipe, Level 1 tuxedo, Royal Sherwani and legacy blazer/trousers/Oxford recipe. No customer assets, SDK operations or storage requests were used. Findings establish conflicting or ambiguous instructions; they do not establish the resulting image failure rate.

## Priority findings

### 1. Double-breasted button conflict — confirmed, high priority

`lib/split-outfit/prompt.ts:100` requires jacket buttons in one vertical column for every recipe. `lib/split-outfit/catalogue.ts:268` explicitly selects a double-breasted 6x2 fastening. Both clauses appear in the same assembled double-breasted prompt.

Replace the blanket column rule with a conditional closure rule derived from the selected construction. Keep the useful prohibition against stacked/duplicated buttons and cross-layer jacket/waistcoat contamination. Verify single-breasted, double-breasted and three-piece assembled requests separately.

### 2. Material authority needs explicit finish/trim exceptions — confirmed overlap, high priority

The Level 1 tuxedo asks for satin lapels/facing and a satin trouser stripe (`lib/catalog/level1-seed.ts:395–400`), while `lib/catalog/level1-prompt.ts` assigns uploaded cloth authority over finish/material appearance and reinforces a sole fabric authority. The intended exception is not explicitly represented. Split's construction-authority paragraph also limits the fabric override to colour/shade/texture, while its per-piece override assigns pattern, scale, weave, sheen and finish.

Compile one per-piece material policy: uploaded cloth for named base panels, selected satin/grosgrain/contrast facing where explicitly specified, construction reference for cut only when that panel has an uploaded cloth. For unassigned pieces, retain their designated reference appearance. Avoid resolving this with another general override paragraph.

### 3. Background invariants conflict with legitimate edit effects — confirmed wording conflict

`SCENE_LOCK` says every other pixel, including shadows, stays unchanged. The legacy person module allows minimal reconstruction around clothing; the provider's optional edit-region instruction allows silhouette/shadow changes. New garments can cover or reveal different areas, so the permission boundary should be explicit.

Keep identity, body, pose, camera, framing and unaffected surroundings fixed. Permit only necessary reconstruction/contact shadows inside the intended edit area. Generate method-aware text for prompt-only, mask and composite modes. Pixel preservation outside a composite region is enforced by code; wording alone cannot guarantee it.

### 4. Legacy original-photo authority is too broad — confirmed text conflict, narrower active scope

`lib/tryon/prompt.ts:11` says Image 1 wins against every other image, while later clauses require changing its clothes using fabric/design references. Its generic reference paragraph also says to ignore reference footwear even when an explicitly selected shoe reference is supplied. Full/Split builders have more specific rules, so this primarily affects the retained legacy route.

Scope authority by attribute: customer for identity/body/scene; selected construction for garment geometry; assigned fabric for material appearance; selected accessory for that accessory only. Avoid a global image winner.

### 5. Fabric scale still lacks one consistent definition — improvement hypothesis, highest user relevance

The full/detail guidance correctly separates the complete swatch from its detail crop and supports optional centimetre repeats. Shared/Split wording still asks for exact or same scale without consistently distinguishing camera magnification, intrinsic cloth repeat and its projected appearance on the body.

State that zooming/cropping a swatch does not change physical repeat size. Apply measured repeat guidance when supplied; otherwise preserve pattern relationships without inventing exact centimetres from pixels. Permit perspective compression and bending over folds while retaining intrinsic repeat density on each cloth panel. Keep fabric-repeat scale separate from lapel/pocket/button proportions. This is a hypothesis requiring matched outputs, not a demonstrated cure for scale drift.

### 6. Compiler priorities are not attached to emitted rules — confirmed compiler gap

`lib/bespoke/engine.ts:199–215` tells the model to prefer critical/high over medium/low attributes, but emits plain group/fragment lines without those ranks. Negative constraints are filtered and truncated to sixteen in their incoming order, rather than priority order. Actual harmful truncation was not established for the examined recipes.

Emit ordered priority sections or explicit ranks. Define which rules may override generic construction defaults while never overriding identity/body preservation. Deduplicate negatives semantically where feasible; prioritize before any cap and expose omitted rule IDs in internal diagnostics. Test priority resolution and over-cap cases offline.

### 7. Prompt and image manifests should share one source — maintenance risk, no current numbering defect proven

Legacy/Level 1/Split builders number images separately from the provider's part-array construction. Split has a map helper and regression coverage, but the final provider packet is still assembled independently; full/detail references append later.

Build one server-owned manifest of image roles, target pieces, full/detail relationships, dimensions and transformations. Render both the prompt map and SDK image array from it. Check every referenced index against the actual final packet for all modes and optional reference combinations. Preserve existing server allowlists and private asset resolution.

### 8. Consolidate repeated preservation/override prose — testable simplification, unproven visual benefit

Observed base prompt lengths were 7,043 characters for the sampled Split recipe, 5,973 for tuxedo, 6,372 for Royal Sherwani and 4,134 for legacy, before the provider's 800-character proportion module and any full/detail/mask additions. These lengths are within the existing 32,000-character guard. Length alone is not a defect or proof of wasted cost.

Replace overlapping authority statements with a compact, structured contract and relevant per-piece rules. Retain critical invariants; test readability and instruction following rather than blindly targeting a shorter prompt. Selected decorative embroidery should be explicitly distinguished from forbidden invented embellishment, particularly for ornate traditionalwear. Do not automatically add a second model or paid retry loop to judge prompts.

## Recommended implementation sequence

1. Fix the confirmed double-breasted conflict and add an assembled-prompt regression.
2. Introduce scoped per-piece authority, including selected finish/trim/embroidery exceptions and untouched underlayers/accessories.
3. Make background and scale wording consistent with the actual processing mode.
4. Centralize final reference mapping, emit usable priorities and consolidate duplicate prose.
5. Add offline final-packet fixtures across full/split/legacy modes, single/double-breasted, partial fabric assignment, satin facings, selected embroidery, no-change pieces, full/detail references and edit masks.
6. Evaluate individual prompt changes on matched outputs when permitted. Retain the existing model/medium quality/canvas for the first comparisons so results are attributable to the instructions.

Suggested contract order: edit objective; fixed identity/body/scene; allowed changed pieces; image-role manifest; selected construction and panel material policy; scale guidance; background/edit boundary; concise exclusions. API quality/size settings remain server-controlled parameters, not staff-authored prompt text.

Official OpenAI guidance recommends clearly separating what changes from what is preserved and checking complete results under controlled comparisons. It does not prove this application's revised instructions will improve outputs: https://developers.openai.com/api/docs/guides/image-prompting

The owner's no-paid-image-calls instruction remains in force. This review supplies recommendations and offline evidence only; it does not change the previously recorded runtime verification result or close visual acceptance gates.
