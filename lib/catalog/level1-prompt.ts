import type { ResolvedLevel1Design } from "@/lib/catalog/level1-types";

export type FabricRegion = "upper" | "lower" | "both" | "custom" | "jacket";

export function buildLevel1TryOnPrompt(resolved: ResolvedLevel1Design, fabricRegion: FabricRegion = "both") {
  const detailReferenceCount = resolved.detailAssets.length;
  const isJacket = fabricRegion === "jacket" || resolved.category.id === "jackets";
  const roleLines = [
    "IMAGE ROLE MAPPING (critical):",
    "Image 1 — male customer/person photograph and the complete source scene.",
    ...(isJacket
      ? [
          "Image 2 — physical showroom jacket fabric photograph.",
          "Image 3 — NASIR BESPOKE approved curated jacket construction reference.",
          ...Array.from({ length: detailReferenceCount }, (_, index) => `Image ${index + 4} — NASIR BESPOKE approved curated jacket detail reference.`),
        ]
      : fabricRegion === "custom"
      ? [
          "Image 2 — physical showroom upper-garment fabric photograph.",
          "Image 3 — physical showroom lower-garment fabric photograph.",
          "Image 4 — NASIR BESPOKE approved curated garment construction reference.",
          ...Array.from({ length: detailReferenceCount }, (_, index) => `Image ${index + 5} — NASIR BESPOKE approved curated garment detail reference.`),
        ]
      : [
          "Image 2 — physical showroom fabric photograph.",
          "Image 3 — NASIR BESPOKE approved curated garment construction reference.",
          ...Array.from({ length: detailReferenceCount }, (_, index) => `Image ${index + 4} — NASIR BESPOKE approved curated garment detail reference.`),
        ]),
  ];
  const construction = Object.entries(resolved.variant?.construction ?? resolved.design.blueprint.construction)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : value}`)
    .join("; ");

  const { upper: upperPieces, lower: lowerPieces } = resolved.design.blueprint.fabricRegions;
  const fabricAuthorityLine = isJacket
    ? `FABRIC PHOTO AUTHORITY — CRITICAL: Image 2 is authoritative only for the base colour, shade, texture, weave, pattern, pattern scale, sheen, finish, motif, checks, stripes, and material appearance of the complete jacket. Apply Image 2's fabric characteristics only to every visible jacket piece named above: ${upperPieces.join(", ")}. Do not apply the jacket fabric to the customer's existing shirt, T-shirt, high-neck underlayer, lower garment, footwear, or any accessory. The jacket fabric overrides the jacket's original colour and any conflicting colour, pattern, texture, weave, finish, or material wording in the customer photo, construction reference, or catalogue text. Ignore every person, garment construction, scene, styling, pose, and background visible in Image 2.`
    : fabricRegion === "both"
    ? "FABRIC PHOTO AUTHORITY — CRITICAL: Image 2 is authoritative only for base colour, shade, texture, weave, pattern, pattern scale, sheen, finish, motif, checks, stripes, and material appearance. Apply these fabric characteristics faithfully to every selected garment piece. Ignore every person, garment construction, scene, styling, pose, and background that might be visible in Image 2."
    : fabricRegion === "custom"
      ? `FABRIC PHOTO AUTHORITY — CRITICAL: Image 2 is authoritative only for base colour, shade, texture, weave, pattern, pattern scale, sheen, finish, motif, checks, stripes, and material appearance of the upper garment group. Apply Image 2's fabric characteristics only to every visible upper garment piece: ${upperPieces.join(", ")}. Image 3 is authoritative only for the same fabric characteristics of the lower garment group. Apply Image 3's fabric characteristics only to every visible lower garment piece: ${lowerPieces.join(", ")}. Apply every visible portion of the named lower garment pieces, including portions visible below a long upper garment. Never transfer, blend, average, or partially apply Image 2's fabric to lower pieces or Image 3's fabric to upper pieces. The uploaded fabric photos override the original garment colours and any colour, pattern, texture, weave, finish, or material appearance suggested by the customer photo, construction reference, or catalogue text. Ignore every person, garment construction, scene, styling, pose, and background that might be visible in either fabric photograph.`
    : fabricRegion === "upper"
      ? `FABRIC PHOTO AUTHORITY — CRITICAL: Image 2 is authoritative only for base colour, shade, texture, weave, pattern, pattern scale, sheen, finish, motif, checks, stripes, and material appearance. Apply these fabric characteristics only to every visible upper garment piece: ${upperPieces.join(", ")}. The lower garment piece(s) remain unchanged. The uploaded fabric photo overrides the original upper-garment colour and any conflicting colour, pattern, texture, weave, finish, or material wording in the customer photo, construction reference, or catalogue text. Ignore every person, garment construction, scene, styling, pose, and background that might be visible in Image 2.`
      : `FABRIC PHOTO AUTHORITY — CRITICAL: Image 2 is authoritative only for base colour, shade, texture, weave, pattern, pattern scale, sheen, finish, motif, checks, stripes, and material appearance. Apply these fabric characteristics only to every visible lower garment piece: ${lowerPieces.join(", ")}. The upper garment piece(s) remain unchanged. The uploaded fabric photo overrides the original lower-garment colour and any conflicting colour, pattern, texture, weave, finish, or material wording in the customer photo, construction reference, or catalogue text. Ignore every person, garment construction, scene, styling, pose, and background that might be visible in Image 2.`;

  const unchangedRegionLine = isJacket
    ? null
    : fabricRegion === "upper"
    ? `UNCHANGED REGION — CRITICAL: The lower garment piece(s) — ${lowerPieces.join(", ")} — must be rendered exactly as they appear in Image 3, in their original colour, fabric, pattern, and material. Do not apply Image 2's fabric to the lower garment piece(s) under any circumstance. Do not blend, average, or partially apply the fabric colour to the lower garment piece(s).`
    : fabricRegion === "lower"
      ? `UNCHANGED REGION — CRITICAL: The upper garment piece(s) — ${upperPieces.join(", ")} — must be rendered exactly as they appear in Image 3, in their original colour, fabric, pattern, and material. Do not apply Image 2's fabric to the upper garment piece(s) under any circumstance. Do not blend, average, or partially apply the fabric colour to the upper garment piece(s).`
      : null;

  const finalFabricOverrideLine = isJacket
    ? "FINAL FABRIC APPLICATION OVERRIDE — CRITICAL: This is a jacket-only selection. Image 2 is the sole authority for the fabric appearance of the complete visible jacket and must recolour every visible jacket panel, sleeve, collar, cuff, hem, pocket, and matching jacket detail. No lower garment fabric input is accepted or exists in this mode. Preserve the customer's existing underlayer, lower garment, footwear, accessories, identity, body, pose, scene, and lighting exactly as they appear. Do not let Image 1, Image 3, or catalogue metadata override the uploaded jacket-fabric colour or material."
    : fabricRegion === "custom"
    ? `FINAL FABRIC APPLICATION OVERRIDE — CRITICAL: Customization requires two independently coloured fabric regions. Image 2 controls the complete fabric appearance of every visible upper piece named above, and Image 3 controls the complete fabric appearance of every visible lower piece named above. Do not preserve, copy, or infer the original upper or lower garment colour from Image 1 or Image 4. Words such as “matching”, “coordinated”, or “same”, and any fixed colour, pattern, texture, weave, finish, or material description in the selected design metadata describe garment construction or relationships only; they must never make the upper and lower fabrics identical. If any catalogue instruction or reference image conflicts with this paragraph, the two uploaded fabric photographs control fabric appearance.`
    : fabricRegion === "both"
      ? "FINAL FABRIC APPLICATION OVERRIDE — CRITICAL: Image 2 is the sole authority for the fabric appearance of every selected garment piece. Do not preserve, copy, or infer a conflicting garment colour, pattern, texture, weave, finish, or material from Image 1, Image 3, or catalogue metadata."
      : fabricRegion === "upper"
        ? "FINAL FABRIC APPLICATION OVERRIDE — CRITICAL: Image 2 is the sole authority for the fabric appearance of every visible upper piece named above. The lower garment must keep its original appearance. Do not let Image 1, Image 3, or catalogue metadata override the uploaded upper-fabric colour."
        : "FINAL FABRIC APPLICATION OVERRIDE — CRITICAL: Image 2 is the sole authority for the fabric appearance of every visible lower piece named above. The upper garment must keep its original appearance. Do not let Image 1, Image 3, or catalogue metadata override the uploaded lower-fabric colour.";

  return [
    "You are the controlled visualization engine for NASIR BESPOKE, a luxury men's bespoke tailoring business. This is exclusively a men's clothing and men's formalwear system. Generate one photorealistic edit, not a new studio portrait or fashion editorial.",
    "EDIT PRIORITY (non-negotiable): Keep Image 1's customer, identity, body, pose, composition, camera, lighting, environment, and scene unchanged. Image 1 does not control the colour, shade, texture, weave, pattern, finish, or material appearance of any garment piece when a fabric authority instruction assigns that piece a fabric.",
    roleLines.join("\n"),
    "CUSTOMER PHOTO AUTHORITY — CRITICAL: Image 1 is the sole authority for the customer's identity, face, skin tone, age appearance, hair, facial hair, natural body size, build, body proportions, height, visible physical characteristics, pose, posture, expression, hands, camera perspective, framing, lighting, shadows, and background. Tailor the garment around the customer's actual body. Never slim, enlarge, reshape, lengthen, shorten, beautify, replace, or otherwise alter the customer to fit the garment or the mannequin. Never adopt mannequin or reference-person proportions.",
    fabricAuthorityLine,
    ...(unchangedRegionLine ? [unchangedRegionLine] : []),
    `${fabricRegion === "custom" ? "CURATED DESIGN AUTHORITY: Image 4 and any following controlled reference images" : "CURATED DESIGN AUTHORITY: Image 3 and any following controlled reference images"} are authoritative only for garment construction, silhouette, layering, included pieces, and visible design architecture. They are not body, identity, pose, scene, lighting, colour, texture, material, footwear, or accessory references. Never copy a reference model, mannequin, person, scene, background, or material. When design text or a reference appearance conflicts with the uploaded fabric authority, the uploaded fabric authority wins.`,
    `SELECTED NASIR BESPOKE CURATED DESIGN: ${resolved.design.customer.name}${resolved.variant ? ` — ${resolved.variant.name}` : ""}. ${resolved.variant?.description ?? resolved.design.customer.description}. Internal garment family: ${resolved.design.blueprint.garmentFamily}. Silhouette: ${resolved.design.blueprint.silhouette.join(", ")}. Included pieces: ${resolved.design.blueprint.includedPieces.join(", ")}. Construction: ${construction}.`,
    `DESIGN INSTRUCTIONS: ${(resolved.variant?.promptFragments ?? resolved.design.generation.promptFragments).join(". ")}.`,
    `NEGATIVE DESIGN CONSTRAINTS: ${(resolved.variant?.negativeConstraints ?? resolved.design.generation.negativeConstraints).join(" ")}`,
    finalFabricOverrideLine,
    "LEVEL 1 STYLING POLICY: Preserve the customer's existing footwear where visible. Do not add a tie, bow tie, pocket square, turban, jewellery, watch, or any other accessory. Do not use the construction reference's colour, fabric, pattern, material, person, or setting.",
    "REALISM: Use physically credible bespoke tailoring around the customer's actual frame: natural shoulder placement, sleeves, folds, drape, gravity, compression, tension, closures, waist behavior, trouser break, and hem. Preserve anatomically correct hands and limbs. Do not add duplicate clothing, random accessories, invented embroidery, extra limbs, text, a border, a collage, split screen, or an explanation. Return only one finished photograph.",
  ].join("\n\n");
}
