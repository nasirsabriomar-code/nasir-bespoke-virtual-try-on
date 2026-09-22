export const SCENE_LOCK = `
SCENE LOCK — CRITICAL: Change only the selected clothing on the person in Image 1. Every other pixel stays as it is in Image 1: face, hair, hands, body, pose, camera, framing, lighting, floor, racks, furniture, and walls. Wooden wall panels, grooves, and any other straight line in the room stay straight, evenly spaced, and in the same place. Do not redraw, wave, bend, or redesign the showroom. Do not copy a background from any other image.
`.trim();

export const PATTERN_GEOMETRY = `
PATTERN GEOMETRY — CRITICAL: The fabric photograph is a flat cloth repeat, not a picture of folds. Ignore curves caused by the swatch not lying flat. Copy the repeat exactly: direction, line width, gap, and scale. Stripes, checks, and herringbone stay straight and parallel to the cloth grain. They continue across lapels, pockets, buttons, seams, and from jacket into trousers when those pieces share that fabric. A fold may shade or briefly interrupt a line. It must not wave, thicken, or change the spacing of the repeat on a flat panel. If the swatch is plain, do not invent a stripe or check.
`.trim();

export const REALISM_PRESERVING_PATTERN = `
REALISM: Use physically credible bespoke tailoring around the customer's actual frame: natural shoulder placement, sleeves, closures, waist behavior, trouser break, and hem. Folds, drape, and gravity may shade the cloth. They must not wave, thicken, or redraw stripes, checks, or any other repeat. Preserve anatomically correct hands and limbs. Do not add duplicate clothing, random accessories, invented embroidery, extra limbs, text, a border, a collage, split screen, or an explanation. Return only one finished photograph.
`.trim();
