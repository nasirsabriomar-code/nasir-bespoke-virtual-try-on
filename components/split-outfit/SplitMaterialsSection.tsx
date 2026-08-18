"use client";

import type { MaterialSlotId, MaterialSlotState } from "@/lib/split-outfit/types";

type SplitMaterialsSectionProps = {
  slots: MaterialSlotState[];
  // Default fabric-linking groups for the current upper design (e.g. Jacket +
  // Trouser, or Jacket + Trouser + Waistcoat for Three-Piece). Architecture
  // only for now — does not drive multi-fabric image generation yet.
  linkGroups?: MaterialSlotId[][];
};

// Static fallback labels for a linked slot whose component isn't selected
// yet (so it has no entry in `slots`) — otherwise the raw internal slot ID
// (e.g. "trouser-primary") would leak into the linking copy.
const MATERIAL_SLOT_FALLBACK_LABELS: Record<MaterialSlotId, string> = {
  "jacket-primary": "Jacket Body & Facing",
  "trouser-primary": "Trouser Fabric",
  "shirt-material": "Shirt Weave",
  "waistcoat-material": "Waistcoat Fabric",
  "neckwear-material": "Neckwear Silk",
  "pocket-square-material": "Pocket Square Fabric",
  "cufflinks-finish": "Cufflinks Finish",
  "buttons-finish": "Button Finish",
  "footwear-leather": "Footwear Leather",
};

export function SplitMaterialsSection({ slots, linkGroups = [] }: SplitMaterialsSectionProps) {
  const labelFor = (slotId: MaterialSlotId) =>
    slots.find((slot) => slot.slotId === slotId)?.label ?? MATERIAL_SLOT_FALLBACK_LABELS[slotId] ?? slotId;
  const visibleLinkGroups = linkGroups.filter((group) => group.length > 1);
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

      {visibleLinkGroups.length > 0 ? (
        <ul className="split-material-link-groups" aria-label="Default fabric linking groups">
          {visibleLinkGroups.map((group, i) => (
            <li key={i} className="split-material-link-group">
              Linked by default: {group.map(labelFor).join(" + ")}
            </li>
          ))}
        </ul>
      ) : null}

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
