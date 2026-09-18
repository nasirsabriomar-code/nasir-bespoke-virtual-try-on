"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildSummaryFromView,
  optionsFor,
  reconcile,
} from "@/lib/split-outfit/client-engine";
import type { RepairNotice } from "@/lib/rules/types";
import { SPLIT_OUTFIT_FAMILIES } from "@/lib/split-outfit/types";
import type { SplitCatalogueView, SplitOutfitFamily, SplitOutfitState } from "@/lib/split-outfit/types";
import { SplitComponentCard } from "./SplitComponentCard";
import { SplitMaterialsSection } from "./SplitMaterialsSection";
import { SplitOutfitReview } from "./SplitOutfitReview";

type SplitOutfitWorkspaceProps = {
  state: SplitOutfitState;
  onChange: (updater: (prev: SplitOutfitState) => SplitOutfitState) => void;
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

export function SplitOutfitWorkspace({ state, onChange }: SplitOutfitWorkspaceProps) {
  const [view, setView] = useState<SplitCatalogueView | null>(null);
  const [viewError, setViewError] = useState<string | null>(null);
  const [notices, setNotices] = useState<RepairNotice[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/split-catalog?family=${encodeURIComponent(state.family)}`, { cache: "no-store" })
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
    return () => { cancelled = true; };
  }, [state.family]);

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
          onClick={() => selectFamily(family)}
        >
          {FAMILY_LABELS[family]}
        </button>
      ))}
    </div>
  );

  if (viewError) {
    return (
      <div className="split-outfit-workspace" aria-label="Split Outfit Customization Workspace">
        {familySelector}
        <p className="split-workspace-status" role="alert">{viewError}</p>
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

  return (
    <div className="split-outfit-workspace" aria-label="Split Outfit Customization Workspace">
      {familySelector}

      {/* 01 — UPPER GARMENT */}
      <section className="level1-flow" aria-label="Upper Garment Selection">
        <div className="level1-step-heading">
          <span>01</span>
          <div>
            <p className="eyebrow">Upper Garment · {FAMILY_LABELS[state.family]} Family</p>
            <h2>Jacket silhouette & cut</h2>
          </div>
        </div>

        <div className="split-cards-grid">
          {optionsFor(view, state, "upper")
            .filter(({ verdict }) => verdict.status !== "incompatible")
            .map(({ option, verdict }) => (
              <SplitComponentCard
                key={option.id}
                option={option}
                selected={state.upperId === option.id}
                onSelect={() => applyChange((prev) => ({ ...prev, upperId: option.id }))}
                verdict={verdict}
              />
            ))}
        </div>
      </section>

      {/* 02 — LOWER GARMENT */}
      <section className="level1-flow" aria-label="Lower Garment Selection">
        <div className="level1-step-heading">
          <span>02</span>
          <div>
            <p className="eyebrow">Lower Garment · Trousers</p>
            <h2>Trouser drape & rise</h2>
          </div>
        </div>

        <div className="split-cards-grid">
          {optionsFor(view, state, "lower")
            .filter(({ verdict }) => verdict.status !== "incompatible")
            .map(({ option, verdict }) => (
              <SplitComponentCard
                key={option.id}
                option={option}
                selected={state.lowerId === option.id}
                onSelect={() => applyChange((prev) => ({ ...prev, lowerId: option.id }))}
                verdict={verdict}
              />
            ))}
        </div>
      </section>

      {/* 03 — INNER / EXTRA */}
      <section className="level1-flow" aria-label="Inner Garments and Waistcoat Selection">
        <div className="level1-step-heading">
          <span>03</span>
          <div>
            <p className="eyebrow">Inner Layer & Extra</p>
            <h2>Dress shirt & waistcoat</h2>
          </div>
        </div>

        <div className="split-inner-group">
          {/* Sub-section: Shirt */}
          <div className="split-subsection">
            <h3 className="split-subsection-title">Dress Shirt</h3>
            <div className="split-cards-grid">
              {optionsFor(view, state, "inner-shirt")
                .filter(({ verdict }) => verdict.status !== "incompatible")
                .map(({ option, verdict }) => (
                  <SplitComponentCard
                    key={option.id}
                    option={option}
                    selected={state.shirtId === option.id}
                    onSelect={() => applyChange((prev) => ({ ...prev, shirtId: option.id }))}
                    verdict={verdict}
                  />
                ))}
            </div>
          </div>

          {/* Sub-section: Waistcoat */}
          <div className="split-subsection">
            <h3 className="split-subsection-title">Waistcoat (Optional Layer)</h3>
            <div className="split-cards-grid">
              {optionsFor(view, state, "inner-waistcoat")
                .filter(({ verdict }) => verdict.status !== "incompatible")
                .map(({ option, verdict }) => (
                  <SplitComponentCard
                    key={option.id}
                    option={option}
                    selected={state.waistcoatId === option.id}
                    onSelect={() => applyChange((prev) => ({ ...prev, waistcoatId: option.id }))}
                    verdict={verdict}
                  />
                ))}
            </div>
          </div>
        </div>
      </section>

      {/* 04 — FOOTWEAR */}
      <section className="level1-flow" aria-label="Footwear Selection">
        <div className="level1-step-heading">
          <span>04</span>
          <div>
            <p className="eyebrow">Footwear</p>
            <h2>Bespoke dress shoes</h2>
          </div>
        </div>

        <div className="split-cards-grid">
          {optionsFor(view, state, "footwear")
            .filter(({ verdict }) => verdict.status !== "incompatible")
            .map(({ option, verdict }) => (
              <SplitComponentCard
                key={option.id}
                option={option}
                selected={state.footwearId === option.id}
                onSelect={() => applyChange((prev) => ({ ...prev, footwearId: option.id }))}
                verdict={verdict}
              />
            ))}
        </div>
      </section>

      {/* 05 — ACCESSORIES (MULTI-SELECT) */}
      <section className="level1-flow" aria-label="Accessories Selection (Multi-Select)">
        <div className="level1-step-heading">
          <span>05</span>
          <div>
            <p className="eyebrow">Accessories · Multi-Select</p>
            <h2>Finishing accents & details</h2>
          </div>
        </div>

        <p className="split-section-intro">
          Select one or more bespoke accessories to complete the look. You can toggle each piece individually.
        </p>

        <div className="split-cards-grid">
          {optionsFor(view, state, "accessory")
            .filter(({ verdict }) => verdict.status !== "incompatible")
            .map(({ option, verdict }) => (
              <SplitComponentCard
                key={option.id}
                option={option}
                selected={state.accessoryIds.includes(option.id)}
                onSelect={() => toggleAccessory(option.id)}
                verdict={verdict}
                isMultiSelect={true}
              />
            ))}
        </div>
      </section>

      {notices.length > 0 ? (
        <div className="split-repair-notice" role="status">
          {notices.map((notice, index) => (
            <p key={`${notice.groupId}-${notice.removedOptionId}-${index}`}>
              Removed a previous selection — {notice.reason}
            </p>
          ))}
        </div>
      ) : null}

      {/* 06 — FABRICS & MATERIALS */}
      <SplitMaterialsSection slots={summary.activeMaterialSlots} />

      {/* 07 — YOUR OUTFIT */}
      <SplitOutfitReview summary={summary} />
    </div>
  );
}
