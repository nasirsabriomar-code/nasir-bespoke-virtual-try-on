"use client";

import { useRef } from "react";
import type { CanonicalMaterialGroup, MaterialSlotId, MaterialSlotState } from "@/lib/split-outfit/types";

type SplitMaterialsSectionProps = {
  slots: MaterialSlotState[];
  // Default fabric-linking groups for the current upper design (e.g. Jacket +
  // Trouser, or Jacket + Trouser + Waistcoat for Three-Piece). Architecture
  // only for now — does not drive multi-fabric image generation yet.
  linkGroups?: MaterialSlotId[][];
  // Canonical upload-required material groups for the current recipe — the
  // SAME groups the server independently recomputes and validates against
  // (see getCanonicalMaterialGroups in lib/split-outfit/compatibility.ts).
  materialGroups?: CanonicalMaterialGroup[];
  materialUploads?: Record<string, File>;
  onUploadMaterial?: (groupId: string, file: File | null) => void;
};

// Static fallback labels for a linked slot whose component isn't selected
// yet (so it has no entry in `slots`) — otherwise the raw internal slot ID
// (e.g. "trouser-primary") would leak into the linking copy.
const MATERIAL_SLOT_FALLBACK_LABELS: Record<MaterialSlotId, string> = {
  "jacket-primary": "Jacket Body & Facing",
  "trouser-primary": "Trouser Fabric",
  "shirt-material": "Shirt Weave",
  "waistcoat-material": "Waistcoat Fabric",
  "neckwear-material": "Neckwear Silk",
  "pocket-square-material": "Pocket Square Fabric",
  "cufflinks-finish": "Cufflinks Finish",
  "buttons-finish": "Button Finish",
  "footwear-leather": "Footwear Leather",
};

export function SplitMaterialsSection({
  slots,
  linkGroups = [],
  materialGroups = [],
  materialUploads = {},
  onUploadMaterial,
}: SplitMaterialsSectionProps) {
  const labelFor = (slotId: MaterialSlotId) =>
    slots.find((slot) => slot.slotId === slotId)?.label ?? MATERIAL_SLOT_FALLBACK_LABELS[slotId] ?? slotId;
  const visibleLinkGroups = linkGroups.filter((group) => group.length > 1);
  const groupForSlot = (slotId: MaterialSlotId) =>
    materialGroups.find((group) => group.slotIds.includes(slotId));
  return (
    <section className="level1-flow" aria-label="Fabrics and Materials Configuration">
      <div className="level1-step-heading">
        <span>06</span>
        <div>
          <p className="eyebrow">Materials & Craft</p>
          <h2>Fabrics & materials</h2>
        </div>
      </div>

      <p className="split-section-intro">
        Material assignments dynamically adjust according to your selected suit pieces. In Phase 1, primary suit components map directly to your uploaded fabric reference.
      </p>

      {visibleLinkGroups.length > 0 ? (
        <ul className="split-material-link-groups" aria-label="Default fabric linking groups">
          {visibleLinkGroups.map((group, i) => (
            <li key={i} className="split-material-link-group">
              Linked by default: {group.map(labelFor).join(" + ")}
            </li>
          ))}
        </ul>
      ) : null}

      {materialGroups.length > 0 ? (
        <div className="split-material-uploads" aria-label="Upload fabric swatches">
          {materialGroups.map((group) => (
            <MaterialSwatchUpload
              key={group.groupId}
              group={group}
              file={materialUploads[group.groupId] ?? null}
              onChange={onUploadMaterial}
            />
          ))}
        </div>
      ) : null}

      <div className="split-materials-grid">
        {slots.map((slot) => {
          const isUploadedFabric = slot.fabricSource === "uploaded-fabric";
          const group = isUploadedFabric ? groupForSlot(slot.slotId) : undefined;
          const hasUpload = Boolean(group && materialUploads[group.groupId]);

          return (
            <div key={slot.slotId} className="split-material-card">
              <div className="split-material-header">
                <div className="split-material-title-group">
                  <span className="split-material-badge">{slot.componentName}</span>
                  <h4 className="split-material-label">{slot.label}</h4>
                </div>
                <span
                  className={`split-material-source-tag ${
                    isUploadedFabric ? "is-uploaded" : "is-standard"
                  }`}
                >
                  {isUploadedFabric ? "Uploaded Fabric" : "Atelier Material"}
                </span>
              </div>

              <p className="split-material-desc">{slot.description}</p>

              <div className="split-material-control-row">
                <span className="split-material-source-indicator">
                  <span
                    className={`split-material-dot ${isUploadedFabric ? "is-active" : ""}`}
                    aria-hidden="true"
                  />
                  {isUploadedFabric
                    ? hasUpload
                      ? "Swatch photo uploaded"
                      : "Assigned to uploaded fabric sample — awaiting upload"
                    : "Curated atelier complementary material"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

type MaterialSwatchUploadProps = {
  group: CanonicalMaterialGroup;
  file: File | null;
  onChange?: (groupId: string, file: File | null) => void;
};

// One upload control per CANONICAL GROUP (not per slot) — a linked group
// like "jacket-primary+trouser-primary" shares exactly one uploaded swatch,
// never one file per slot within it. `inputId` and the field name this
// eventually maps to on the wire both derive from `group.groupId`, so the
// client and the server-recomputed expected group set can never disagree
// about which upload governs which component set.
function MaterialSwatchUpload({ group, file, onChange }: MaterialSwatchUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const inputId = `split-material-upload-${group.groupId}`;

  return (
    <div className="split-material-upload-card">
      <div className="split-material-upload-header">
        <span className="split-material-upload-label">{group.label}</span>
        {file ? <span className="split-material-upload-filename">{file.name}</span> : null}
      </div>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="split-material-upload-input"
        onChange={(event) => {
          const selected = event.target.files?.[0] ?? null;
          onChange?.(group.groupId, selected);
        }}
      />
      <div className="split-material-upload-actions">
        <label htmlFor={inputId} className="split-material-upload-button">
          {file ? "Replace swatch photo" : "Upload swatch photo"}
        </label>
        {file ? (
          <button
            type="button"
            className="split-material-upload-clear"
            onClick={() => {
              if (inputRef.current) inputRef.current.value = "";
              onChange?.(group.groupId, null);
            }}
          >
            Remove
          </button>
        ) : null}
      </div>
    </div>
  );
}
