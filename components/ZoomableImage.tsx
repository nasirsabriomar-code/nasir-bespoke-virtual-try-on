"use client";

/* eslint-disable @next/next/no-img-element -- private generation images must be requested with the session cookie. */

import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from "react";
import { createPortal } from "react-dom";

const ZOOM_STEPS = [1, 2, 3] as const;

type ZoomableImageProps = {
  src: string;
  alt: string;
  className?: string;
};

export function ZoomableImage({ src, alt, className }: ZoomableImageProps) {
  const [open, setOpen] = useState(false);
  const [scaleIndex, setScaleIndex] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; originX: number; originY: number; moved: boolean } | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const scale = ZOOM_STEPS[scaleIndex] ?? 1;

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setScaleIndex(0);
      setOffset({ x: 0, y: 0 });
    }
  }, [open]);

  function cycleZoom() {
    setScaleIndex((current) => {
      const next = (current + 1) % ZOOM_STEPS.length;
      if (next === 0) setOffset({ x: 0, y: 0 });
      return next;
    });
  }

  function onPointerDown(event: PointerEvent<HTMLImageElement>) {
    if (scale <= 1) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, originX: offset.x, originY: offset.y, moved: false };
  }

  function onPointerMove(event: PointerEvent<HTMLImageElement>) {
    if (!drag.current) return;
    const dx = event.clientX - drag.current.x;
    const dy = event.clientY - drag.current.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) drag.current.moved = true;
    setOffset({ x: drag.current.originX + dx, y: drag.current.originY + dy });
  }

  function onPointerUp() {
    const session = drag.current;
    drag.current = null;
    if (!session || session.moved) return;
    cycleZoom();
  }

  function onImageClick(event: MouseEvent<HTMLImageElement>) {
    if (scale > 1) return;
    event.stopPropagation();
    cycleZoom();
  }

  return (
    <>
      <button
        type="button"
        className={`zoomable-image-trigger ${className ?? ""}`.trim()}
        onClick={() => setOpen(true)}
        aria-label={`Preview ${alt}`}
      >
        <img src={src} alt={alt} />
        <span className="zoomable-image-hint">Click to preview</span>
      </button>

      {open
        ? createPortal(
            <div className="result-preview-root" role="dialog" aria-modal="true" aria-labelledby="result-preview-title">
              <button type="button" className="result-preview-dismiss" aria-label="Close preview" onClick={() => setOpen(false)} />
              <div className="result-preview-stage">
                <div className="result-preview-toolbar">
                  <p id="result-preview-title">Preview</p>
                  <p className="result-preview-hint">{scale === 1 ? "Click the image to zoom" : "Click to zoom further · drag to pan"}</p>
                  <button type="button" className="result-preview-close" ref={closeButtonRef} onClick={() => setOpen(false)}>
                    Close
                  </button>
                </div>
                <div className="result-preview-canvas">
                  <img
                    src={src}
                    alt={alt}
                    className={`result-preview-image is-zoom-${scale}${scale > 1 ? " is-pannable" : ""}`}
                    style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
                    onClick={onImageClick}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={() => {
                      drag.current = null;
                    }}
                    draggable={false}
                  />
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
