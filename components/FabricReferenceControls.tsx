"use client";
/* eslint-disable @next/next/no-img-element -- previews are local object URLs only. */
import { useState } from "react";
import { DEFAULT_DETAIL_CROP, type FabricReferenceOptions, type DetailCrop } from "@/lib/tryon/fabric-guidance";
export function FabricReferenceControls({ label, previewUrl, value, onChange, disabled }: { label: string; previewUrl: string; value?: FabricReferenceOptions; onChange: (value: FabricReferenceOptions) => void; disabled: boolean }) {
  const [aspect, setAspect] = useState(1);
  const options = value ?? { mode: "legacy-crop" as const };
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
      <label><input type="checkbox" checked={options.mode === "full-detail"} onChange={event => onChange({ ...options, mode: event.target.checked ? "full-detail" : "legacy-crop" })} /> Use full swatch plus selected detail</label>
      <p>The full swatch supplies pattern context; the selected detail shows weave and edges. The established centre-crop treatment remains available while evaluating results.</p>
      {options.mode === "full-detail" ? <>
        <div className="fabric-reference-preview-grid">
          <figure><figcaption>Full swatch with selected detail</figcaption><div className="fabric-crop-source"><img src={previewUrl} alt={`${label} full swatch`} onLoad={event => setAspect(event.currentTarget.naturalWidth / event.currentTarget.naturalHeight)} /><span aria-hidden="true" style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.width * 100}%`, height: `${crop.height * 100}%` }} /></div></figure>
          <figure><figcaption>Selected detail preview</figcaption><div className="fabric-detail-preview" style={{ aspectRatio: aspect * crop.width / crop.height }}><img src={previewUrl} alt={`${label} selected fabric detail`} style={{ width: `${100 / crop.width}%`, maxWidth: "none", transform: `translate(-${crop.x * 100}%, -${crop.y * 100}%)` }} /></div></figure>
        </div>
        {(["x", "y", "width", "height"] as const).map(field => <label key={field}>{({ x: "Detail left", y: "Detail top", width: "Detail width", height: "Detail height" })[field]}: {Math.round(crop[field] * 100)}% <input type="range" min={field === "x" || field === "y" ? 0 : .05} max={field === "x" ? 1 - crop.width : field === "y" ? 1 - crop.height : field === "width" ? 1 - crop.x : 1 - crop.y} step="0.01" value={crop[field]} onChange={event => updateCrop(field, Number(event.target.value))} /></label>)}
        <p>Photograph flat cloth in even light. Include a ruler in the same plane if supplying measured repeats; keep it outside the detail selection.</p>
        <label>Measured repeat width (cm, optional)<input type="number" min="0.1" max="100" step="0.1" value={options.repeatWidthCm ?? ""} onChange={event => onChange({ ...options, repeatWidthCm: event.target.value ? Number(event.target.value) : undefined })} /></label>
        <label>Measured repeat height (cm, optional)<input type="number" min="0.1" max="100" step="0.1" value={options.repeatHeightCm ?? ""} onChange={event => onChange({ ...options, repeatHeightCm: event.target.value ? Number(event.target.value) : undefined })} /></label>
        <p>Repeat measurements guide visual scale; this is not a physical fit or exact-size guarantee.</p>
      </> : null}
    </fieldset>
  </section>;
}
