"use client";

import { useState } from "react";
import { ZoomableImage } from "@/components/ZoomableImage";

type TryOnResultProps = {
  resultUrl: string;
  originalUrl: string;
  outputSize?: string;
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
  outputSize,
  summary,
  onRegenerate,
  onReset,
  isGenerating,
}: TryOnResultProps) {
  const [view, setView] = useState<"original" | "result">("result");
  const [filename] = useState(
    () => `nasir-bespoke-try-on-${new Date().toISOString().replace(/[:.]/g, "-")}.png`,
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
        <ZoomableImage
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
        {outputSize ? <div><dt>Master</dt><dd>{outputSize} PNG</dd></div> : null}
      </dl>

      <div className="result-actions">
        <a href={`${resultUrl}${resultUrl.includes("?") ? "&" : "?"}download=1`} download={filename}>Download</a>
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
