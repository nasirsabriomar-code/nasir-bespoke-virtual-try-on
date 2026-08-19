import { SPLIT_CATALOGUE_BY_FAMILY } from "./catalogue";
import type {
  CanonicalMaterialGroup,
  CompatibilityStatus,
  MaterialSlotId,
  MaterialSlotState,
  RecipeStatus,
  SplitComponentCategory,
  SplitComponentOption,
  SplitOutfitFamily,
  SplitOutfitState,
  SplitOutfitSummary,
  WaistcoatRequirement,
} from "./types";

/**
 * Resolves a component option by its ID within a given family.
 */
export function findSplitOption(
  family: SplitOutfitFamily,
  optionId: string | null | undefined,
): SplitComponentOption | null {
  if (!optionId) return null;
  const catalogue = SPLIT_CATALOGUE_BY_FAMILY[family];
  if (!catalogue) return null;

  const all = [
    ...catalogue.uppers,
    ...catalogue.lowers,
    ...catalogue.shirts,
    ...catalogue.waistcoats,
    ...catalogue.footwear,
    ...catalogue.accessories,
  ];

  return all.find((item) => item.id === optionId) ?? null;
}

/**
 * Evaluates the compatibility status of an option given the current active split outfit state.
 * Returns: "REQUIRED" | "RECOMMENDED" | "ALLOWED" | "OPTIONAL" | "DISALLOWED" | "CONDITIONAL"
 *
 * This is a thin lookup over SUIT_COMPATIBILITY_RULES[upperId].statusOverrides — the
 * SAME data table that drives hard visibility/validity (getVisible*Options,
 * sanitizeSplitOutfitState, getSplitOutfitRecipeStatus). There is deliberately no
 * second, independently-authored set of per-upper conditionals here: badge/
 * recommendation display and hard compatibility now share one authority.
 */
export function evaluateOptionCompatibility(
  option: SplitComponentOption,
  state: SplitOutfitState,
): CompatibilityStatus {
  const rule = getSuitCompatibilityRule(state.upperId);
  const override = rule?.statusOverrides?.[option.categoryId]?.[option.id];
  return override ?? option.defaultStatus ?? "ALLOWED";
}

/**
 * Derives the active material slots dynamically based on the customer's selected components.
 */
