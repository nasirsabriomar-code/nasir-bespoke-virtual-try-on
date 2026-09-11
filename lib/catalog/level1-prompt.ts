import type { ResolvedLevel1Design } from "@/lib/catalog/level1-types";

export type FabricRegion = "upper" | "lower" | "both";

export function buildLevel1TryOnPrompt(resolved: ResolvedLevel1Design, fabricRegion: FabricRegion = "both") {
  const detailReferenceCount = resolved.detailAssets.length;
  const roleLines = [
    "IMAGE ROLE MAPPING (critical):",
    "Image 1 — male customer/person photograph and the complete source scene.",
    "Image 2 — physical showroom fabric photograph.",
    "Image 3 — NASIR BESPOKE approved curated garment construction reference.",
    ...Array.from({ length: detailReferenceCount }, (_, index) => `Image ${index + 4} — NASIR BESPOKE approved curated garment detail reference.`),
  ];
  const construction = Object.entries(resolved.design.blueprint.construction)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : value}`)
    .join("; ");

  const { upper: upperPieces, lower: lowerPieces } = resolved.design.blueprint.fabricRegions;
  const fabricAuthorityLine = fabricRegion === "both"
    ? "FABRIC PHOTO AUTHORITY — CRITICAL: Image 2 is authoritative only for base colour, shade, texture, weave, pattern, pattern scale, sheen, finish, motif, checks, stripes, and material appearance. Apply these fabric characteristics faithfully to the selected garment pieces. Ignore every person, garment construction, scene, styling, pose, and background that might be visible in Image 2."
    : fabricRegion === "upper"
      ? `FABRIC PHOTO AUTHORITY — CRITICAL: Image 2 is authoritative only for base colour, shade, texture, weave, pattern, pattern scale, sheen, finish, motif, checks, stripes, and material appearance. Apply these fabric characteristics only to the upper garment piece(s): ${upperPieces.join(", ")}. Ignore every person, garment construction, scene, styling, pose, and background that might be visible in Image 2.`
      : `FABRIC PHOTO AUTHORITY — CRITICAL: Image 2 is authoritative only for base colour, shade, texture, weave, pattern, pattern scale, sheen, finish, motif, checks, stripes, and material appearance. Apply these fabric characteristics only to the lower garment piece(s): ${lowerPieces.join(", ")}. Ignore every person, garment construction, scene, styling, pose, and background that might be visible in Image 2.`;

  const unchangedRegionLine = fabricRegion === "upper"
    ? `UNCHANGED REGION — CRITICAL: The lower garment piece(s) — ${lowerPieces.join(", ")} — must be rendered exactly as they appear in Image 3, in their original colour, fabric, pattern, and material. Do not apply Image 2's fabric to the lower garment piece(s) under any circumstance. Do not blend, average, or partially apply the fabric colour to the lower garment piece(s).`
    : fabricRegion === "lower"
      ? `UNCHANGED REGION — CRITICAL: The upper garment piece(s) — ${upperPieces.join(", ")} — must be rendered exactly as they appear in Image 3, in their original colour, fabric, pattern, and material. Do not apply Image 2's fabric to the upper garment piece(s) under any circumstance. Do not blend, average, or partially apply the fabric colour to the upper garment piece(s).`
      : null;

  return [
    "You are the controlled visualization engine for NASIR BESPOKE, a luxury men's bespoke tailoring business. This is exclusively a men's clothing and men's formalwear system. Generate one photorealistic edit, not a new studio portrait or fashion editorial.",
    "EDIT PRIORITY (non-negotiable): Image 1 remains the same photograph, subject, composition, camera, lighting, environment, and scene. If another image conflicts with Image 1, Image 1 wins.",
    roleLines.join("\n"),
    "CUSTOMER PHOTO AUTHORITY — CRITICAL: Image 1 is the sole authority for the customer's identity, face, skin tone, age appearance, hair, facial hair, natural body size, build, body proportions, height, visible physical characteristics, pose, posture, expression, hands, camera perspective, framing, lighting, shadows, and background. Tailor the garment around the customer's actual body. Never slim, enlarge, reshape, lengthen, shorten, beautify, replace, or otherwise alter the customer to fit the garment or the mannequin. Never adopt mannequin or reference-person proportions.",
    fabricAuthorityLine,
    ...(unchangedRegionLine ? [unchangedRegionLine] : []),
    "CURATED DESIGN AUTHORITY: Image 3 and any following controlled reference images are authoritative only for garment construction, silhouette, layering, included pieces, and visible design architecture. They are not body, identity, pose, scene, lighting, colour, texture, material, footwear, or accessory references. Never copy a reference model, mannequin, person, scene, background, or material.",
    `SELECTED NASIR BESPOKE CURATED DESIGN: ${resolved.design.customer.name}. ${resolved.design.customer.description}. Internal garment family: ${resolved.design.blueprint.garmentFamily}. Silhouette: ${resolved.design.blueprint.silhouette.join(", ")}. Included pieces: ${resolved.design.blueprint.includedPieces.join(", ")}. Construction: ${construction}.`,
    `DESIGN INSTRUCTIONS: ${resolved.design.generation.promptFragments.join(". ")}.`,
    `NEGATIVE DESIGN CONSTRAINTS: ${resolved.design.generation.negativeConstraints.join(" ")}`,
    "LEVEL 1 STYLING POLICY: Preserve the customer's existing footwear where visible. Do not add a tie, bow tie, pocket square, turban, jewellery, watch, or any other accessory. Do not use the construction reference's colour, fabric, pattern, material, person, or setting.",
    "REALISM: Use physically credible bespoke tailoring around the customer's actual frame: natural shoulder placement, sleeves, folds, drape, gravity, compression, tension, closures, waist behavior, trouser break, and hem. Preserve anatomically correct hands and limbs. Do not add duplicate clothing, random accessories, invented embroidery, extra limbs, text, a border, a collage, split screen, or an explanation. Return only one finished photograph.",
  ].join("\n\n");
}
