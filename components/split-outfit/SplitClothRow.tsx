"use client";
/* eslint-disable @next/next/no-img-element -- linked cloth previews are transient blob URLs. */

import type { ReactNode } from "react";
import { ImageUpload } from "@/components/ImageUpload";
import type { SplitPieceFabrics } from "./SplitMaterialsSection";

type Piece = keyof SplitPieceFabrics;

const PIECE_LABEL: Record<Piece, string> = {
  jacket: "Jacket cloth",
  trousers: "Trouser cloth",
  shirt: "Shirt cloth",
  waistcoat: "Waistcoat cloth",
};

const EMPTY_HELP: Record<Piece, string> = {
  jacket: "No cloth photo yet: the jacket keeps the cloth shown in its reference photo.",
  trousers: "No cloth photo yet: the trousers keep the cloth shown in their reference photo.",
  shirt: "No cloth photo yet: the shirt keeps its reference cloth, including white.",
  waistcoat: "No cloth photo yet: the waistcoat keeps the cloth shown in its reference photo.",
};

const CLOTH_GUIDANCE = "Lay cloth flat in even light. Avoid folds and glare; include enough area to show the repeat.";

type Props = {
  piece: Piece;
  fabric: SplitPieceFabrics[Piece];
  onSelect: (file: File) => void;
  onRemove: () => void;
  disabled?: boolean;
  controls?: ReactNode;
  /** Trousers only. */
  link?: { linked: boolean; available: boolean; jacketPreview: string | null; onToggle: () => void };
};

/** Compact cloth choice for one garment piece, shown inside that piece's builder step. */
export function SplitClothRow({ piece, fabric, onSelect, onRemove, disabled = false, controls, link }: Props) {
  const linked = Boolean(link?.linked);
  return (
    <div className="split-cloth-row" id={`split-piece-${piece}`}>
      <div className="split-cloth-row-head">
        <h3>Cloth</h3>
        <p>{linked ? "Same cloth as the jacket." : fabric ? "Cut from the cloth in this photo. Check the result against the real cloth." : EMPTY_HELP[piece]}</p>
      </div>
      {link && (link.available || linked) ? (
        <button type="button" className="history-button split-cloth-link" onClick={link.onToggle} disabled={disabled} aria-pressed={linked}>
          {linked ? "Unlink from jacket cloth" : "Same as jacket"}
        </button>
      ) : null}
      {linked ? (
        <div className="split-cloth-linked">
          {link?.jacketPreview ? <img src={link.jacketPreview} alt="Jacket cloth used for the trousers" /> : null}
          <span>Controlled by jacket cloth</span>
        </div>
      ) : (
        <ImageUpload
          compact
          id={`split-fabric-${piece}`}
          label={PIECE_LABEL[piece]}
          description="Photograph or upload the cloth for this piece."
          guidance={CLOTH_GUIDANCE}
          file={fabric?.file ?? null}
          previewUrl={fabric?.previewUrl ?? null}
          onSelect={onSelect}
          onRemove={onRemove}
          disabled={disabled}
        />
      )}
      {controls ? (
        <details className="split-cloth-settings">
          <summary>Cloth settings</summary>
          {controls}
        </details>
      ) : null}
    </div>
  );
}
