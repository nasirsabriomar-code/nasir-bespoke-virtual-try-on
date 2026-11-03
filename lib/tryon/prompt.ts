import { orderGenerationImages } from "./image-layout";
import type { CatalogSelection } from "@/lib/catalog/types";

const NASIR_MENS_INSTRUCTION = `
You are the controlled visualization engine for NASIR BESPOKE, a luxury men's bespoke tailoring business.
This is an exclusively men's clothing, men's formalwear, men's traditionalwear, men's weddingwear, and men's accessories system. Never introduce women's garments, dresses, gowns, skirts, women's tops, or feminine fashion styling.
Create one photorealistic edit of the male customer in the supplied person photograph wearing the explicitly selected men's garment configuration.
`.trim();

const EDIT_PRIORITY_MODULE = `
EDIT PRIORITY (non-negotiable):
This is an edit of Image 1, not a new fashion editorial, catalog photograph, or studio portrait. Image 1 remains the complete scene and the only source for the subject, composition, camera, lighting, and environment. Image 1 controls identity, body, pose and scene; selected construction controls the changed clothing geometry, assigned cloth controls its base material, and selected accessory references control only their named accessories. The final image must still be recognizably the same photograph of the same person in the same place.
`.trim();

const PERSON_MODULE = `
PERSON IMAGE AUTHORITY:
Image 1 is the male customer/person and the base photograph. Preserve identity, face, skin tone, hairstyle, facial hair, age appearance, body shape, proportions, pose, posture, expression, hands, camera perspective, framing, scene lighting and unaffected background. Do not slim, broaden, beautify, age, reshape, or replace the person. Keep the original background except for minimal reconstruction around the clothing edit.
`.trim();

function fabricModule(imageNumber: number) {
  return `
FABRIC IMAGE AUTHORITY:
Image ${imageNumber} is the physical showroom fabric photograph. Treat it as the source of truth only for colour, pattern, visible weave, texture, sheen, motif, checks, stripes, shade, finish, and material character. Apply it faithfully to assigned base panels, with explicitly selected facings, trim and embroidery confined to their specified details. Ignore any person, body, styling, scene, or garment construction visible in Image ${imageNumber}. Do not arbitrarily invent a different fabric.
`.trim();
}

const OUTFIT_MODULE = `
OUTFIT IMAGE AUTHORITY:
Image 2 is the customer-supplied outfit photograph. Treat it only as the authoritative construction and style source for the clothing: garment category, silhouette, cut, length, collar or lapels, pockets, seams, closures, button layout, cuffs, vents, layering, and proportion. Do not copy its wearer, face, body, pose, hair, hands, footwear, accessories, lighting, background, camera, or location. The fabric in Image 3 controls base-panel colour, weave, texture, pattern and surface finish; retain explicitly selected local facings, trim and embroidery.
`.trim();

const REFERENCE_IMAGE_MODULE = `
REFERENCE IMAGE HANDLING (critical):
Any controlled reference image after the uploaded customer, fabric, and optional outfit is a garment or accessory construction reference only. Extract only the selected garment/accessory design, silhouette, construction, and visible details from it. Ignore and do not reproduce every reference image's person, face, hair, skin, body proportions, pose, hands, unselected footwear, lighting, props, architecture, floor, wall, or background. Never substitute a reference person or scene for the customer. A reference may be a crop from a worn garment; treat the crop as a design sheet, not as a second subject or location.
`.trim();

const REALISM_MODULE = `
REALISM AND SAFETY:
Transfer garment design and construction onto the supplied customer; do not copy the reference model or person. Preserve physically credible tailoring, shoulder placement, armholes, sleeves, folds, gravity, compression, tension, overlaps, closures, waist behavior, trouser break, and hem behavior. Preserve anatomically correct hands and limbs. Do not add extra garments, random accessories, duplicate clothing, unselected embroidery, unselected button changes, altered facial identity, a different hairstyle, a different body shape, or any unrelated background, room, floor, wall, or camera change. Return only one finished photograph with no text, border, collage, split screen, or explanation.
`.trim();

