"use client";

import { useEffect, useRef, useState } from "react";
import type { Level1CatalogueDesignView, Level1CatalogueView } from "@/lib/catalog/level1-types";

type Level1CatalogueProps = {
  catalogue: Level1CatalogueView;
  categoryId: string;
  designId: string | null;
  designVariantId: string | null;
  onCategoryChange: (categoryId: string) => void;
  onDesignChange: (designId: string, variantId?: string) => void;
};

export function Level1Catalogue({
  catalogue,
  categoryId,
  designId,
  designVariantId,
  onCategoryChange,
  onDesignChange,
}: Level1CatalogueProps) {
  const activeCategory = catalogue.categories.find((category) => category.id === categoryId) ?? catalogue.categories[0];
  const designs = catalogue.designs.filter((design) => design.categoryId === activeCategory?.id);
  const [inspectingDesign, setInspectingDesign] = useState<Level1CatalogueDesignView | null>(null);
  const [choosingVariantDesign, setChoosingVariantDesign] = useState<Level1CatalogueDesignView | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  // Close modal on Escape key & manage body scroll lock
  useEffect(() => {
    if (!inspectingDesign && !choosingVariantDesign) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setInspectingDesign(null);
        setChoosingVariantDesign(null);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [choosingVariantDesign, inspectingDesign]);

  return (
    <div className="level1-catalogue">
      <div className="level1-category-tabs" role="tablist" aria-label="Outfit categories">
        {catalogue.categories.map((category) => {
          const selected = category.id === activeCategory?.id;

          return (
            <button
              className={`level1-category-tab${selected ? " is-selected" : ""}`}
              type="button"
              role="tab"
              key={category.id}
              aria-selected={selected}
              onClick={() => onCategoryChange(category.id)}
            >
              <span>{category.name}</span>
            </button>
          );
        })}
      </div>

      {activeCategory ? (
        <div className="level1-catalogue-heading">
          <div>
            <h3>{activeCategory.name}</h3>
            <p>{activeCategory.description}</p>
          </div>
          <span>{designs.length} curated designs</span>
        </div>
      ) : null}

      <div className="level1-design-grid" role="list" aria-label={`Curated ${activeCategory?.name ?? "garment"} designs`}>
        {designs.map((design) => {
          const selected = design.id === designId;
          const ready = design.generation.state === "ready";
          const selectable = ready || Boolean(design.variants?.some(variant => variant.generation.state === "ready"));
          const hasImage = design.cardImage.state === "ready" && Boolean(design.cardImage.url);

          return (
            <div
              className={`level1-design-card${selected ? " is-selected" : ""}`}
              key={design.id}
              role="button"
              tabIndex={selectable ? 0 : -1}
              aria-disabled={!selectable}
              aria-pressed={selected}
              onClick={() => {
                if (!selectable) return;
                if (design.variants?.length) {
                  setChoosingVariantDesign(design);
                } else {
                  onDesignChange(design.id);
                }
              }}
              onKeyDown={(e) => {
                if (selectable && (e.key === " " || e.key === "Enter")) {
                  e.preventDefault();
                  if (design.variants?.length) {
                    setChoosingVariantDesign(design);
                  } else {
                    onDesignChange(design.id);
                  }
                }
              }}
            >
              <div className="level1-card-image-wrap">
                {hasImage ? (
                  <>
                    {/* Protected application route proxy — never a storage URL */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={design.cardImage.url}
                      alt={`Full silhouette catalogue reference for ${design.name}`}
                      className="level1-card-image"
                      loading="lazy"
                    />
                    <button
                      type="button"
                      className="level1-card-inspect-btn"
                      aria-label={`Inspect ${design.name} in full screen`}
                      title="Inspect full silhouette and tailoring details"
                      onClick={(e) => {
                        e.stopPropagation();
                        setInspectingDesign(design);
                      }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        <line x1="11" y1="8" x2="11" y2="14" />
                        <line x1="8" y1="11" x2="14" y2="11" />
                      </svg>
                      <span>Inspect</span>
                    </button>
                  </>
                ) : (
                  <div className="level1-card-placeholder" aria-hidden="true">
                    <span>NB</span>
                    <small>Reference image unavailable</small>
                  </div>
                )}
              </div>

              <div className="level1-card-body">
                <div className="level1-card-title-row">
                  <strong>{design.name}</strong>
                  {selected ? <span className="level1-selected-mark">Selected</span> : null}
                </div>
                <p className="level1-card-description">{design.description}</p>
                <p className="level1-card-intent">{design.intent}</p>
                {!ready ? <span className="level1-card-state">Reference unavailable</span> : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* FULL-SCREEN EXPANDED DESIGN VIEWER MODAL */}
      {inspectingDesign ? (
        <div className="level1-viewer-backdrop">
          <button
            type="button"
            className="level1-viewer-backdrop-dismiss"
            aria-label="Close expanded viewer"
            tabIndex={-1}
            onClick={() => setInspectingDesign(null)}
          />
          <div
            className="level1-viewer-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="viewer-design-name"
          >
            <div className="level1-viewer-header">
              <div className="level1-viewer-title-group">
                <span className="eyebrow">Nasir Bespoke Catalogue</span>
                <h3 id="viewer-design-name">{inspectingDesign.name}</h3>
              </div>
              <button
                type="button"
                className="level1-viewer-close-btn"
                aria-label="Close design viewer (Esc)"
                ref={closeButtonRef}
                onClick={() => setInspectingDesign(null)}
              >
                <span aria-hidden="true">✕</span>
                <span>Close</span>
              </button>
            </div>

            <div className="level1-viewer-stage">
              {inspectingDesign.cardImage.state === "ready" && inspectingDesign.cardImage.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={inspectingDesign.cardImage.url}
                  alt={`Full silhouette view of ${inspectingDesign.name}`}
                  className="level1-viewer-image"
                />
              ) : null}
            </div>

            <div className="level1-viewer-footer">
              <div className="level1-viewer-info">
                <p className="level1-viewer-description">{inspectingDesign.description}</p>
                <p className="level1-viewer-intent">{inspectingDesign.intent}</p>
              </div>
              <div className="level1-viewer-actions">
                <button
                  type="button"
                  className={`level1-viewer-select-btn${designId === inspectingDesign.id ? " is-selected" : ""}`}
                  onClick={() => {
                    onDesignChange(inspectingDesign.id);
                    setInspectingDesign(null);
                  }}
                >
                  {designId === inspectingDesign.id ? "✓ Selected for Try-On" : "Select this Look"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* VARIANT SELECTION POPUP FOR DESIGNS WITH MULTIPLE APPROVED REFERENCES */}
      {choosingVariantDesign ? (
        <div className="level1-variant-backdrop">
          <button
            type="button"
            className="level1-viewer-backdrop-dismiss"
            aria-label="Close design options"
            tabIndex={-1}
            onClick={() => setChoosingVariantDesign(null)}
          />
          <div
            className="level1-variant-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="variant-design-name"
          >
            <div className="level1-viewer-header">
              <div className="level1-viewer-title-group">
                <span className="eyebrow">Nasir Bespoke Catalogue</span>
                <h3 id="variant-design-name">Choose {choosingVariantDesign.name}</h3>
                <p className="level1-variant-subtitle">Select the approved construction reference for this silhouette.</p>
              </div>
              <button
                type="button"
                className="level1-viewer-close-btn"
                aria-label="Close design options (Esc)"
                ref={closeButtonRef}
                onClick={() => setChoosingVariantDesign(null)}
              >
                <span aria-hidden="true">✕</span>
                <span>Close</span>
              </button>
            </div>

            <div className="level1-variant-grid">
              {[
                {
                  id: null,
                  name: choosingVariantDesign.name,
                  description: choosingVariantDesign.description,
                  cardImage: choosingVariantDesign.cardImage,
                  generation: choosingVariantDesign.generation,
                },
                ...(choosingVariantDesign.variants ?? []),
              ].map((option) => {
                const selected = designId === choosingVariantDesign.id && (option.id === designVariantId || (!option.id && !designVariantId));
                const ready = option.generation.state === "ready";
                const hasImage = option.cardImage.state === "ready" && Boolean(option.cardImage.url);
                return (
                  <button
                    type="button"
                    className={`level1-variant-option${selected ? " is-selected" : ""}`}
                    key={option.id ?? "base"}
                    disabled={!ready}
                    onClick={() => {
                      onDesignChange(choosingVariantDesign.id, option.id ?? undefined);
                      setChoosingVariantDesign(null);
                    }}
                  >
                    <span className="level1-variant-image-wrap">
                      {hasImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={option.cardImage.url} alt={`${option.name} reference`} className="level1-variant-image" />
                      ) : (
                        <span className="level1-variant-placeholder">Reference awaiting approval</span>
                      )}
                    </span>
                    <span className="level1-variant-option-body">
                      <span className="level1-variant-option-title">{option.name}</span>
                      <span className="level1-variant-option-description">{option.description}</span>
                      <span className={`level1-variant-option-state${selected ? " is-selected" : ""}`}>
                        {selected ? "Selected" : ready ? "Use this reference" : "Awaiting approved reference"}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
