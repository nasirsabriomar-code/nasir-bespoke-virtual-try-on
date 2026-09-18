"use client";

import { useMemo, useState } from "react";
import {
  buildSplitOutfitSummary,
  optionsFor,
  reconcile,
} from "@/lib/split-outfit/compatibility";
import type { RepairNotice } from "@/lib/rules/types";
import type { SplitOutfitState } from "@/lib/split-outfit/types";
import { SplitComponentCard } from "./SplitComponentCard";
import { SplitMaterialsSection } from "./SplitMaterialsSection";
import { SplitOutfitReview } from "./SplitOutfitReview";

type SplitOutfitWorkspaceProps = {
  state: SplitOutfitState;
  onChange: (updater: (prev: SplitOutfitState) => SplitOutfitState) => void;
};

export function SplitOutfitWorkspace({ state, onChange }: SplitOutfitWorkspaceProps) {
  const summary = useMemo(() => buildSplitOutfitSummary(state), [state]);
  const [notices, setNotices] = useState<RepairNotice[]>([]);

  // Every change is followed by a reconcile pass: a change to an upstream
  // slot (e.g. the jacket) can invalidate a downstream selection (e.g. a
  // waistcoat that no longer fits a two-piece jacket) that must be dropped
  // rather than left stale and invisible-but-selected.
  const applyChange = (mutate: (prev: SplitOutfitState) => SplitOutfitState) => {
    onChange((prev) => {
      const proposed = mutate(prev);
      const { state: reconciled, notices: repairNotices } = reconcile(proposed);
      setNotices(repairNotices);
      return reconciled;
    });
  };

  const toggleAccessory = (id: string) => {
    applyChange((prev) => {
      const exists = prev.accessoryIds.includes(id);
      const nextAccessories = exists
        ? prev.accessoryIds.filter((accId) => accId !== id)
        : [...prev.accessoryIds, id];
      return { ...prev, accessoryIds: nextAccessories };
    });
  };

  return (
    <div className="split-outfit-workspace" aria-label="Split Outfit Customization Workspace">
      {/* 01 — UPPER GARMENT */}
      <section className="level1-flow" aria-label="Upper Garment Selection">
        <div className="level1-step-heading">
          <span>01</span>
          <div>
            <p className="eyebrow">Upper Garment · Suit Family</p>
            <h2>Jacket silhouette & cut</h2>
          </div>
        </div>

        <div className="split-cards-grid">
          {optionsFor(state, "upper")
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
          {optionsFor(state, "lower")
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
              {optionsFor(state, "inner-shirt")
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
              {optionsFor(state, "inner-waistcoat")
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
          {optionsFor(state, "footwear")
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
          {optionsFor(state, "accessory")
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
