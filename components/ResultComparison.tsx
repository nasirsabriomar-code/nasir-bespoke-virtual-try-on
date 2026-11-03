"use client";
/* eslint-disable @next/next/no-img-element -- authenticated private asset URLs. */
import { useRef, useState } from "react";
export type ComparisonReference = { label: string; url: string };
export function ResultComparison({ originalUrl, resultUrl, fabricReferences = [] }: { originalUrl: string; resultUrl: string; fabricReferences?: ComparisonReference[] }) {
  const [zoom, setZoom] = useState(1);
  const [referenceIndex, setReferenceIndex] = useState(-1);
  const reference = fabricReferences[referenceIndex];
  const first = useRef<HTMLDivElement>(null);
  const second = useRef<HTMLDivElement>(null);
  function synchronize(source: HTMLDivElement, target: HTMLDivElement | null) {
    if (!target || (source.scrollLeft === target.scrollLeft && source.scrollTop === target.scrollTop)) return;
    target.scrollLeft = source.scrollLeft; target.scrollTop = source.scrollTop;
  }
  return <section aria-label="Synchronized original and result comparison">
    {fabricReferences.length ? <label>Compare result with <select value={reference ? referenceIndex : -1} onChange={event => { setReferenceIndex(Number(event.target.value)); if (first.current) first.current.scrollTo(0, 0); if (second.current) second.current.scrollTo(0, 0); }}><option value={-1}>Original customer photo</option>{fabricReferences.map((item, index) => <option key={item.url} value={index}>{item.label}</option>)}</select></label> : null}
    <label>Shared zoom: {zoom}× <input type="range" min="1" max="4" step="0.25" value={zoom} onChange={event => setZoom(Number(event.target.value))} /></label>
    <p>Scroll either image to inspect the same region in both. Compare fabric repeats, tailoring and the background.</p>
    <div className="result-comparison-grid">
      <figure><figcaption>{reference?.label ?? "Original"}</figcaption><div className="result-comparison-pane" ref={first} onScroll={event => synchronize(event.currentTarget, second.current)}><img src={reference?.url ?? originalUrl} alt={reference ? `${reference.label} for pattern and weave comparison` : "Original customer photograph"} style={{ width: `${zoom * 100}%`, maxWidth: "none" }} /></div></figure>
      <figure><figcaption>Try-on</figcaption><div className="result-comparison-pane" ref={second} onScroll={event => synchronize(event.currentTarget, first.current)}><img src={resultUrl} alt="Generated try-on for comparison" style={{ width: `${zoom * 100}%`, maxWidth: "none" }} /></div></figure>
    </div>
    <p>Zoom into the fabric and result to inspect repeat shapes, spacing, colour and weave. Different photographs and aspect ratios can shift alignment; shared zoom does not represent equal physical scale or a fit measurement.</p>
  </section>;
}
