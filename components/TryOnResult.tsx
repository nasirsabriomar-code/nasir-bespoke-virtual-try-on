"use client";

import { useState } from "react";

type TryOnResultProps = {
  resultUrl: string;
  originalUrl: string;
  summary: {
    garment: string;
    lower?: string;
    fabric: string;
    turban: string;
    shoes: string;
  };
  onRegenerate: () => void;
  onReset: () => void;
  isGenerating: boolean;
};

export function TryOnResult({
  resultUrl,
  originalUrl,
  summary,
  onRegenerate,
  onReset,
  isGenerating,
}: TryOnResultProps) {
  const [view, setView] = useState<"original" | "result">("result");
  const [filename] = useState(
    () => `nasir-bespoke-try-on-${new Date().toISOString().replace(/[:.]/g, "-")}.jpg`,
  );

  return (
    <div>
      <div className="result-heading">
        <div>
          <p className="result-eyebrow">The result</p>
          <h2>Your Try-On</h2>
        </div>
        <div className="comparison-toggle" role="group" aria-label="Compare original and try-on">
          <button
            type="button"
            className={view === "original" ? "is-active" : ""}
            aria-pressed={view === "original"}
            onClick={() => setView("original")}
          >
            Original
          </button>
          <button
            type="button"
            className={view === "result" ? "is-active" : ""}
            aria-pressed={view === "result"}
            onClick={() => setView("result")}
          >
            Try-On
          </button>
        </div>
      </div>

      <div className="result-frame">
        {/* Blob URLs are transient user images and intentionally bypass framework optimization. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={view === "result" ? resultUrl : originalUrl}
          alt={view === "result" ? "Generated virtual try-on" : "Original person photo"}
        />
      </div>

      <dl className="result-summary" aria-label="Generated look summary">
        <div><dt>Garment</dt><dd>{summary.garment}</dd></div>
        {summary.lower ? <div><dt>Lower</dt><dd>{summary.lower}</dd></div> : null}
        <div><dt>Fabric</dt><dd>{summary.fabric}</dd></div>
        <div><dt>Turban</dt><dd>{summary.turban}</dd></div>
        <div><dt>Shoes</dt><dd>{summary.shoes}</dd></div>
      </dl>

      <div className="result-actions">
        <a href={resultUrl} download={filename}>Download</a>
        <button type="button" onClick={onRegenerate} disabled={isGenerating}>
          {isGenerating ? "Creating…" : "Try Again"}
        </button>
        <button
          type="button"
          className="start-over-button"
          onClick={onReset}
          disabled={isGenerating}
        >
          Start Over
        </button>
      </div>
      <p className="result-disclaimer">AI visualization. Actual garment fit may vary.</p>
    </div>
  );
}
