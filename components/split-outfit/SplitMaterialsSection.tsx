"use client";

import type { MaterialSlotState } from "@/lib/split-outfit/types";

type SplitMaterialsSectionProps = {
  slots: MaterialSlotState[];
};

export function SplitMaterialsSection({ slots }: SplitMaterialsSectionProps) {
  return (
    <section className="level1-flow" aria-label="Fabrics and Materials Configuration">
      <div className="level1-step-heading">
        <span>06</span>
        <div>
          <p className="eyebrow">Materials & Craft</p>
          <h2>Fabrics & materials</h2>
        </div>
      </div>

      <p className="split-section-intro">
        Material assignments dynamically adjust according to your selected suit pieces. In Phase 1, primary suit components map directly to your uploaded fabric reference.
      </p>

      <div className="split-materials-grid">
        {slots.map((slot) => {
          const isUploadedFabric = slot.fabricSource === "uploaded-fabric";

          return (
            <div key={slot.slotId} className="split-material-card">
              <div className="split-material-header">
                <div className="split-material-title-group">
                  <span className="split-material-badge">{slot.componentName}</span>
                  <h4 className="split-material-label">{slot.label}</h4>
                </div>
                <span
                  className={`split-material-source-tag ${
                    isUploadedFabric ? "is-uploaded" : "is-standard"
                  }`}
                >
                  {isUploadedFabric ? "Uploaded Fabric" : "Atelier Material"}
                </span>
              </div>

              <p className="split-material-desc">{slot.description}</p>

              <div className="split-material-control-row">
                <span className="split-material-source-indicator">
                  <span
                    className={`split-material-dot ${isUploadedFabric ? "is-active" : ""}`}
                    aria-hidden="true"
                  />
                  {isUploadedFabric
                    ? "Assigned to uploaded fabric sample"
                    : "Curated atelier complementary material"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