export function deriveActiveMaterialSlots(state: SplitOutfitState): MaterialSlotState[] {
  const slots: MaterialSlotState[] = [];
  const family = state.family;

  // 1. Upper Garment Slot (always active if upper selected)
  const upper = findSplitOption(family, state.upperId);
  if (upper) {
    slots.push({
      slotId: "jacket-primary",
      label: "Jacket Body & Facing",
      componentName: upper.name,
      fabricSource: "uploaded-fabric",
      description: "Primary tailored suit wool / blend assigned from your uploaded fabric reference.",
    });
  }

  // 2. Lower Garment Slot (always active if lower selected)
  const lower = findSplitOption(family, state.lowerId);
  if (lower) {
    slots.push({
      slotId: "trouser-primary",
      label: "Trouser Fabric",
      componentName: lower.name,
      fabricSource: "uploaded-fabric",
      description: "Matching or coordinated trousers tailored from your uploaded fabric.",
    });
  }

  // 3. Shirt Slot (active if shirt selected) — an INDEPENDENT customer
  // upload, deliberately never linked into materialLinkGroups with the
  // jacket/trouser/waistcoat suit fabric (see SUIT_COMPATIBILITY_RULES).
  const shirt = findSplitOption(family, state.shirtId);
  if (shirt) {
    slots.push({
      slotId: "shirt-material",
      label: "Shirt Fabric",
      componentName: shirt.name,
      fabricSource: "uploaded-fabric",
      description: "Dress shirt fabric from your independently uploaded shirt swatch.",
    });
  }

  // 4. Waistcoat Slot (active ONLY if a waistcoat is selected and not 'None').
  // fabricSource is "uploaded-fabric" only when this upper's materialLinkGroups
  // actually links waistcoat-material into the suit-fabric group (Three-Piece
  // today) — otherwise (e.g. Tuxedo, where the waistcoat is evening satin
  // matched by its own construction reference, not a customer swatch) it
  // stays atelier-standard so it never becomes a third, unlinked upload
  // group. This keeps Suit v1's canonical upload groups fixed at exactly
  // two (suit fabric, shirt fabric) for every upper.
  const waistcoat = findSplitOption(family, state.waistcoatId);
  if (waistcoat && waistcoat.id !== "SUIT_WAISTCOAT_NONE") {
    const rule = getSuitCompatibilityRule(state.upperId);
    const isLinkedToSuitFabric = Boolean(rule?.materialLinkGroups.some((group) => group.includes("waistcoat-material")));
    slots.push({
      slotId: "waistcoat-material",
      label: "Waistcoat Fabric",
      componentName: waistcoat.name,
      fabricSource: isLinkedToSuitFabric ? "uploaded-fabric" : "atelier-standard",
      description: isLinkedToSuitFabric
        ? "Matching or bespoke contrasting waistcoat fabric."
        : "Evening satin or self-fabric facing, matched from the waistcoat's own construction reference.",
    });
  }

  // 5. Neckwear Slot (active if Tie or Bow Tie selected)
  if (state.accessoryIds.includes("SUIT_ACC_TIE")) {
    slots.push({
      slotId: "neckwear-material",
      label: "Necktie Silk",
      componentName: "Silk Necktie",
      fabricSource: "atelier-standard",
      description: "Hand-rolled woven mulberry silk in classic finish.",
    });
  } else if (state.accessoryIds.includes("SUIT_ACC_BOW_TIE")) {
    slots.push({
      slotId: "neckwear-material",
      label: "Bow Tie Silk",
      componentName: "Silk Bow Tie",
      fabricSource: "atelier-standard",
      description: "Black or midnight blue woven silk satin/grosgrain.",
    });
  }

  // 6. Pocket Square Slot (active if selected)
  if (state.accessoryIds.includes("SUIT_ACC_POCKET_SQUARE")) {
    slots.push({
      slotId: "pocket-square-material",
      label: "Pocket Square Fabric",
      componentName: "Pocket Square",
      fabricSource: "atelier-standard",
      description: "Hand-rolled pure Irish linen or printed silk twill.",
    });
  }

  // 7. Cufflinks Slot (active if selected)
  if (state.accessoryIds.includes("SUIT_ACC_CUFFLINKS")) {
    slots.push({
      slotId: "cufflinks-finish",
      label: "Cufflinks Metal Finish",
      componentName: "Bespoke Cufflinks",
      fabricSource: "atelier-standard",
      description: "Polished gold or rhodium-plated sterling silver tone.",
    });
  }

  // 8. Buttons Slot (active if selected)
  if (state.accessoryIds.includes("SUIT_ACC_BUTTONS")) {
    slots.push({
      slotId: "buttons-finish",
      label: "Suit Button Finish",
      componentName: "Custom Buttons",
      fabricSource: "atelier-standard",
      description: "Genuine carved natural horn or mother-of-pearl.",
    });
  }

  // 9. Footwear Slot (active if footwear selected)
  const footwear = findSplitOption(family, state.footwearId);
  if (footwear) {
    slots.push({
      slotId: "footwear-leather",
      label: "Footwear Leather",
      componentName: footwear.name,
      fabricSource: "atelier-standard",
      description: "Full-grain burnished calfskin or patent mirror leather.",
    });
  }

  return slots;
}

// ============================================================
// SUIT COMPATIBILITY RULE ENGINE (deterministic, data-driven)
// ------------------------------------------------------------
// This table is the single source of truth for which Suit-family
// components may be combined. The AI model never decides this —
// the application does, before generation is ever possible. UI
// components MUST query the functions below rather than encoding
// their own `if (design === "tuxedo")` branches.
//
// Filtering here is client-side UX only. When Split Outfit
// generation is eventually connected, the server must re-run this
// same rule table and independently reject any recipe that was
// never valid, regardless of what the client sent.
//
// This is a prototype configuration for the Suit family's first
// five upper designs and is intentionally easy to extend: add an
// entry to SUIT_COMPATIBILITY_RULES for a new upper design (Suit
// or otherwise, once other families are populated) and every
// visibility/status/validation function below picks it up
// automatically — no other file needs to change.
// ============================================================

