import "server-only";

import {
  SplitRecipeValidationError,
  validateSplitRecipe,
  type NormalizedSplitRecipe,
  type SplitTryOnClientRequest,
} from "@/lib/split-outfit/generation-compiler";
import type { CanonicalMaterialGroup } from "@/lib/split-outfit/types";
import { isRecipeIdenticalToLook } from "./look-application";
import { getActiveValidatedSignatureLooks } from "./look-validation";
import type { SignatureLook } from "./types";

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

// ============================================================
// SHARED CLIENT-FIELD RESOLUTION
// ------------------------------------------------------------
// Both /api/showroom/finalize-outfit (Phase 3A) and
// /api/customers/[id]/outfits (Phase 3B) accept the identical minimal
// client field shape (declared source + component selection IDs) and must
// resolve it the exact same way — there is only one implementation of
// "validate provenance, validate recipe, build snapshot," here, so the two
// routes cannot silently drift into different validation behavior.
// ============================================================

export type OutfitProvenanceErrorCode = "unknown_source" | "provenance_mismatch" | "unknown_look" | "wrong_family";

export class OutfitProvenanceError extends Error {
  constructor(
    public readonly code: OutfitProvenanceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "OutfitProvenanceError";
  }
}

/** The untrusted shape both routes accept. Nothing else is ever read from a request body for this purpose. */
export type RawOutfitFields = {
  source: unknown;
  lookId: unknown;
  upperId: unknown;
  lowerId: unknown;
  shirtId: unknown;
  waistcoatId: unknown;
  footwearId: unknown;
  accessoryIds: unknown;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/**
 * Resolves untrusted client fields into a server-validated
 * FinalOutfitSnapshot. Throws OutfitProvenanceError for a source/look
 * problem, or SplitRecipeValidationError (re-thrown from validateSplitRecipe)
 * for a recipe problem — callers map both to 400.
 */
export function resolveFinalOutfitSnapshot(
  fields: RawOutfitFields,
  lookLibrary: SignatureLook[],
): FinalOutfitSnapshot {
  const { source, lookId, upperId, lowerId, shirtId, waistcoatId, footwearId, accessoryIds } = fields;

  if (source !== "manual" && source !== "signature-look") {
    throw new OutfitProvenanceError("unknown_source", "Unknown outfit source.");
  }
  // Provenance shape must be internally consistent with the declared
  // source: a manual build must not also carry a lookId, and a
  // signature-look source must carry exactly one.
  if (source === "manual" && lookId !== undefined) {
    throw new OutfitProvenanceError("provenance_mismatch", "A manual build must not reference a Signature Look.");
  }
  if (source === "signature-look" && !isNonEmptyString(lookId)) {
    throw new OutfitProvenanceError("provenance_mismatch", "A Signature Look source must include a valid look ID.");
  }

  let sourceLook: SignatureLook | null = null;
  if (source === "signature-look" && typeof lookId === "string") {
    // Only an ACTIVE, independently re-validated look may ever be claimed as
    // provenance — an inactive, draft, or (defensively) invalid look is
    // rejected identically to an unknown one.
    sourceLook = getActiveValidatedSignatureLooks(lookLibrary).find((look) => look.id === lookId) ?? null;
    if (!sourceLook) throw new OutfitProvenanceError("unknown_look", "This Signature Look could not be found.");
    if (sourceLook.family !== "suit") {
      throw new OutfitProvenanceError("wrong_family", "This Signature Look does not match the current outfit family.");
    }
  }

  if (
    !isNonEmptyString(upperId) ||
    !isNonEmptyString(lowerId) ||
    !isNonEmptyString(shirtId) ||
    (waistcoatId !== null && !isNonEmptyString(waistcoatId)) ||
    !isNonEmptyString(footwearId) ||
    !Array.isArray(accessoryIds) ||
    !accessoryIds.every((id) => typeof id === "string")
  ) {
    throw new SplitRecipeValidationError("malformed_request", "Please submit a complete outfit recipe.");
  }

  const clientRequest: SplitTryOnClientRequest = {
    family: "suit",
    upperId,
    lowerId,
    shirtId,
    waistcoatId: waistcoatId as string | null,
    footwearId,
    accessoryIds: accessoryIds as string[],
  };

  // Re-runs the SAME server-side compatibility authority every other Split
  // Outfit entry point uses — never a second, duplicated rule table.
  const recipe = validateSplitRecipe(clientRequest);

  const resolvedSource: FinalOutfitSource = sourceLook
    ? {
      type: "signature-look",
      lookId: sourceLook.id,
      customized: !isRecipeIdenticalToLook(
        {
          family: recipe.family,
          upperId: recipe.components.upper.id,
          lowerId: recipe.components.lower.id,
          shirtId: recipe.components.shirt.id,
          waistcoatId: recipe.components.waistcoat ? recipe.components.waistcoat.id : "SUIT_WAISTCOAT_NONE",
          footwearId: recipe.components.footwear.id,
          accessoryIds: recipe.components.accessories.map((accessory) => accessory.id),
          materials: {},
        },
        sourceLook,
      ),
    }
    : { type: "manual" };

  return buildFinalOutfitSnapshot(recipe, resolvedSource);
}
