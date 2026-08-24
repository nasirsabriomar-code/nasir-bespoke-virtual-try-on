"use client";

import { useState } from "react";
import {
  JACKET_MEASUREMENT_FIELDS,
  SHIRT_MEASUREMENT_FIELDS,
  TROUSER_MEASUREMENT_FIELDS,
} from "@/lib/customer/measurement-fields";
import type { MeasurementBlock, MeasurementProfile } from "@/lib/customer/types";

type MeasurementWorkflowProps = {
  customerId: string;
  history: MeasurementProfile[];
  onRecorded: (measurement: MeasurementProfile) => void;
  onCancel: () => void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
function readResponseError(payload: unknown, fallback: string) {
  return isRecord(payload) && typeof payload.error === "string" ? payload.error : fallback;
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return iso;
  }
}

type BlockDraft = Record<string, string>;

function draftToBlock(draft: BlockDraft): MeasurementBlock {
  const block: MeasurementBlock = {};
  for (const [key, raw] of Object.entries(draft)) {
    const value = raw.trim();
    if (value.length === 0) continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) block[key] = parsed;
  }
  return block;
}

function MeasurementFieldGroup({
  title,
  fields,
  draft,
  onChange,
}: {
  title: string;
  fields: readonly string[];
  draft: BlockDraft;
  onChange: (field: string, value: string) => void;
}) {
  return (
    <fieldset className="measurement-field-group">
      <legend>{title}</legend>
      <div className="measurement-field-grid">
        {fields.map((field) => (
          <label key={field} className="measurement-field-label">
            <span>{field}</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              max="200"
              value={draft[field] ?? ""}
              onChange={(event) => onChange(field, event.target.value)}
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Measurements are an append-only history — this form only ever creates the
 * NEXT version (see POST /api/customers/[id]/measurements). There is no
 * edit or delete affordance anywhere in this component; a correction is
 * recorded as a brand-new version, preserving every prior fitting exactly
 * as it was recorded.
 */
export function MeasurementWorkflow({ customerId, history, onRecorded, onCancel }: MeasurementWorkflowProps) {
  const [jacketDraft, setJacketDraft] = useState<BlockDraft>({});
  const [trouserDraft, setTrouserDraft] = useState<BlockDraft>({});
  const [shirtDraft, setShirtDraft] = useState<BlockDraft>({});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFullHistory, setShowFullHistory] = useState(false);

  async function save() {
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/customers/${customerId}/measurements`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jacketMeasurements: draftToBlock(jacketDraft),
          trouserMeasurements: draftToBlock(trouserDraft),
          shirtMeasurements: draftToBlock(shirtDraft),
        }),
      });
      const payload: unknown = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(readResponseError(payload, "We couldn't record this measurement."));
      onRecorded(payload as MeasurementProfile);
      setJacketDraft({});
      setTrouserDraft({});
      setShirtDraft({});
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "We couldn't record this measurement.");
    } finally {
      setIsSaving(false);
    }
  }

  const visibleHistory = showFullHistory ? history : history.slice(0, 1);

  return (
    <div className="measurement-workflow" aria-label="Measurement workflow">
      {error ? <p className="form-error" role="alert">{error}</p> : null}

      <MeasurementFieldGroup
        title="Jacket"
        fields={JACKET_MEASUREMENT_FIELDS}
        draft={jacketDraft}
        onChange={(field, value) => setJacketDraft((current) => ({ ...current, [field]: value }))}
      />
      <MeasurementFieldGroup
        title="Trouser"
        fields={TROUSER_MEASUREMENT_FIELDS}
        draft={trouserDraft}
        onChange={(field, value) => setTrouserDraft((current) => ({ ...current, [field]: value }))}
      />
      <MeasurementFieldGroup
        title="Shirt"
        fields={SHIRT_MEASUREMENT_FIELDS}
        draft={shirtDraft}
        onChange={(field, value) => setShirtDraft((current) => ({ ...current, [field]: value }))}
      />

      <div className="customer-profile-actions">
        <button type="button" className="showroom-link-button" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="showroom-cta-button" onClick={() => void save()} disabled={isSaving}>
          {isSaving ? "Recording…" : "Record New Measurement"}
        </button>
      </div>

      <div className="measurement-history">
        <div className="measurement-history-header">
          <span className="customer-profile-card-label">Measurement History ({history.length} version{history.length === 1 ? "" : "s"})</span>
          {history.length > 1 ? (
            <button type="button" className="showroom-link-button" onClick={() => setShowFullHistory((current) => !current)}>
              {showFullHistory ? "Show latest only" : "View full history"}
            </button>
          ) : null}
        </div>
        {visibleHistory.length === 0 ? (
          <p className="customer-profile-empty">No measurements recorded yet.</p>
        ) : (
          <ul className="measurement-history-list">
            {visibleHistory.map((entry) => (
              <li key={entry.id} className="measurement-history-entry">
                <div className="measurement-history-entry-header">
                  <strong>Version {entry.version}</strong>
                  <span>{formatDateTime(entry.createdAt)} — {entry.recordedBy}</span>
                </div>
                <div className="measurement-history-entry-body">
                  {Object.entries(entry.jacketMeasurements).map(([field, value]) => (
                    <span key={`jacket-${field}`} className="customer-chip">jacket {field}: {value}</span>
                  ))}
                  {Object.entries(entry.trouserMeasurements).map(([field, value]) => (
                    <span key={`trouser-${field}`} className="customer-chip">trouser {field}: {value}</span>
                  ))}
                  {Object.entries(entry.shirtMeasurements).map(([field, value]) => (
                    <span key={`shirt-${field}`} className="customer-chip">shirt {field}: {value}</span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