export function buildTryOnPrompt(selection: CatalogSelection | undefined, options: { outfitProvided: boolean; bespokeReferenceCount?: number }) {
  const hasCatalog = Boolean(selection);
  const fabricImageNumber = options.outfitProvided ? 3 : 2;
  const hasUpperReference = Boolean(selection && selection.upper.category !== "no-change");
  const hasLowerReference = Boolean(selection && selection.lower && selection.upper.pieceType === "upper" && selection.lower.category !== "no-change");
  const hasSubtypeReference = Boolean(selection && selection.subtype && selection.subtype.id !== selection.upper.id);
  const hasUpperStyleReference = Boolean(selection?.upperStyle?.aiReferences.length);
  const hasLowerStyleReference = Boolean(selection?.lowerStyle?.aiReferences.length);
  const hasTurbanStyleReference = Boolean(selection?.turbanStyle?.aiReferences.length);
  const hasShoeStyleReference = Boolean(selection?.shoeStyle?.aiReferences.length);
  const pieces = [
    selection ? `SELECTED MEN'S UPPER OR COMPLETE LOOK:\n${selection.upper.name}. ${selection.upper.promptInstruction}` : "OUTFIT-ONLY MODE:\nUse Image 2 as the authoritative outfit style and construction source. Do not use a catalog garment or accessory blueprint.",
    selection?.subtype ? `SELECTED SUIT SUBTYPE:\n${selection.subtype.name}. ${selection.subtype.promptInstruction}` : "",
    selection?.lower ? `SELECTED MEN'S LOWER:\n${selection.lower.name}. ${selection.lower.promptInstruction}` : "",
    selection?.upperStyle ? `SELECTED UPPER STYLE:\n${selection.upperStyle.name}. ${selection.upperStyle.promptInstruction}` : "",
    selection?.lowerStyle ? `SELECTED LOWER STYLE:\n${selection.lowerStyle.name}. ${selection.lowerStyle.promptInstruction}` : "",
    selection ? `SELECTED TURBAN:\n${selection.turban.name}. ${selection.turban.promptInstruction}` : "",
    selection?.turbanStyle ? `SELECTED TURBAN STYLE:\n${selection.turbanStyle.name}. ${selection.turbanStyle.promptInstruction}` : "",
    selection ? `SELECTED MEN'S SHOES:\n${selection.shoes.name}. ${selection.shoes.promptInstruction}` : "",
    selection?.shoeStyle ? `SELECTED SHOE STYLE:\n${selection.shoeStyle.name}. ${selection.shoeStyle.promptInstruction}` : "",
  ].filter(Boolean);

  const referenceDescriptions = [
    ...(hasUpperReference ? ["selected upper or complete men's garment blueprint."] : []),
    ...(hasLowerReference ? ["independently selected men's lower-garment blueprint."] : []),
    ...(hasSubtypeReference ? ["selected men's suit subtype blueprint."] : []),
    ...(hasUpperStyleReference ? ["selected men's upper style reference."] : []),
    ...(hasLowerStyleReference ? ["selected men's lower style reference."] : []),
    ...(selection?.turban.aiReferences.length ? ["selected men's turban reference."] : []),
    ...(hasTurbanStyleReference ? ["selected men's turban style reference."] : []),
    ...(selection?.shoes.aiReferences.length ? ["selected men's shoe reference."] : []),
    ...(hasShoeStyleReference ? ["selected men's shoe style reference."] : []),
    ...Array.from({ length: options.bespokeReferenceCount ?? 0 }, () => "controlled bespoke visual-detail reference."),
  ];
  const layout = orderGenerationImages("catalog", "male customer/person photograph.", options.outfitProvided ? "customer-supplied outfit construction and style photograph." : undefined, ["physical showroom fabric photograph."], referenceDescriptions);
  const roles = ["IMAGE ROLE MAPPING (critical):", ...layout.map((description, index) => `Image ${index + 1} — ${description}`)];

  return [
    NASIR_MENS_INSTRUCTION,
    EDIT_PRIORITY_MODULE,
    roles.join("\n"),
    PERSON_MODULE,
    ...(options.outfitProvided ? [OUTFIT_MODULE] : []),
    fabricModule(fabricImageNumber),
    ...(hasCatalog || options.bespokeReferenceCount ? [REFERENCE_IMAGE_MODULE] : []),
    pieces.join("\n\n"),
    REALISM_MODULE,
  ].join("\n\n");
}

export { NASIR_MENS_INSTRUCTION };
