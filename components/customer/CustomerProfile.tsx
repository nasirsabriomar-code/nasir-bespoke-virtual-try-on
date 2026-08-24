"use client";

import { useEffect, useState } from "react";
import { SIGNATURE_LOOK_LIBRARY } from "@/lib/showroom/look-library";
import type { Customer, MeasurementProfile, Order, SavedOutfit, ShowroomSession } from "@/lib/customer/types";
import { MeasurementWorkflow } from "./MeasurementWorkflow";
import { OrderDetail } from "./OrderDetail";
import { PreferencesEditor } from "./PreferencesEditor";

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

type PanelState = "none" | "preferences" | "measurements" | "order-detail";

export function CustomerProfile({ customer: initialCustomer, onStartSession, onBack }: CustomerProfileProps) {
  const [customer, setCustomer] = useState<Customer>(initialCustomer);
  const [measurements, setMeasurements] = useState<MeasurementProfile[] | null>(null);
  const [outfits, setOutfits] = useState<SavedOutfit[] | null>(null);
  const [sessions, setSessions] = useState<ShowroomSession[] | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [openPanel, setOpenPanel] = useState<PanelState>("none");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [creatingOrderForOutfitId, setCreatingOrderForOutfitId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadAll() {
      setError(null);
      try {
        const [measurementsResponse, outfitsResponse, sessionsResponse, ordersResponse] = await Promise.all([
          fetch(`/api/customers/${customer.id}/measurements`, { credentials: "same-origin" }),
          fetch(`/api/customers/${customer.id}/outfits`, { credentials: "same-origin" }),
          fetch(`/api/customers/${customer.id}/sessions`, { credentials: "same-origin" }),
          fetch(`/api/customers/${customer.id}/orders`, { credentials: "same-origin" }),
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

        const ordersPayload: unknown = await ordersResponse.json();
        setOrders(isRecord(ordersPayload) && Array.isArray(ordersPayload.orders) ? (ordersPayload.orders as Order[]) : []);
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

  async function createOrder(savedOutfitId: string) {
    setCreatingOrderForOutfitId(savedOutfitId);
    setError(null);
    try {
      const response = await fetch(`/api/customers/${customer.id}/orders`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ savedOutfitId }),
      });
      const payload: unknown = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(readResponseError(payload, "We couldn't create this order."));
      const order = payload as Order;
      setOrders((current) => [order, ...(current ?? [])]);
      setSelectedOrder(order);
      setOpenPanel("order-detail");
    } catch (orderError: unknown) {
      setError(orderError instanceof Error ? orderError.message : "We couldn't create this order.");
    } finally {
      setCreatingOrderForOutfitId(null);
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
          <div className="customer-profile-card-header">
            <span className="customer-profile-card-label">Preferences</span>
            <button type="button" className="showroom-link-button" onClick={() => setOpenPanel(openPanel === "preferences" ? "none" : "preferences")}>
              {openPanel === "preferences" ? "Close" : "Edit"}
            </button>
          </div>
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
          <div className="customer-profile-card-header">
            <span className="customer-profile-card-label">Measurements</span>
            <button type="button" className="showroom-link-button" onClick={() => setOpenPanel(openPanel === "measurements" ? "none" : "measurements")}>
              {openPanel === "measurements" ? "Close" : "Manage"}
            </button>
          </div>
          {measurements === null ? (
            <p className="customer-profile-empty">Loading…</p>
          ) : measurements.length > 0 ? (
            <p className="customer-profile-value">Latest: {formatDate(measurements[0].createdAt)} — v{measurements[0].version}</p>
          ) : (
            <p className="customer-profile-empty">No measurements recorded yet.</p>
          )}
        </div>

        <div className="customer-profile-card">
          <span className="customer-profile-card-label">Previous Looks</span>
          {outfits === null ? (
            <p className="customer-profile-empty">Loading…</p>
          ) : outfits.length > 0 ? (
            <ul className="customer-list customer-outfit-list">
              {outfits.slice(0, 5).map((outfit) => (
                <li key={outfit.id} className="customer-outfit-list-item">
                  <span>{outfitLookLabel(outfit)} — {formatDate(outfit.createdAt)}</span>
                  <button
                    type="button"
                    className="showroom-link-button"
                    onClick={() => void createOrder(outfit.id)}
                    disabled={creatingOrderForOutfitId === outfit.id}
                  >
                    {creatingOrderForOutfitId === outfit.id ? "Creating…" : "Create Order"}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="customer-profile-empty">No saved outfits yet.</p>
          )}
        </div>

        <div className="customer-profile-card">
          <span className="customer-profile-card-label">Showroom History</span>
          {sessions === null ? (
            <p className="customer-profile-empty">Loading…</p>
          ) : sessions.length > 0 ? (
            <>
              <p className="customer-profile-value">{sessions.length} visit{sessions.length === 1 ? "" : "s"}</p>
              <ul className="customer-list">
                {sessions.slice(0, 5).map((session) => (
                  <li key={session.id}>{session.status} — {formatDate(session.createdAt)}</li>
                ))}
              </ul>
            </>
          ) : (
            <p className="customer-profile-empty">No previous sessions yet.</p>
          )}
        </div>

        <div className="customer-profile-card">
          <span className="customer-profile-card-label">Orders</span>
          {orders === null ? (
            <p className="customer-profile-empty">Loading…</p>
          ) : orders.length > 0 ? (
            <ul className="customer-list">
              {orders.slice(0, 5).map((order) => (
                <li key={order.id}>
                  <button
                    type="button"
                    className="order-list-entry-button"
                    onClick={() => {
                      setSelectedOrder(order);
                      setOpenPanel("order-detail");
                    }}
                  >
                    <span className={`order-status-pill order-status-${order.status.toLowerCase()}`}>{order.status}</span>
                    {formatDate(order.createdAt)}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="customer-profile-empty">No orders yet.</p>
          )}
        </div>
      </div>

      {openPanel === "preferences" ? (
        <PreferencesEditor
          customer={customer}
          onCancel={() => setOpenPanel("none")}
          onSaved={(updated) => {
            setCustomer(updated);
            setOpenPanel("none");
          }}
        />
      ) : null}

      {openPanel === "measurements" ? (
        <MeasurementWorkflow
          customerId={customer.id}
          history={measurements ?? []}
          onCancel={() => setOpenPanel("none")}
          onRecorded={(measurement) => {
            setMeasurements((current) => [measurement, ...(current ?? [])]);
          }}
        />
      ) : null}

      {openPanel === "order-detail" && selectedOrder ? (
        <OrderDetail
          order={selectedOrder}
          customer={customer}
          onClose={() => setOpenPanel("none")}
          onStatusChanged={(updated) => {
            setSelectedOrder(updated);
            setOrders((current) => (current ?? []).map((entry) => (entry.id === updated.id ? updated : entry)));
          }}
        />
      ) : null}

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
