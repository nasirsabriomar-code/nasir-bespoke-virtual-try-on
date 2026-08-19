"use client";

import { findSplitOption } from "@/lib/split-outfit/compatibility";
import type { SignatureLookRecommendation } from "@/lib/showroom/types";

type LookRecommendationListProps = {
  recommendations: SignatureLookRecommendation[];
  error: string | null;
  onSelectLook: (lookId: string) => void;
  onRefineProfile: () => void;
  onBuildManually: () => void;
};

function componentSummary(recommendation: SignatureLookRecommendation): string {
  const { look } = recommendation;
  const upper = findSplitOption(look.family, look.components.upperId);
  const waistcoat =
    look.components.waistcoatId !== "SUIT_WAISTCOAT_NONE"
      ? findSplitOption(look.family, look.components.waistcoatId)
      : null;
  return [upper?.name, waistcoat ? `${waistcoat.name} Waistcoat` : null].filter(Boolean).join(" + ");
}

export function LookRecommendationList({
  recommendations,
  error,
  onSelectLook,
  onRefineProfile,
  onBuildManually,
}: LookRecommendationListProps) {
  return (
    <section className="showroom-recommendations" aria-label="Recommended Signature Looks">
      <div className="level1-step-heading">
        <span aria-hidden="true">✦</span>
        <div>
          <p className="eyebrow">Recommended For You</p>
          <h2>Your curated starting points</h2>
        </div>
      </div>

      {error ? <p className="form-error" role="alert">{error}</p> : null}

      {recommendations.length === 0 ? (
        <p className="split-section-intro">
          No Signature Looks matched — try adjusting your preferences, or build manually.
        </p>
      ) : (
        <div className="showroom-look-cards">
          {recommendations.map((recommendation) => (
            <article key={recommendation.look.id} className="showroom-look-card">
              <div className="showroom-look-card-header">
                <h3>{recommendation.look.name}</h3>
                <span className="showroom-look-score">{recommendation.score}% match</span>
              </div>
              <p className="showroom-look-desc">{recommendation.look.shortDescription}</p>
              <p className="showroom-look-components">{componentSummary(recommendation)}</p>
              {recommendation.reasons.length > 0 ? (
                <ul className="showroom-look-reasons">
                  {recommendation.reasons.map((reason) => (
                    <li key={reason} className="showroom-reason-chip">{reason}</li>
                  ))}
                </ul>
              ) : null}
              <button
                type="button"
                className="showroom-cta-button showroom-look-cta"
                onClick={() => onSelectLook(recommendation.look.id)}
              >
                Start With This Look
              </button>
            </article>
          ))}
        </div>
      )}

      <div className="showroom-profile-actions">
        <button type="button" className="showroom-link-button" onClick={onRefineProfile}>
          Refine preferences
        </button>
        <button type="button" className="showroom-link-button" onClick={onBuildManually}>
          Build manually instead
        </button>
      </div>
    </section>
  );
}