type SuitCompatibilityRule = {
  upperId: string;
  allowedLowerIds: string[];
  allowedShirtIds: string[];
  waistcoatRequirement: WaistcoatRequirement;
  allowedWaistcoatIds: string[];
  allowedFootwearIds: string[];
  allowedAccessoryIds: string[];
  materialLinkGroups: MaterialSlotId[][];
  // Per-option status overrides (RECOMMENDED/DISALLOWED/OPTIONAL badges) for this
  // upper, keyed by the option's own categoryId then its id. This is the single
  // authority evaluateOptionCompatibility() reads from — no separate hardcoded
  // conditionals may exist elsewhere. An id with no override falls back to the
  // option's own defaultStatus (normally "ALLOWED").
  statusOverrides?: Partial<Record<SplitComponentCategory, Record<string, CompatibilityStatus>>>;
};

const FORMAL_TROUSER_IDS = [
  "SUIT_LOWER_CLASSIC_STRAIGHT",
  "SUIT_LOWER_TAILORED_TAPERED",
  "SUIT_LOWER_PLEATED_FORMAL",
  "SUIT_LOWER_CONTEMPORARY",
];
const STANDARD_SHIRT_IDS = ["SUIT_SHIRT_CLASSIC_FORMAL", "SUIT_SHIRT_SPREAD_COLLAR"];
const STANDARD_ACCESSORY_IDS = [
  "SUIT_ACC_TIE",
  "SUIT_ACC_POCKET_SQUARE",
  "SUIT_ACC_CUFFLINKS",
  "SUIT_ACC_BUTTONS",
];

