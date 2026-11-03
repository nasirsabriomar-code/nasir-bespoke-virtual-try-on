import { PATTERN_GEOMETRY, REALISM_PRESERVING_PATTERN, SCENE_LOCK } from "@/lib/tryon/pattern-geometry";
import type { ResolvedSplitOutfit } from "./generation";
import {
  buildSplitImageMap,
  fabricFidelityOverride,
  type SplitFabricPresence,
  type SplitImageMap,
} from "./image-map";

export type SplitFabricRegion = "upper" | "lower" | "both";

function pieceBinding(name: string, construction: number, fabric: number | null, fragment: string, extra = "") {
  if (fabric) {
    return `${name} [Image ${construction} = cut; Image ${fabric} = cloth — exact shade and texture of Image ${fabric}, as if cut from that cloth]${extra}: ${fragment}`;
  }
  return `${name} [Image ${construction} = cut and cloth]${extra}: ${fragment}`;
}

function imageRoleLines(map: SplitImageMap) {
  const lines = [
    "IMAGE ROLE MAPPING (critical):",
    "Image 1 — male customer/person photograph and the complete source scene.",
  ];
  if (map.fabrics.jacket) lines.push(`Image ${map.fabrics.jacket} — physical showroom fabric for the jacket only. Absolute cloth: exact colour, shade, and texture.`);
  if (map.fabrics.trousers) lines.push(`Image ${map.fabrics.trousers} — physical showroom fabric for the trousers only. Absolute cloth: exact colour, shade, and texture.`);
  if (map.fabrics.shirt) lines.push(`Image ${map.fabrics.shirt} — physical showroom fabric for the shirt only. Absolute cloth: exact colour, shade, and texture.`);
  if (map.fabrics.waistcoat) lines.push(`Image ${map.fabrics.waistcoat} — physical showroom fabric for the waistcoat only. Absolute cloth: exact colour, shade, and texture.`);
  lines.push(
    map.fabrics.jacket
      ? `Image ${map.construction.jacket} — NASIR BESPOKE approved jacket construction (cut, lapel, pockets, vents only — cloth from Image ${map.fabrics.jacket}).`
      : `Image ${map.construction.jacket} — NASIR BESPOKE approved jacket construction AND cloth appearance.`,
  );
  lines.push(
    map.fabrics.trousers
      ? `Image ${map.construction.trousers} — NASIR BESPOKE approved trouser CUT TEMPLATE only (rise, pleats, baggy/straight/tapered silhouette, hem). Discard this image's original cloth colour completely. Cloth is Image ${map.fabrics.trousers} only.`
      : `Image ${map.construction.trousers} — NASIR BESPOKE approved trouser construction AND cloth appearance. If this image shows jeans, the customer wears those jeans unless a trouser fabric photograph was supplied.`,
  );
  lines.push(
    map.fabrics.shirt
      ? `Image ${map.construction.shirt} — NASIR BESPOKE approved shirt construction (cut only — cloth from Image ${map.fabrics.shirt}).`
      : `Image ${map.construction.shirt} — NASIR BESPOKE approved shirt construction AND cloth appearance, including a white shirt if that is what this reference shows.`,
  );
  if (map.construction.waistcoat) {
    lines.push(
      map.fabrics.waistcoat
        ? `Image ${map.construction.waistcoat} — NASIR BESPOKE approved waistcoat construction (cut only — cloth from Image ${map.fabrics.waistcoat}).`
        : `Image ${map.construction.waistcoat} — NASIR BESPOKE approved waistcoat construction AND cloth appearance.`,
    );
  }
  lines.push(`Image ${map.construction.shoes} — NASIR BESPOKE approved footwear construction AND cloth appearance.`);
  return lines.join("\n");
}

/**
 * Composes a modular outfit recipe into a single generation prompt.
 * Image numbers come only from buildSplitImageMap.
 */
