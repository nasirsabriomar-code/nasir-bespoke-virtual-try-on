"use client";

/* eslint-disable @next/next/no-img-element -- private asset routes must be requested directly with the session cookie. */

import { useState } from "react";

type HistoryEvent = {
  id: string;
  occurredAt: string;
  username: string;
  status: "success" | "failed";
  device: {
    kind: "phone" | "tablet" | "desktop" | "unknown";
    browser: string;
    operatingSystem: string;
  };
  durationMs: number;
  provider: string;
  model: string;
  quality: string;
  generation?: {
    mode: "catalog" | "outfit";
    upperGarmentName?: string;
    lowerGarmentName?: string;
    garmentSubtypeName?: string;
    upperStyleName?: string;
    lowerStyleName?: string;
    turbanStyleName?: string;
    shoeStyleName?: string;
    turbanName?: string;
    shoeName?: string;
    outfitSpecification?: {
      garment: { name: string; subtypeName?: string };
      configuration: { selectedOptions: Array<{ groupId: string; groupName: string; section: string; optionId: string; optionName: string }> };
    };
  };
  assets?: {
    result?: { pathname: string; contentType: string };
    person?: { pathname: string; contentType: string };
    outfit?: { pathname: string; contentType: string };
    fabric?: { pathname: string; contentType: string };
    upper?: { pathname: string; contentType: string };
    lower?: { pathname: string; contentType: string };
    subtype?: { pathname: string; contentType: string };
    turban?: { pathname: string; contentType: string };
    shoes?: { pathname: string; contentType: string };
    "upper-style"?: { pathname: string; contentType: string };
    "lower-style"?: { pathname: string; contentType: string };
    "turban-style"?: { pathname: string; contentType: string };
    "shoe-style"?: { pathname: string; contentType: string };
    "bespoke-detail-1"?: { pathname: string; contentType: string };
    "bespoke-detail-2"?: { pathname: string; contentType: string };
  };
};

