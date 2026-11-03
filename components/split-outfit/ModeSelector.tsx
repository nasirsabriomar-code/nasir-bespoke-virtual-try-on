"use client";

import type { VisualTryOnMode } from "@/lib/split-outfit/types";

type ModeSelectorProps = {
  disabled?: boolean;
  mode: VisualTryOnMode;
  onModeChange: (mode: VisualTryOnMode) => void;
};

export function ModeSelector({ mode, onModeChange, disabled = false }: ModeSelectorProps) {
  return (
    <section className="mode-selector-container" aria-label="Operating Mode Selection">
      <div className="mode-selector-heading">
        <p className="eyebrow">Operating Mode</p>
        <h2>Select creation workflow</h2>
      </div>

      <div
        className="mode-segmented-control"
        role="radiogroup"
        aria-label="Creation Mode: Full Outfit or Split Outfit"
      >
        <button
          type="button"
          disabled={disabled}
          role="radio"
          aria-checked={mode === "full"}
          className={`mode-option-btn ${mode === "full" ? "is-active" : ""}`}
          onClick={() => onModeChange("full")}
        >
          <div className="mode-option-content">
            <span className="mode-option-title">FULL OUTFIT</span>
            <span className="mode-option-desc">Complete curated looks across 8 bespoke categories</span>
          </div>
          {mode === "full" ? <span className="mode-active-pill" aria-hidden="true">Active</span> : null}
        </button>

        <button
          type="button"
          disabled={disabled}
          role="radio"
          aria-checked={mode === "split"}
          className={`mode-option-btn ${mode === "split" ? "is-active" : ""}`}
          onClick={() => onModeChange("split")}
        >
          <div className="mode-option-content">
            <span className="mode-option-title">SPLIT OUTFIT</span>
            <span className="mode-option-desc">Modular tailoring: customize jacket, trousers, inner, and accessories</span>
          </div>
          {mode === "split" ? <span className="mode-active-pill" aria-hidden="true">Active</span> : null}
        </button>
      </div>
    </section>
  );
}
