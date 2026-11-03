"use client";

import { useState } from "react";
import { ResultComparison, type ComparisonReference } from "@/components/ResultComparison";
import { GenerationReview } from "@/components/GenerationReview";
import { ZoomableImage } from "@/components/ZoomableImage";
import type { ResultSummary } from "@/lib/result-summary";

type TryOnResultProps = {
  resultUrl: string;
  originalUrl: string;
  outputSize?: string;
  summary: ResultSummary;
  onRegenerate: () => void;
  onReset: () => void;
  isGenerating: boolean;
  fabricReferences?: ComparisonReference[];
};

export function TryOnResult({
  resultUrl,
  originalUrl,
  outputSize,
  summary,
  onRegenerate,
  onReset,
  isGenerating,
  fabricReferences,
}: TryOnResultProps) {
  const [view, setView] = useState<"original" | "result" | "compare">("result");
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
          <button type="button" aria-pressed={view === "compare"} onClick={() => setView("compare")}>Side by side</button>
        </div>
      </div>

      {view === "compare" ? <ResultComparison originalUrl={originalUrl} resultUrl={resultUrl} fabricReferences={fabricReferences} /> : <div className="result-frame">
        <ZoomableImage
          src={view === "result" ? resultUrl : originalUrl}
          alt={view === "result" ? "Generated virtual try-on" : "Original person photo"}
        />
      </div>}

      <dl className="result-summary" aria-label="Generated look summary">
        <div><dt>Garment</dt><dd>{summary.garment}</dd></div>
        {summary.lower ? <div><dt>Lower</dt><dd>{summary.lower}</dd></div> : null}
        <div><dt>Fabric</dt><dd>{summary.fabric}</dd></div>
        {summary.turban ? <div><dt>Turban</dt><dd>{summary.turban}</dd></div> : null}
        <div><dt>Shoes</dt><dd>{summary.shoes}</dd></div>
        {outputSize ? <div><dt>Master</dt><dd>{outputSize} PNG</dd></div> : null}
      </dl>

      {summary.pieces ? <dl className="result-summary" aria-label="Submitted piece assignments">{summary.pieces.map(piece => <div key={piece.label}><dt>{piece.label}</dt><dd>{piece.design} · {piece.source}</dd></div>)}</dl> : null}
      <div className="result-actions">
        <a href={resultUrl.startsWith("blob:") ? resultUrl : `${resultUrl}${resultUrl.includes("?") ? "&" : "?"}download=1`} download={filename}>Download</a>
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
      {resultUrl.match(/\/api\/history\/([0-9a-f-]{36})\//i)?.[1] ? <GenerationReview key={resultUrl} generationId={resultUrl.match(/\/api\/history\/([0-9a-f-]{36})\//i)![1]} /> : <p>Persistent feedback is available for results saved to History. Download this unsaved image before leaving the page.</p>}
      <p className="result-disclaimer">AI visualization. Actual garment fit may vary.</p>
    </div>
  );
}