type HistoryResponse = {
  events: HistoryEvent[];
  total: number;
  retained: number;
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatDevice(event: HistoryEvent) {
  const kind = event.device.kind.charAt(0).toUpperCase() + event.device.kind.slice(1);
  return `${kind} · ${event.device.browser} · ${event.device.operatingSystem}`;
}

function formatLook(event: HistoryEvent) {
  if (!event.generation) return "Legacy generation";
  if (event.generation.mode === "outfit") return "Uploaded outfit + uploaded fabric";
  if (event.generation.outfitSpecification) return `${event.generation.outfitSpecification.garment.subtypeName ?? event.generation.outfitSpecification.garment.name} · Bespoke configuration`;
  return [
    event.generation.upperGarmentName,
    event.generation.garmentSubtypeName,
    event.generation.upperStyleName,
    event.generation.lowerGarmentName,
    event.generation.lowerStyleName,
    event.generation.turbanName ? `${event.generation.turbanName} turban` : "",
    event.generation.turbanStyleName,
    event.generation.shoeName ? `${event.generation.shoeName} shoes` : "",
    event.generation.shoeStyleName,
  ].filter(Boolean).join(" · ");
}

export function UsageHistory() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<HistoryEvent | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function openHistory() {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    if (!nextOpen || history || isLoading) return;

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/history?limit=100", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (response.status === 401) {
        window.location.replace("/login");
        return;
      }
      const payload = (await response.json().catch(() => ({}))) as Partial<HistoryResponse> & {
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || "Usage history is unavailable.");
      setHistory({
        events: Array.isArray(payload.events) ? payload.events as HistoryEvent[] : [],
        total: typeof payload.total === "number" ? payload.total : 0,
        retained: typeof payload.retained === "number" ? payload.retained : 1_000,
      });
    } catch (historyError) {
      setError(
        historyError instanceof Error
          ? historyError.message
          : "Usage history is unavailable. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="history-control">
      <button type="button" className="history-button" onClick={openHistory} aria-expanded={isOpen}>
        History
      </button>

      {isOpen ? (
        <>
          <button
            type="button"
            className="history-backdrop"
            onClick={() => setIsOpen(false)}
            aria-label="Close history"
          />
          <section className="history-panel" aria-label="Try-on usage history">
            <div className="history-panel-header">
              <div>
                <p className="history-eyebrow">ACTIVITY LOG</p>
                <h2>Try-On History</h2>
              </div>
              <button type="button" className="history-close" onClick={() => setIsOpen(false)} aria-label="Close history">
                ×
              </button>
            </div>

            <p className="history-note">
              Configuration and audit metadata are shown here. Visual thumbnails appear only when private image storage is enabled. Times use your device&apos;s local timezone.
            </p>

            {isLoading ? <p className="history-status">Loading activity…</p> : null}
            {error ? <p className="history-status history-status-error" role="alert">{error}</p> : null}

            {history && !isLoading ? (
              <>
                <div className="history-summary">
                  <strong>{history.total}</strong>
                  <span>recorded uses · latest {Math.min(history.events.length, history.retained)} shown</span>
                </div>
                {history.events.length ? (
                  <div className="history-table-wrap">
                    <table className="history-table">
                      <thead>
                        <tr><th>Preview</th><th>When</th><th>Look</th><th>Account</th><th>Device</th><th>Model</th><th>Result</th><th>Time</th></tr>
                      </thead>
                      <tbody>
                        {history.events.map((event) => (
                          <tr key={event.id}>
                            <td data-label="Preview">
                              {event.assets?.result ? (
                                <button type="button" className="history-thumbnail-button" onClick={() => setSelectedEvent(event)} aria-label={`Open details for ${formatLook(event)}`}>
                                  <img className="history-thumbnail" src={`/api/history/${encodeURIComponent(event.id)}/asset/result`} alt={`${formatLook(event)} generated result`} loading="lazy" />
                                </button>
                              ) : <span className="history-legacy-label">Metadata only</span>}
                            </td>
                            <td data-label="When">{formatDate(event.occurredAt)}</td>
                            <td data-label="Look">{formatLook(event)}</td>
                            <td data-label="Account">{event.username}</td>
                            <td data-label="Device">{formatDevice(event)}</td>
                            <td data-label="Model">{event.model} · {event.quality}</td>
                            <td data-label="Result">
                              <span className={`history-result is-${event.status}`}>
                                {event.status === "success" ? "Completed" : "Failed"}
                              </span>
                            </td>
                            <td data-label="Time">{event.durationMs > 0 ? `${Math.round(event.durationMs / 1000)}s` : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="history-status">No try-on uses have been recorded yet.</p>
                )}
                {selectedEvent ? (
                  <section className="generation-details" aria-label="Generation details">
                    <div className="generation-details-header">
                      <div><p className="history-eyebrow">GENERATION DETAILS</p><h3>{formatLook(selectedEvent)}</h3></div>
                      <button type="button" className="history-close" onClick={() => setSelectedEvent(null)} aria-label="Close generation details">×</button>
                    </div>
                    <div className="generation-details-grid">
                      {["person", "outfit", "fabric", "upper", "subtype", "lower", "turban", "shoes", "upper-style", "lower-style", "turban-style", "shoe-style", "bespoke-detail-1", "bespoke-detail-2", "result"].map((asset) => selectedEvent.assets?.[asset as keyof NonNullable<HistoryEvent["assets"]>] ? (
                        <figure key={asset}>
                          <img src={`/api/history/${encodeURIComponent(selectedEvent.id)}/asset/${asset}`} alt={asset === "person" ? "Customer photo" : asset === "outfit" ? "Outfit style photo" : asset === "fabric" ? "Fabric photo" : "Generated men's try-on result"} loading="lazy" />
                          <figcaption>{asset === "person" ? "Customer" : asset === "outfit" ? "Outfit photo" : asset === "fabric" ? "Fabric" : asset === "upper" ? "Upper blueprint" : asset === "lower" ? "Lower blueprint" : asset === "subtype" ? "Suit subtype" : asset === "upper-style" ? "Upper style" : asset === "lower-style" ? "Lower style" : asset === "turban" ? "Turban" : asset === "turban-style" ? "Turban style" : asset === "shoes" ? "Shoes" : asset === "shoe-style" ? "Shoe style" : asset.startsWith("bespoke-detail") ? "Bespoke visual reference" : "Final result"}</figcaption>
                        </figure>
                      ) : null)}
                    </div>
                    {selectedEvent.generation?.outfitSpecification ? (
                      <section className="generation-specification" aria-label="Saved outfit specification">
                        <p className="history-eyebrow">SAVED OUTFIT SPECIFICATION</p>
                        <h4>{selectedEvent.generation.outfitSpecification.garment.subtypeName ?? selectedEvent.generation.outfitSpecification.garment.name}</h4>
                        <div>{selectedEvent.generation.outfitSpecification.configuration.selectedOptions.map((option) => <span key={option.groupId}><b>{option.groupName}:</b> {option.optionName}</span>)}</div>
                      </section>
                    ) : null}
                    <p className="generation-details-meta">{formatDate(selectedEvent.occurredAt)} · {formatDevice(selectedEvent)} · {selectedEvent.durationMs > 0 ? `${Math.round(selectedEvent.durationMs / 1000)}s` : "—"}</p>
                    {selectedEvent.assets?.result ? <a className="generation-details-download" href={`/api/history/${encodeURIComponent(selectedEvent.id)}/asset/result`} download="nasir-bespoke-try-on.jpg">Download result</a> : null}
                  </section>
                ) : null}
              </>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  );
}
