/**
 * Single, centralized, versioned scoring configuration for the Signature
 * Look recommendation engine. Every weight lives here — no scoring constant
 * is scattered across components or the engine module itself. Total is
 * understandable as 0–100:
 *
 *   occasion match            40
 *   style-personality match   35
 *   formality proximity       20
 *   curated priority tie-break 5 (max)
 *   ---------------------------------
 *   TOTAL                    100
 */
export const RECOMMENDATION_SCORING_VERSION = 1;

export const RECOMMENDATION_WEIGHTS = {
  occasionMatch: 40,
  stylePersonalityMatch: 35,
  formalityProximity: 20,
  curatedPriority: 5,
} as const;

/** Formality is declared on a 1–5 scale, so the maximum possible gap is 4. */
export const MAX_FORMALITY_DISTANCE = 4;

/** Maximum number of recommendations ever surfaced to the showroom UI. */
export const MAX_RECOMMENDATIONS = 3;
