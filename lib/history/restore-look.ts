import type { FabricRegion } from "@/lib/catalog/level1-prompt";
import { CURATED_CATEGORY_IDS } from "@/lib/catalog/level1-types";
import { SPLIT_OUTFIT_FAMILIES, type SplitOutfitFamily, type SplitOutfitState, type VisualTryOnMode } from "@/lib/split-outfit/types";

/** The generation metadata the history API already returns to the browser. */
export type HistoryGenerationLook = {
  mode?: string;
  categoryId?: string;
  curatedDesignId?: string;
  curatedVariantId?: string;
  fabricRegion?: string;
  splitFamily?: string;
  splitUpperId?: string;
  splitLowerId?: string;
  splitShirtId?: string;
  splitWaistcoatId?: string | null;
  splitFootwearId?: string;
  splitAccessoryIds?: string[];
};

export type RestoredLook =
  | {
      kind: "split";
      mode: Extract<VisualTryOnMode, "split">;
      state: SplitOutfitState;
      fabricRegion: Extract<FabricRegion, "upper" | "lower" | "both">;
    }
  | {
      kind: "level1";
      mode: Extract<VisualTryOnMode, "full">;
      categoryId: string;
      designId: string;
      variantId: string | null;
      fabricRegion: FabricRegion;
    }
  | { kind: "unsupported" };

const SPLIT_REGIONS = new Set(["upper", "lower", "both"]);
const LEVEL1_REGIONS = new Set(["upper", "lower", "both", "custom", "jacket"]);

function isSplitFamily(value: string): value is SplitOutfitFamily {
  return (SPLIT_OUTFIT_FAMILIES as readonly string[]).includes(value);
}

function optionalId(value: unknown): string | null {
  if (value === null) return null;
  return typeof value === "string" && value.length > 0 && value.length <= 120 ? value : null;
}

/**
 * Maps stored history metadata back into the workspace selection.
 * Person and fabric photos are not restored — upload slots are single-use.
 * The try-on handler still re-validates whatever this returns.
 */
export function restoreLookFromGeneration(generation: HistoryGenerationLook | undefined): RestoredLook {
  if (!generation) return { kind: "unsupported" };

  if (generation.mode === "split") {
    const family = generation.splitFamily;
    if (!family || !isSplitFamily(family)) return { kind: "unsupported" };
    const upperId = optionalId(generation.splitUpperId);
    const lowerId = optionalId(generation.splitLowerId);
    const shirtId = optionalId(generation.splitShirtId);
    const footwearId = optionalId(generation.splitFootwearId);
    if (!upperId || !lowerId || !shirtId || !footwearId) return { kind: "unsupported" };
    const waistcoatId = optionalId(generation.splitWaistcoatId);
    const accessoryIds = Array.isArray(generation.splitAccessoryIds)
      ? generation.splitAccessoryIds.filter((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 120)
      : [];
    const fabricRegion = SPLIT_REGIONS.has(generation.fabricRegion ?? "")
      ? (generation.fabricRegion as "upper" | "lower" | "both")
      : "both";
    return {
      kind: "split",
      mode: "split",
      state: { family, upperId, lowerId, shirtId, waistcoatId, footwearId, accessoryIds },
      fabricRegion,
    };
  }

  if (generation.mode === "level1") {
    const categoryId = optionalId(generation.categoryId);
    const designId = optionalId(generation.curatedDesignId);
    if (!categoryId || !designId) return { kind: "unsupported" };
    if (!(CURATED_CATEGORY_IDS as readonly string[]).includes(categoryId)) return { kind: "unsupported" };
    const storedRegion = LEVEL1_REGIONS.has(generation.fabricRegion ?? "")
      ? (generation.fabricRegion as FabricRegion)
      : "both";
    const fabricRegion: FabricRegion = categoryId === "jackets" ? "jacket" : storedRegion === "jacket" ? "both" : storedRegion;
    return {
      kind: "level1",
      mode: "full",
      categoryId,
      designId,
      variantId: optionalId(generation.curatedVariantId),
      fabricRegion,
    };
  }

  return { kind: "unsupported" };
}
