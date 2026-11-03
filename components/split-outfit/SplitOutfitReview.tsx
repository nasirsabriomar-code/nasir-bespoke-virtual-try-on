"use client";
/* eslint-disable @next/next/no-img-element -- local cloth previews are transient blob URLs. */
import { BUILDER_STEPS, type BuilderStepId } from "@/lib/split-outfit/builder-steps";
import type { SplitOutfitSummaryView } from "@/lib/split-outfit/types";
import type { SplitPieceFabrics } from "./SplitMaterialsSection";

type Props = {
  summary: SplitOutfitSummaryView;
  fabrics: SplitPieceFabrics;
  trousersLinked: boolean;
  onGenerate: () => void;
  isGenerating: boolean;
  missing: BuilderStepId[];
  onEdit: (step: BuilderStepId) => void;
};
const stepLabel = (id: BuilderStepId) => BUILDER_STEPS.find((step) => step.id === id)?.label ?? id;
export function SplitOutfitReview({ summary, fabrics, trousersLinked, onGenerate, isGenerating, missing, onEdit }: Props) {
  const rows: { key: string; step: BuilderStepId; label: string; option: SplitOutfitSummaryView["upper"]; cloth: SplitPieceFabrics[keyof SplitPieceFabrics] }[] = [
    { key: "jacket", step: "jacket", label: "Jacket", option: summary.upper, cloth: fabrics.jacket },
    { key: "trousers", step: "trousers", label: "Trousers", option: summary.lower, cloth: fabrics.trousers },
    { key: "shirt", step: "inner", label: "Shirt", option: summary.shirt, cloth: fabrics.shirt },
    ...(summary.waistcoat && summary.waistcoat.id !== "SUIT_WAISTCOAT_NONE" ? [{ key: "waistcoat", step: "inner" as const, label: "Waistcoat", option: summary.waistcoat, cloth: fabrics.waistcoat }] : []),
    { key: "footwear", step: "shoes", label: "Shoes", option: summary.footwear, cloth: null },
  ];
  const assigned = rows.filter(row => row.option && row.key !== "footwear");
  const uploaded = assigned.filter(row => row.cloth).length;
  const unavailable = rows.filter(row => row.option?.reference?.status === "awaiting-upload");
  const ready = missing.length === 0 && unavailable.length === 0;
  return <section className="level1-review split-outfit-review" aria-label="Review your modular outfit recipe">
    <div className="split-review-content">
      <h3 className="split-review-title">Your outfit</h3>
      <div className="split-summary-grid">
        {rows.map(row => <div className="split-summary-card" key={row.key}>
          <span className="split-summary-kicker">{row.label}</span>
          <strong className="split-summary-value">{row.option?.customer.name ?? "Not selected"}</strong>
          <p className="split-summary-detail">{row.option ? row.key === "footwear" ? "Reference material" : row.cloth ? (row.key === "trousers" && trousersLinked ? "Linked jacket cloth" : "Uploaded cloth") : "Reference cloth" : "Choose a design to continue"}</p>
          {row.cloth ? <img className="split-review-swatch" src={row.cloth.previewUrl} alt={`${row.label} assigned cloth`} /> : null}
          {row.option?.reference?.status === "awaiting-upload" ? <p role="status">Approved reference not yet available</p> : null}
          <button type="button" className="split-review-edit" onClick={() => onEdit(row.step)}>Edit {row.label.toLowerCase()}</button>
        </div>)}
        <div className="split-summary-card"><span className="split-summary-kicker">Accessories · Text instructions</span><strong className="split-summary-value">{summary.accessories.map(option => option.customer.name).join(", ") || "None selected"}</strong><button type="button" className="split-review-edit" onClick={() => onEdit("extras")}>Edit accessories</button></div>
        <div className="split-summary-card"><span className="split-summary-kicker">Material assignments</span><strong className="split-summary-value">{assigned.length} garment-piece assignments</strong><p>{uploaded} uploaded cloth / {assigned.length - uploaded} reference cloth. Shoes use reference material; accessories use text instructions.</p></div>
      </div>
      {missing.length ? <div className="split-review-missing" role="status"><p>Still needed:</p>{missing.map((id) => <button key={id} type="button" className="split-review-edit" onClick={() => onEdit(id)}>{stepLabel(id)}</button>)}</div> : null}
      {!missing.length && unavailable.length ? <p role="status">{`Waiting for approved references: ${unavailable.map(row => row.label).join(", ")}.`}</p> : null}
      <button className="button button-primary level1-generate" type="button" onClick={onGenerate} disabled={!ready || isGenerating}>{isGenerating ? "Constructing your look…" : ready ? "Generate Split Try-On" : "Complete Recipe to Continue"}</button>
    </div>
  </section>;
}