const SUIT_COMPATIBILITY_RULES: Record<string, SuitCompatibilityRule> = {
  SUIT_UPPER_CLASSIC: {
    upperId: "SUIT_UPPER_CLASSIC",
    allowedLowerIds: FORMAL_TROUSER_IDS,
    allowedShirtIds: STANDARD_SHIRT_IDS,
    waistcoatRequirement: "OPTIONAL",
    allowedWaistcoatIds: ["SUIT_WAISTCOAT_NONE", "SUIT_WAISTCOAT_CLASSIC", "SUIT_WAISTCOAT_FORMAL"],
    allowedFootwearIds: ["SUIT_SHOE_OXFORD", "SUIT_SHOE_DERBY", "SUIT_SHOE_LOAFER"],
    allowedAccessoryIds: STANDARD_ACCESSORY_IDS,
    materialLinkGroups: [["jacket-primary", "trouser-primary"]],
  },
  SUIT_UPPER_DOUBLE_BREASTED: {
    upperId: "SUIT_UPPER_DOUBLE_BREASTED",
    allowedLowerIds: FORMAL_TROUSER_IDS,
    allowedShirtIds: STANDARD_SHIRT_IDS,
    // Prototype rule: waistcoats are not offered under a double-breasted
    // jacket yet. The section is hidden entirely (see getVisibleWaistcoatOptions)
    // and any stored selection is forced back to "None" by sanitizeSplitOutfitState.
    waistcoatRequirement: "UNAVAILABLE",
    allowedWaistcoatIds: ["SUIT_WAISTCOAT_NONE"],
    allowedFootwearIds: ["SUIT_SHOE_OXFORD", "SUIT_SHOE_DERBY"],
    allowedAccessoryIds: STANDARD_ACCESSORY_IDS,
    materialLinkGroups: [["jacket-primary", "trouser-primary"]],
    // Non-None waistcoats are unreachable through the UI (the section is
    // hidden entirely), but evaluateOptionCompatibility must still answer
    // honestly if ever queried directly against a non-visible option.
    statusOverrides: {
      "inner-waistcoat": {
        SUIT_WAISTCOAT_CLASSIC: "OPTIONAL",
        SUIT_WAISTCOAT_FORMAL: "OPTIONAL",
        SUIT_WAISTCOAT_TUXEDO: "OPTIONAL",
      },
    },
  },
  SUIT_UPPER_TUXEDO: {
    upperId: "SUIT_UPPER_TUXEDO",
    allowedLowerIds: ["SUIT_LOWER_TUXEDO_TROUSER"],
    allowedShirtIds: ["SUIT_SHIRT_TUXEDO_PLEATED"],
    // Only offered because an approved tuxedo waistcoat exists in the
    // catalogue today; if it is ever removed this should drop to UNAVAILABLE.
    waistcoatRequirement: "CONDITIONAL",
    allowedWaistcoatIds: ["SUIT_WAISTCOAT_NONE", "SUIT_WAISTCOAT_TUXEDO"],
    allowedFootwearIds: ["SUIT_SHOE_PATENT_OXFORD", "SUIT_SHOE_OXFORD"],
    // Standard neckties are deliberately excluded — black-tie shows a bow
    // tie only unless a future configuration explicitly opts back in.
    allowedAccessoryIds: ["SUIT_ACC_BOW_TIE", "SUIT_ACC_POCKET_SQUARE", "SUIT_ACC_CUFFLINKS", "SUIT_ACC_BUTTONS"],
    materialLinkGroups: [["jacket-primary", "trouser-primary"], ["neckwear-material"]],
    statusOverrides: {
      lower: { SUIT_LOWER_TUXEDO_TROUSER: "RECOMMENDED" },
      "inner-shirt": { SUIT_SHIRT_TUXEDO_PLEATED: "RECOMMENDED" },
      "inner-waistcoat": { SUIT_WAISTCOAT_TUXEDO: "RECOMMENDED" },
      footwear: { SUIT_SHOE_PATENT_OXFORD: "RECOMMENDED" },
      accessory: { SUIT_ACC_BOW_TIE: "RECOMMENDED" },
    },
  },
  SUIT_UPPER_THREE_PIECE: {
    upperId: "SUIT_UPPER_THREE_PIECE",
    allowedLowerIds: FORMAL_TROUSER_IDS,
    allowedShirtIds: STANDARD_SHIRT_IDS,
    waistcoatRequirement: "REQUIRED",
    allowedWaistcoatIds: ["SUIT_WAISTCOAT_CLASSIC", "SUIT_WAISTCOAT_FORMAL"],
    allowedFootwearIds: ["SUIT_SHOE_OXFORD", "SUIT_SHOE_DERBY"],
    allowedAccessoryIds: STANDARD_ACCESSORY_IDS,
    materialLinkGroups: [["jacket-primary", "trouser-primary", "waistcoat-material"]],
    // "None" is already excluded from allowedWaistcoatIds (so it never
    // appears in the visible list), but is explicitly marked DISALLOWED here
    // so a direct query against the raw option still answers honestly.
    statusOverrides: {
      "inner-waistcoat": {
        SUIT_WAISTCOAT_NONE: "DISALLOWED",
        SUIT_WAISTCOAT_CLASSIC: "RECOMMENDED",
        SUIT_WAISTCOAT_FORMAL: "RECOMMENDED",
      },
    },
  },
  SUIT_UPPER_STATEMENT: {
    upperId: "SUIT_UPPER_STATEMENT",
    allowedLowerIds: ["SUIT_LOWER_CLASSIC_STRAIGHT", "SUIT_LOWER_TAILORED_TAPERED", "SUIT_LOWER_CONTEMPORARY"],
    allowedShirtIds: STANDARD_SHIRT_IDS,
    waistcoatRequirement: "CONDITIONAL",
    allowedWaistcoatIds: ["SUIT_WAISTCOAT_NONE", "SUIT_WAISTCOAT_CLASSIC", "SUIT_WAISTCOAT_FORMAL"],
    allowedFootwearIds: ["SUIT_SHOE_OXFORD", "SUIT_SHOE_DERBY", "SUIT_SHOE_PATENT_OXFORD"],
    allowedAccessoryIds: STANDARD_ACCESSORY_IDS,
    materialLinkGroups: [["jacket-primary", "trouser-primary"]],
  },
};

function getSuitCompatibilityRule(upperId: string | null | undefined): SuitCompatibilityRule | null {
  if (!upperId) return null;
  return SUIT_COMPATIBILITY_RULES[upperId] ?? null;
}

function filterAllowed(options: SplitComponentOption[], allowedIds: string[]): SplitComponentOption[] {
  return options.filter((option) => allowedIds.includes(option.id));
}

/** 1. What lower garments are valid for the current upper design? */
export function getVisibleLowerOptions(state: SplitOutfitState): SplitComponentOption[] {
  const catalogue = SPLIT_CATALOGUE_BY_FAMILY[state.family];
  const rule = getSuitCompatibilityRule(state.upperId);
  if (!catalogue) return [];
  if (!rule) return catalogue.lowers;
  return filterAllowed(catalogue.lowers, rule.allowedLowerIds);
}

