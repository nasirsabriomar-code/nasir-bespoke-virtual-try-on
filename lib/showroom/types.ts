import type { SplitOutfitFamily } from "@/lib/split-outfit/types";

/**
 * Nasir Bespoke showroom domain model (Phase 3A).
 *
 * A Signature Look is HUMAN-CURATED product data — a starting recipe a
 * customer/staff member may begin from. The recommendation engine only
 * ranks a fixed, curated library; it never invents, generates, or mutates
 * a look. The existing Split compatibility engine
 * (lib/split-outfit/compatibility.ts) remains the SOLE authority for
 * whether any garment combination — curated or manually built — is
 * actually valid. See lib/showroom/look-validation.ts.
 *
 * Deliberately excluded from this type (see AGENTS/task boundaries):
 * Blob paths, private asset paths, prompts, OpenAI/model/provider
 * configuration, reference checksums, customer data. A Look is pure,
 * serializable, curated product data — safe to ship to the browser as-is.
 */

export type SignatureLookStatus = "active" | "draft";

/**
 * Recommended v1 occasion values. Extensible — add a literal here (and to
 * the scoring/reason copy in recommendation-engine.ts) without touching the
 * Look schema, recommendation API contract, or FinalOutfitSnapshot.
 */
export type ShowroomOccasion =
  | "business"
  | "wedding"
  | "reception"
  | "black-tie"
  | "formal-evening"
  | "celebration";

/** Runtime value list for ShowroomOccasion — the closed set lib/customer/validation.ts validates against. */
export const SHOWROOM_OCCASION_VALUES: readonly ShowroomOccasion[] = [
  "business",
  "wedding",
  "reception",
  "black-tie",
  "formal-evening",
  "celebration",
];

/** Recommended v1 style-personality values. */
export type StylePersonality =
  | "classic"
  | "executive"
  | "minimal"
  | "black-tie"
  | "modern-statement";

/** Runtime value list for StylePersonality — the closed set lib/customer/validation.ts validates against. */
export const STYLE_PERSONALITY_VALUES: readonly StylePersonality[] = [
  "classic",
  "executive",
  "minimal",
  "black-tie",
  "modern-statement",
];

/** 1 (most relaxed) through 5 (most formal). */
export type FormalityLevel = 1 | 2 | 3 | 4 | 5;

/**
 * A Signature Look's approved component selection. Mirrors
 * SplitOutfitState's component fields exactly (never a parallel garment
 * model) so applying a look is a direct, lossless assignment into the
 * existing Split state shape. `waistcoatId` is always a real catalogue ID —
 * including the explicit "SUIT_WAISTCOAT_NONE" sentinel — never `null`,
 * matching the existing convention in lib/split-outfit/compatibility.ts.
 */
export type SignatureLookComponents = {
  upperId: string;
  lowerId: string;
  shirtId: string;
  waistcoatId: string;
  footwearId: string;
  accessoryIds: string[];
};

export type SignatureLook = {
  id: string;
  name: string;
  shortDescription: string;
  family: SplitOutfitFamily;
  status: SignatureLookStatus;
  occasions: ShowroomOccasion[];
  stylePersonality: StylePersonality;
  formality: FormalityLevel;
  components: SignatureLookComponents;
  /** Optional staff-authored styling note — never customer data, never a generation instruction. */
  styleNote?: string;
  /**
   * Stable curated priority for deterministic tie-breaking (lower value =
   * shown first when scores tie). Set once per look at authoring time;
   * never recomputed at runtime.
   */
  rankPriority: number;
};

/**
 * The declared-intent-only recommendation input. Deliberately excludes any
 * inferred trait (age, skin tone, ethnicity, body type, facial features) —
 * see recommendSignatureLooks() in recommendation-engine.ts, which never
 * receives or inspects the customer photo.
 */
export type RecommendationProfile = {
  occasion: ShowroomOccasion;
  stylePersonality: StylePersonality;
  formality: FormalityLevel;
  /** Optional explicit garment preference — not required by the engine. */
  preferredUpperId?: string;
};

export type SignatureLookRecommendation = {
  look: SignatureLook;
  /** 0–100, deterministic — see lib/showroom/scoring-config.ts. */
  score: number;
  /** Deterministic, structured reasons derived only from matched profile fields. Never LLM-generated. */
  reasons: string[];
};

/** Which starting point the current Split session is on. */
export type ShowroomJourneyStep = "starting-point" | "profile" | "recommendations" | "workspace";

/** Whether the current Split recipe was built manually or from a curated Look. */
export type SignatureLookProvenance =
  | { type: "manual" }
  | { type: "signature-look"; lookId: string; lookName: string };

/**
 * UI-facing showroom session state. Serializable product-domain data only —
 * no File objects, Blob paths, prompts, or secrets belong here. If a
 * customer material upload (a File) needs to travel alongside this, keep it
 * in separate, explicitly ephemeral React state (see SplitOutfitState.materialUploads),
 * never folded into this object.
 */
export type ShowroomSessionState = {
  journeyStep: ShowroomJourneyStep;
  recommendationProfile: RecommendationProfile | null;
  recommendations: SignatureLookRecommendation[];
  provenance: SignatureLookProvenance;
};

export const DEFAULT_SHOWROOM_SESSION_STATE: ShowroomSessionState = {
  journeyStep: "starting-point",
  recommendationProfile: null,
  recommendations: [],
  provenance: { type: "manual" },
};
