"use client";
/* eslint-disable @next/next/no-img-element -- local customer preview object URL. */
import type { BackgroundControl } from "@/lib/tryon/background-control";
import type { DetailCrop } from "@/lib/tryon/fabric-guidance";
const DEFAULT_REGION: DetailCrop = { x: .1, y: .2, width: .8, height: .75 };
export function BackgroundControls({ previewUrl, value, onChange, disabled }: { previewUrl: string; value: BackgroundControl; onChange: (value: BackgroundControl) => void; disabled: boolean }) {
  const region = value.region ?? DEFAULT_REGION;
  function update(field: keyof DetailCrop, next: number) {
    const box = { ...region, [field]: next };
    box.width = Math.min(box.width, 1 - box.x); box.height = Math.min(box.height, 1 - box.y);
    onChange({ ...value, region: box });
  }
  return <section className="fabric-reference-controls" aria-label="Background preservation controls">
    <h3>Protect the original background</h3>
    <fieldset disabled={disabled}>
      <legend>Garment edit region</legend>
      <label>Preservation method <select value={value.mode} onChange={event => onChange({ mode: event.target.value as BackgroundControl["mode"], region, featherPixels: value.featherPixels ?? 4 })}><option value="prompt-only">Established prompt-only method</option><option value="masked">Guide the edit with a garment mask</option><option value="composite">Preserve the original outside the garment region</option></select></label>
      {value.mode !== "prompt-only" ? <>
        <p>Include the entire new garment, sleeves, hems and expected shadows. Keep the face and unchanged surroundings outside the box. Too small a region can clip clothing or leave remnants of the old outfit.</p>
        <div className="fabric-crop-source" style={{ maxWidth: 400 }}><img src={previewUrl} alt="Customer photograph with the allowed garment edit region" /><span aria-hidden="true" style={{ left: `${region.x * 100}%`, top: `${region.y * 100}%`, width: `${region.width * 100}%`, height: `${region.height * 100}%` }} /></div>
        {(["x", "y", "width", "height"] as const).map(field => <label key={field}>{({ x: "Region left", y: "Region top", width: "Region width", height: "Region height" })[field]}: {Math.round(region[field] * 100)}% <input type="range" min={field === "x" || field === "y" ? 0 : .05} max={field === "x" ? 1 - region.width : field === "y" ? 1 - region.height : field === "width" ? 1 - region.x : 1 - region.y} step="0.01" value={region[field]} onChange={event => update(field, Number(event.target.value))} /></label>)}
        <label>Blend inside the region edge: {value.featherPixels ?? 4} pixels<input type="range" min="0" max="32" step="1" value={value.featherPixels ?? 4} onChange={event => onChange({ ...value, featherPixels: Number(event.target.value) })} /></label>
        <p>{value.mode === "composite" ? "The original is aligned to the output canvas and retained outside the selected region. Inspect garment boundaries before accepting the result." : "The mask guides generation; it does not guarantee unchanged pixels."}</p>
      </> : <p>Use the established method as the comparison baseline. Region-based methods need visual evaluation on your garments.</p>}
    </fieldset>
  </section>;
}
