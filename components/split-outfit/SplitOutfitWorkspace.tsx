"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  buildSummaryFromView,
  optionsFor,
  reconcile,
} from "@/lib/split-outfit/client-engine";
import { adjacentStep, BUILDER_STEPS, buildBuilderRows, missingSteps, type BuilderStepId } from "@/lib/split-outfit/builder-steps";
import type { RepairNotice } from "@/lib/rules/types";
import { SPLIT_OUTFIT_FAMILIES } from "@/lib/split-outfit/types";
import type { SplitCatalogueView, SplitComponentCategory, SplitOutfitFamily, SplitOutfitState } from "@/lib/split-outfit/types";
import { BuilderStepList } from "./BuilderStepList";
import { SplitClothRow } from "./SplitClothRow";
import { SplitComponentCard } from "./SplitComponentCard";
import type { SplitPieceFabrics } from "./SplitMaterialsSection";
import { SplitOutfitReview } from "./SplitOutfitReview";

type SplitOutfitWorkspaceProps = {
  state: SplitOutfitState;
  onChange: (updater: (prev: SplitOutfitState) => SplitOutfitState) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  fabrics: SplitPieceFabrics;
  onFabricSelect: (piece: keyof SplitPieceFabrics, file: File) => void;
  onFabricRemove: (piece: keyof SplitPieceFabrics) => void;
  trousersLinked: boolean;
  fabricControls: (piece: keyof SplitPieceFabrics) => ReactNode;
  onReuseJacketOnTrousers: () => void;
  step: BuilderStepId;
  onStepChange: (step: BuilderStepId) => void;
  visited: ReadonlySet<BuilderStepId>;
  personPreview: string | null;
  /** Customer photo upload, rendered in the first step. */
  personSlot: ReactNode;
  /** Errors and generation progress, shown on every step. */
  statusSlot: ReactNode;
  /** Advanced settings and the result, shown on the review step. */
  reviewExtras: ReactNode;
};

const FAMILY_LABELS: Record<SplitOutfitFamily, string> = {
  suit: "Suit",
  sherwani: "Sherwani",
  bandhgala: "Bandhgala",
  "nehru-jacket": "Nehru Jacket",
  "kurta-set": "Kurta Set",
  "indo-western": "Indo-Western",
  achkan: "Achkan",
};

const STEP_INTRO: Record<BuilderStepId, string> = {
  customer: "Photograph or upload the customer.",
  jacket: "Choose a cut, then the cloth.",
  trousers: "Choose a cut, then the cloth.",
  inner: "Choose the shirt and, if wanted, a waistcoat.",
  shoes: "Shoes keep the leather and colour of their reference photograph.",
  extras: "Optional. Accessories are described in words; there is no photograph.",
  review: "Check every piece, then generate.",
};

const STEP_FOR_GROUP: Record<string, BuilderStepId> = {
  upper: "jacket",
  lower: "trousers",
  "inner-shirt": "inner",
  "inner-waistcoat": "inner",
  footwear: "shoes",
  accessory: "extras",
};

const FLASH_MS = 1500;

