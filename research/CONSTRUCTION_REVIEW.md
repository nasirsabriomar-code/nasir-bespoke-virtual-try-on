# Construction and scale review

Code review completed locally; professional tailor review and matched generated-output review are **pending**. This document is a review checklist, not a tailoring certification.

## Conflicts found and addressed

The shared pattern instruction originally demanded uninterrupted repeat continuity across seams and independent garment pieces. Split Outfit also appended its own unconditional instruction to continue a repeat across seams, lapels, pockets and edges. Updating only the shared instruction would have left this second conflict in the final prompt.

Both now distinguish density within a cloth panel from alignment across panels. Selected construction, grain direction, lapel rolls and bias-cut details may create legitimate breaks. No instruction should stretch/shrink the repeat to force universal continuity. Server-appended proportion guidance separately covers lapels, collars, button spacing, pockets and garment length relative to the blueprint and unchanged body. Fabric repeat size remains its own constraint.

The existing suit profile already distinguishes slim/standard/wide/extra-wide lapels and selected cuff-button arrangements. Those qualitative choices are preserved. They do not provide measured body dimensions or a numerical physical-fit specification. Catalogue construction photos/text still need human review for ambiguous framing, poor detail visibility or conflicts with these options; automated tests cannot certify their photographic adequacy.

## Tailor checklist

| Detail | Inspect against | Reject when |
| --- | --- | --- |
| Lapel width/roll | Selected design and front-panel/chest proportion | Lapels grow/shrink with photo framing, or repeat bends unrealistically |
| Collar height | Selected neckline/stand and customer's visible neck | Wrong collar architecture or changed neck/body |
| Button arrangement | Selected closure and visible garment length | Incorrect count, uneven spacing or displaced closure |
| Pocket dimensions/placement | Selected design, chest/hip anatomy and cutting | Oversized pockets, copied framing scale or impossible pattern matching |
| Jacket/kurta/sherwani length | Intended blueprint and visible body landmarks | Garment length follows the reference model's proportions instead of the customer |
| Repeat/grain | Same measured cloth; panel grain and chosen construction | Inconsistent within-panel density or impossible continuity forced across seams |
| Independent pieces | Assigned jacket/trouser/shirt/waistcoat fabric role | Cloth from another piece/reference contaminates the selected piece |
| Draping and boundaries | Pose, silhouette, hands, occlusions and light | Body reshaping, clipped new clothing, old outfit remnants or fake shadows |

Review suit and traditionalwear separately. Include both wide and close construction photos of the same design. Record the exact catalogue IDs/version and reference checksum for any ambiguous example; no customer image collection has been authorized for this research. Preserve intentional shared-staff history and existing catalogue ownership/access controls while collecting the eventual review record.

## Acceptance evidence still required

A tailor must confirm the cutting/grain expectations and staff must score matched actual outputs. The code changes resolve contradictory instructions; they do not establish that the model follows those instructions reliably. No paid output comparisons have been run.
