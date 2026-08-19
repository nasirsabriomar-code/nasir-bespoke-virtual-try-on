"use client";

import { useEffect, useState } from "react";
import { SIGNATURE_LOOK_LIBRARY } from "@/lib/showroom/look-library";
import type { Customer, MeasurementProfile, SavedOutfit, ShowroomSession } from "@/lib/customer/types";

type CustomerProfileProps = {
  customer: Customer;
  onStartSession: (session: ShowroomSession) => void;
  onBack: () => void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
function readResponseError(payload: unknown, fallback: string) {
  return isRecord(payload) && typeof payload.error === "string" ? payload.error : fallback;
}

function outfitLookLabel(outfit: SavedOutfit): string {
  if (outfit.sourceType === "manual" || !outfit.sourceLookId) return "Custom Build";
  return SIGNATURE_LOOK_LIBRARY.find((look) => look.id === outfit.sourceLookId)?.name ?? "Signature Look";
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long" });
  } catch {
    return iso;
  }
}

export function CustomerProfile({ customer, onStartSession, onBack }: CustomerProfileProps) {
  const [measurements, setMeasurements] = useState<MeasurementProfile[] | null>(null);
  const [outfits, setOutfits] = useState<SavedOutfit[] | null>(null);
  const [sessions, setSessions] = useState<ShowroomSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStartingSession, setIsStartingSession] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadAll() {
      setError(null);
      try {
        const [measurementsResponse, outfitsResponse, sessionsResponse] = await Promise.all([
          fetch(`/api/customers/${customer.id}/measurements`, { credentials: "same-origin" }),
          fetch(`/api/customers/${customer.id}/outfits`, { credentials: "same-origin" }),
          fetch(`/api/customers/${customer.id}/sessions`, { credentials: "same-origin" }),
        ]);
        if (!active) return;

        if (!measurementsResponse.ok) {
          const payload: unknown = await measurementsResponse.json().catch(() => ({}));
          throw new Error(readResponseError(payload, "We couldn't load measurements."));
        }
        const measurementsPayload: unknown = await measurementsResponse.json();
        setMeasurements(isRecord(measurementsPayload) && Array.isArray(measurementsPayload.history) ? (measurementsPayload.history as MeasurementProfile[]) : []);

        const outfitsPayload: unknown = await outfitsResponse.json();
        setOutfits(isRecord(outfitsPayload) && Array.isArray(outfitsPayload.outfits) ? (outfitsPayload.outfits as SavedOutfit[]) : []);

        const sessionsPayload: unknown = await sessionsResponse.json();
        setSessions(isRecord(sessionsPayload) && Array.isArray(sessionsPayload.sessions) ? (sessionsPayload.sessions as ShowroomSession[]) : []);
      } catch (loadError: unknown) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "We couldn't load this customer's history.");
      }
    }

    void loadAll();
    return () => {
      active = false;
    };
  }, [customer.id]);

  async function startSession() {
    setIsStartingSession(true);
    setError(null);
    try {
      const response = await fetch(`/api/customers/${customer.id}/sessions`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const payload: unknown = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(readResponseError(payload, "We couldn't start a showroom session."));
      onStartSession(payload as ShowroomSession);
    } catch (sessionError: unknown) {
      setError(sessionError instanceof Error ? sessionError.message : "We couldn't start a showroom session.");
    } finally {
      setIsStartingSession(false);
    }
  }

  const preferenceChips = [
    ...customer.preferences.preferredStyles,
    ...customer.preferences.preferredColours,
    ...(customer.preferences.preferredFit ? [customer.preferences.preferredFit] : []),
  ];

  return (
    <section className="customer-profile" aria-label={`Customer profile for ${customer.name}`}>
      <div className="level1-step-heading">
        <span aria-hidden="true">✦</span>
        <div>
          <p className="eyebrow">Customer Profile</p>
          <h2>{customer.name}</h2>
        </div>
      </div>

      {error ? <p className="form-error" role="alert">{error}</p> : null}

      <div className="customer-profile-grid">
        <div className="customer-profile-card">
          <span className="customer-profile-card-label">Preferences</span>
          {preferenceChips.length > 0 ? (
            <div className="customer-chip-row">
              {preferenceChips.map((chip) => (
                <span key={chip} className="customer-chip">{chip}</span>
              ))}
            </div>
          ) : (
            <p className="customer-profile-empty">No preferences recorded yet.</p>
          )}
        </div>

        <div className="customer-profile-card">
          <span className="customer-profile-card-label">Latest Measurements</span>
          {measurements === null ? (
            <p className="customer-profile-empty">Loading…</p>
          ) : measurements.length > 0 ? (
            <p className="customer-profile-value">{formatDate(measurements[0].createdAt)} — v{measurements[0].version}</p>
          ) : (
            <p className="customer-profile-empty">No measurements recorded yet.</p>
          )}
        </div>

        <div className="customer-profile-card">
          <span className="customer-profile-card-label">Previous Looks</span>
          {outfits === null ? (
            <p className="customer-profile-empty">Loading…</p>
          ) : outfits.length > 0 ? (
            <ul className="customer-list">
              {outfits.slice(0, 5).map((outfit) => (
                <li key={outfit.id}>{outfitLookLabel(outfit)} — {formatDate(outfit.createdAt)}</li>
              ))}
            </ul>
          ) : (
            <p className="customer-profile-empty">No saved outfits yet.</p>
          )}
        </div>

        <div className="customer-profile-card">
          <span className="customer-profile-card-label">Previous Showroom Sessions</span>
          {sessions === null ? (
            <p className="customer-profile-empty">Loading…</p>
          ) : sessions.length > 0 ? (
            <ul className="customer-list">
              {sessions.slice(0, 5).map((session) => (
                <li key={session.id}>{session.status} — {formatDate(session.createdAt)}</li>
              ))}
            </ul>
          ) : (
            <p className="customer-profile-empty">No previous sessions yet.</p>
          )}
        </div>
      </div>

      <div className="customer-profile-actions">
        <button type="button" className="showroom-link-button" onClick={onBack}>
          Back to search
        </button>
        <button type="button" className="showroom-cta-button" onClick={() => void startSession()} disabled={isStartingSession}>
          {isStartingSession ? "Starting…" : "Start Showroom Session"}
        </button>
      </div>
    </section>
  );
}
