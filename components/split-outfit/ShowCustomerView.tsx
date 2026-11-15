"use client";
/* eslint-disable @next/next/no-img-element -- swatches are transient blob URLs or private History assets. */

import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { ZoomableImage } from "@/components/ZoomableImage";
import { useModalDialog } from "@/components/hooks/useModalDialog";
import type { SessionResult, SwatchPiece } from "@/lib/session-results";

type Props = {
  results: SessionResult[];
  initialIndex: number;
  onClose: () => void;
};

const PIECE_SWATCH: Record<string, SwatchPiece | undefined> = {
  Jacket: "jacket",
  Trousers: "trousers",
  Shirt: "shirt",
  Waistcoat: "waistcoat",
};

const SWIPE_PX = 50;

/** Full-screen result for handing the iPad to the customer. Shows no staff controls. */
export function ShowCustomerView({ results, initialIndex, onClose }: Props) {
  const [index, setIndex] = useState(Math.min(Math.max(initialIndex, 0), results.length - 1));
  const [showBefore, setShowBefore] = useState(false);
  const [failedSwatches, setFailedSwatches] = useState<ReadonlySet<string>>(() => new Set());
  const dialogRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef<HTMLButtonElement>(null);
  const swipeStart = useRef<number | null>(null);
  const current = results[index];

  useModalDialog({
    open: Boolean(current),
    onClose,
    dialogRef,
    initialFocusRef: doneRef,
  });

  const go = useCallback((delta: number) => {
    setShowBefore(false);
    setIndex((value) => Math.min(Math.max(value + delta, 0), results.length - 1));
  }, [results.length]);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "ArrowLeft") go(-1);
      if (event.key === "ArrowRight") go(1);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [go]);

  if (!current) return null;

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => { if (event.pointerType !== "mouse") swipeStart.current = event.clientX; };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (swipeStart.current === null) return;
    const distance = event.clientX - swipeStart.current;
    swipeStart.current = null;
    if (Math.abs(distance) >= SWIPE_PX) go(distance < 0 ? 1 : -1);
  };

  const pieces = current.summary.pieces ?? [];
  const accessories = current.summary.accessories ?? [];

  return (
    <div className="show-customer" role="dialog" aria-modal="true" aria-label="Customer view of the try-on" ref={dialogRef}>
      <div className="show-customer-photo" onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
        <div className="show-customer-toolbar">
          <div className="comparison-toggle" role="group" aria-label="Before and after">
            <button type="button" aria-pressed={showBefore} className={showBefore ? "is-active" : ""} onClick={() => setShowBefore(true)}>Before</button>
            <button type="button" aria-pressed={!showBefore} className={showBefore ? "" : "is-active"} onClick={() => setShowBefore(false)}>After</button>
          </div>
        </div>
        <ZoomableImage
          key={`${current.id}-${showBefore ? "before" : "after"}`}
          src={showBefore ? current.originalUrl : current.resultUrl}
          alt={showBefore ? "The customer's original photo" : "The customer wearing the selected outfit"}
          className="show-customer-image"
        />
        {results.length > 1 ? (
          <div className="show-customer-nav">
            <button type="button" onClick={() => go(-1)} disabled={index === 0} aria-label="Previous result">←</button>
            <span className="show-customer-dots" aria-label={`Result ${index + 1} of ${results.length}`}>
              {results.map((result, dot) => <span key={result.id} className={dot === index ? "is-on" : ""} aria-hidden="true" />)}
            </span>
            <button type="button" onClick={() => go(1)} disabled={index === results.length - 1} aria-label="Next result">→</button>
          </div>
        ) : null}
      </div>

      <aside className="show-customer-card" aria-label="Your outfit">
        <div className="show-customer-card-head">
          <p className="eyebrow">Your outfit</p>
          <button type="button" className="show-customer-done" ref={doneRef} onClick={onClose}>Done</button>
        </div>
        <ul className="show-customer-pieces">
          {pieces.map((piece) => {
            const swatchPiece = PIECE_SWATCH[piece.label];
            const url = swatchPiece ? current.swatches[swatchPiece] : undefined;
            const usable = url && !failedSwatches.has(url);
            return (
              <li key={piece.label}>
                {usable ? (
                  <img className="show-customer-swatch" src={url} alt="" onError={() => setFailedSwatches((set) => new Set([...set, url]))} />
                ) : (
                  <span className="show-customer-swatch is-house" aria-hidden="true" title="House cloth" />
                )}
                <span>{piece.customerLabel ?? `${piece.design} ${piece.label.toLowerCase()}`}</span>
              </li>
            );
          })}
        </ul>
        {accessories.length ? <p className="show-customer-extras">{accessories.join(" · ")}</p> : null}
        <p className="show-customer-disclaimer">AI visual reference — not an exact match of the cloth.</p>
      </aside>
    </div>
  );
}
