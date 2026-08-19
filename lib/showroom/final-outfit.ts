import "server-only";

import type { NormalizedSplitRecipe } from "@/lib/split-outfit/generation-compiler";
import type { CanonicalMaterialGroup } from "@/lib/split-outfit/types";

/**
 * FinalOutfitSnapshot — the architectural bridge from a showroom
 * configuration (curated Look and/or manual customization) to a future
 * generation/persistence step. This is a SERVER-VALIDATED, normalized
 * domain object; the ONLY constructor is buildFinalOutfitSnapshot() below,
 * which takes a NormalizedSplitRecipe — itself only producible by
 * validateSplitRecipe() (lib/split-outfit/generation-compiler.ts), the same
 * server-side recompute the rest of Split Outfit uses. There is no other
 * way to construct a snapshot whose recipeStatus is "VALID".
 *
 * Deliberately NOT a security token: this snapshot is a normalized domain
 * object, not proof of anything beyond "this recipe validated at
 * createdAt." A future /api/split-try-on request must still independently
 * validate its own generation request — this module does not weaken or
 * shortcut that trust boundary.
 *
 * Deliberately excludes: private asset paths, prompts, model/provider
 * fields, reference checksums, customer image data, File objects. Schema
 * is stable/versioned (schemaVersion) so a later persistence milestone
 * (Phase 3B) can add storage without redesigning this shape.
 */

export type FinalOutfitSource =
  | { type: "manual" }
  | { type: "signature-look"; lookId: string; customized: boolean };

export type FinalOutfitComponents = {
  upperId: string;
  lowerId: string;
  shirtId: string;
  waistcoatId: string | null;
  footwearId: string;
  accessoryIds: string[];
};

export type FinalOutfitSnapshot = {
  schemaVersion: 1;
  id: string;
  family: "suit";
  source: FinalOutfitSource;
  components: FinalOutfitComponents;
  materialGroups: CanonicalMaterialGroup[];
  recipeStatus: "VALID";
  createdAt: string;
};

/**
 * Constructs a FinalOutfitSnapshot from a server-validated recipe. `id` is
 * always server-generated (crypto.randomUUID) — a client-supplied
 * finalOutfitId is never accepted (see lib/showroom-finalize-handler.ts's
 * strict field allow-list, which has no such field at all).
 */
export function buildFinalOutfitSnapshot(
  recipe: NormalizedSplitRecipe,
  source: FinalOutfitSource,
): FinalOutfitSnapshot {
  return {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    family: "suit",
    source,
    components: {
      upperId: recipe.components.upper.id,
      lowerId: recipe.components.lower.id,
      shirtId: recipe.components.shirt.id,
      waistcoatId: recipe.components.waistcoat ? recipe.components.waistcoat.id : null,
      footwearId: recipe.components.footwear.id,
      accessoryIds: recipe.components.accessories.map((accessory) => accessory.id),
    },
    materialGroups: recipe.materialGroups,
    recipeStatus: "VALID",
    createdAt: new Date().toISOString(),
  };
}
