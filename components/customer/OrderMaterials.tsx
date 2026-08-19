"use client";

import { useEffect, useState } from "react";
import type { Fabric, FabricVariant, MaterialRole, OrderMaterialSnapshot } from "@/lib/customer/types";

type OrderMaterialsProps = {
  orderId: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
function readResponseError(payload: unknown, fallback: string) {
  return isRecord(payload) && typeof payload.error === "string" ? payload.error : fallback;
}

const ROLE_LABELS: Record<MaterialRole, string> = {
  SUIT_FABRIC: "Suit Fabric",
  SHIRT_FABRIC: "Shirt Fabric",
};
const ROLES: MaterialRole[] = ["SUIT_FABRIC", "SHIRT_FABRIC"];

type RoleDraft = { fabricId: string; fabricVariantId: string };

/**
 * Order Detail's "Materials" section (Phase 4B) — lets staff attach a
 * curated fabric (and optional variant) to each material role on an order.
 * The server independently re-validates every selection (fabric exists and
 * is ACTIVE, variant belongs to the fabric and is available) and builds the
 * stored snapshot itself; this component only ever submits
 * { role, fabricId, fabricVariantId }, never the descriptive fabric fields.
 */
export function OrderMaterials({ orderId }: OrderMaterialsProps) {
  const [fabrics, setFabrics] = useState<Fabric[] | null>(null);
  const [materials, setMaterials] = useState<OrderMaterialSnapshot[] | null>(null);
  const [variantsByFabric, setVariantsByFabric] = useState<Record<string, FabricVariant[]>>({});
  const [drafts, setDrafts] = useState<Record<MaterialRole, RoleDraft>>({
    SUIT_FABRIC: { fabricId: "", fabricVariantId: "" },
    SHIRT_FABRIC: { fabricId: "", fabricVariantId: "" },
  });
  const [savingRole, setSavingRole] = useState<MaterialRole | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setError(null);
      try {
        const [fabricsResponse, materialsResponse] = await Promise.all([
          fetch("/api/fabrics", { credentials: "same-origin" }),
          fetch(`/api/orders/${orderId}/materials`, { credentials: "same-origin" }),
        ]);
        if (!active) return;

        const fabricsPayload: unknown = await fabricsResponse.json();
        if (!fabricsResponse.ok) throw new Error(readResponseError(fabricsPayload, "We couldn't load the fabric catalogue."));
        setFabrics(isRecord(fabricsPayload) && Array.isArray(fabricsPayload.fabrics) ? (fabricsPayload.fabrics as Fabric[]) : []);

        const materialsPayload: unknown = await materialsResponse.json();
        if (!materialsResponse.ok) throw new Error(readResponseError(materialsPayload, "We couldn't load this order's materials."));
        setMaterials(isRecord(materialsPayload) && Array.isArray(materialsPayload.materials) ? (materialsPayload.materials as OrderMaterialSnapshot[]) : []);
      } catch (loadError: unknown) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "We couldn't load this order's materials.");
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [orderId]);

  async function loadVariants(fabricId: string) {
    if (!fabricId || variantsByFabric[fabricId]) return;
    try {
      const response = await fetch(`/api/fabrics/${fabricId}/variants`, { credentials: "same-origin" });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(readResponseError(payload, "We couldn't load fabric variants."));
      const variants = isRecord(payload) && Array.isArray(payload.variants) ? (payload.variants as FabricVariant[]) : [];
      setVariantsByFabric((current) => ({ ...current, [fabricId]: variants }));
    } catch {
      // Non-fatal: the fabric can still be selected without a variant.
    }
  }

  function updateDraft(role: MaterialRole, patch: Partial<RoleDraft>) {
    setDrafts((current) => ({ ...current, [role]: { ...current[role], ...patch } }));
  }

  async function saveRole(role: MaterialRole) {
    const draft = drafts[role];
    if (!draft.fabricId) return;
    setSavingRole(role);
    setError(null);
    try {
      const response = await fetch(`/api/orders/${orderId}/materials`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          fabricId: draft.fabricId,
          fabricVariantId: draft.fabricVariantId || null,
        }),
      });
      const payload: unknown = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(readResponseError(payload, "We couldn't save this fabric selection."));
      const saved = payload as OrderMaterialSnapshot;
      setMaterials((current) => [...(current ?? []).filter((entry) => entry.role !== role), saved]);
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "We couldn't save this fabric selection.");
    } finally {
      setSavingRole(null);
    }
  }

  if (fabrics === null || materials === null) {
    return (
      <div className="order-detail-section order-materials">
        <span className="customer-profile-card-label">Materials</span>
        <p className="customer-profile-empty">Loading…</p>
      </div>
    );
  }

  return (
    <div className="order-detail-section order-materials">
      <span className="customer-profile-card-label">Materials</span>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {fabrics.length === 0 ? (
        <p className="customer-profile-empty">No fabrics in the catalogue yet.</p>
      ) : (
        <div className="order-materials-list">
          {ROLES.map((role) => {
            const current = materials.find((entry) => entry.role === role);
            const draft = drafts[role];
            const variants = draft.fabricId ? variantsByFabric[draft.fabricId] ?? [] : [];
            return (
              <div key={role} className="order-materials-row" aria-label={ROLE_LABELS[role]}>
                <span className="order-materials-role-label">{ROLE_LABELS[role]}</span>
                {current ? (
                  <p className="customer-profile-value order-materials-current">
                    {current.fabricName}
                    {current.variantColour ? ` — ${current.variantColour}` : current.colour ? ` — ${current.colour}` : ""}
                  </p>
                ) : (
                  <p className="customer-profile-empty">Not yet selected.</p>
                )}
                <div className="order-materials-picker">
                  <select
                    aria-label={`${ROLE_LABELS[role]} fabric`}
                    value={draft.fabricId}
                    onChange={(event) => {
                      const fabricId = event.target.value;
                      updateDraft(role, { fabricId, fabricVariantId: "" });
                      void loadVariants(fabricId);
                    }}
                  >
                    <option value="">Select a fabric…</option>
                    {fabrics.filter((fabric) => fabric.status === "ACTIVE").map((fabric) => (
                      <option key={fabric.id} value={fabric.id}>
                        {fabric.name} — {fabric.colour}
                      </option>
                    ))}
                  </select>
                  {draft.fabricId && variants.length > 0 ? (
                    <select
                      aria-label={`${ROLE_LABELS[role]} variant`}
                      value={draft.fabricVariantId}
                      onChange={(event) => updateDraft(role, { fabricVariantId: event.target.value })}
                    >
                      <option value="">Default colour</option>
                      {variants.filter((variant) => variant.isAvailable).map((variant) => (
                        <option key={variant.id} value={variant.id}>
                          {variant.colour}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  <button
                    type="button"
                    className="showroom-link-button"
                    onClick={() => void saveRole(role)}
                    disabled={!draft.fabricId || savingRole === role}
                  >
                    {savingRole === role ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
