"use client";
/* eslint-disable @next/next/no-img-element -- previews are local object URLs only. */
import { useState } from "react";
import { DEFAULT_DETAIL_CROP, FABRIC_PATTERNS, type FabricPattern, type FabricReferenceOptions, type FabricTreatment, type DetailCrop } from "@/lib/tryon/fabric-guidance";

const TREATMENT_LABELS: Record<FabricTreatment, string> = {
  "legacy-crop": "Centre crop",
  "full-swatch": "Whole swatch",
  "full-detail": "Whole swatch + selected detail",
};
const PATTERN_LABELS: Record<FabricPattern, string> = {
  pinstripe: "Fine pinstripe",
  "chalk-stripe": "Chalk stripe",
  check: "Check or plaid",
};

export function FabricReferenceControls({ label, previewUrl, value, onChange, disabled }: { label: string; previewUrl: string; value?: FabricReferenceOptions; onChange: (value: FabricReferenceOptions | undefined) => void; disabled: boolean }) {
  const [aspect, setAspect] = useState(1);
  const options: FabricReferenceOptions = value ?? { mode: "studio-default" };
  const crop = options.crop ?? DEFAULT_DETAIL_CROP;
  function updateCrop(field: keyof DetailCrop, next: number) {
    const updated = { ...crop, [field]: next };
    updated.width = Math.min(updated.width, 1 - updated.x);
    updated.height = Math.min(updated.height, 1 - updated.y);
    onChange({ ...options, crop: updated });
  }
  return <section className="fabric-reference-controls" aria-label={`${label} reference controls`}>
    <h3>{label}: pattern scale</h3>
    <fieldset disabled={disabled}>
      <legend>Reference treatment</legend>
      <label>Fabric photo sent to the model
        <select value={options.mode} onChange={event => onChange({ ...options, mode: event.target.value as FabricReferenceOptions["mode"] })}>
          <option value="studio-default">Studio default</option>
          {(Object.keys(TREATMENT_LABELS) as FabricTreatment[]).map(mode => <option key={mode} value={mode}>{TREATMENT_LABELS[mode]}</option>)}
        </select>
      </label>
      <label>Fabric pattern
        <select value={options.pattern ?? ""} onChange={event => onChange({ ...options, pattern: (event.target.value || undefined) as FabricPattern | undefined })}>
          <option value="">Use the swatch photo</option>
          {FABRIC_PATTERNS.map(pattern => <option key={pattern} value={pattern}>{PATTERN_LABELS[pattern]}</option>)}
        </select>
      </label>
      <p>Measure from one stripe or motif to the next matching one. Enter width across the swatch and height along it.</p>
      {(["repeatWidthCm", "repeatHeightCm"] as const).map(field => {
        const measurement = options[field];
        return <label key={field}>
          {field === "repeatWidthCm" ? "Repeat width (mm, optional)" : "Repeat height (mm, optional)"}
          <input type="number" min={1} max={1000} step={1} value={measurement === undefined ? "" : Number((measurement * 10).toFixed(6))} onChange={event => onChange({ ...options, [field]: event.target.value ? event.target.valueAsNumber / 10 : undefined })} />
        </label>;
      })}
      {options.mode === "full-detail" ? <>
        <div className="fabric-reference-preview-grid">
          <figure><figcaption>Full swatch with selected detail</figcaption><div className="fabric-crop-source"><img src={previewUrl} alt={`${label} full swatch`} onLoad={event => setAspect(event.currentTarget.naturalWidth / event.currentTarget.naturalHeight)} /><span aria-hidden="true" style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.width * 100}%`, height: `${crop.height * 100}%` }} /></div></figure>
          <figure><figcaption>Selected detail preview</figcaption><div className="fabric-detail-preview" style={{ aspectRatio: aspect * crop.width / crop.height }}><img src={previewUrl} alt={`${label} selected fabric detail`} style={{ width: `${100 / crop.width}%`, maxWidth: "none", transform: `translate(-${crop.x * 100}%, -${crop.y * 100}%)` }} /></div></figure>
        </div>
        {(["x", "y", "width", "height"] as const).map(field => <label key={field}>{({ x: "Detail left", y: "Detail top", width: "Detail width", height: "Detail height" })[field]}: {Math.round(crop[field] * 100)}% <input type="range" min={field === "x" || field === "y" ? 0 : .05} max={field === "x" ? 1 - crop.width : field === "y" ? 1 - crop.height : field === "width" ? 1 - crop.x : 1 - crop.y} step="0.01" value={crop[field]} onChange={event => updateCrop(field, Number(event.target.value))} /></label>)}
        <p>Photograph flat cloth in even light. Include a ruler in the same plane if supplying measured repeats; keep it outside the detail selection.</p>
      </> : null}
    </fieldset>
  </section>;
}
