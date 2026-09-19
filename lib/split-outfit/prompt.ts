import type { SplitComponentOption } from "./types";
import type { ResolvedSplitOutfit } from "./generation";

export type SplitFabricRegion = "upper" | "lower" | "both";

function photographedWaistcoat(resolved: ResolvedSplitOutfit) {
  return Boolean(resolved.waistcoat && resolved.waistcoat.id !== "SUIT_WAISTCOAT_NONE");
}

function appearanceOf(option: SplitComponentOption): "uploaded-fabric" | "reference" {
  if (option.generation.appearance) return option.generation.appearance;
  return option.materialRequirements?.[0]?.defaultFabricSource === "atelier-standard" ? "reference" : "uploaded-fabric";
}

/**
 * Composes a modular outfit recipe into a single generation prompt.
 *
 * Image order contract — must match inputParts() in
 * lib/tryon/providers/openai.ts: Image 1 person, Image 2 fabric,
 * Image 3 jacket, Image 4 trousers, Image 5 shirt, optional waistcoat,
 * then footwear. Accessories stay text-only.
 */
export function buildSplitOutfitPrompt(resolved: ResolvedSplitOutfit, fabricRegion: SplitFabricRegion = "both") {
  const hasWaistcoatPhoto = photographedWaistcoat(resolved);
  const waistcoat = hasWaistcoatPhoto ? resolved.waistcoat : null;
  const footwearImage = hasWaistcoatPhoto ? 7 : 6;
  const shirtImage = 5;
  const waistcoatImage = hasWaistcoatPhoto ? 6 : null;

  const jacketTakesFabric = fabricRegion === "both" || fabricRegion === "upper";
  const lowerTakesFabric = (fabricRegion === "both" || fabricRegion === "lower") && appearanceOf(resolved.lower) === "uploaded-fabric";
  const waistcoatTakesFabric = Boolean(waistcoat && appearanceOf(waistcoat) === "uploaded-fabric" && jacketTakesFabric);

  const imageRoleLines = [
    "IMAGE ROLE MAPPING (critical):",
    "Image 1 — male customer/person photograph and the complete source scene.",
    "Image 2 — physical showroom fabric photograph.",
    jacketTakesFabric
      ? "Image 3 — NASIR BESPOKE approved jacket construction reference (cut, lapel, pockets, vents only — cloth from Image 2)."
      : "Image 3 — NASIR BESPOKE approved jacket construction AND cloth appearance. Do not recolour this jacket from Image 2.",
    lowerTakesFabric
      ? "Image 4 — NASIR BESPOKE approved trouser construction reference (cut, pleats, rise, hem only — cloth from Image 2)."
      : "Image 4 — NASIR BESPOKE approved trouser construction AND cloth appearance. These trousers keep the cloth shown in Image 4. Do not recolour them from Image 2. Do not turn them into tailored suit trousers if they are jeans, or into jeans if they are tailored trousers.",
    `Image ${shirtImage} — NASIR BESPOKE approved shirt construction AND cloth appearance.`,
    ...(waistcoatImage
      ? [
          waistcoatTakesFabric
            ? `Image ${waistcoatImage} — NASIR BESPOKE approved waistcoat construction reference (cut only — cloth from Image 2).`
            : `Image ${waistcoatImage} — NASIR BESPOKE approved waistcoat construction AND cloth appearance.`,
        ]
      : []),
    `Image ${footwearImage} — NASIR BESPOKE approved footwear construction AND cloth appearance.`,
  ];

  const fabricTargets = [
    ...(jacketTakesFabric ? ["the jacket"] : []),
    ...(lowerTakesFabric ? ["the trousers"] : []),
    ...(waistcoatTakesFabric ? ["the waistcoat"] : []),
  ];
  const fabricAuthorityLine = fabricTargets.length
    ? `FABRIC PHOTO AUTHORITY — CRITICAL: Image 2 is authoritative only for base colour, shade, texture, weave, pattern, pattern scale, sheen, finish, motif, checks, stripes, and material appearance of ${fabricTargets.join(" and ")}. Apply these fabric characteristics faithfully to ${fabricTargets.join(" and ")} only. Ignore every person, garment construction, scene, styling, pose, and background that might be visible in Image 2.`
    : "FABRIC PHOTO AUTHORITY — CRITICAL: Image 2 is not applied to any garment in this recipe. Ignore Image 2 for cloth, colour, and construction.";

  const unchangedLines = [
    ...(!jacketTakesFabric
      ? ["UNCHANGED JACKET CLOTH — CRITICAL: The jacket must keep the cloth, colour, and material shown in Image 3. Do not apply Image 2's fabric to the jacket."]
      : []),
    ...(!lowerTakesFabric
      ? ["UNCHANGED TROUSER CLOTH — CRITICAL: The trousers must be rendered as the selected lower garment in Image 4, including that image's cloth and material. Do not apply Image 2's fabric to the trousers. If Image 4 shows jeans, the customer wears those jeans — not pressed suit trousers painted with Image 2."]
      : []),
  ];

  const jacketBinding = jacketTakesFabric
    ? `Jacket [Image 3 = cut; Image 2 = cloth]: ${resolved.upper.generation.constructionFragment}`
    : `Jacket [Image 3 = cut and cloth]: ${resolved.upper.generation.constructionFragment}`;
  const trouserBinding = lowerTakesFabric
    ? `Trousers [Image 4 = cut; Image 2 = cloth]: ${resolved.lower.generation.constructionFragment}`
    : `Trousers [Image 4 = cut and cloth; do not apply Image 2]: ${resolved.lower.generation.constructionFragment}`;
  const shirtBinding = `Shirt [Image ${shirtImage} = cut and cloth]: ${resolved.shirt.generation.constructionFragment}`;
  const waistcoatBinding = waistcoat && waistcoatImage
    ? waistcoatTakesFabric
      ? `Waistcoat [Image ${waistcoatImage} = cut; Image 2 = cloth]: ${waistcoat.generation.constructionFragment}`
      : `Waistcoat [Image ${waistcoatImage} = cut and cloth]: ${waistcoat.generation.constructionFragment}`
    : resolved.waistcoat
      ? `Waistcoat: ${resolved.waistcoat.generation.constructionFragment}`
      : null;
  const footwearBinding = `Footwear [Image ${footwearImage} = cut and cloth]: ${resolved.footwear.generation.constructionFragment}`;
  const accessoryBindings = resolved.accessories.map(
    (accessory) => `Accessory [text only; conventional tailored placement]: ${accessory.generation.constructionFragment}`,
  );

  const componentLines = [jacketBinding, trouserBinding, shirtBinding, ...(waistcoatBinding ? [waistcoatBinding] : []), footwearBinding, ...accessoryBindings];

  const notFromFabric = [
    ...(!jacketTakesFabric ? ["jacket"] : []),
    ...(!lowerTakesFabric ? ["trousers"] : []),
    "shirt",
    ...(waistcoat && !waistcoatTakesFabric ? ["waistcoat"] : []),
    ...(!waistcoat ? [] : []),
    "footwear",
    "accessories",
  ];

  const finalFabricOverrideLine = fabricTargets.length
    ? `FINAL FABRIC APPLICATION OVERRIDE — CRITICAL: Image 2 is the sole cloth authority for ${fabricTargets.join(" and ")} only. ${notFromFabric.join(", ")} are not coloured from Image 2. Do not preserve a conflicting colour on ${fabricTargets.join(" and ")} from Image 1 or from a construction reference. Do not apply Image 2 to any piece not named here.`
    : "FINAL FABRIC APPLICATION OVERRIDE — CRITICAL: Image 2 is not the cloth authority for any piece in this recipe.";

  const shirtAndFootwearImages = waistcoatImage ? `Images ${shirtImage}, ${waistcoatImage}, and ${footwearImage}` : `Images ${shirtImage} and ${footwearImage}`;

  return [
    "You are the controlled visualization engine for NASIR BESPOKE, a luxury men's bespoke tailoring business. This is exclusively a men's clothing and men's formalwear system. Generate one photorealistic edit, not a new studio portrait or fashion editorial.",
    "EDIT PRIORITY (non-negotiable): Keep Image 1's customer, identity, body, pose, composition, camera, lighting, environment, and scene unchanged. Image 1 does not control the colour, shade, texture, weave, pattern, finish, or material appearance of any garment piece when a fabric authority instruction assigns that piece a fabric.",
    imageRoleLines.join("\n"),
    "CUSTOMER PHOTO AUTHORITY — CRITICAL: Image 1 is the sole authority for the customer's identity, face, skin tone, age appearance, hair, facial hair, natural body size, build, body proportions, height, visible physical characteristics, pose, posture, expression, hands, camera perspective, framing, lighting, shadows, and background. Tailor every garment around the customer's actual body. Never slim, enlarge, reshape, lengthen, shorten, beautify, replace, or otherwise alter the customer to fit a garment or a mannequin.",
    fabricAuthorityLine,
    ...unchangedLines,
    `CURATED CONSTRUCTION AUTHORITY: Wear exactly the selected pieces listed below. Do not substitute a different jacket, trouser, shirt, waistcoat, or shoe. Image 3 is the jacket cut. Image 4 is the selected lower garment cut${lowerTakesFabric ? "" : " and cloth"}. ${shirtAndFootwearImages} are the shirt${waistcoatImage ? ", waistcoat," : ""} and footwear. Never copy a reference model, mannequin, person, scene, or background. When a piece is assigned Image 2 as cloth authority, Image 2 wins over that piece's construction photograph for colour and material only.`,
    `SELECTED MODULAR OUTFIT (${resolved.state.family}):\n${componentLines.join("\n")}`,
    hasWaistcoatPhoto
      ? "TEXT-COMPOSED PIECES: Any accessories listed above have no reference photograph. Place each only where the description says. Do not invent details beyond what is described, and do not add any accessory not explicitly listed. Do not invent a second waistcoat."
      : "TEXT-COMPOSED PIECES: There is no waistcoat — do not add one. Any accessories listed above have no reference photograph. Place each only where the description says. Do not invent details beyond what is described, and do not add any accessory not explicitly listed.",
    finalFabricOverrideLine,
    "REALISM: Use physically credible tailoring around the customer's actual frame: natural shoulder placement, sleeves, folds, drape, gravity, compression, tension, closures, waist behavior, trouser break, and hem. Preserve anatomically correct hands and limbs. Do not add duplicate clothing, random accessories, invented embroidery, extra limbs, text, a border, a collage, split screen, or an explanation. Return only one finished photograph.",
  ].join("\n\n");
}
