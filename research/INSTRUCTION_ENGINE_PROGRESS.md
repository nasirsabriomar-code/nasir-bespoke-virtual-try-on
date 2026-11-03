# Instruction engine implementation progress

The owner authorized implementation of the eight findings in INSTRUCTION_ENGINE_REVIEW.md. Paid calls remain disallowed; no visual-quality claim or deployment is authorized by these changes.

Implemented:

- Split button instructions now distinguish selected single/double-breasted closures and preserve button-layer isolation.
- Split material authority now includes pattern/repeat rather than claiming only colour/shade/texture authority.
- Shared scene wording permits necessary reconstruction/contact shadows within the clothing edit area while preserving identity/body/camera and unaffected surroundings.
- Legacy original-photo authority is scoped to identity/body/scene; explicitly selected footwear is no longer categorically excluded from reference use.
- Selected per-panel facing/trim/embroidery and intrinsic-repeat guidance are emitted at the provider boundary. Level 1 base-panel rules now recognize local trim exceptions.
- Bespoke instructions include their actual priority labels, order rules by priority within sections, and retain selected negatives instead of silently dropping everything beyond sixteen.
- A shared generic image-ordering function now drives provider arrays and Full/Split/legacy prompt image-order calculations.
- Prompt recipe version advanced to atelier-v4-scoped-authority.

Completed follow-up:

- Replaced the old exact-source-scale/flat-fold language with intrinsic repeat rules that permit natural projection over curved cloth; removed the categorical colour exclusion and blanket invented-embroidery rule in favour of assigned colours and explicitly selected details.
- Scoped Split trouser recolouring and Full/legacy material instructions to base panels, with selected facing/trim exceptions and preservation of unassigned layers.
- Consolidated pattern geometry, realism and shared material/scale rules; the authoritative material/scale policies are emitted once at the provider boundary.
- Generated a final input manifest directly from actual prepared image parts, including appended fabric details. Final prompts referencing an out-of-range image fail before the SDK call.
- Added mode-aware prompt-only/masked/composite edit-boundary wording, preserving normalized outside-region pixels through the existing composite implementation.
- Added final mocked-SDK packet tests for all sixteen Split fabric bit combinations with/without waistcoat, optional fabric detail, Full tuxedo/Royal Sherwani with zero/one/two detail references, outfit mode, and legacy no-change clothing with explicitly selected shoes. Existing mask/fallback tests now also assert the matching composite instruction. Constraint-overflow and double-breasted regressions are included in the normal suite.

Final verification: lint, type checking and **210 tests passed, zero failures**: 54 security, 68 catalogue, 5 bespoke, 8 rendered-source and 75 storage/client/pipeline. **Production build, local HTTP security checks and diff whitespace checks passed.** Both verification processes exited successfully. The two catalogue regressions that required blanket all-piece fabric treatment and rigid fold/colour wording were updated to assert the corrected base-panel/selected-trim and intrinsic-projection behavior. Authentication, body limits, private assets, fixed medium quality, model selection and paid-call idempotency remain in place. The dependency lockfile and generated Next type declarations are unchanged. No UI component was changed in this instruction-only milestone, so the earlier browser workflow checks were not repeated as evidence for prompt correctness.

Actual visual comparisons and tailor acceptance remain separate from this implementation goal. No paid image call, production access or deployment occurred; these code/packet tests do not establish an image-quality improvement percentage.