/** 2. What shirts are valid for the current upper design? */
export function getVisibleShirtOptions(state: SplitOutfitState): SplitComponentOption[] {
  const catalogue = SPLIT_CATALOGUE_BY_FAMILY[state.family];
  const rule = getSuitCompatibilityRule(state.upperId);
  if (!catalogue) return [];
  if (!rule) return catalogue.shirts;
  return filterAllowed(catalogue.shirts, rule.allowedShirtIds);
}

/** 3. Is a waistcoat required, optional, unavailable, or conditional? */
export function getWaistcoatRequirement(state: SplitOutfitState): WaistcoatRequirement {
  return getSuitCompatibilityRule(state.upperId)?.waistcoatRequirement ?? "OPTIONAL";
}

/** Waistcoat options valid for the current upper design (empty when UNAVAILABLE). */
export function getVisibleWaistcoatOptions(state: SplitOutfitState): SplitComponentOption[] {
  const catalogue = SPLIT_CATALOGUE_BY_FAMILY[state.family];
  const rule = getSuitCompatibilityRule(state.upperId);
  if (!catalogue) return [];
  if (!rule) return catalogue.waistcoats;
  if (rule.waistcoatRequirement === "UNAVAILABLE") return [];
  return filterAllowed(catalogue.waistcoats, rule.allowedWaistcoatIds);
}

/** 4. What footwear is valid for the current upper design? */
export function getVisibleFootwearOptions(state: SplitOutfitState): SplitComponentOption[] {
  const catalogue = SPLIT_CATALOGUE_BY_FAMILY[state.family];
  const rule = getSuitCompatibilityRule(state.upperId);
  if (!catalogue) return [];
  if (!rule) return catalogue.footwear;
  return filterAllowed(catalogue.footwear, rule.allowedFootwearIds);
}

/** 5. What accessories are valid for the current upper design? */
export function getVisibleAccessoryOptions(state: SplitOutfitState): SplitComponentOption[] {
  const catalogue = SPLIT_CATALOGUE_BY_FAMILY[state.family];
  const rule = getSuitCompatibilityRule(state.upperId);
  if (!catalogue) return [];
  if (!rule) return catalogue.accessories;
  return filterAllowed(catalogue.accessories, rule.allowedAccessoryIds);
}

/**
 * 6. Which material slots (and default linking groups, e.g. "Jacket + Trouser")
 * should exist for the current upper design? Architecture only — this does not
 * drive any actual multi-fabric image generation yet.
 */
export function getMaterialLinkGroups(state: SplitOutfitState): MaterialSlotId[][] {
  return getSuitCompatibilityRule(state.upperId)?.materialLinkGroups ?? [];
}

/**
 * Clears any currently stored selection that is no longer valid under the
 * current upper design's rules. Must be called on every Split Outfit state
 * change (see SplitOutfitWorkspace's updateState wrapper) so a hidden,
 * invalid selection never lingers silently when the upper design changes.
 */
export function sanitizeSplitOutfitState(state: SplitOutfitState): SplitOutfitState {
  const rule = getSuitCompatibilityRule(state.upperId);
  if (!rule) return state;

  const lowerId = state.lowerId && rule.allowedLowerIds.includes(state.lowerId) ? state.lowerId : null;
  const shirtId = state.shirtId && rule.allowedShirtIds.includes(state.shirtId) ? state.shirtId : null;
  const footwearId = state.footwearId && rule.allowedFootwearIds.includes(state.footwearId) ? state.footwearId : null;
  const accessoryIds = state.accessoryIds.filter((id) => rule.allowedAccessoryIds.includes(id));

  let waistcoatId: string | null;
  if (rule.waistcoatRequirement === "UNAVAILABLE") {
    // Only one valid value when unavailable: the explicit "no waistcoat" record.
    waistcoatId = "SUIT_WAISTCOAT_NONE";
  } else if (state.waistcoatId && rule.allowedWaistcoatIds.includes(state.waistcoatId)) {
    waistcoatId = state.waistcoatId;
  } else if (rule.waistcoatRequirement === "REQUIRED") {
    // Do not silently pick one on the customer's behalf — leave it unselected
    // so the recipe status correctly reports INCOMPLETE until staff chooses.
    waistcoatId = null;
  } else {
    waistcoatId = "SUIT_WAISTCOAT_NONE";
  }

  const sanitized: SplitOutfitState = { ...state, lowerId, shirtId, waistcoatId, footwearId, accessoryIds };

  // Prune any previously-uploaded material swatch whose canonical group ID
  // no longer applies under the (possibly new) upper design — e.g. a
  // jacket+trouser swatch uploaded for Classic stays valid after switching
  // to Double-Breasted (same group ID), but is dropped if the customer
  // instead switches families or a future rule change reshapes the group.
  if (sanitized.materialUploads && Object.keys(sanitized.materialUploads).length > 0) {
    const validGroupIds = new Set(getCanonicalMaterialGroups(sanitized).map((group) => group.groupId));
    const materialUploads = Object.fromEntries(
      Object.entries(sanitized.materialUploads).filter(([groupId]) => validGroupIds.has(groupId)),
    );
    return { ...sanitized, materialUploads };
  }

  return sanitized;
}

