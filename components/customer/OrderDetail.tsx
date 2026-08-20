"use client";

import { useState } from "react";
import { findSplitOption } from "@/lib/split-outfit/compatibility";
import { ORDER_STATUS_TRANSITIONS } from "@/lib/customer/validation";
import type { Customer, Order, OrderStatus } from "@/lib/customer/types";
import { OrderMaterials } from "./OrderMaterials";
import { OrderProduction } from "./OrderProduction";
import { OrderPresentation } from "./OrderPresentation";

type OrderDetailProps = {
  order: Order;
  customer: Customer;
  onStatusChanged: (updated: Order) => void;
  onClose: () => void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
function readResponseError(payload: unknown, fallback: string) {
  return isRecord(payload) && typeof payload.error === "string" ? payload.error : fallback;
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

function outfitComponentSummary(order: Order): string[] {
  const { components, family } = order.outfitSnapshot;
  const upper = findSplitOption(family, components.upperId);
  const lower = findSplitOption(family, components.lowerId);
  const shirt = findSplitOption(family, components.shirtId);
  const waistcoat = components.waistcoatId ? findSplitOption(family, components.waistcoatId) : null;
  const footwear = findSplitOption(family, components.footwearId);
  const accessories = components.accessoryIds.map((id) => findSplitOption(family, id)?.name).filter(Boolean);

  return [
    upper ? `Upper: ${upper.name}` : null,
    lower ? `Lower: ${lower.name}` : null,
    shirt ? `Shirt: ${shirt.name}` : null,
    waistcoat && waistcoat.id !== "SUIT_WAISTCOAT_NONE" ? `Waistcoat: ${waistcoat.name}` : null,
    footwear ? `Footwear: ${footwear.name}` : null,
    accessories.length > 0 ? `Accessories: ${accessories.join(", ")}` : null,
  ].filter((line): line is string => Boolean(line));
}

/**
 * Order Detail — a minimal, non-ERP view: order identity, customer, the
 * outfit that was ordered, the exact measurements it was ordered against
 * (the snapshot, never re-derived from current data), and status with the
 * valid next-status actions. The server independently re-validates every
 * transition regardless of which button is shown here.
 */
export function OrderDetail({ order, customer, onStatusChanged, onClose }: OrderDetailProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [presenting, setPresenting] = useState(false);

  async function moveTo(next: OrderStatus) {
    setIsUpdating(true);
    setError(null);
    try {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const payload: unknown = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(readResponseError(payload, "We couldn't update this order."));
      onStatusChanged(payload as Order);
    } catch (updateError: unknown) {
      setError(updateError instanceof Error ? updateError.message : "We couldn't update this order.");
    } finally {
      setIsUpdating(false);
    }
  }

  const nextStatuses = ORDER_STATUS_TRANSITIONS[order.status] ?? [];
  const measurements = order.measurementSnapshot;

  if (presenting) {
    return <OrderPresentation order={order} customer={customer} onClose={() => setPresenting(false)} />;
  }

  return (
    <div className="order-detail" aria-label={`Order detail for ${order.id}`}>
      {error ? <p className="form-error" role="alert">{error}</p> : null}

      <div className="order-detail-grid">
        <div className="order-detail-field">
          <span className="customer-profile-card-label">Order ID</span>
          <p className="customer-profile-value order-detail-id">{order.id}</p>
        </div>
        <div className="order-detail-field">
          <span className="customer-profile-card-label">Customer</span>
          <p className="customer-profile-value">{customer.name}</p>
        </div>
        <div className="order-detail-field">
          <span className="customer-profile-card-label">Status</span>
          <p className="customer-profile-value">
            <span className={`order-status-pill order-status-${order.status.toLowerCase()}`}>{order.status}</span>
          </p>
        </div>
        <div className="order-detail-field">
          <span className="customer-profile-card-label">Placed</span>
          <p className="customer-profile-value">{formatDateTime(order.createdAt)}</p>
        </div>
      </div>

      <div className="order-detail-section">
        <span className="customer-profile-card-label">Outfit</span>
        <ul className="customer-list">
          {outfitComponentSummary(order).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

      <div className="order-detail-section">
        <span className="customer-profile-card-label">Measurements Used (v{measurements.version})</span>
        <div className="customer-chip-row">
          {Object.entries(measurements.jacketMeasurements).map(([field, value]) => (
            <span key={`jacket-${field}`} className="customer-chip">jacket {field}: {value}</span>
          ))}
          {Object.entries(measurements.trouserMeasurements).map(([field, value]) => (
            <span key={`trouser-${field}`} className="customer-chip">trouser {field}: {value}</span>
          ))}
          {Object.entries(measurements.shirtMeasurements).map(([field, value]) => (
            <span key={`shirt-${field}`} className="customer-chip">shirt {field}: {value}</span>
          ))}
        </div>
        <p className="order-detail-meta">Recorded by {measurements.recordedBy} on {formatDateTime(measurements.recordedAt)}</p>
      </div>

      <OrderMaterials orderId={order.id} />

      <OrderProduction orderId={order.id} />

      <div className="order-detail-actions">
        <button type="button" className="showroom-link-button" onClick={onClose}>
          Close
        </button>
        {order.status !== "CANCELLED" ? (
          <button type="button" className="showroom-cta-button" onClick={() => setPresenting(true)}>
            Present to Customer
          </button>
        ) : null}
        {nextStatuses.length > 0 ? (
          <div className="order-detail-transitions">
            {nextStatuses.map((status) => (
              <button
                key={status}
                type="button"
                className={status === "CANCELLED" ? "showroom-link-button" : "showroom-cta-button"}
                onClick={() => void moveTo(status)}
                disabled={isUpdating}
              >
                Move to {status}
              </button>
            ))}
          </div>
        ) : (
          <p className="customer-profile-empty">This order is in a final state.</p>
        )}
      </div>
    </div>
  );
}
