"use client";

/* eslint-disable @next/next/no-img-element -- private asset routes must be requested directly with the session cookie. */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useModalDialog } from "@/components/hooks/useModalDialog";
import { restoreLookFromGeneration, type RestoredLook } from "@/lib/history/restore-look";
import { GenerationReview } from "@/components/GenerationReview";
import type { GenerationReview as Review } from "@/lib/history/review-types";
import { ZoomableImage } from "@/components/ZoomableImage";

const emptySubscribe = () => () => {};

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
  review?: Review;
  metadata?: { reportedQuality?: string; requestedSize?: string; outputWidth?: number; outputHeight?: number; provenance?: { promptVersion?: string; preprocessingVersion?: string; providerAttempts?: number } };
  generation?: {
    mode: "catalog" | "outfit" | "level1" | "split";
    categoryId?: string;
    categoryName?: string;
    curatedDesignId?: string;
    curatedDesignName?: string;
    curatedVariantId?: string;
    curatedDesignVersion?: number;
    curatedAssetStatus?: "ready" | "awaiting-approved-reference";
    fabricRegion?: "upper" | "lower" | "both" | "custom" | "jacket";
    upperGarmentName?: string;
    lowerGarmentName?: string;
    garmentSubtypeName?: string;
    upperStyleName?: string;
    lowerStyleName?: string;
    turbanStyleName?: string;
    shoeStyleName?: string;
    turbanName?: string;
    shoeName?: string;
    splitFabricSlots?: { jacket: boolean; trousers: boolean; shirt: boolean; waistcoat: boolean };
    splitFamily?: string;
    splitUpperId?: string;
    splitUpperName?: string;
    splitLowerId?: string;
    splitLowerName?: string;
    splitShirtId?: string;
    splitShirtName?: string;
    splitWaistcoatId?: string;
    splitWaistcoatName?: string;
    splitFootwearId?: string;
    splitFootwearName?: string;
    splitAccessoryIds?: string[];
    splitAccessoryNames?: string[];
    outfitSpecification?: {
      garment: { name: string; subtypeName?: string };
      configuration: { selectedOptions: Array<{ groupId: string; groupName: string; section: string; optionId: string; optionName: string }> };
    };
  };
  assets?: {
    result?: { contentType: string };
    person?: { contentType: string };
    outfit?: { contentType: string };
    fabric?: { contentType: string };
    "lower-fabric"?: { contentType: string };
    upper?: { contentType: string };
    lower?: { contentType: string };
    subtype?: { contentType: string };
    turban?: { contentType: string };
    shoes?: { contentType: string };
    "upper-style"?: { contentType: string };
    "lower-style"?: { contentType: string };
    "turban-style"?: { contentType: string };
    "shoe-style"?: { contentType: string };
    "bespoke-detail-1"?: { contentType: string };
    "bespoke-detail-2"?: { contentType: string };
    "curated-design"?: { contentType: string };
    "curated-detail"?: { contentType: string };
    "split-upper"?: { contentType: string };
    "split-lower"?: { contentType: string };
    "split-shirt"?: { contentType: string };
    "split-waistcoat"?: { contentType: string };
    "split-footwear"?: { contentType: string };
    "shirt-fabric"?: { contentType: string };
    "waistcoat-fabric"?: { contentType: string };
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
  if (event.generation.mode === "level1") {
    const version = event.generation.curatedDesignVersion ? ` · Catalogue v${event.generation.curatedDesignVersion}` : "";
    return `${event.generation.categoryName ?? "Curated"} · ${event.generation.curatedDesignName ?? "Design"}${version}`;
  }
  if (event.generation.mode === "split") {
    const pieces = [
      event.generation.splitUpperName,
      event.generation.splitLowerName,
      event.generation.splitShirtName,
      event.generation.splitWaistcoatName,
      ...(event.generation.splitAccessoryNames ?? []),
    ].filter(Boolean);
    const familyLabel = event.generation.splitFamily ? `${event.generation.splitFamily} · ` : "";
    return `${familyLabel}${pieces.join(" · ") || "Modular outfit"}`;
  }
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

type UsageHistoryProps = {
  onRestoreLook?: (look: RestoredLook) => void;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
};

export function UsageHistory({
  onRestoreLook,
  isOpen: controlledOpen,
  onOpenChange,
  hideTrigger = false,
}: UsageHistoryProps = {}) {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  const [favouritesOnly, setFavouritesOnly] = useState(false);
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledOpen ?? internalOpen;
  const setIsOpen = useCallback(
    (next: boolean | ((current: boolean) => boolean)) => {
      const resolved = typeof next === "function" ? next(isOpen) : next;
      if (onOpenChange) onOpenChange(resolved);
      else setInternalOpen(resolved);
    },
    [isOpen, onOpenChange],
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<HistoryEvent | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const detailsBackRef = useRef<HTMLButtonElement | null>(null);
  const thumbnailRef = useRef<HTMLButtonElement | null>(null);
  const listScrollRef = useRef(0);
  const fetchControllerRef = useRef<AbortController | null>(null);

  const handleClose = useCallback(() => {
    if (selectedEvent) {
      setSelectedEvent(null);
    } else {
      setIsOpen(false);
    }
  }, [selectedEvent, setIsOpen]);

  useModalDialog({
    open: isOpen,
    onClose: handleClose,
    dialogRef: panelRef,
    initialFocusRef: selectedEvent ? detailsBackRef : closeButtonRef,
  });

  // Restore scroll position and focus between list and details views
  useEffect(() => {
    if (!isOpen) return;
    if (selectedEvent) {
      if (panelRef.current) panelRef.current.scrollTop = 0;
      detailsBackRef.current?.focus({ preventScroll: true });
    } else {
      if (panelRef.current) panelRef.current.scrollTop = listScrollRef.current;
      (thumbnailRef.current ?? closeButtonRef.current)?.focus({ preventScroll: true });
    }
  }, [isOpen, selectedEvent]);

  // Fetch history whenever the modal opens, aborting any in-flight request on close
  useEffect(() => {
    if (!isOpen) {
      fetchControllerRef.current?.abort();
      fetchControllerRef.current = null;
      return;
    }

    const controller = new AbortController();
    fetchControllerRef.current = controller;
    thumbnailRef.current = null;
    listScrollRef.current = 0;

    void (async () => {
      await Promise.resolve();
      if (controller.signal.aborted) return;
      setSelectedEvent(null);
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/history?limit=100", {
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        });
        if (response.status === 401) {
          window.location.replace("/login");
          return;
        }
        const payload = (await response.json().catch(() => ({}))) as Partial<HistoryResponse> & {
          error?: string;
        };
        if (!response.ok) throw new Error(payload.error || "Usage history is unavailable.");
        if (controller.signal.aborted) return;
        setHistory({
          events: Array.isArray(payload.events) ? (payload.events as HistoryEvent[]) : [],
          total: typeof payload.total === "number" ? payload.total : 0,
          retained: typeof payload.retained === "number" ? payload.retained : 1_000,
        });
      } catch (historyError) {
        if (controller.signal.aborted) return;
        setError(
          historyError instanceof Error
            ? historyError.message
            : "Usage history is unavailable. Please try again.",
        );
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    })();

    return () => {
      controller.abort();
    };
  }, [isOpen]);

  async function deleteSelectedGeneration() {
    if (isDeleting || !selectedEvent || !window.confirm("Permanently delete this generation and its stored customer photos?")) return;
    setError(null);
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/history/${encodeURIComponent(selectedEvent.id)}`, { method: "DELETE", credentials: "same-origin", cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok && !payload.deletionQueued) throw new Error(payload.error || "Deletion failed. Please try again.");
      if (payload.deletionQueued) setError(payload.error);
      const id = selectedEvent.id;
      setSelectedEvent(null);
      setHistory(current => current ? { ...current, events: current.events.filter(event => event.id !== id), total: Math.max(0, current.total - 1), retained: Math.max(0, current.retained - 1) } : current);
    } catch (error) { setError(error instanceof Error ? error.message : "Deletion failed."); }
    finally { setIsDeleting(false); }
  }

  async function loadMoreHistory() {
    if (!history || isLoadingMore || history.events.length >= history.total) return;
    setIsLoadingMore(true);
    setError(null);
    try {
      const response = await fetch(`/api/history?limit=100&offset=${history.events.length}`, {
        credentials: "same-origin", cache: "no-store",
      });
      if (response.status === 401) {
        window.location.replace("/login");
        return;
      }
      const payload = (await response.json().catch(() => ({}))) as Partial<HistoryResponse> & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Usage history is unavailable.");
      const events = Array.isArray(payload.events) ? payload.events as HistoryEvent[] : [];
      setHistory((current) => {
        if (!current) return current;
        const seenIds = new Set(current.events.map((existing) => existing.id));
        return {
          events: [...current.events, ...events.filter((event) => !seenIds.has(event.id))],
          total: typeof payload.total === "number" ? payload.total : current.total,
          retained: typeof payload.retained === "number" ? payload.retained : current.retained,
        };
      });
    } catch (historyError) {
      setError(historyError instanceof Error ? historyError.message : "Usage history is unavailable. Please try again.");
    } finally {
      setIsLoadingMore(false);
    }
  }

  const visibleEvents = history
    ? history.events.filter((event) => !favouritesOnly || event.review?.favourite)
    : [];

  return (
    <>
      {hideTrigger ? null : (
        <div className="history-control">
          <button
            type="button"
            className="history-button"
            onClick={() => setIsOpen((open) => !open)}
            aria-expanded={isOpen}
          >
            History
          </button>
        </div>
      )}

      {isOpen && mounted
        ? createPortal(
            <div className="history-modal-root">
              <button
                type="button"
                className="history-backdrop"
                onClick={() => setIsOpen(false)}
                aria-label="Close history"
              />
              <section
                className="history-panel"
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="history-title"
                tabIndex={-1}
              >
                <div className="history-panel-header">
                  <div>
                    <p className="history-eyebrow">ACTIVITY LOG</p>
                    <h2 id="history-title">Try-On History</h2>
                  </div>
                  <button
                    type="button"
                    className="history-close"
                    ref={closeButtonRef}
                    onClick={() => setIsOpen(false)}
                    aria-label="Close history"
                  >
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
                      <div className="history-table-wrap" hidden={Boolean(selectedEvent)}>
                        <table className="history-table">
                          <thead>
                            <tr>
                              <th>Preview</th>
                              <th>When</th>
                              <th>Look</th>
                              <th>Account</th>
                              <th>Device</th>
                              <th>Model</th>
                              <th>Result</th>
                              <th>Time</th>
                            </tr>
                          </thead>
                          <tbody>
                            {visibleEvents.length > 0 ? visibleEvents.map((event) => (
                              <tr key={event.id}>
                                <td data-label="Preview">
                                  {event.assets?.result ? (
                                    <button
                                      type="button"
                                      className="history-thumbnail-button"
                                      onClick={click => {
                                        listScrollRef.current = panelRef.current?.scrollTop ?? 0;
                                        thumbnailRef.current = click.currentTarget;
                                        setSelectedEvent(event);
                                      }}
                                      aria-label={`Open details for ${formatLook(event)}`}
                                    >
                                      <img
                                        className="history-thumbnail"
                                        src={`/api/history/${encodeURIComponent(event.id)}/asset/result`}
                                        alt={`${formatLook(event)} generated result`}
                                        loading="lazy"
                                      />
                                    </button>
                                  ) : (
                                    <span className="history-legacy-label">Metadata only</span>
                                  )}
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
                            )) : (
                              <tr>
                                <td colSpan={8} className="history-status">
                                  No favourite try-ons in the loaded history.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="history-status">No try-on uses have been recorded yet.</p>
                    )}
                    <label hidden={Boolean(selectedEvent)}><input type="checkbox" checked={favouritesOnly} onChange={event => setFavouritesOnly(event.target.checked)} /> Favourites in loaded history</label>
                    {selectedEvent ? (
                      <section className="generation-details" aria-label="Generation details">
                        <div className="generation-details-header">
                          <div>
                            <p className="history-eyebrow">GENERATION DETAILS</p>
                            <h3>{formatLook(selectedEvent)}</h3>
                          </div>
                          <button
                            type="button"
                            className="history-button"
                            ref={detailsBackRef}
                            onClick={() => setSelectedEvent(null)}
                            aria-label="Close generation details"
                          >
                            Back to history
                          </button>
                        </div>
                        <button type="button" className="history-button" disabled={isDeleting} onClick={() => void deleteSelectedGeneration()}>Delete generation and photos</button>
                        <div className="generation-details-grid">
                          {[
                            "person",
                            "outfit",
                            "fabric",
                            "lower-fabric",
                            "shirt-fabric",
                            "waistcoat-fabric",
                            "upper",
                            "subtype",
                            "lower",
                            "turban",
                            "shoes",
                            "upper-style",
                            "lower-style",
                            "turban-style",
                            "shoe-style",
                            "bespoke-detail-1",
                            "bespoke-detail-2",
                            "curated-design",
                            "curated-detail",
                            "split-upper",
                            "split-lower",
                            "split-shirt",
                            "split-waistcoat",
                            "split-footwear",
                            "result",
                          ].map((asset) =>
                            selectedEvent.assets?.[asset as keyof NonNullable<HistoryEvent["assets"]>] ? (
                              <figure key={asset}>
                                <ZoomableImage
                                  src={`/api/history/${encodeURIComponent(selectedEvent.id)}/asset/${asset}`}
                                  alt={
                                    asset === "person"
                                      ? "Customer photo"
                                      : asset === "outfit"
                                      ? "Outfit style photo"
                                      : asset === "fabric"
                                      ? "Fabric photo"
                                      : asset === "lower-fabric"
                                      ? "Lower fabric photo"
                                      : asset === "shirt-fabric"
                                      ? "Shirt fabric photo"
                                      : asset === "waistcoat-fabric"
                                      ? "Waistcoat fabric photo"
                                      : "Generated men's try-on result"
                                  }
                                />
                                <figcaption>
                                  {asset === "person"
                                    ? "Customer"
                                    : asset === "outfit"
                                    ? "Outfit photo"
                                    : asset === "fabric"
                                    ? "Fabric"
                                    : asset === "lower-fabric"
                                    ? "Lower fabric"
                                    : asset === "shirt-fabric"
                                    ? "Shirt fabric"
                                    : asset === "waistcoat-fabric"
                                    ? "Waistcoat fabric"
                                    : asset === "upper"
                                    ? "Upper blueprint"
                                    : asset === "lower"
                                    ? "Lower blueprint"
                                    : asset === "subtype"
                                    ? "Suit subtype"
                                    : asset === "upper-style"
                                    ? "Upper style"
                                    : asset === "lower-style"
                                    ? "Lower style"
                                    : asset === "turban"
                                    ? "Turban"
                                    : asset === "turban-style"
                                    ? "Turban style"
                                    : asset === "shoes"
                                    ? "Shoes"
                                    : asset === "shoe-style"
                                    ? "Shoe style"
                                    : asset === "curated-design"
                                    ? "Curated construction reference"
                                    : asset === "curated-detail"
                                    ? "Curated detail reference"
                                    : asset === "split-upper"
                                    ? "Jacket reference"
                                    : asset === "split-lower"
                                    ? "Trouser reference"
                                    : asset === "split-shirt"
                                    ? "Shirt reference"
                                    : asset === "split-waistcoat"
                                    ? "Waistcoat reference"
                                    : asset === "split-footwear"
                                    ? "Shoe reference"
                                    : asset.startsWith("bespoke-detail")
                                    ? "Bespoke visual reference"
                                    : "Final result"}
                                </figcaption>
                                <a
                                  className="generation-details-download"
                                  href={`/api/history/${encodeURIComponent(selectedEvent.id)}/asset/${asset}?download=1`}
                                >
                                  Download original
                                </a>
                              </figure>
                            ) : null,
                          )}
                        </div>
                        {selectedEvent.generation?.mode === "split" ? <section aria-label="Saved piece assignments"><h4>Submitted outfit</h4><dl className="result-summary">{[
                          ["Jacket", selectedEvent.generation.splitUpperName, "jacket"],
                          ["Trousers", selectedEvent.generation.splitLowerName, "trousers"],
                          ["Shirt", selectedEvent.generation.splitShirtName, "shirt"],
                          ...(selectedEvent.generation.splitWaistcoatId && selectedEvent.generation.splitWaistcoatId !== "SUIT_WAISTCOAT_NONE" ? [["Waistcoat", selectedEvent.generation.splitWaistcoatName, "waistcoat"]] : []),
                        ].map(([label, name, piece]) => <div key={label}><dt>{label}</dt><dd>{name || "Design not recorded"} · {selectedEvent.generation?.splitFabricSlots ? selectedEvent.generation.splitFabricSlots[piece as "jacket" | "trousers" | "shirt" | "waistcoat"] ? "Uploaded cloth" : "Reference cloth" : "Material assignment not recorded"}</dd></div>)}<div><dt>Shoes</dt><dd>{selectedEvent.generation.splitFootwearName || "Design not recorded"} · Reference material</dd></div><div><dt>Accessories · Text instructions</dt><dd>{selectedEvent.generation.splitAccessoryNames?.join(", ") || "None recorded"}</dd></div></dl></section> : null}
                        <GenerationReview key={selectedEvent.id} generationId={selectedEvent.id} onSaved={review => setHistory(current => current ? { ...current, events: current.events.map(event => event.id === selectedEvent.id ? { ...event, review } : event) } : current)} />
                        <details><summary>Generation record</summary><p>Output: {selectedEvent.metadata?.outputWidth && selectedEvent.metadata?.outputHeight ? `${selectedEvent.metadata.outputWidth} × ${selectedEvent.metadata.outputHeight}` : "Not recorded"}. Reported effort: {selectedEvent.metadata?.reportedQuality ?? "Not provided"}. Processing: {selectedEvent.metadata?.provenance?.preprocessingVersion ?? "Legacy"}. Attempts: {selectedEvent.metadata?.provenance?.providerAttempts ?? "Not recorded"}.</p></details>
                        {selectedEvent.generation?.outfitSpecification ? (
                          <section className="generation-specification" aria-label="Saved outfit specification">
                            <p className="history-eyebrow">SAVED OUTFIT SPECIFICATION</p>
                            <h4>
                              {selectedEvent.generation.outfitSpecification.garment.subtypeName ??
                                selectedEvent.generation.outfitSpecification.garment.name}
                            </h4>
                            <div>
                              {selectedEvent.generation.outfitSpecification.configuration.selectedOptions.map(
                                (option) => (
                                  <span key={option.groupId}>
                                    <b>{option.groupName}:</b> {option.optionName}
                                  </span>
                                ),
                              )}
                            </div>
                          </section>
                        ) : null}
                        <p className="generation-details-meta">
                          {formatDate(selectedEvent.occurredAt)} · {formatDevice(selectedEvent)} ·{" "}
                          {selectedEvent.durationMs > 0 ? `${Math.round(selectedEvent.durationMs / 1000)}s` : "—"}
                        </p>
                        {(() => {
                          const restored = restoreLookFromGeneration(selectedEvent.generation);
                          if (restored.kind === "unsupported" || !onRestoreLook) return null;
                          return (
                            <button
                              type="button"
                              className="history-button"
                              onClick={() => {
                                onRestoreLook(restored);
                                setSelectedEvent(null);
                                setIsOpen(false);
                              }}
                            >
                              Use this look
                            </button>
                          );
                        })()}
                        {selectedEvent.assets?.result ? (
                          <a
                            className="generation-details-download"
                            href={`/api/history/${encodeURIComponent(selectedEvent.id)}/asset/result?download=1`}
                            download="nasir-bespoke-try-on.png"
                          >
                            Download result original
                          </a>
                        ) : null}
                      </section>
                    ) : null}
                    {!selectedEvent && history.events.length < history.total ? (
                      <button type="button" className="history-button" onClick={() => void loadMoreHistory()} disabled={isLoadingMore}>
                        {isLoadingMore ? "Loading…" : "Load earlier history"}
                      </button>
                    ) : null}
                  </>
                ) : null}
              </section>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
