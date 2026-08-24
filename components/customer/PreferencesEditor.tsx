"use client";

import { useState } from "react";
import { SHOWROOM_OCCASION_VALUES, STYLE_PERSONALITY_VALUES } from "@/lib/showroom/types";
import type { ShowroomOccasion, StylePersonality } from "@/lib/showroom/types";
import { CUSTOMER_PREFERRED_COLOUR_VALUES, CUSTOMER_PREFERRED_FIT_VALUES } from "@/lib/customer/types";
import type { Customer, CustomerPreferences, CustomerPreferredColour, CustomerPreferredFit } from "@/lib/customer/types";

type PreferencesEditorProps = {
  customer: Customer;
  onSaved: (updated: Customer) => void;
  onCancel: () => void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
function readResponseError(payload: unknown, fallback: string) {
  return isRecord(payload) && typeof payload.error === "string" ? payload.error : fallback;
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
}

/**
 * Structured preference editing — every value comes from a closed set
 * (STYLE_PERSONALITY_VALUES, CUSTOMER_PREFERRED_COLOUR_VALUES,
 * CUSTOMER_PREFERRED_FIT_VALUES, SHOWROOM_OCCASION_VALUES). There is no
 * free-text field anywhere here, and nothing about appearance, ethnicity,
 * age, or personality is ever collected — only what the customer explicitly
 * tells the atelier they prefer.
 */
export function PreferencesEditor({ customer, onSaved, onCancel }: PreferencesEditorProps) {
  const [preferredStyles, setPreferredStyles] = useState<StylePersonality[]>(customer.preferences.preferredStyles);
  const [preferredColours, setPreferredColours] = useState<CustomerPreferredColour[]>(customer.preferences.preferredColours);
  const [preferredFit, setPreferredFit] = useState<CustomerPreferredFit | null>(customer.preferences.preferredFit);
  const [preferredOccasions, setPreferredOccasions] = useState<ShowroomOccasion[]>(customer.preferences.preferredOccasions);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setIsSaving(true);
    setError(null);
    try {
      const preferences: CustomerPreferences = { preferredStyles, preferredColours, preferredFit, preferredOccasions };
      const response = await fetch(`/api/customers/${customer.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences }),
      });
      const payload: unknown = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(readResponseError(payload, "We couldn't save these preferences."));
      onSaved(payload as Customer);
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "We couldn't save these preferences.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="preferences-editor" aria-label="Edit customer preferences">
      {error ? <p className="form-error" role="alert">{error}</p> : null}

      <div className="preferences-editor-group">
        <span className="customer-profile-card-label">Style</span>
        <div className="customer-chip-row">
          {STYLE_PERSONALITY_VALUES.map((style) => (
            <button
              key={style}
              type="button"
              className={`preference-toggle-chip ${preferredStyles.includes(style) ? "is-selected" : ""}`}
              onClick={() => setPreferredStyles((current) => toggle(current, style))}
            >
              {style}
            </button>
          ))}
        </div>
      </div>

      <div className="preferences-editor-group">
        <span className="customer-profile-card-label">Colour</span>
        <div className="customer-chip-row">
          {CUSTOMER_PREFERRED_COLOUR_VALUES.map((colour) => (
            <button
              key={colour}
              type="button"
              className={`preference-toggle-chip ${preferredColours.includes(colour) ? "is-selected" : ""}`}
              onClick={() => setPreferredColours((current) => toggle(current, colour))}
            >
              {colour}
            </button>
          ))}
        </div>
      </div>

      <div className="preferences-editor-group">
        <span className="customer-profile-card-label">Fit</span>
        <div className="customer-chip-row">
          {CUSTOMER_PREFERRED_FIT_VALUES.map((fit) => (
            <button
              key={fit}
              type="button"
              className={`preference-toggle-chip ${preferredFit === fit ? "is-selected" : ""}`}
              onClick={() => setPreferredFit((current) => (current === fit ? null : fit))}
            >
              {fit}
            </button>
          ))}
        </div>
      </div>

      <div className="preferences-editor-group">
        <span className="customer-profile-card-label">Occasions</span>
        <div className="customer-chip-row">
          {SHOWROOM_OCCASION_VALUES.map((occasion) => (
            <button
              key={occasion}
              type="button"
              className={`preference-toggle-chip ${preferredOccasions.includes(occasion) ? "is-selected" : ""}`}
              onClick={() => setPreferredOccasions((current) => toggle(current, occasion))}
            >
              {occasion}
            </button>
          ))}
        </div>
      </div>

      <div className="customer-profile-actions">
        <button type="button" className="showroom-link-button" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="showroom-cta-button" onClick={() => void save()} disabled={isSaving}>
          {isSaving ? "Saving…" : "Save Preferences"}
        </button>
      </div>
    </div>
  );
}
