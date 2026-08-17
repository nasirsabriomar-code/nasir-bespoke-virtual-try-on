"use client";

import { useMemo } from "react";
import {
  SUIT_ACCESSORY_OPTIONS,
  SUIT_FOOTWEAR_OPTIONS,
  SUIT_LOWER_OPTIONS,
  SUIT_SHIRT_OPTIONS,
  SUIT_UPPER_OPTIONS,
  SUIT_WAISTCOAT_OPTIONS,
} from "@/lib/split-outfit/catalogue";
import {
  buildSplitOutfitSummary,
  evaluateOptionCompatibility,
} from "@/lib/split-outfit/compatibility";
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

  const toggleAccessory = (id: string) => {
    onChange((prev) => {
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
          {SUIT_UPPER_OPTIONS.map((option) => {
            const status = evaluateOptionCompatibility(option, state);
            return (
              <SplitComponentCard
                key={option.id}
                option={option}
                selected={state.upperId === option.id}
                onSelect={() => onChange((prev) => ({ ...prev, upperId: option.id }))}
                compatibilityStatus={status}
              />
            );
          })}
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
          {SUIT_LOWER_OPTIONS.map((option) => {
            const status = evaluateOptionCompatibility(option, state);
            return (
              <SplitComponentCard
                key={option.id}
                option={option}
                selected={state.lowerId === option.id}
                onSelect={() => onChange((prev) => ({ ...prev, lowerId: option.id }))}
                compatibilityStatus={status}
              />
            );
          })}
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
              {SUIT_SHIRT_OPTIONS.map((option) => {
                const status = evaluateOptionCompatibility(option, state);
                return (
                  <SplitComponentCard
                    key={option.id}
                    option={option}
                    selected={state.shirtId === option.id}
                    onSelect={() => onChange((prev) => ({ ...prev, shirtId: option.id }))}
                    compatibilityStatus={status}
                  />
                );
              })}
            </div>
          </div>

          {/* Sub-section: Waistcoat */}
          <div className="split-subsection">
            <h3 className="split-subsection-title">Waistcoat (Optional Layer)</h3>
            <div className="split-cards-grid">
              {SUIT_WAISTCOAT_OPTIONS.map((option) => {
                const status = evaluateOptionCompatibility(option, state);
                return (
                  <SplitComponentCard
                    key={option.id}
                    option={option}
                    selected={state.waistcoatId === option.id}
                    onSelect={() => onChange((prev) => ({ ...prev, waistcoatId: option.id }))}
                    compatibilityStatus={status}
                  />
                );
              })}
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
          {SUIT_FOOTWEAR_OPTIONS.map((option) => {
            const status = evaluateOptionCompatibility(option, state);
            return (
              <SplitComponentCard
                key={option.id}
                option={option}
                selected={state.footwearId === option.id}
                onSelect={() => onChange((prev) => ({ ...prev, footwearId: option.id }))}
                compatibilityStatus={status}
              />
            );
          })}
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
          {SUIT_ACCESSORY_OPTIONS.map((option) => {
            const isSelected = state.accessoryIds.includes(option.id);
            const status = evaluateOptionCompatibility(option, state);
            return (
              <SplitComponentCard
                key={option.id}
                option={option}
                selected={isSelected}
                onSelect={() => toggleAccessory(option.id)}
                compatibilityStatus={status}
                isMultiSelect={true}
              />
            );
          })}
        </div>
      </section>

      {/* 06 — FABRICS & MATERIALS */}
      <SplitMaterialsSection slots={summary.activeMaterialSlots} />

      {/* 07 — YOUR OUTFIT */}
      <SplitOutfitReview summary={summary} />
    </div>
  );
}
