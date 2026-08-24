"use client";

import type { SplitOutfitSummary } from "@/lib/split-outfit/types";
import type { SignatureLookProvenance } from "@/lib/showroom/types";

type OutfitReviewProps = {
  summary: SplitOutfitSummary;
  provenance: SignatureLookProvenance;
  customizedFromLook: boolean;
  onContinueEditing: () => void;
};

/**
 * Phase 5 — the showroom journey's missing pause point: previously the
 * "workspace" step looped indefinitely with no dedicated summary before
 * saving (the "Save Outfit to Customer History" action lives in the
 * persistent CustomerGate banner above this journey, unchanged, and stays
 * reachable while this step is showing). This is presentation only — it
 * reads the existing SplitOutfitSummary/RecipeStatus outputs and adds no
 * new validation, garment state, or save path of its own.
 */
export function OutfitReview({ summary, provenance, customizedFromLook, onContinueEditing }: OutfitReviewProps) {
  const componentLines = [
    summary.upper ? `Upper: ${summary.upper.name}` : null,
    summary.lower ? `Lower: ${summary.lower.name}` : null,
    summary.shirt ? `Shirt: ${summary.shirt.name}` : null,
    summary.waistcoat && summary.waistcoat.id !== "SUIT_WAISTCOAT_NONE" ? `Waistcoat: ${summary.waistcoat.name}` : null,
    summary.footwear ? `Footwear: ${summary.footwear.name}` : null,
    summary.accessories.length > 0 ? `Accessories: ${summary.accessories.map((accessory) => accessory.name).join(", ")}` : null,
  ].filter((line): line is string => Boolean(line));

  return (
    <section className="showroom-review" aria-label="Review the outfit">
      <div className="level1-step-heading">
        <span aria-hidden="true">✦</span>
        <div>
          <p className="eyebrow">Review</p>
          <h2>Ready to finish?</h2>
        </div>
      </div>

      <p className="split-section-intro">
        {provenance.type === "signature-look"
          ? customizedFromLook
            ? `Customized from ${provenance.lookName}.`
            : `Started from ${provenance.lookName}.`
          : "Built manually."}
      </p>

      {summary.recipeStatus === "CONFLICT" ? (
        <p className="form-error" role="alert">
          One or more selections no longer fit this design — return to the workspace to resolve it before saving.
        </p>
      ) : summary.recipeStatus === "INCOMPLETE" ? (
        <p className="form-error" role="alert">
          {summary.missingComponents.length > 0
            ? `Still needed: ${summary.missingComponents.join(", ")}.`
            : "This outfit isn't complete yet."}
        </p>
      ) : null}

      <div className="order-detail-section">
        <span className="customer-profile-card-label">The Outfit</span>
        <ul className="customer-list">
          {componentLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

      {summary.activeMaterialSlots.length > 0 ? (
        <div className="order-detail-section">
          <span className="customer-profile-card-label">Materials</span>
          <ul className="customer-list">
            {summary.activeMaterialSlots.map((slot) => (
              <li key={slot.slotId}>
                {slot.label}: {slot.componentName}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="split-section-intro">
        Use &quot;Save Outfit to Customer History&quot; above to save this outfit, or continue editing.
      </p>

      <div className="showroom-profile-actions">
        <button type="button" className="showroom-cta-button" onClick={onContinueEditing}>
          Continue Editing
        </button>
      </div>
    </section>
  );
}
