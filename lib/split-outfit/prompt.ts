import type { ResolvedSplitOutfit } from "./generation";

export type SplitFabricRegion = "upper" | "lower" | "both";

/**
 * Composes a modular outfit recipe into a single generation prompt.
 *
 * Image order contract — must match inputParts() in
 * lib/tryon/providers/openai.ts, which appends person, then fabric, then
 * `references` in array order: Image 1 = person, Image 2 = fabric,
 * Image 3 = jacket reference (role "split-upper"), Image 4 = trouser
 * reference (role "split-lower"). This is fixed and always exactly four
 * images for split mode (decision: only jacket + trousers ever carry a
 * reference photo), so unlike Level 1's variable detail-asset count, no
 * shared numbering helper is needed here — the numbers below are correct
 * as long as the caller supplies references in that exact order.
 */
export function buildSplitOutfitPrompt(resolved: ResolvedSplitOutfit, fabricRegion: SplitFabricRegion = "both") {
  const fabricAuthorityLine = fabricRegion === "both"
    ? "FABRIC PHOTO AUTHORITY — CRITICAL: Image 2 is authoritative only for base colour, shade, texture, weave, pattern, pattern scale, sheen, finish, motif, checks, stripes, and material appearance. Apply these fabric characteristics faithfully to both the jacket and the trousers. Ignore every person, garment construction, scene, styling, pose, and background that might be visible in Image 2."
    : fabricRegion === "upper"
      ? `FABRIC PHOTO AUTHORITY — CRITICAL: Image 2 is authoritative only for base colour, shade, texture, weave, pattern, pattern scale, sheen, finish, motif, checks, stripes, and material appearance. Apply these fabric characteristics only to the jacket (${resolved.upper.customer.name}). The trousers remain unchanged. Ignore every person, garment construction, scene, styling, pose, and background that might be visible in Image 2.`
      : `FABRIC PHOTO AUTHORITY — CRITICAL: Image 2 is authoritative only for base colour, shade, texture, weave, pattern, pattern scale, sheen, finish, motif, checks, stripes, and material appearance. Apply these fabric characteristics only to the trousers (${resolved.lower.customer.name}). The jacket remains unchanged. Ignore every person, garment construction, scene, styling, pose, and background that might be visible in Image 2.`;

  const unchangedRegionLine = fabricRegion === "upper"
    ? "UNCHANGED REGION — CRITICAL: The trousers must be rendered exactly as they appear in Image 4, in their original colour, fabric, pattern, and material. Do not apply Image 2's fabric to the trousers under any circumstance."
    : fabricRegion === "lower"
      ? "UNCHANGED REGION — CRITICAL: The jacket must be rendered exactly as it appears in Image 3, in its original colour, fabric, pattern, and material. Do not apply Image 2's fabric to the jacket under any circumstance."
      : null;

  // Same closing override Level 1 needed after the model kept the reference
  // garment's colour. Split applies Image 2 only to jacket and trousers —
  // never "every selected garment piece", which would recolour shirt/shoes.
  const finalFabricOverrideLine = fabricRegion === "both"
    ? "FINAL FABRIC APPLICATION OVERRIDE — CRITICAL: Image 2 is the sole authority for the fabric appearance of the jacket and the trousers. Do not preserve, copy, or infer a conflicting jacket or trouser colour, pattern, texture, weave, finish, or material from Image 1, Image 3, Image 4, or catalogue metadata. Shirt, waistcoat, footwear, and accessories are not coloured from Image 2."
    : fabricRegion === "upper"
      ? "FINAL FABRIC APPLICATION OVERRIDE — CRITICAL: Image 2 is the sole authority for the fabric appearance of the jacket. The trousers must keep their original appearance from Image 4. Do not let Image 1, Image 3, or catalogue metadata override the uploaded jacket-fabric colour."
      : "FINAL FABRIC APPLICATION OVERRIDE — CRITICAL: Image 2 is the sole authority for the fabric appearance of the trousers. The jacket must keep its original appearance from Image 3. Do not let Image 1, Image 4, or catalogue metadata override the uploaded trouser-fabric colour.";

  const componentLines = [
    `Jacket: ${resolved.upper.generation.constructionFragment}`,
    `Trousers: ${resolved.lower.generation.constructionFragment}`,
    `Shirt: ${resolved.shirt.generation.constructionFragment}`,
    ...(resolved.waistcoat ? [`Waistcoat: ${resolved.waistcoat.generation.constructionFragment}`] : []),
    `Footwear: ${resolved.footwear.generation.constructionFragment}`,
    ...resolved.accessories.map((accessory) => `Accessory: ${accessory.generation.constructionFragment}`),
  ];

  return [
    "You are the controlled visualization engine for NASIR BESPOKE, a luxury men's bespoke tailoring business. This is exclusively a men's clothing and men's formalwear system. Generate one photorealistic edit, not a new studio portrait or fashion editorial.",
    "EDIT PRIORITY (non-negotiable): Keep Image 1's customer, identity, body, pose, composition, camera, lighting, environment, and scene unchanged. Image 1 does not control the colour, shade, texture, weave, pattern, finish, or material appearance of any garment piece when a fabric authority instruction assigns that piece a fabric.",
    [
      "IMAGE ROLE MAPPING (critical):",
      "Image 1 — male customer/person photograph and the complete source scene.",
      "Image 2 — physical showroom fabric photograph.",
      "Image 3 — NASIR BESPOKE approved jacket construction reference.",
      "Image 4 — NASIR BESPOKE approved trouser construction reference.",
    ].join("\n"),
    "CUSTOMER PHOTO AUTHORITY — CRITICAL: Image 1 is the sole authority for the customer's identity, face, skin tone, age appearance, hair, facial hair, natural body size, build, body proportions, height, visible physical characteristics, pose, posture, expression, hands, camera perspective, framing, lighting, shadows, and background. Tailor every garment around the customer's actual body. Never slim, enlarge, reshape, lengthen, shorten, beautify, replace, or otherwise alter the customer to fit a garment or a mannequin.",
    fabricAuthorityLine,
    ...(unchangedRegionLine ? [unchangedRegionLine] : []),
    "CURATED CONSTRUCTION AUTHORITY: Images 3 and 4 are authoritative only for garment construction, silhouette, layering, and visible design architecture. They are not body, identity, pose, scene, lighting, colour, texture, material, footwear, or accessory references. Never copy a reference model, mannequin, person, scene, background, or material. When construction text or a reference appearance conflicts with the uploaded fabric authority, the uploaded fabric authority wins.",
    `SELECTED MODULAR OUTFIT (${resolved.state.family}):\n${componentLines.join("\n")}`,
    "TEXT-COMPOSED PIECES: The shirt, waistcoat (if any), footwear, and any accessories above have no reference photograph. Render each conservatively and physically credibly from its construction description alone — do not invent details beyond what is described, and do not add any accessory not explicitly listed above.",
    finalFabricOverrideLine,
    "REALISM: Use physically credible bespoke tailoring around the customer's actual frame: natural shoulder placement, sleeves, folds, drape, gravity, compression, tension, closures, waist behavior, trouser break, and hem. Preserve anatomically correct hands and limbs. Do not add duplicate clothing, random accessories, invented embroidery, extra limbs, text, a border, a collage, split screen, or an explanation. Return only one finished photograph.",
  ].join("\n\n");
}
