"use client";

import type { SplitOutfitSummary } from "@/lib/split-outfit/types";

type SplitOutfitReviewProps = {
  summary: SplitOutfitSummary;
};

export function SplitOutfitReview({ summary }: SplitOutfitReviewProps) {
  const { upper, lower, shirt, waistcoat, footwear, accessories, activeMaterialSlots, isComplete } = summary;

  return (
    <section className="level1-review split-outfit-review" aria-label="Review your modular outfit recipe">
      <div className="split-review-content">
        <div className="level1-step-heading">
          <span>07</span>
          <div>
            <p className="eyebrow">Modular Outfit Recipe</p>
            <h2>Your outfit</h2>
          </div>
        </div>

        <div className="split-summary-grid">
          {/* 1. UPPER */}
          <div className="split-summary-card">
            <span className="split-summary-kicker">01 · Upper Garment</span>
            <strong className="split-summary-value">{upper ? upper.customer.name : "Not selected"}</strong>
            <p className="split-summary-detail">{upper ? upper.customer.subtitle : "Choose a jacket style"}</p>
          </div>

          {/* 2. LOWER */}
          <div className="split-summary-card">
            <span className="split-summary-kicker">02 · Lower Garment</span>
            <strong className="split-summary-value">{lower ? lower.customer.name : "Not selected"}</strong>
            <p className="split-summary-detail">{lower ? lower.customer.subtitle : "Choose trouser tailoring"}</p>
          </div>

          {/* 3. INNER */}
          <div className="split-summary-card">
            <span className="split-summary-kicker">03 · Inner & Waistcoat</span>
            <strong className="split-summary-value">
              {shirt ? shirt.customer.name : "No shirt"}
              {waistcoat && waistcoat.id !== "SUIT_WAISTCOAT_NONE"
                ? ` + ${waistcoat.customer.name} Waistcoat`
                : ""}
            </strong>
            <p className="split-summary-detail">
              {shirt ? shirt.customer.subtitle : ""}
              {waistcoat && waistcoat.id !== "SUIT_WAISTCOAT_NONE" ? ` · ${waistcoat.customer.subtitle}` : ""}
            </p>
          </div>

          {/* 4. FOOTWEAR */}
          <div className="split-summary-card">
            <span className="split-summary-kicker">04 · Footwear</span>
            <strong className="split-summary-value">{footwear ? footwear.customer.name : "Not selected"}</strong>
            <p className="split-summary-detail">{footwear ? footwear.customer.subtitle : "Choose shoes"}</p>
          </div>

          {/* 5. ACCESSORIES */}
          <div className="split-summary-card">
            <span className="split-summary-kicker">05 · Accessories ({accessories.length})</span>
            <strong className="split-summary-value">
              {accessories.length > 0
                ? accessories.map((a) => a.customer.name).join(", ")
                : "None selected"}
            </strong>
            <p className="split-summary-detail">
              {accessories.length > 0
                ? `${accessories.length} sartorial accessory item(s)`
                : "Select ties, squares, or jewelry"}
            </p>
          </div>

          {/* 6. MATERIALS */}
          <div className="split-summary-card">
            <span className="split-summary-kicker">06 · Material Assignments</span>
            <strong className="split-summary-value">{activeMaterialSlots.length} Active Slots</strong>
            <p className="split-summary-detail">
              {activeMaterialSlots.filter((s) => s.fabricSource === "uploaded-fabric").length} uploaded fabric / {activeMaterialSlots.filter((s) => s.fabricSource !== "uploaded-fabric").length} atelier materials
            </p>
          </div>
        </div>

        {/* Development State Notice */}
        <div className="split-dev-notice" role="status">
          <span className="split-dev-badge">Phase 1 Foundation</span>
          <p>
            Split Outfit architecture is configured and ready. Generation compiler connection and multi-part visual rendering are scheduled for Phase 2.
          </p>
        </div>

        <button
          className="button button-primary level1-generate split-generate-disabled"
          type="button"
          disabled={true}
          aria-disabled="true"
          title="Split Outfit generation will be enabled in Phase 2"
        >
          {isComplete ? "Generate Split Try-On (Phase 2)" : "Complete Recipe to Continue"}
        </button>
      </div>
    </section>
  );
}
