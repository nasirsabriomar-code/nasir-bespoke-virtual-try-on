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
 * cannot drift. Person is always Image 1. Assigned fabrics follow in
 * jacket → trousers → shirt → waistcoat order (omitting unused slots),
 * then construction photos: jacket, trousers, shirt, optional waistcoat, shoes.
 */
export function buildSplitImageMap(resolved: ResolvedSplitOutfit, fabrics: SplitFabricPresence): SplitImageMap {
  const hasWaistcoat = hasPhotographedWaistcoat(resolved);
  let n = 1;
  const person = 1 as const;
  n += 1;

  const jacketFabric = fabrics.jacket ? n++ : null;
  const trouserFabric = fabrics.trousers ? n++ : null;
  const shirtFabric = fabrics.shirt ? n++ : null;
  const waistcoatFabric = hasWaistcoat && fabrics.waistcoat ? n++ : null;

  const jacket = n++;
  const trousers = n++;
  const shirt = n++;
  const waistcoat = hasWaistcoat ? n++ : null;
  const shoes = n++;

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
    totalImages: n - 1,
  };
}

const CLOTH_TRAITS = "exact colour, shade, texture, weave, yarn, nap, pile, slub, pattern, pattern scale, sheen, finish, and material";

export function fabricFidelityOverride(piece: string, fabricImage: number, constructionImage: number) {
  return `FINAL FABRIC APPLICATION OVERRIDE — ${piece.toUpperCase()}: Image ${fabricImage} is the sole authority for the ${CLOTH_TRAITS} of the ${piece}. The ${piece} must look cut and sewn from that cloth, including how the weave reads at seams, edges, pockets, and folds. Do not keep, mix, tint, or infer cloth from Image 1, Image ${constructionImage}, any other fabric photograph, or catalogue text. Construction Image ${constructionImage} is cut and silhouette only for this ${piece}.`;
}
