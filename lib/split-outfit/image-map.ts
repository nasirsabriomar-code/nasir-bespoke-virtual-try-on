import { imageRoleLayout } from "@/lib/tryon/image-layout";
import type { ResolvedSplitOutfit } from "./generation";

export type SplitFabricPresence = {
  jacket: boolean;
  trousers: boolean;
  shirt: boolean;
  waistcoat: boolean;
};

export type SplitImageMap = {
  hasWaistcoat: boolean;
  person: 1;
  fabrics: {
    jacket: number | null;
    trousers: number | null;
    shirt: number | null;
    waistcoat: number | null;
  };
  construction: {
    jacket: number;
    trousers: number;
    shirt: number;
    waistcoat: number | null;
    shoes: number;
  };
  totalImages: number;
};

export function hasPhotographedWaistcoat(resolved: ResolvedSplitOutfit) {
  return Boolean(resolved.waistcoat && resolved.waistcoat.id !== "SUIT_WAISTCOAT_NONE");
}

/**
 * Numbers images for Split Outfit so the prompt and the provider packet
 * cannot drift. Person is Image 1, then construction photos, then assigned
 * fabrics last so the cloth photograph is the later colour signal.
 */
export function buildSplitImageMap(resolved: ResolvedSplitOutfit, fabrics: SplitFabricPresence): SplitImageMap {
  const hasWaistcoat = hasPhotographedWaistcoat(resolved);
  const layout = imageRoleLayout("split", ["jacket", "trousers", "shirt", ...(hasWaistcoat ? ["waistcoat"] : []), "shoes"], ["jacket", "trousers", "shirt", "waistcoat"].filter(piece => (piece !== "waistcoat" || hasWaistcoat) && fabrics[piece as keyof SplitFabricPresence]).map(piece => piece + "Fabric"));
  const position = (role: string) => layout.indexOf(role) + 1;
  const person = 1 as const;
  const jacket = position("jacket"), trousers = position("trousers"), shirt = position("shirt"), shoes = position("shoes");
  const waistcoat = hasWaistcoat ? position("waistcoat") : null;
  const jacketFabric = position("jacketFabric") || null, trouserFabric = position("trousersFabric") || null, shirtFabric = position("shirtFabric") || null, waistcoatFabric = position("waistcoatFabric") || null;

  return {
    hasWaistcoat,
    person,
    fabrics: {
      jacket: jacketFabric,
      trousers: trouserFabric,
      shirt: shirtFabric,
      waistcoat: waistcoatFabric,
    },
    construction: { jacket, trousers, shirt, waistcoat, shoes },
    totalImages: layout.length,
  };
}

const CLOTH_TRAITS = "exact colour, shade, texture, weave, yarn, nap, pile, slub, pattern, pattern scale, sheen, finish, and material";

export function fabricFidelityOverride(piece: string, fabricImage: number, constructionImage: number) {
  const trousersExtra = piece === "trousers"
    ? ` Image ${constructionImage} is a complete pair of trousers used only as a cut template — discard its original colour, wash, and cloth entirely (including olive, khaki, navy, grey, denim, or any other colour visible there). Apply assigned cloth to the trouser base panels: waistband, fly, pockets, belt loops, seams, both legs, folds and hem. Preserve only explicitly selected local side-stripe or trim exceptions.`
    : "";
  return `FINAL FABRIC APPLICATION OVERRIDE — ${piece.toUpperCase()}: Image ${fabricImage} is the sole authority for the ${CLOTH_TRAITS} of the ${piece} base panels, excluding explicitly selected facings, trim and embroidery. The ${piece} must look cut and sewn from that cloth, including how the weave reads at seams, edges, pockets, and folds. Keep this piece's repeat straight, parallel, evenly spaced, and at the intrinsic cloth repeat of Image ${fabricImage}. Read scale as cloth-pattern information, not source-image pixel dimensions. Keep spacing consistent on flat panels while allowing perspective compression and bending over curved folds. Preserve repeat density within panels. Align adjoining checks or stripes only where the selected cutting and grain direction permit; seams, lapel rolls and bias-cut pockets may legitimately interrupt the repeat. Never distort the cloth to force continuity. Do not keep, mix, tint, or infer cloth from Image 1, Image ${constructionImage}, any other fabric photograph, or catalogue text. Construction Image ${constructionImage} is cut and silhouette only for this ${piece}.${trousersExtra}`;
}