export function SplitOutfitWorkspace({ state, onChange, onGenerate, isGenerating, fabrics, trousersLinked, fabricControls, onFabricSelect, onFabricRemove, onReuseJacketOnTrousers, step, onStepChange, visited, personPreview, personSlot, statusSlot, reviewExtras }: SplitOutfitWorkspaceProps) {
  const [view, setView] = useState<SplitCatalogueView | null>(null);
  const [retry, setRetry] = useState(0);
  const [viewError, setViewError] = useState<string | null>(null);
  const [notices, setNotices] = useState<RepairNotice[]>([]);
  const [flashIds, setFlashIds] = useState<BuilderStepId[]>([]);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const builderRef = useRef<HTMLDivElement>(null);
  const previousStep = useRef(step);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    fetch(`/api/split-catalog?family=${encodeURIComponent(state.family)}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("request_failed");
        return response.json() as Promise<SplitCatalogueView>;
      })
      .then((data) => {
        if (cancelled) return;
        setView(data);
        setViewError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setViewError("We couldn't load this outfit family. Please try again.");
      });
    return () => { cancelled = true; controller.abort(); };
  }, [state.family, retry]);

  // Move focus to the new step for keyboard and screen-reader users, and bring the builder into view.
  useEffect(() => {
    if (previousStep.current === step) return;
    previousStep.current = step;
    headingRef.current?.focus({ preventScroll: true });
    builderRef.current?.scrollIntoView({ block: "start" });
  }, [step]);

  useEffect(() => {
    if (flashIds.length === 0) return;
    const timer = window.setTimeout(() => setFlashIds([]), FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [flashIds]);

  // The fetched view lags one render behind a family switch — treat a view
  // for a stale family the same as "still loading" rather than rendering it.
  const isLoadingView = !viewError && (!view || view.family !== state.family);
  const summary = useMemo(() => (view && !isLoadingView ? buildSummaryFromView(view, state) : null), [view, state, isLoadingView]);

  // Every change is followed by a reconcile pass: a change to an upstream
  // slot (e.g. the jacket) can invalidate a downstream selection (e.g. a
  // waistcoat that no longer fits a two-piece jacket) that must be dropped
  // rather than left stale and invisible-but-selected.
  const applyChange = useCallback((mutate: (prev: SplitOutfitState) => SplitOutfitState) => {
    if (!view) return;
    onChange((prev) => {
      const proposed = mutate(prev);
      const { state: reconciled, notices: repairNotices } = reconcile(view, proposed);
      setNotices(repairNotices);
      if (repairNotices.length) setFlashIds([...new Set(repairNotices.map((notice) => STEP_FOR_GROUP[notice.groupId]).filter(Boolean))]);
      return reconciled;
    });
  }, [onChange, view]);

  const toggleAccessory = (id: string) => {
    applyChange((prev) => {
      const exists = prev.accessoryIds.includes(id);
      const nextAccessories = exists
        ? prev.accessoryIds.filter((accId) => accId !== id)
        : [...prev.accessoryIds, id];
      return { ...prev, accessoryIds: nextAccessories };
    });
  };

  const selectFamily = (family: SplitOutfitFamily) => {
    if (family === state.family) return;
    setViewError(null);
    setNotices([]);
    onChange(() => ({
      family,
      upperId: null,
      lowerId: null,
      shirtId: null,
      waistcoatId: null,
      footwearId: null,
      accessoryIds: [],
    }));
    onStepChange("jacket");
  };

  const familySelector = (
    <div className="split-family-selector" role="radiogroup" aria-label="Outfit family">
      {SPLIT_OUTFIT_FAMILIES.map((family) => (
        <button
          key={family}
          type="button"
          role="radio"
          aria-checked={state.family === family}
          className={`split-family-btn ${state.family === family ? "is-active" : ""}`}
          disabled={isGenerating || view?.families?.find(item => item.id === family)?.configured === false}
          onClick={() => selectFamily(family)}
        >
          {FAMILY_LABELS[family]}{view?.families?.find(item => item.id === family)?.configured === false ? " · Coming soon" : ""}
        </button>
      ))}
    </div>
  );

  if (viewError) {
    return (
      <div className="split-outfit-workspace" aria-label="Split Outfit Customization Workspace">
        {familySelector}
        <p className="split-workspace-status" role="alert">{viewError}</p><button type="button" onClick={() => { setViewError(null); setRetry(value => value + 1); }}>Retry loading catalogue</button>
      </div>
    );
  }

  if (isLoadingView || !view || !summary) {
    return (
      <div className="split-outfit-workspace" aria-label="Split Outfit Customization Workspace">
        {familySelector}
        <p className="split-workspace-status" role="status">Loading {FAMILY_LABELS[state.family]} components…</p>
      </div>
    );
  }

  const hasAnyOptions = view.slots.some((slot) => slot.options.length > 0);
  if (!hasAnyOptions) {
    return (
      <div className="split-outfit-workspace" aria-label="Split Outfit Customization Workspace">
        {familySelector}
        <div className="split-family-empty">
          {FAMILY_LABELS[state.family]} components are coming soon. Choose Suit to build a modular outfit today.
        </div>
      </div>
    );
  }

  const rows = buildBuilderRows({
    state,
    names: {
      upper: summary.upper?.customer.name,
      lower: summary.lower?.customer.name,
      shirt: summary.shirt?.customer.name,
      waistcoat: summary.waistcoat?.customer.name,
      footwear: summary.footwear?.customer.name,
    },
    accessoryNames: summary.accessories.map((option) => option.customer.name),
    personPreview,
    fabricPreviews: {
      jacket: fabrics.jacket?.previewUrl ?? null,
      trousers: fabrics.trousers?.previewUrl ?? null,
      shirt: fabrics.shirt?.previewUrl ?? null,
      waistcoat: fabrics.waistcoat?.previewUrl ?? null,
    },
    trousersLinked,
    visited,
    current: step,
  });
  const currentRow = rows.find((row) => row.id === step) ?? rows[0];
  const previous = adjacentStep(step, -1);
  const next = adjacentStep(step, 1);
  const nextLabel = next ? BUILDER_STEPS.find((item) => item.id === next)?.label : null;

  const cards = (category: SplitComponentCategory, isSelected: (id: string) => boolean, onSelect: (id: string) => void, isMultiSelect = false) => (
    <div className="split-cards-grid">
      {optionsFor(view, state, category)
        .filter(({ verdict }) => verdict.status !== "incompatible")
        .map(({ option, verdict }) => (
          <SplitComponentCard
            disabled={isGenerating}
            key={option.id}
            option={option}
            selected={isSelected(option.id)}
            onSelect={() => onSelect(option.id)}
            verdict={verdict}
            isMultiSelect={isMultiSelect}
          />
        ))}
    </div>
  );

  const clothRow = (piece: keyof SplitPieceFabrics) => (
    <SplitClothRow
      piece={piece}
      fabric={fabrics[piece]}
      onSelect={(file) => onFabricSelect(piece, file)}
      onRemove={() => onFabricRemove(piece)}
      disabled={isGenerating}
      controls={fabricControls(piece)}
      link={piece === "trousers" ? { linked: trousersLinked, available: Boolean(fabrics.jacket), jacketPreview: fabrics.jacket?.previewUrl ?? null, onToggle: onReuseJacketOnTrousers } : undefined}
    />
  );

  const stepContent: Record<BuilderStepId, ReactNode> = {
    customer: personSlot,
    jacket: <>{cards("upper", (id) => state.upperId === id, (id) => applyChange((prev) => ({ ...prev, upperId: id })))}{clothRow("jacket")}</>,
    trousers: <>{cards("lower", (id) => state.lowerId === id, (id) => applyChange((prev) => ({ ...prev, lowerId: id })))}{clothRow("trousers")}</>,
    inner: (
      <div className="split-inner-group">
        <div className="split-subsection">
          <h3 className="split-subsection-title">Dress shirt</h3>
          {cards("inner-shirt", (id) => state.shirtId === id, (id) => applyChange((prev) => ({ ...prev, shirtId: id })))}
          {clothRow("shirt")}
        </div>
        <div className="split-subsection">
          <h3 className="split-subsection-title">Waistcoat (optional)</h3>
          {cards("inner-waistcoat", (id) => state.waistcoatId === id, (id) => applyChange((prev) => ({ ...prev, waistcoatId: id })))}
          {state.waistcoatId && state.waistcoatId !== "SUIT_WAISTCOAT_NONE" ? clothRow("waistcoat") : null}
        </div>
      </div>
    ),
    shoes: cards("footwear", (id) => state.footwearId === id, (id) => applyChange((prev) => ({ ...prev, footwearId: id }))),
    extras: cards("accessory", (id) => state.accessoryIds.includes(id), toggleAccessory, true),
    review: (
      <>
        <SplitOutfitReview
          summary={summary}
          fabrics={fabrics}
          trousersLinked={trousersLinked}
          onGenerate={onGenerate}
          isGenerating={isGenerating}
          missing={missingSteps(state, Boolean(personPreview))}
          onEdit={onStepChange}
        />
        {reviewExtras}
      </>
    ),
  };

  return (
    <div className="split-outfit-workspace" aria-label="Split Outfit Customization Workspace">
      {familySelector}
      <div className="split-builder" ref={builderRef}>
        <BuilderStepList rows={rows} onSelect={onStepChange} flashIds={flashIds} />
        <div className="split-builder-main">
          <section className="split-builder-step" aria-labelledby="split-step-heading">
            <div className="split-builder-step-heading">
              <p className="eyebrow">Step {currentRow.number} of {rows.length}</p>
              <h2 id="split-step-heading" ref={headingRef} tabIndex={-1}>{currentRow.label}</h2>
              <p className="split-section-intro">{STEP_INTRO[step]}</p>
            </div>
            {notices.length > 0 ? (
              <div className="split-repair-notice" role="status">
                {notices.map((notice, index) => (
                  <p key={`${notice.groupId}-${notice.removedOptionId}-${index}`}>
                    Removed a previous selection — {notice.reason}
                  </p>
                ))}
              </div>
            ) : null}
            {stepContent[step]}
            {statusSlot}
          </section>
          <div className="split-builder-footer">
            <button type="button" className="split-builder-back" onClick={() => previous && onStepChange(previous)} disabled={!previous}>
              ← Back
            </button>
            {next ? (
              <button type="button" className="level1-generate split-builder-next" onClick={() => onStepChange(next)}>
                Next: {nextLabel} →
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
