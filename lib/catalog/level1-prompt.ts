import type { ResolvedLevel1Design } from "@/lib/catalog/level1-types";
import { PATTERN_GEOMETRY, REALISM_PRESERVING_PATTERN, SCENE_LOCK } from "@/lib/tryon/pattern-geometry";

export type FabricRegion = "upper" | "lower" | "both" | "custom" | "jacket";

export function buildLevel1TryOnPrompt(resolved: ResolvedLevel1Design, fabricRegion: FabricRegion = "both") {
  const detailReferenceCount = resolved.detailAssets.length;
  const isJacket = fabricRegion === "jacket" || resolved.category.id === "jackets";
  const constructionImage = 2;
  const firstDetailImage = 3;
  const fabricImage = 2 + detailReferenceCount + 1;
  const lowerFabricImage = fabricImage + 1;
  const detailLines = Array.from({ length: detailReferenceCount }, (_, index) =>
    `Image ${firstDetailImage + index} — NASIR BESPOKE approved curated ${isJacket ? "jacket detail" : "garment detail"} reference.`,
  );
  const roleLines = [
    "IMAGE ROLE MAPPING (critical):",
    "Image 1 — male customer/person photograph and the complete source scene.",
    `Image ${constructionImage} — NASIR BESPOKE approved curated ${isJacket ? "jacket" : "garment"} construction reference (cut only when a fabric photograph follows).`,
    ...detailLines,
    ...(fabricRegion === "custom"
      ? [
          `Image ${fabricImage} — physical showroom upper-garment fabric photograph.`,
          `Image ${lowerFabricImage} — physical showroom lower-garment fabric photograph.`,
        ]
      : [
          `Image ${fabricImage} — physical showroom ${isJacket ? "jacket " : ""}fabric photograph.`,
        ]),
  ];
  const construction = Object.entries(resolved.variant?.construction ?? resolved.design.blueprint.construction)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : value}`)
    .join("; ");

  const { upper: upperPieces, lower: lowerPieces } = resolved.design.blueprint.fabricRegions;
  const fabricAuthorityLine = isJacket
    ? `FABRIC PHOTO AUTHORITY — CRITICAL: Image ${fabricImage} is authoritative only for the base colour, shade, texture, weave, pattern, pattern scale, sheen, finish, motif, checks, stripes, and material appearance of the complete jacket. Apply Image ${fabricImage}'s fabric characteristics only to every visible jacket piece named above: ${upperPieces.join(", ")}. Do not apply the jacket fabric to the customer's existing shirt, T-shirt, high-neck underlayer, lower garment, footwear, or any accessory. The jacket fabric overrides the jacket's original colour and any conflicting colour, pattern, texture, weave, finish, or material wording in the customer photo, construction reference, or catalogue text. Ignore every person, garment construction, scene, styling, pose, and background visible in Image ${fabricImage}.`
    : fabricRegion === "both"
    ? `FABRIC PHOTO AUTHORITY — CRITICAL: Image ${fabricImage} is authoritative only for base colour, shade, texture, weave, pattern, pattern scale, sheen, finish, motif, checks, stripes, and material appearance. Apply these fabric characteristics faithfully to every selected garment piece. Ignore every person, garment construction, scene, styling, pose, and background that might be visible in Image ${fabricImage}.`
    : fabricRegion === "custom"
      ? `FABRIC PHOTO AUTHORITY — CRITICAL: Image ${fabricImage} is authoritative only for base colour, shade, texture, weave, pattern, pattern scale, sheen, finish, motif, checks, stripes, and material appearance of the upper garment group. Apply Image ${fabricImage}'s fabric characteristics only to every visible upper garment piece: ${upperPieces.join(", ")}. Image ${lowerFabricImage} is authoritative only for the same fabric characteristics of the lower garment group. Apply Image ${lowerFabricImage}'s fabric characteristics only to every visible lower garment piece: ${lowerPieces.join(", ")}. Apply every visible portion of the named lower garment pieces, including portions visible below a long upper garment. Never transfer, blend, average, or partially apply Image ${fabricImage}'s fabric to lower pieces or Image ${lowerFabricImage}'s fabric to upper pieces. The uploaded fabric photos override the original garment colours and any colour, pattern, texture, weave, finish, or material appearance suggested by the customer photo, construction reference, or catalogue text. Ignore every person, garment construction, scene, styling, pose, and background that might be visible in either fabric photograph.`
    : fabricRegion === "upper"
      ? `FABRIC PHOTO AUTHORITY — CRITICAL: Image ${fabricImage} is authoritative only for base colour, shade, texture, weave, pattern, pattern scale, sheen, finish, motif, checks, stripes, and material appearance. Apply these fabric characteristics only to every visible upper garment piece: ${upperPieces.join(", ")}. The lower garment piece(s) remain unchanged. The uploaded fabric photo overrides the original upper-garment colour and any conflicting colour, pattern, texture, weave, finish, or material wording in the customer photo, construction reference, or catalogue text. Ignore every person, garment construction, scene, styling, pose, and background that might be visible in Image ${fabricImage}.`
      : `FABRIC PHOTO AUTHORITY — CRITICAL: Image ${fabricImage} is authoritative only for base colour, shade, texture, weave, pattern, pattern scale, sheen, finish, motif, checks, stripes, and material appearance. Apply these fabric characteristics only to every visible lower garment piece: ${lowerPieces.join(", ")}. The upper garment piece(s) remain unchanged. The uploaded fabric photo overrides the original lower-garment colour and any conflicting colour, pattern, texture, weave, finish, or material wording in the customer photo, construction reference, or catalogue text. Ignore every person, garment construction, scene, styling, pose, and background that might be visible in Image ${fabricImage}.`;

  const unchangedRegionLine = isJacket
    ? null
    : fabricRegion === "upper"
    ? `UNCHANGED REGION — CRITICAL: The lower garment piece(s) — ${lowerPieces.join(", ")} — must be rendered exactly as they appear in Image ${constructionImage}, in their original colour, fabric, pattern, and material. Do not apply Image ${fabricImage}'s fabric to the lower garment piece(s) under any circumstance. Do not blend, average, or partially apply the fabric colour to the lower garment piece(s).`
    : fabricRegion === "lower"
      ? `UNCHANGED REGION — CRITICAL: The upper garment piece(s) — ${upperPieces.join(", ")} — must be rendered exactly as they appear in Image ${constructionImage}, in their original colour, fabric, pattern, and material. Do not apply Image ${fabricImage}'s fabric to the upper garment piece(s) under any circumstance. Do not blend, average, or partially apply the fabric colour to the upper garment piece(s).`
      : null;

  const finalFabricOverrideLine = isJacket
    ? `FINAL FABRIC APPLICATION OVERRIDE — CRITICAL: This is a jacket-only selection. Image ${fabricImage} is the sole authority for the fabric appearance of the complete visible jacket and must recolour every visible jacket panel, sleeve, collar, cuff, hem, pocket, and matching jacket detail. No lower garment fabric input is accepted or exists in this mode. Preserve the customer's existing underlayer, lower garment, footwear, accessories, identity, body, pose, scene, and lighting exactly as they appear. Do not let Image 1, Image ${constructionImage}, or catalogue metadata override the uploaded jacket-fabric colour or material.`
    : fabricRegion === "custom"
    ? `FINAL FABRIC APPLICATION OVERRIDE — CRITICAL: Customization requires two independently coloured fabric regions. Image ${fabricImage} controls the complete fabric appearance of every visible upper piece named above, and Image ${lowerFabricImage} controls the complete fabric appearance of every visible lower piece named above. Do not preserve, copy, or infer the original upper or lower garment colour from Image 1 or Image ${constructionImage}. Words such as “matching”, “coordinated”, or “same”, and any fixed colour, pattern, texture, weave, finish, or material description in the selected design metadata describe garment construction or relationships only; they must never make the upper and lower fabrics identical. If any catalogue instruction or reference image conflicts with this paragraph, the two uploaded fabric photographs control fabric appearance.`
    : fabricRegion === "both"
      ? `FINAL FABRIC APPLICATION OVERRIDE — CRITICAL: Image ${fabricImage} is the sole authority for the fabric appearance of ${[...upperPieces, ...lowerPieces].join(", ")}. Replace the customer's original colour on each of those pieces, including a solid black or any other previous lower-garment cloth. Do not preserve, copy, or infer a conflicting garment colour, pattern, texture, weave, finish, or material from Image 1, Image ${constructionImage}, or catalogue metadata.`
      : fabricRegion === "upper"
        ? `FINAL FABRIC APPLICATION OVERRIDE — CRITICAL: Image ${fabricImage} is the sole authority for the fabric appearance of every visible upper piece named above. The lower garment must keep its original appearance. Do not let Image 1, Image ${constructionImage}, or catalogue metadata override the uploaded upper-fabric colour.`
        : `FINAL FABRIC APPLICATION OVERRIDE — CRITICAL: Image ${fabricImage} is the sole authority for the fabric appearance of every visible lower piece named above. The upper garment must keep its original appearance. Do not let Image 1, Image ${constructionImage}, or catalogue metadata override the uploaded lower-fabric colour.`;

  return [
    "You are the controlled visualization engine for NASIR BESPOKE, a luxury men's bespoke tailoring business. This is exclusively a men's clothing and men's formalwear system. Generate one photorealistic edit, not a new studio portrait or fashion editorial.",
    "EDIT PRIORITY (non-negotiable): Keep Image 1's customer, identity, body, pose, composition, camera, lighting, environment, and scene unchanged. Image 1 does not control the colour, shade, texture, weave, pattern, finish, or material appearance of any garment piece when a fabric authority instruction assigns that piece a fabric.",
    SCENE_LOCK,
    roleLines.join("\n"),
    "CUSTOMER PHOTO AUTHORITY — CRITICAL: Image 1 is the sole authority for the customer's identity, face, skin tone, age appearance, hair, facial hair, natural body size, build, body proportions, height, visible physical characteristics, pose, posture, expression, hands, camera perspective, framing, lighting, shadows, and background. Tailor the garment around the customer's actual body. Never slim, enlarge, reshape, lengthen, shorten, beautify, replace, or otherwise alter the customer to fit the garment or the mannequin. Never adopt mannequin or reference-person proportions.",
    fabricAuthorityLine,
    ...(unchangedRegionLine ? [unchangedRegionLine] : []),
    `CURATED DESIGN AUTHORITY: Image ${constructionImage} and any following detail references before the fabric photograph are authoritative only for garment construction, silhouette, layering, included pieces, and visible design architecture. They are not body, identity, pose, scene, lighting, colour, texture, material, footwear, or accessory references. Never copy a reference model, mannequin, person, scene, background, or material. When design text or a reference appearance conflicts with the uploaded fabric authority, the uploaded fabric authority wins.`,
    `SELECTED NASIR BESPOKE CURATED DESIGN: ${resolved.design.customer.name}${resolved.variant ? ` — ${resolved.variant.name}` : ""}. ${resolved.variant?.description ?? resolved.design.customer.description}. Internal garment family: ${resolved.design.blueprint.garmentFamily}. Silhouette: ${resolved.design.blueprint.silhouette.join(", ")}. Included pieces: ${resolved.design.blueprint.includedPieces.join(", ")}. Construction: ${construction}.`,
    `DESIGN INSTRUCTIONS: ${(resolved.variant?.promptFragments ?? resolved.design.generation.promptFragments).join(". ")}.`,
    `NEGATIVE DESIGN CONSTRAINTS: ${(resolved.variant?.negativeConstraints ?? resolved.design.generation.negativeConstraints).join(" ")}`,
    finalFabricOverrideLine,
    PATTERN_GEOMETRY,
    "HUE LOCK: Lighting and shadows from Image 1 may shade folds. They must not change the cloth hue toward the room, the customer's previous clothes, or the construction photograph.",
    "LEVEL 1 STYLING POLICY: Preserve the customer's existing footwear where visible. Do not add a tie, bow tie, pocket square, turban, jewellery, watch, or any other accessory. Do not use the construction reference's colour, fabric, pattern, material, person, or setting.",
    REALISM_PRESERVING_PATTERN,
  ].join("\n\n");
}