export function buildSplitOutfitPrompt(
  resolved: ResolvedSplitOutfit,
  fabrics: SplitFabricPresence = { jacket: false, trousers: false, shirt: false, waistcoat: false },
) {
  const map = buildSplitImageMap(resolved, fabrics);
  const overrides = [
    ...(map.fabrics.jacket ? [fabricFidelityOverride("jacket", map.fabrics.jacket, map.construction.jacket)] : []),
    ...(map.fabrics.trousers ? [fabricFidelityOverride("trousers", map.fabrics.trousers, map.construction.trousers)] : []),
    ...(map.fabrics.shirt ? [fabricFidelityOverride("shirt", map.fabrics.shirt, map.construction.shirt)] : []),
    ...(map.fabrics.waistcoat && map.construction.waistcoat
      ? [fabricFidelityOverride("waistcoat", map.fabrics.waistcoat, map.construction.waistcoat)]
      : []),
  ];

  const componentLines = [
    pieceBinding("Jacket", map.construction.jacket, map.fabrics.jacket, resolved.upper.generation.constructionFragment),
    pieceBinding("Trousers", map.construction.trousers, map.fabrics.trousers, resolved.lower.generation.constructionFragment),
    pieceBinding(
      "Shirt",
      map.construction.shirt,
      map.fabrics.shirt,
      resolved.shirt.generation.constructionFragment,
      map.fabrics.shirt ? "" : " — including white if that is the shirt reference",
    ),
    ...(resolved.waistcoat && map.construction.waistcoat
      ? [pieceBinding("Waistcoat", map.construction.waistcoat, map.fabrics.waistcoat, resolved.waistcoat.generation.constructionFragment)]
      : resolved.waistcoat
        ? [`Waistcoat: ${resolved.waistcoat.generation.constructionFragment}`]
        : []),
    `Footwear [Image ${map.construction.shoes} = cut and cloth]: ${resolved.footwear.generation.constructionFragment}`,
    ...resolved.accessories.map(
      (accessory) => `Accessory [text only; conventional tailored placement]: ${accessory.generation.constructionFragment}`,
    ),
  ];

  return [
    "You are the controlled visualization engine for NASIR BESPOKE, a luxury men's bespoke tailoring business. This is exclusively a men's clothing and men's formalwear system. Generate one photorealistic edit, not a new studio portrait or fashion editorial.",
    "EDIT PRIORITY (non-negotiable): Keep Image 1's customer, identity, body, pose, composition, camera, scene lighting and unaffected environment unchanged. Image 1 does not control the colour, shade, texture, weave, pattern, finish, or material appearance of any garment piece when a fabric photograph is assigned to that piece.",
    SCENE_LOCK,
    imageRoleLines(map),
    "CUSTOMER PHOTO AUTHORITY — CRITICAL: Image 1 is the sole authority for the customer's identity, face, skin tone, age appearance, hair, facial hair, natural body size, build, body proportions, height, visible physical characteristics, pose, posture, expression, hands, camera perspective, framing, scene lighting and unaffected background. Tailor every garment around the customer's actual body. Never slim, enlarge, reshape, lengthen, shorten, beautify, replace, or otherwise alter the customer to fit a garment or a mannequin.",
    "CURATED CONSTRUCTION AUTHORITY: Wear exactly the selected pieces listed below. Do not substitute a different jacket, trouser, shirt, waistcoat, or shoe. Never copy a reference model, mannequin, person, scene, or background. Assigned fabric controls base-panel material appearance, including pattern and repeat; selected facings and trim remain construction exceptions.",
    "CONSTRUCTION PHOTO ISOLATION — CRITICAL: Each construction photograph may show a full mannequin look. Extract only the named piece's construction; ignore every other garment/accessory. Jacket button layout follows the selected closure: single-breasted uses its selected single column; double-breasted preserves the selected two-column arrangement and fastening count. Never stack duplicate buttons at one position. Waistcoat buttons belong only to the waistcoat layer; do not transfer buttons between layers.",
    `SELECTED MODULAR OUTFIT (${resolved.state.family}):\n${componentLines.join("\n")}`,
    map.hasWaistcoat
      ? "TEXT-COMPOSED PIECES: Any accessories listed above have no reference photograph. Place each only where the description says. Do not invent details beyond what is described, and do not add any accessory not explicitly listed. Do not invent a second waistcoat."
      : "TEXT-COMPOSED PIECES: There is no waistcoat — do not add one. Any accessories listed above have no reference photograph. Place each only where the description says. Do not invent details beyond what is described, and do not add any accessory not explicitly listed.",
    ...overrides,
    PATTERN_GEOMETRY,
    "HUE LOCK: Lighting and shadows from Image 1 may shade folds. They must not change the cloth hue toward the room, the customer's previous clothes, or a construction photograph.",
    REALISM_PRESERVING_PATTERN,
  ].join("\n\n");
}

export type { SplitFabricPresence };