/** Machine-readable keys for required categories still missing a valid selection. */
export function getMissingRequiredComponents(state: SplitOutfitState): string[] {
  const rule = getSuitCompatibilityRule(state.upperId);
  if (!rule) return [];

  const missing: string[] = [];
  if (!state.lowerId || !rule.allowedLowerIds.includes(state.lowerId)) missing.push("lower");
  if (!state.shirtId || !rule.allowedShirtIds.includes(state.shirtId)) missing.push("shirt");
  if (!state.footwearId || !rule.allowedFootwearIds.includes(state.footwearId)) missing.push("footwear");
  if (
    rule.waistcoatRequirement === "REQUIRED" &&
    (!state.waistcoatId ||
      state.waistcoatId === "SUIT_WAISTCOAT_NONE" ||
      !rule.allowedWaistcoatIds.includes(state.waistcoatId))
  ) {
    missing.push("waistcoat");
  }
  return missing;
}

/**
 * 7. Is the current outfit recipe complete and valid?
 * CONFLICT: a stored selection is not valid for the current upper design
 *   (should only be reachable if state was set without going through
 *   sanitizeSplitOutfitState — kept as a defensive, honestly-reported state
 *   rather than silently coercing it).
 * INCOMPLETE: no conflicts, but a required category has no selection yet.
 * VALID: every required category has a selection valid for this upper design.
 */
export function getSplitOutfitRecipeStatus(state: SplitOutfitState): RecipeStatus {
  const rule = getSuitCompatibilityRule(state.upperId);
  if (!rule) return "INCOMPLETE";

  const hasConflict =
    (state.lowerId !== null && !rule.allowedLowerIds.includes(state.lowerId)) ||
    (state.shirtId !== null && !rule.allowedShirtIds.includes(state.shirtId)) ||
    (state.waistcoatId !== null && !rule.allowedWaistcoatIds.includes(state.waistcoatId)) ||
    (state.footwearId !== null && !rule.allowedFootwearIds.includes(state.footwearId)) ||
    state.accessoryIds.some((id) => !rule.allowedAccessoryIds.includes(id));
  if (hasConflict) return "CONFLICT";

  if (getMissingRequiredComponents(state).length > 0) return "INCOMPLETE";

  return "VALID";
}

/**
 * Builds the complete Split Outfit summary view for reactive review.
 */
export function buildSplitOutfitSummary(state: SplitOutfitState): SplitOutfitSummary {
  const family = state.family;
  const upper = findSplitOption(family, state.upperId);
  const lower = findSplitOption(family, state.lowerId);
  const shirt = findSplitOption(family, state.shirtId);
  const waistcoat = findSplitOption(family, state.waistcoatId);
  const footwear = findSplitOption(family, state.footwearId);
  const accessories = state.accessoryIds
    .map((id) => findSplitOption(family, id))
    .filter((acc): acc is SplitComponentOption => acc !== null);

  const activeMaterialSlots = deriveActiveMaterialSlots(state);

  // An outfit is considered complete if upper, lower, shirt, and footwear are selected
  const isComplete = Boolean(upper && lower && shirt && footwear);

  return {
    family,
    upper,
    lower,
    shirt,
    waistcoat,
    footwear,
    accessories,
    activeMaterialSlots,
    isComplete,
    recipeStatus: getSplitOutfitRecipeStatus(state),
    missingComponents: getMissingRequiredComponents(state),
    waistcoatRequirement: getWaistcoatRequirement(state),
    materialLinkGroups: getMaterialLinkGroups(state),
    materialGroups: getCanonicalMaterialGroups(state),
  };
}

