"use client";

import type { ReactNode } from "react";
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

const PIECE_LABEL: Record<keyof SplitPieceFabrics, string> = {
  jacket: "Jacket fabric",
  trousers: "Trouser fabric",
  shirt: "Shirt fabric",
  waistcoat: "Waistcoat fabric",
};

export function SplitPieceFabricSlot({
  piece,
  fabric,
  onSelect,
  onRemove,
  disabled = false,
  extra,
  controls,
}: {
  piece: keyof SplitPieceFabrics;
  fabric: PieceFabric;
  onSelect: (file: File) => void;
  onRemove: () => void;
  disabled?: boolean;
  extra?: ReactNode;
  controls?: ReactNode;
}) {
  return (
    <div className="split-inline-fabric">
      <p className="split-inline-fabric-copy">
        {fabric
          ? "This piece will be cut from the cloth in the photograph — aiming to reproduce its colour, pattern, and texture. Inspect the generated result."
          : EMPTY_HELP[piece]}
      </p>
      {extra}
      <ImageUpload
        id={`split-fabric-${piece}`}
        label={PIECE_LABEL[piece]}
        description="Photograph or upload the cloth for this piece."
        guidance="Lay cloth flat in even light. Avoid folds and glare; include enough area to show the repeat. Use a representative detail and measured repeat dimensions when available."
        file={fabric?.file ?? null}
        previewUrl={fabric?.previewUrl ?? null}
        onSelect={onSelect}
        onRemove={onRemove}
        disabled={disabled}
      />
      {controls}
    </div>
  );
}

export function SplitMaterialsSection({ slots }: SplitMaterialsSectionProps) {
  const remaining = slots.filter((slot) => !SLOT_TO_PIECE[slot.slotId]);
  if (remaining.length === 0) return null;

  return (
    <section className="level1-flow" aria-label="Finishing materials">
      <div className="level1-step-heading">
        <span>06</span>
        <div>
          <p className="eyebrow">Materials & Craft</p>
          <h2>Shoes & finishing</h2>
        </div>
      </div>

      <p className="split-section-intro">
        Shoes keep the cloth in the shoe photograph. Accessories are finishing details only.
      </p>

      <div className="split-materials-grid">
        {remaining.map((slot) => (
          <div key={slot.slotId} className="split-material-card">
            <div className="split-material-header">
              <div className="split-material-title-group">
                <span className="split-material-badge">{slot.componentName}</span>
                <h4 className="split-material-label">{slot.label}</h4>
              </div>
              <span className="split-material-source-tag is-standard">Atelier Material</span>
            </div>
            <p className="split-material-desc">{slot.description}</p>
            <div className="split-material-control-row">
              <span className="split-material-source-indicator">
                <span className="split-material-dot" aria-hidden="true" />
                {slot.slotId === "footwear-leather" ? "Cloth from the reference photograph" : "Text detail"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
