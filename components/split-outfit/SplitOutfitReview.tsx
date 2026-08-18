"use client";

import type { SplitOutfitSummary } from "@/lib/split-outfit/types";

type SplitOutfitReviewProps = {
  summary: SplitOutfitSummary;
};

const MISSING_COMPONENT_LABEL: Record<string, string> = {
  lower: "Lower Garment (Trousers)",
  shirt: "Dress Shirt",
  footwear: "Footwear",
  waistcoat: "Waistcoat",
};

const STATUS_COPY: Record<
  SplitOutfitSummary["recipeStatus"],
  { badge: string; className: string; generateLabel: string }
> = {
  VALID: {
    badge: "Recipe Valid",
    className: "is-valid",
    generateLabel: "Ready — Generation Arrives in Phase 2",
  },
  INCOMPLETE: {
    badge: "Incomplete",
    className: "is-incomplete",
    generateLabel: "Complete Recipe to Continue",
  },
  CONFLICT: {
    badge: "Conflict",
    className: "is-conflict",
    generateLabel: "Resolve Conflicts to Continue",
  },
};

export function SplitOutfitReview({ summary }: SplitOutfitReviewProps) {
  const {
    upper,
    lower,
    shirt,
    waistcoat,
    footwear,
    accessories,
    activeMaterialSlots,
    recipeStatus,
    missingComponents,
    waistcoatRequirement,
  } = summary;
  const statusCopy = STATUS_COPY[recipeStatus];

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
            <strong className="split-summary-value">{upper ? upper.name : "Not selected"}</strong>
            <p className="split-summary-detail">{upper ? upper.subtitle : "Choose a jacket style"}</p>
          </div>

          {/* 2. LOWER */}
          <div className="split-summary-card">
            <span className="split-summary-kicker">02 · Lower Garment</span>
            <strong className="split-summary-value">{lower ? lower.name : "Not selected"}</strong>
            <p className="split-summary-detail">{lower ? lower.subtitle : "Choose trouser tailoring"}</p>
          </div>

          {/* 3. INNER */}
          <div className="split-summary-card">
            <span className="split-summary-kicker">03 · Inner & Waistcoat</span>
            <strong className="split-summary-value">
              {shirt ? shirt.name : "No shirt"}
              {waistcoat && waistcoat.id !== "SUIT_WAISTCOAT_NONE"
                ? ` + ${waistcoat.name} Waistcoat`
                : ""}
            </strong>
            <p className="split-summary-detail">
              {[
                shirt?.subtitle,
                waistcoat && waistcoat.id !== "SUIT_WAISTCOAT_NONE" ? waistcoat.subtitle : null,
                waistcoatRequirement === "UNAVAILABLE" ? "Waistcoat not offered for this jacket" : null,
                waistcoatRequirement === "REQUIRED" && (!waistcoat || waistcoat.id === "SUIT_WAISTCOAT_NONE")
                  ? "Waistcoat required — please select one"
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>

          {/* 4. FOOTWEAR */}
          <div className="split-summary-card">
            <span className="split-summary-kicker">04 · Footwear</span>
            <strong className="split-summary-value">{footwear ? footwear.name : "Not selected"}</strong>
            <p className="split-summary-detail">{footwear ? footwear.subtitle : "Choose shoes"}</p>
          </div>

          {/* 5. ACCESSORIES */}
          <div className="split-summary-card">
            <span className="split-summary-kicker">05 · Accessories ({accessories.length})</span>
            <strong className="split-summary-value">
              {accessories.length > 0
                ? accessories.map((a) => a.name).join(", ")
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

        {/* Deterministic Recipe Status — computed entirely by the compatibility
            engine (lib/split-outfit/compatibility.ts), never inferred by the AI. */}
        <div className={`split-status-notice ${statusCopy.className}`} role="status">
          <span className="split-status-badge">{statusCopy.badge}</span>
          {recipeStatus === "VALID" ? (
            <p>
              This recipe is complete and every selection is valid for {upper?.name ?? "the selected jacket"}.
              The generation compiler and multi-part rendering are scheduled for Phase 2 — nothing is sent for
              generation yet.
            </p>
          ) : recipeStatus === "INCOMPLETE" ? (
            <p>
              Still needed:{" "}
              {missingComponents.map((key) => MISSING_COMPONENT_LABEL[key] ?? key).join(", ")}.
            </p>
          ) : (
            <p>
              Some selections are no longer valid for {upper?.name ?? "the selected jacket"}. Reselect the
              highlighted sections above.
            </p>
          )}
        </div>

        <button
          className="button button-primary level1-generate split-generate-disabled"
          type="button"
          disabled={true}
          aria-disabled="true"
          title="Split Outfit generation will be enabled in Phase 2"
        >
          {statusCopy.generateLabel}
        </button>
      </div>
    </section>
  );
}
