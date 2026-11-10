export const SCENE_LOCK = `
SCENE LOCK — CRITICAL: Change only selected clothing and explicitly selected accessories on Image 1. Preserve identity, face, hair, hands, body, pose, camera, framing and scene lighting. Keep unaffected floor, racks, furniture and walls fixed. Permit only necessary reconstruction of newly revealed background and garment contact shadows inside the clothing edit area; do not redesign the room. Wooden wall panels and other straight lines remain straight and in place. Never copy a reference person's body or background.
`.trim();

export const MATERIAL_POLICY = `
PANEL MATERIAL POLICY: Assigned cloth controls base-panel colour, weave, pattern, repeat, sheen and finish. Explicitly selected satin/grosgrain/contrast facings, piping, trouser side stripes and decorative embroidery are separate construction details: retain them only on the specified panels/trim, without spreading them onto the base cloth. Unassigned pieces retain their designated reference appearance; no-change pieces retain Image 1's appearance. Do not recolour shirts, underlayers, footwear or accessories unless explicitly assigned. Selected embroidery is permitted; unselected invented embellishment is forbidden.
`.trim();

export const FABRIC_SCALE_POLICY = `
INTRINSIC REPEAT SCALE: Camera distance, swatch zoom and detail cropping do not change a cloth's physical repeat. Use supplied repeat measurements as guidance; never equate source pixels with centimetres or infer exact body measurements. Keep intrinsic repeat density consistent within each panel while allowing perspective compression and bending over folds. A close detail supplies weave and motif edges, not a larger physical repeat. Fabric repeat size is separate from lapel, pocket and button proportions. Preserve the actual colours of all lines, including coloured stripes; do not borrow colours from the room or former outfit.

STRIPE RENDERING: Judge the cloth as it reads at the customer's viewing distance. A pinstripe made of tiny dots or slubs in the close-up swatch renders on the garment as one fine, continuous, unbroken line of constant width. Never draw dashed, broken, chalky, zig-zag or crossing stripe lines. Stripes run with the grain of each panel, follow the lapel roll on lapels, and bend only where the cloth visibly folds.
`.trim();

export const PATTERN_GEOMETRY = `
PATTERN GEOMETRY — CRITICAL: Read the cloth's intrinsic repeat separately from capture zoom and draped-swatch distortion. On flat panels, keep lines straight, parallel to the cloth grain and evenly spaced. Preserve repeat density within each garment panel. Perspective and curved folds may compress or bend the visible projection without changing the underlying cloth repeat. Align adjacent panels only where cutting and grain direction permit; seams, lapel rolls, bias-cut details and independent pieces may legitimately interrupt direction. Never distort the repeat to force continuity. Plain base cloth remains plain; explicitly selected decorative trim or embroidery is a separate local detail. Copy the ground and line colours from the assigned cloth, including coloured stripes, without contamination from the room or previous clothes.
`.trim();

export const REALISM_PRESERVING_PATTERN = `
REALISM: Use physically credible bespoke tailoring around the customer's actual frame: natural shoulder placement, sleeves, closures, waist behavior, trouser break, and hem. Preserve anatomically correct hands and limbs. Do not add duplicate clothing, unselected accessories or embroidery, extra limbs, text, a border, a collage, split screen, or an explanation. Return only one finished photograph.
`.trim();

export const CONSTRUCTION_PROPORTIONS = `
CONSTRUCTION PROPORTIONS: Treat the reference as a garment blueprint, not a pixel-size template. Preserve intended lapel width relative to the jacket front, collar height relative to the neckline, button spacing along the closure, pockets relative to the chest/hip and garment length relative to the customer's visible anatomy. Do not enlarge a small photographed design merely because it occupies a small part of its reference frame, or shrink a large photographed detail merely because it fills the reference. Fit the selected construction around the customer's unchanged body rather than changing their body to match a mannequin. Fabric repeat scale and garment-detail proportions are separate constraints. Do not infer physical body measurements or guaranteed fit from reference pixel dimensions.
`.trim();
