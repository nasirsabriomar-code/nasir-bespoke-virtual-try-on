import type { SplitReferencePolicy } from "./types";

/**
 * Explicit, data-driven construction-reference policy for the Suit family.
 * This is the single authority `buildSplitAuthorityPlan` and the readiness
 * model consult — no other file may hardcode a component's image-vs-text
 * behavior. Extending to other families/components later means adding rows
 * here, not new conditionals in the compiler.
 */
const SUIT_REFERENCE_POLICY: Record<string, SplitReferencePolicy> = {
  // Uppers — every jacket construction is visually complex enough that a
  // photo is mandatory; there is no acceptable text-only fallback.
  SUIT_UPPER_CLASSIC: "REQUIRED",
  SUIT_UPPER_DOUBLE_BREASTED: "REQUIRED",
  SUIT_UPPER_TUXEDO: "REQUIRED",
  SUIT_UPPER_THREE_PIECE: "REQUIRED",
  SUIT_UPPER_STATEMENT: "REQUIRED",

  // Waistcoats — required when a real waistcoat is selected. The explicit
  // "no waistcoat" sentinel is handled structurally (see
  // getSplitReferencePolicy below), never entered into this table, so it
  // can never require or resolve a reference by construction.
  SUIT_WAISTCOAT_CLASSIC: "REQUIRED",
  SUIT_WAISTCOAT_FORMAL: "REQUIRED",
  SUIT_WAISTCOAT_TUXEDO: "REQUIRED",

  // Trousers — text-only for Suit v1.
  SUIT_LOWER_CLASSIC_STRAIGHT: "TEXT_ONLY",
  SUIT_LOWER_TAILORED_TAPERED: "TEXT_ONLY",
  SUIT_LOWER_PLEATED_FORMAL: "TEXT_ONLY",
  SUIT_LOWER_TUXEDO_TROUSER: "TEXT_ONLY",
  SUIT_LOWER_CONTEMPORARY: "TEXT_ONLY",

  // Shirts — text-only for Suit v1 (independent shirt FABRIC is now
  // customer-uploadable — see MATERIAL authority — but shirt CONSTRUCTION
  // stays text-only; these are separate authority kinds).
  SUIT_SHIRT_CLASSIC_FORMAL: "TEXT_ONLY",
  SUIT_SHIRT_SPREAD_COLLAR: "TEXT_ONLY",
  SUIT_SHIRT_TUXEDO_PLEATED: "TEXT_ONLY",

  // Footwear — text-only, footwear renders in the final outfit per product
  // policy but never gets its own image authority in Suit v1.
  SUIT_SHOE_OXFORD: "TEXT_ONLY",
  SUIT_SHOE_DERBY: "TEXT_ONLY",
  SUIT_SHOE_LOAFER: "TEXT_ONLY",
  SUIT_SHOE_PATENT_OXFORD: "TEXT_ONLY",

  // Accessories — text-only (Tie/Bow Tie/Pocket Square render; Cufflinks/
  // Buttons are secondary styling instructions). No accessory ever gets an
  // image authority in Suit v1.
  SUIT_ACC_TIE: "TEXT_ONLY",
  SUIT_ACC_BOW_TIE: "TEXT_ONLY",
  SUIT_ACC_POCKET_SQUARE: "TEXT_ONLY",
  SUIT_ACC_CUFFLINKS: "TEXT_ONLY",
  SUIT_ACC_BUTTONS: "TEXT_ONLY",
};

/**
 * Resolves the reference policy for a component. `"SUIT_WAISTCOAT_NONE"` is
 * never looked up in the table — it is handled structurally here so it can
 * never accidentally require or resolve a reference, matching the same
 * convention already established for authority/material generation.
 */
export function getSplitReferencePolicy(componentId: string): SplitReferencePolicy {
  if (componentId === "SUIT_WAISTCOAT_NONE") return "TEXT_ONLY";
  return SUIT_REFERENCE_POLICY[componentId] ?? "TEXT_ONLY";
}

/** Every componentId in the Suit family whose policy is REQUIRED. Used by readiness/registry tooling. */
export function getRequiredSuitComponentIds(): string[] {
  return Object.entries(SUIT_REFERENCE_POLICY)
    .filter(([, policy]) => policy === "REQUIRED")
    .map(([componentId]) => componentId);
}
