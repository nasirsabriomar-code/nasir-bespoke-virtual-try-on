export type VisualTryOnMode = "full" | "split";

export type SplitOutfitFamily =
  | "suit"
  | "sherwani"
  | "bandhgala"
  | "nehru-jacket"
  | "kurta-set"
  | "indo-western"
  | "achkan";

export type SplitComponentCategory =
  | "upper"
  | "lower"
  | "inner-shirt"
  | "inner-waistcoat"
  | "footwear"
  | "accessory";

export type CompatibilityStatus =
  | "REQUIRED"
  | "ALLOWED"
  | "RECOMMENDED"
  | "OPTIONAL"
  | "DISALLOWED"
  | "CONDITIONAL";

// Whether a waistcoat may/must appear at all for the currently selected
// upper garment. Distinct from CompatibilityStatus, which is per-option.
export type WaistcoatRequirement = "REQUIRED" | "OPTIONAL" | "UNAVAILABLE" | "CONDITIONAL";

// Deterministic recipe status. Computed entirely by the rule engine in
// lib/split-outfit/compatibility.ts — never inferred by the AI model.
export type RecipeStatus = "INCOMPLETE" | "VALID" | "CONFLICT";

export type MaterialSlotId =
  | "jacket-primary"
  | "trouser-primary"
  | "shirt-material"
  | "waistcoat-material"
  | "neckwear-material"
  | "pocket-square-material"
  | "cufflinks-finish"
  | "buttons-finish"
  | "footwear-leather";

export type MaterialRequirement = {
  slotId: MaterialSlotId;
  label: string;
  defaultFabricSource: "uploaded-fabric" | "atelier-standard" | "custom";
  description: string;
};

export type SplitComponentOption = {
  id: string;
  categoryId: SplitComponentCategory;
  family: SplitOutfitFamily;
  name: string;
  subtitle?: string;
  description: string;
  details?: string[];
  imagePlaceholderLabel: string;
  imageAssetPath?: string;
  constructionReferencePath?: string;
  materialRequirements?: MaterialRequirement[];
  compatibilityTags?: string[];
  defaultStatus?: CompatibilityStatus;
};

export type MaterialSlotState = {
  slotId: MaterialSlotId;
  label: string;
  componentName: string;
  fabricSource: "uploaded-fabric" | "atelier-standard" | "custom";
  description: string;
};

export type SplitOutfitState = {
  family: SplitOutfitFamily;
  upperId: string | null;
  lowerId: string | null;
  shirtId: string | null;
  waistcoatId: string | null;
  footwearId: string | null;
  accessoryIds: string[];
  materials: Record<string, string>;
  /**
   * Canonical material-group ID (see getCanonicalMaterialGroups in
   * compatibility.ts) -> the File the customer uploaded for that group.
   * Client-local only — never a server path or Blob reference. Optional so
   * existing state literals that predate material uploads remain valid.
   * Pruned by sanitizeSplitOutfitState whenever the upper design changes and
   * a previously-uploaded group's ID no longer applies.
   */
  materialUploads?: Record<string, File>;
};

export type SplitOutfitSummary = {
  family: SplitOutfitFamily;
  upper: SplitComponentOption | null;
  lower: SplitComponentOption | null;
  shirt: SplitComponentOption | null;
  waistcoat: SplitComponentOption | null;
  footwear: SplitComponentOption | null;
  accessories: SplitComponentOption[];
  activeMaterialSlots: MaterialSlotState[];
  isComplete: boolean;
  // Deterministic rule-engine outputs (see lib/split-outfit/compatibility.ts).
  recipeStatus: RecipeStatus;
  missingComponents: string[];
  waistcoatRequirement: WaistcoatRequirement;
  materialLinkGroups: MaterialSlotId[][];
  materialGroups: CanonicalMaterialGroup[];
};

/**
 * A "canonical material group" is the unit of material UPLOAD: one or more
 * active "uploaded-fabric"-sourced slots (see MaterialRequirement above)
 * that share exactly one uploaded swatch. Derived deterministically by
 * getCanonicalMaterialGroups() in compatibility.ts — the client and server
 * always compute the identical set from the identical state.
 */
export type CanonicalMaterialGroup = {
  /** Deterministic, sorted, '+'-joined slot IDs — e.g. "jacket-primary+trouser-primary". */
  groupId: string;
  slotIds: MaterialSlotId[];
  label: string;
};

/**
 * The construction-reference policy for a given component. This is the
 * explicit semantics layer the Phase 2a foundation deliberately lacked —
 * "an asset exists or doesn't" is never enough to decide behavior on its
 * own. See lib/split-outfit/reference-policy.ts for the Suit v1 table.
 *
 * REQUIRED:  an active, checksum-verified image authority MUST resolve for
 *            this component before a generation is provider-ready. Missing/
 *            unresolved/corrupt → fail closed, never silently downgrade to
 *            text-only.
 * OPTIONAL:  an image authority is used when available; text-only
 *            construction instruction is an acceptable fallback. (Reserved
 *            for future families/components — Suit v1 uses only REQUIRED
 *            and TEXT_ONLY.)
 * TEXT_ONLY: no image authority is ever attempted for this component,
 *            regardless of whether a reference asset might exist.
 */
export type SplitReferencePolicy = "REQUIRED" | "OPTIONAL" | "TEXT_ONLY";
