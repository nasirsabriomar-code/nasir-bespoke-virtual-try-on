"use client";
/* eslint-disable @next/next/no-img-element -- local cloth previews are transient blob URLs. */
import type { SplitOutfitSummaryView } from "@/lib/split-outfit/types";
import type { SplitPieceFabrics } from "./SplitMaterialsSection";

type Props = {
  summary: SplitOutfitSummaryView;
  fabrics: SplitPieceFabrics;
  trousersLinked: boolean;
  onGenerate: () => void;
  isGenerating: boolean;
};
export function SplitOutfitReview({ summary, fabrics, trousersLinked, onGenerate, isGenerating }: Props) {
  const rows = [
    { key: "jacket", label: "Jacket", option: summary.upper, cloth: fabrics.jacket },
    { key: "trousers", label: "Trousers", option: summary.lower, cloth: fabrics.trousers },
    { key: "shirt", label: "Shirt", option: summary.shirt, cloth: fabrics.shirt },
    ...(summary.waistcoat && summary.waistcoat.id !== "SUIT_WAISTCOAT_NONE" ? [{ key: "waistcoat", label: "Waistcoat", option: summary.waistcoat, cloth: fabrics.waistcoat }] : []),
    { key: "footwear", label: "Shoes", option: summary.footwear, cloth: null },
  ];
  const assigned = rows.filter(row => row.option && row.key !== "footwear");
  const uploaded = assigned.filter(row => row.cloth).length;
  const unavailable = rows.filter(row => row.option?.reference?.status === "awaiting-upload");
  const ready = summary.isComplete && unavailable.length === 0;
  return <section className="level1-review split-outfit-review" aria-label="Review your modular outfit recipe">
    <div className="split-review-content">
      <div className="level1-step-heading"><span>07</span><div><p className="eyebrow">Modular Outfit Recipe</p><h2>Your outfit</h2></div></div>
      <div className="split-summary-grid">
        {rows.map(row => <div className="split-summary-card" key={row.key}>
          <span className="split-summary-kicker">{row.label}</span>
          <strong className="split-summary-value">{row.option?.customer.name ?? "Not selected"}</strong>
          <p className="split-summary-detail">{row.option ? row.key === "footwear" ? "Reference material" : row.cloth ? (row.key === "trousers" && trousersLinked ? "Linked jacket cloth" : "Uploaded cloth") : "Reference cloth" : "Choose a design to continue"}</p>
          {row.cloth ? <img className="split-review-swatch" src={row.cloth.previewUrl} alt={`${row.label} assigned cloth`} /> : null}
          {row.option?.reference?.status === "awaiting-upload" ? <p role="status">Approved reference not yet available</p> : null}
          <a href={`#split-piece-${row.key}`}>Edit {row.label.toLowerCase()}</a>
        </div>)}
        <div className="split-summary-card"><span className="split-summary-kicker">Accessories · Text instructions</span><strong className="split-summary-value">{summary.accessories.map(option => option.customer.name).join(", ") || "None selected"}</strong><a href="#split-piece-accessories">Edit accessories</a></div>
        <div className="split-summary-card"><span className="split-summary-kicker">Material assignments</span><strong className="split-summary-value">{assigned.length} garment-piece assignments</strong><p>{uploaded} uploaded cloth / {assigned.length - uploaded} reference cloth. Shoes use reference material; accessories use text instructions.</p></div>
      </div>
      {!ready ? <p role="status">{unavailable.length ? `Waiting for approved references: ${unavailable.map(row => row.label).join(", ")}.` : "Select a compatible jacket, trousers, shirt and shoes to continue."}</p> : null}
      <button className="button button-primary level1-generate" type="button" onClick={onGenerate} disabled={!ready || isGenerating}>{isGenerating ? "Constructing your look…" : ready ? "Generate Split Try-On" : "Complete Recipe to Continue"}</button>
    </div>
  </section>;
}
