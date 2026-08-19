import { findSplitOption, getSplitOutfitRecipeStatus } from "@/lib/split-outfit/compatibility";
import type { SplitOutfitState } from "@/lib/split-outfit/types";
import type { SignatureLook } from "./types";

export type SignatureLookValidationErrorCode =
  | "unknown_component"
  | "duplicate_accessory"
  | "recipe_incomplete"
  | "recipe_conflict";

export type SignatureLookValidationResult =
  | { valid: true }
  | { valid: false; code: SignatureLookValidationErrorCode; reason: string };

/**
 * Builds the plain SplitOutfitState a Look's components correspond to, for
 * feeding into the existing compatibility engine. `materials` is unused by
 * every compatibility function this module calls, so an empty object is
 * always correct here — Signature Looks never carry material data (see
 * lib/showroom/types.ts doc comment: materials are recipe-owned, not
 * look-owned).
 */
function stateForLook(look: SignatureLook): SplitOutfitState {
  return {
    family: look.family,
    upperId: look.components.upperId,
    lowerId: look.components.lowerId,
    shirtId: look.components.shirtId,
    waistcoatId: look.components.waistcoatId,
    footwearId: look.components.footwearId,
    accessoryIds: look.components.accessoryIds,
    materials: {},
  };
}

/**
 * Independently validates a Signature Look using the SAME deterministic
 * compatibility authority (lib/split-outfit/compatibility.ts) the rest of
 * the app uses — there is no second, look-specific rule table. A look is
 * never trusted merely because it is hardcoded curated data: every active
 * look is re-derived and re-checked here, both in tests and (via
 * getActiveValidatedSignatureLooks) at runtime, so a malformed/incompatible
 * look can never reach a customer or staff member.
 */
export function validateSignatureLook(look: SignatureLook): SignatureLookValidationResult {
  const { upperId, lowerId, shirtId, waistcoatId, footwearId, accessoryIds } = look.components;

  if (new Set(accessoryIds).size !== accessoryIds.length) {
    return { valid: false, code: "duplicate_accessory", reason: "This look contains a duplicate accessory selection." };
  }

  const upper = findSplitOption(look.family, upperId);
  const lower = findSplitOption(look.family, lowerId);
  const shirt = findSplitOption(look.family, shirtId);
  const waistcoat = findSplitOption(look.family, waistcoatId);
  const footwear = findSplitOption(look.family, footwearId);
  const accessories = accessoryIds.map((id) => findSplitOption(look.family, id));

  if (
    !upper || upper.categoryId !== "upper" ||
    !lower || lower.categoryId !== "lower" ||
    !shirt || shirt.categoryId !== "inner-shirt" ||
    !waistcoat || waistcoat.categoryId !== "inner-waistcoat" ||
    !footwear || footwear.categoryId !== "footwear" ||
    accessories.some((accessory) => !accessory || accessory.categoryId !== "accessory")
  ) {
    return { valid: false, code: "unknown_component", reason: "This look references an unknown or invalid component." };
  }

  const status = getSplitOutfitRecipeStatus(stateForLook(look));
  if (status === "CONFLICT") {
    return { valid: false, code: "recipe_conflict", reason: "This look's component combination is not valid together." };
  }
  if (status === "INCOMPLETE") {
    return { valid: false, code: "recipe_incomplete", reason: "This look is missing a required component." };
  }

  return { valid: true };
}

/**
 * The only source recommendation/application code should read from. Filters
 * to `status === "active"` AND independently re-validates each — an
 * "active" look that somehow fails validation is excluded, never
 * surfaced. This is the runtime fail-closed behavior required alongside the
 * library's own test coverage.
 */
export function getActiveValidatedSignatureLooks(library: SignatureLook[]): SignatureLook[] {
  return library.filter((look) => look.status === "active" && validateSignatureLook(look).valid);
}
