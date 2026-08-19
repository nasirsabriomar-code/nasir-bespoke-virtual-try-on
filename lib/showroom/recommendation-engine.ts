import { getActiveValidatedSignatureLooks } from "./look-validation";
import { MAX_FORMALITY_DISTANCE, MAX_RECOMMENDATIONS, RECOMMENDATION_WEIGHTS } from "./scoring-config";
import type {
  RecommendationProfile,
  ShowroomOccasion,
  SignatureLook,
  SignatureLookRecommendation,
  StylePersonality,
} from "./types";

/**
 * Deterministic Signature Look recommendation engine.
 *
 * recommendSignatureLooks(profile, library) is a PURE function: the same
 * profile against the same library always produces the same ordered
 * result, including tie-break order. There is no randomness, no LLM call,
 * and no inspection of the customer photo or any inferred trait (age, skin
 * tone, ethnicity, body type, facial features) — ranking is based solely on
 * the customer's/staff's declared occasion, style-personality, and
 * formality preferences (see RecommendationProfile in types.ts).
 */

const OCCASION_LABEL: Record<ShowroomOccasion, string> = {
  business: "business occasion",
  wedding: "wedding celebration",
  reception: "reception",
  "black-tie": "black-tie event",
  "formal-evening": "formal evening",
  celebration: "celebration",
};

const STYLE_LABEL: Record<StylePersonality, string> = {
  classic: "classic",
  executive: "executive",
  minimal: "minimal",
  "black-tie": "black-tie",
  "modern-statement": "modern statement",
};

function scoreFormalityProximity(lookFormality: number, profileFormality: number): number {
  const distance = Math.abs(lookFormality - profileFormality);
  const raw = RECOMMENDATION_WEIGHTS.formalityProximity * (1 - distance / MAX_FORMALITY_DISTANCE);
  return Math.max(0, Math.round(raw));
}

/**
 * Stable curated tie-break contribution. Deterministic and independent of
 * the rest of the library — a look with a lower `rankPriority` (curated
 * higher priority) earns a small, capped bonus. Never depends on iteration
 * order or any other look's data.
 */
function scoreCuratedPriority(look: SignatureLook): number {
  return Math.max(0, RECOMMENDATION_WEIGHTS.curatedPriority - (look.rankPriority - 1));
}

function formalityReason(distance: number): string | null {
  if (distance === 0) return "Formality precisely matches your selection.";
  if (distance === 1) return "Formality closely matches your selection.";
  return null;
}

function scoreLook(profile: RecommendationProfile, look: SignatureLook): SignatureLookRecommendation {
  const reasons: string[] = [];
  let score = 0;

  const occasionMatch = look.occasions.includes(profile.occasion);
  if (occasionMatch) {
    score += RECOMMENDATION_WEIGHTS.occasionMatch;
    reasons.push(`Strong match for a ${OCCASION_LABEL[profile.occasion]}.`);
  }

  const styleMatch = look.stylePersonality === profile.stylePersonality;
  if (styleMatch) {
    score += RECOMMENDATION_WEIGHTS.stylePersonalityMatch;
    reasons.push(`Matches your preference for ${STYLE_LABEL[profile.stylePersonality]} tailoring.`);
  }

  const formalityDistance = Math.abs(look.formality - profile.formality);
  score += scoreFormalityProximity(look.formality, profile.formality);
  const formalityText = formalityReason(formalityDistance);
  if (formalityText) reasons.push(formalityText);

  score += scoreCuratedPriority(look);

  return { look, score: Math.round(score), reasons: reasons.slice(0, 3) };
}

/**
 * Ranks the ACTIVE, independently re-validated portion of the given library
 * against a declared recommendation profile. Returns at most
 * MAX_RECOMMENDATIONS (3) results, highest score first, with a fully stable
 * deterministic tie-break (rankPriority, then look id) so repeated calls
 * with identical input always produce an identical order.
 */
export function recommendSignatureLooks(
  profile: RecommendationProfile,
  library: SignatureLook[],
): SignatureLookRecommendation[] {
  const activeLooks = getActiveValidatedSignatureLooks(library);
  const scored = activeLooks.map((look) => scoreLook(profile, look));

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.look.rankPriority !== b.look.rankPriority) return a.look.rankPriority - b.look.rankPriority;
    return a.look.id.localeCompare(b.look.id);
  });

  return scored.slice(0, MAX_RECOMMENDATIONS);
}
