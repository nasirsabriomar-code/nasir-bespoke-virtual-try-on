import { getSplitOutfitRecipeStatus, sanitizeSplitOutfitState } from "@/lib/split-outfit/compatibility";
import type { SplitOutfitFamily, SplitOutfitState } from "@/lib/split-outfit/types";
import { validateSignatureLook } from "./look-validation";
import type { SignatureLook, SignatureLookProvenance } from "./types";

export type LookApplicationErrorCode =
  | "look_inactive"
  | "wrong_family"
  | "invalid_look"
  | "sanitization_altered_recipe";

export type LookApplicationResult =
  | { applied: true; state: SplitOutfitState }
  | { applied: false; code: LookApplicationErrorCode; reason: string };

/**
 * Applies a Signature Look into the EXISTING SplitOutfitState shape — there
 * is no parallel garment-state system. Fails safe: a look that is inactive,
 * belongs to a different family, references an unreal component, or fails
 * the compatibility engine's own validation is REJECTED atomically (no
 * partial recipe is ever applied) with a staff-friendly reason. On success
 * the returned state has already been run through the same
 * sanitizeSplitOutfitState() every other Split mutation uses, so downstream
 * behavior (visible options, material slots, recipe status) is identical to
 * a manually built recipe with the same selections.
 */
export function applySignatureLook(look: SignatureLook, targetFamily: SplitOutfitFamily): LookApplicationResult {
  if (look.status !== "active") {
    return { applied: false, code: "look_inactive", reason: "This look is no longer available." };
  }
  if (look.family !== targetFamily) {
    return { applied: false, code: "wrong_family", reason: "This look does not match the current outfit family." };
  }

  const validation = validateSignatureLook(look);
  if (!validation.valid) {
    return { applied: false, code: "invalid_look", reason: "This look could not be applied. Please choose another or build manually." };
  }

  const rawState: SplitOutfitState = {
    family: look.family,
    upperId: look.components.upperId,
    lowerId: look.components.lowerId,
    shirtId: look.components.shirtId,
    waistcoatId: look.components.waistcoatId,
    footwearId: look.components.footwearId,
    accessoryIds: [...look.components.accessoryIds],
    materials: {},
  };

  const sanitized = sanitizeSplitOutfitState(rawState);

  // A look that independently validated must still read as VALID once
  // routed through the exact same sanitize path every other mutation uses —
  // defense in depth against a future rule change silently altering a
  // previously-valid curated recipe. If it does not, refuse rather than
  // apply a partially-corrected recipe.
  if (getSplitOutfitRecipeStatus(sanitized) !== "VALID") {
    return { applied: false, code: "sanitization_altered_recipe", reason: "This look could not be applied. Please choose another or build manually." };
  }

  return { applied: true, state: sanitized };
}

function sameAccessorySet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return [...a].sort().join(",") === [...b].sort().join(",");
}

/**
 * Canonical component-identity comparison — the ONLY way customization
 * status is ever derived. There is no manually toggled "customized" flag
 * anywhere in this module; drift is structurally impossible because the
 * comparison is recomputed from the current state every time it is asked.
 */
export function isRecipeIdenticalToLook(state: SplitOutfitState, look: SignatureLook): boolean {
  return (
    state.upperId === look.components.upperId &&
    state.lowerId === look.components.lowerId &&
    state.shirtId === look.components.shirtId &&
    state.waistcoatId === look.components.waistcoatId &&
    state.footwearId === look.components.footwearId &&
    sameAccessorySet(state.accessoryIds, look.components.accessoryIds)
  );
}

/**
 * True iff the current provenance is a Signature Look AND the live recipe
 * has diverged from that look's original component selection. Always
 * derived fresh from canonical identity comparison — never a stored,
 * independently-toggled boolean, so it can never drift out of sync with the
 * actual selections (it flips back to false the instant selections are
 * restored to exactly match the source look).
 */
export function deriveCustomizedFromLook(
  state: SplitOutfitState,
  provenance: SignatureLookProvenance,
  library: SignatureLook[],
): boolean {
  if (provenance.type !== "signature-look") return false;
  const look = library.find((candidate) => candidate.id === provenance.lookId);
  if (!look) return false;
  return !isRecipeIdenticalToLook(state, look);
}
