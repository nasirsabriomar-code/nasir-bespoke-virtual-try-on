"use client";

import { ImageUpload } from "@/components/ImageUpload";
import type { MaterialSlotState } from "@/lib/split-outfit/types";

type PieceFabric = {
  file: File;
  previewUrl: string;
} | null;

export type SplitPieceFabrics = {
  jacket: PieceFabric;
  trousers: PieceFabric;
  shirt: PieceFabric;
  waistcoat: PieceFabric;
};

type SplitMaterialsSectionProps = {
  slots: MaterialSlotState[];
  fabrics: SplitPieceFabrics;
  onFabricSelect: (piece: keyof SplitPieceFabrics, file: File) => void;
  onFabricRemove: (piece: keyof SplitPieceFabrics) => void;
  onReuseJacketOnTrousers?: () => void;
  disabled?: boolean;
};

const SLOT_TO_PIECE: Partial<Record<string, keyof SplitPieceFabrics>> = {
  "jacket-primary": "jacket",
  "trouser-primary": "trousers",
  "shirt-material": "shirt",
  "waistcoat-material": "waistcoat",
};

const EMPTY_HELP = {
  jacket: "Using the look in the jacket construction photo until you add a cloth.",
  trousers: "Using the look in the trouser construction photo until you add a cloth.",
  shirt: "Defaults to the shirt in the reference, including white, until you add a cloth.",
  waistcoat: "Using the look in the waistcoat construction photo until you add a cloth.",
} as const;

export function SplitMaterialsSection({
  slots,
  fabrics,
  onFabricSelect,
  onFabricRemove,
  onReuseJacketOnTrousers,
  disabled = false,
}: SplitMaterialsSectionProps) {
  const showReuse = Boolean(fabrics.jacket && onReuseJacketOnTrousers);

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
        Optionally photograph a cloth for the jacket, trousers, shirt, or waistcoat. If you skip a piece, that piece keeps the colour and texture from its construction photo. Shoes always use the shoe photograph.
      </p>

      {showReuse ? (
        <button type="button" className="history-button" onClick={onReuseJacketOnTrousers} disabled={disabled}>
          Use jacket fabric on trousers
        </button>
      ) : null}

      <div className="split-materials-grid">
        {slots.map((slot) => {
          const piece = SLOT_TO_PIECE[slot.slotId];
          const assigned = piece ? fabrics[piece] : null;
          const canUpload = Boolean(piece);

          return (
            <div key={slot.slotId} className="split-material-card">
              <div className="split-material-header">
                <div className="split-material-title-group">
                  <span className="split-material-badge">{slot.componentName}</span>
                  <h4 className="split-material-label">{slot.label}</h4>
                </div>
                <span className={`split-material-source-tag ${assigned || !canUpload ? (assigned ? "is-uploaded" : "is-standard") : "is-standard"}`}>
                  {canUpload ? (assigned ? "Uploaded Fabric" : "Construction photo") : slot.fabricSource === "uploaded-fabric" ? "Uploaded Fabric" : "Atelier Material"}
                </span>
              </div>

              <p className="split-material-desc">
                {canUpload && piece ? (assigned ? "This piece will be cut from the cloth in the photograph — exact colour, shade, and texture." : EMPTY_HELP[piece]) : slot.description}
              </p>

              {canUpload && piece ? (
                <ImageUpload
                  id={`split-fabric-${piece}`}
                  label={`${slot.componentName} fabric`}
                  description="Photograph or upload the cloth for this piece."
                  guidance="Capture the colour, pattern, texture, and finish clearly. Click the image to replace it."
                  file={assigned?.file ?? null}
                  previewUrl={assigned?.previewUrl ?? null}
                  onSelect={(file) => onFabricSelect(piece, file)}
                  onRemove={() => onFabricRemove(piece)}
                  disabled={disabled}
                />
              ) : (
                <div className="split-material-control-row">
                  <span className="split-material-source-indicator">
                    <span className="split-material-dot" aria-hidden="true" />
                    {slot.slotId === "footwear-leather" ? "Cloth from the reference photograph" : "Text detail"}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