// ============================================================
// CANONICAL MATERIAL GROUPS (server-owned, deterministic)
// ------------------------------------------------------------
// A "canonical material group" is the unit of material UPLOAD: every active
// slot whose fabricSource is "uploaded-fabric" (a genuine customer swatch
// photo is required), grouped per materialLinkGroups when linked. Slots
// sourced "atelier-standard" (shirt, neckwear, pocket square, cufflinks,
// buttons, footwear leather today — see deriveActiveMaterialSlots) never
// require an upload in Phase 2a and are deliberately excluded from this
// set entirely; they use the atelier default and need no client file.
// The group ID is derived, never client-authored — the server independently
// recomputes it from a validated recipe and rejects any wire input that
// references a group ID it did not itself derive.
// ============================================================

/**
 * Canonicalizes a set of material slot IDs into a stable group ID string.
 * Sorting makes the result independent of input order, so client UX code
 * and server validation always agree on the same ID for the same slot set.
 */
export function canonicalMaterialGroupId(slotIds: MaterialSlotId[]): string {
  return [...new Set(slotIds)].sort().join("+");
}

function labelForGroup(slotIds: MaterialSlotId[], activeSlots: MaterialSlotState[]): string {
  const names = slotIds
    .map((slotId) => activeSlots.find((slot) => slot.slotId === slotId)?.label)
    .filter((label): label is string => Boolean(label));
  return names.length ? names.join(" + ") : slotIds.join(" + ");
}

/**
 * Derives the complete, ordered set of canonical UPLOAD-REQUIRED material
 * groups for the given state: every currently active, "uploaded-fabric"
 * sourced material slot (per deriveActiveMaterialSlots) is placed into its
 * linked group (per getMaterialLinkGroups) if that group has at least one
 * active "uploaded-fabric" member, or into its own singleton group
 * otherwise. Atelier-standard slots never appear here — they need no
 * upload. Deterministic regardless of object/array iteration order —
 * callers (client UX and server validation) always get the same groups,
 * in the same order, for the same state.
 *
 * For every Suit v1 rule today this always yields exactly ONE group
 * (jacket-primary + trouser-primary, plus waistcoat-material for
 * Three-Piece) — see the fixed Suit v1 material policy in
 * SUIT_COMPATIBILITY_RULES. This is what keeps a Split request's worst-case
 * upload count small and predictable under Vercel's 4.5MB request ceiling
 * (see SPLIT_MAX_MATERIAL_GROUPS in lib/split-try-on-handler.ts).
 */
export function getCanonicalMaterialGroups(state: SplitOutfitState): CanonicalMaterialGroup[] {
  const activeSlots = deriveActiveMaterialSlots(state).filter((slot) => slot.fabricSource === "uploaded-fabric");
  const activeSlotIds = activeSlots.map((slot) => slot.slotId);
  const activeSet = new Set(activeSlotIds);
  const linkGroups = getMaterialLinkGroups(state);

  const grouped = new Set<MaterialSlotId>();
  const groups: CanonicalMaterialGroup[] = [];

  for (const group of linkGroups) {
    const activeMembers = group.filter((slotId) => activeSet.has(slotId));
    if (activeMembers.length === 0) continue;
    for (const slotId of activeMembers) grouped.add(slotId);
    const sorted = [...activeMembers].sort();
    groups.push({ groupId: canonicalMaterialGroupId(sorted), slotIds: sorted, label: labelForGroup(sorted, activeSlots) });
  }

  for (const slotId of activeSlotIds) {
    if (grouped.has(slotId)) continue;
    groups.push({ groupId: canonicalMaterialGroupId([slotId]), slotIds: [slotId], label: labelForGroup([slotId], activeSlots) });
  }

  return groups.sort((a, b) => a.groupId.localeCompare(b.groupId));
}
