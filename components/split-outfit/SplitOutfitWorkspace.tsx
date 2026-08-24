"use client";

import { useMemo } from "react";
import { SUIT_UPPER_OPTIONS } from "@/lib/split-outfit/catalogue";
import {
  buildSplitOutfitSummary,
  evaluateOptionCompatibility,
  getVisibleAccessoryOptions,
  getVisibleFootwearOptions,
  getVisibleLowerOptions,
  getVisibleShirtOptions,
  getVisibleWaistcoatOptions,
  getWaistcoatRequirement,
  sanitizeSplitOutfitState,
} from "@/lib/split-outfit/compatibility";
import type { SplitOutfitState, WaistcoatRequirement } from "@/lib/split-outfit/types";
import type { SignatureLookProvenance } from "@/lib/showroom/types";
import { SplitComponentCard } from "./SplitComponentCard";
import { SplitMaterialsSection } from "./SplitMaterialsSection";
import { SplitOutfitReview } from "./SplitOutfitReview";

type SplitOutfitWorkspaceProps = {
  state: SplitOutfitState;
  onChange: (updater: (prev: SplitOutfitState) => SplitOutfitState) => void;
  /** Safe, non-fabricated Look provenance — surfaced read-only in the review section. */
  provenance?: SignatureLookProvenance;
  customizedFromLook?: boolean;
};

const WAISTCOAT_REQUIREMENT_LABEL: Record<WaistcoatRequirement, string> = {
  REQUIRED: "Required",
  OPTIONAL: "Optional",
  CONDITIONAL: "Conditional",
  UNAVAILABLE: "Unavailable",
};

export function SplitOutfitWorkspace({ state, onChange, provenance, customizedFromLook }: SplitOutfitWorkspaceProps) {
  const summary = useMemo(() => buildSplitOutfitSummary(state), [state]);
  const visibleLowers = useMemo(() => getVisibleLowerOptions(state), [state]);
  const visibleShirts = useMemo(() => getVisibleShirtOptions(state), [state]);
  const visibleWaistcoats = useMemo(() => getVisibleWaistcoatOptions(state), [state]);
  const visibleFootwear = useMemo(() => getVisibleFootwearOptions(state), [state]);
  const visibleAccessories = useMemo(() => getVisibleAccessoryOptions(state), [state]);
  const waistcoatRequirement = useMemo(() => getWaistcoatRequirement(state), [state]);

  // Every mutation is routed through the compatibility engine so a selection
  // that becomes invalid when the upper design changes is cleared immediately
  // rather than lingering as hidden, stale state.
  const updateState = (updater: (prev: SplitOutfitState) => SplitOutfitState) => {
    onChange((prev) => sanitizeSplitOutfitState(updater(prev)));
  };

  const toggleAccessory = (id: string) => {
    updateState((prev) => {
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
                onSelect={() => updateState((prev) => ({ ...prev, upperId: option.id }))}
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
          {visibleLowers.map((option) => {
            const status = evaluateOptionCompatibility(option, state);
            return (
              <SplitComponentCard
                key={option.id}
                option={option}
                selected={state.lowerId === option.id}
                onSelect={() => updateState((prev) => ({ ...prev, lowerId: option.id }))}
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
              {visibleShirts.map((option) => {
                const status = evaluateOptionCompatibility(option, state);
                return (
                  <SplitComponentCard
                    key={option.id}
                    option={option}
                    selected={state.shirtId === option.id}
                    onSelect={() => updateState((prev) => ({ ...prev, shirtId: option.id }))}
                    compatibilityStatus={status}
                  />
                );
              })}
            </div>
          </div>

          {/* Sub-section: Waistcoat — hidden entirely when the current upper
              design does not offer one (e.g. Double-Breasted). */}
          {waistcoatRequirement !== "UNAVAILABLE" ? (
            <div className="split-subsection">
              <h3 className="split-subsection-title">
                Waistcoat
                <span className={`split-requirement-tag is-${waistcoatRequirement.toLowerCase()}`}>
                  {WAISTCOAT_REQUIREMENT_LABEL[waistcoatRequirement]}
                </span>
              </h3>
              <div className="split-cards-grid">
                {visibleWaistcoats.map((option) => {
                  const status = evaluateOptionCompatibility(option, state);
                  return (
                    <SplitComponentCard
                      key={option.id}
                      option={option}
                      selected={state.waistcoatId === option.id}
                      onSelect={() => updateState((prev) => ({ ...prev, waistcoatId: option.id }))}
                      compatibilityStatus={status}
                    />
                  );
                })}
              </div>
            </div>
          ) : null}
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
          {visibleFootwear.map((option) => {
            const status = evaluateOptionCompatibility(option, state);
            return (
              <SplitComponentCard
                key={option.id}
                option={option}
                selected={state.footwearId === option.id}
                onSelect={() => updateState((prev) => ({ ...prev, footwearId: option.id }))}
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
          {visibleAccessories.map((option) => {
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
      <SplitMaterialsSection
        slots={summary.activeMaterialSlots}
        linkGroups={summary.materialLinkGroups}
        materialGroups={summary.materialGroups}
        materialUploads={state.materialUploads ?? {}}
        onUploadMaterial={(groupId, file) => {
          updateState((prev) => {
            const nextUploads = { ...(prev.materialUploads ?? {}) };
            if (file) nextUploads[groupId] = file;
            else delete nextUploads[groupId];
            return { ...prev, materialUploads: nextUploads };
          });
        }}
      />

      {/* 07 — YOUR OUTFIT */}
      <SplitOutfitReview summary={summary} provenance={provenance} customizedFromLook={customizedFromLook} />
    </div>
  );
}
