"use client";

import { useEffect, useState } from "react";
import { findSplitOption } from "@/lib/split-outfit/compatibility";
import type { Customer, MaterialRole, MeasurementBlock, Order, OrderMaterialSnapshot, OrderStatus } from "@/lib/customer/types";

type OrderPresentationProps = {
  order: Order;
  customer: Customer;
  onClose: () => void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const STATUS_PHRASES: Record<OrderStatus, string> = {
  DRAFT: "Your Bespoke Order",
  CONFIRMED: "Confirmed",
  TAILORING: "In the Atelier",
  TRIAL: "First Fitting",
  ALTERATION: "Being Refined",
  QUALITY_CHECK: "Final Craftsmanship Review",
  READY: "Ready for You",
  DELIVERED: "Delivered",
  CANCELLED: "",
};

const ROLE_LABELS: Record<MaterialRole, string> = {
  SUIT_FABRIC: "Suit Fabric",
  SHIRT_FABRIC: "Shirt Fabric",
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return iso;
  }
}

function humanizeField(field: string): string {
  const spaced = field.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

function measurementLine(block: MeasurementBlock): string {
  return Object.entries(block)
    .map(([field, value]) => `${humanizeField(field)} ${value}`)
    .join(" · ");
}

function outfitLines(order: Order): string[] {
  const { components, family } = order.outfitSnapshot;
  const upper = findSplitOption(family, components.upperId);
  const lower = findSplitOption(family, components.lowerId);
  const shirt = findSplitOption(family, components.shirtId);
  const waistcoat = components.waistcoatId ? findSplitOption(family, components.waistcoatId) : null;
  const footwear = findSplitOption(family, components.footwearId);
  const accessories = components.accessoryIds.map((id) => findSplitOption(family, id)?.name).filter(Boolean);

  return [
    upper?.name ?? null,
    lower?.name ?? null,
    shirt?.name ?? null,
    waistcoat && waistcoat.id !== "SUIT_WAISTCOAT_NONE" ? waistcoat.name : null,
    footwear?.name ?? null,
    accessories.length > 0 ? accessories.join(", ") : null,
  ].filter((line): line is string => Boolean(line));
}

/**
 * Phase 5A — a private-client presentation of a finalized order, reached
 * from OrderDetail.tsx's "Present to Customer" action. Read-only,
 * presentation-only: every raw ID, staff username, internal status name,
 * and production detail is either translated to customer language or
 * simply never fetched. Reuses the existing order:read permission and the
 * existing order-materials endpoint — no new backend surface of any kind.
 */
export function OrderPresentation({ order, customer, onClose }: OrderPresentationProps) {
  const [materials, setMaterials] = useState<OrderMaterialSnapshot[] | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await fetch(`/api/orders/${order.id}/materials`, { credentials: "same-origin" });
        const payload: unknown = await response.json().catch(() => ({}));
        if (!active) return;
        setMaterials(response.ok && isRecord(payload) && Array.isArray(payload.materials) ? (payload.materials as OrderMaterialSnapshot[]) : []);
      } catch {
        if (active) setMaterials([]);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [order.id]);

  const measurements = order.measurementSnapshot;
  const outfit = outfitLines(order);

  return (
    <div className="order-presentation">
      <header className="order-presentation-header">
        <p className="brand-kicker">NASIR BESPOKE</p>
        <span className="brand-rule" aria-hidden="true" />
        <h1 className="order-presentation-title">{customer.name}</h1>
        <p className="order-presentation-subtitle">A Bespoke Presentation — {STATUS_PHRASES[order.status]}</p>
      </header>

      <section className="order-presentation-section">
        <span className="customer-profile-card-label">The Outfit</span>
        <ul className="order-presentation-list">
          {outfit.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <span className="order-presentation-divider" aria-hidden="true" />

      <section className="order-presentation-section">
        <span className="customer-profile-card-label">Your Measurements</span>
        <ul className="order-presentation-list">
          <li>Jacket — {measurementLine(measurements.jacketMeasurements)}</li>
          <li>Trouser — {measurementLine(measurements.trouserMeasurements)}</li>
          <li>Shirt — {measurementLine(measurements.shirtMeasurements)}</li>
        </ul>
        <p className="order-presentation-meta">Measurements taken {formatDate(measurements.recordedAt)}</p>
      </section>

      <span className="order-presentation-divider" aria-hidden="true" />

      <section className="order-presentation-section">
        <span className="customer-profile-card-label">Materials Selected</span>
        {materials === null ? (
          <p className="order-presentation-meta">Loading…</p>
        ) : materials.length === 0 ? (
          <p className="order-presentation-meta">Not yet selected.</p>
        ) : (
          <ul className="order-presentation-list">
            {materials.map((material) => (
              <li key={material.id}>
                {ROLE_LABELS[material.role]} — {material.fabricName}
                {material.variantColour ? `, ${material.variantColour}` : material.colour ? `, ${material.colour}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="order-presentation-closing">Prepared exclusively for {customer.name} — Nasir Bespoke</p>

      <div className="order-presentation-controls no-print">
        <button type="button" className="showroom-link-button" onClick={onClose}>
          Back to Order
        </button>
        <button type="button" className="showroom-cta-button" onClick={() => window.print()}>
          Print / Save as PDF
        </button>
      </div>
    </div>
  );
}
