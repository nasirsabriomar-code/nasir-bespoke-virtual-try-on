"use client";

import { useEffect, useState } from "react";
import type { Fabric, FabricStatus, FabricVariant } from "@/lib/customer/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
function readResponseError(payload: unknown, fallback: string) {
  return isRecord(payload) && typeof payload.error === "string" ? payload.error : fallback;
}

type FabricDraft = {
  name: string;
  composition: string;
  weight: string;
  season: string;
  colour: string;
  supplier: string;
};

function draftFrom(fabric: Fabric): FabricDraft {
  return {
    name: fabric.name,
    composition: fabric.composition,
    weight: fabric.weight,
    season: fabric.season,
    colour: fabric.colour,
    supplier: fabric.supplier ?? "",
  };
}

type FabricCatalogueProps = {
  canManage: boolean;
};

/**
 * Minimal Owner/Manager fabric catalogue (Phase 4E). Live edits never
 * rewrite OrderMaterialSnapshot copies — this UI only mutates catalogue
 * rows. STAFF/read-only callers get the list without mutation controls.
 */
export function FabricCatalogue({ canManage }: FabricCatalogueProps) {
  const [fabrics, setFabrics] = useState<Fabric[] | null>(null);
  const [variantsByFabric, setVariantsByFabric] = useState<Record<string, FabricVariant[]>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, FabricDraft>>({});
  const [newVariantColour, setNewVariantColour] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setError(null);
      try {
        const response = await fetch("/api/fabrics", { credentials: "same-origin" });
        if (!active) return;
        const payload: unknown = await response.json();
        if (!response.ok) throw new Error(readResponseError(payload, "We couldn't load the fabric catalogue."));
        setFabrics(isRecord(payload) && Array.isArray(payload.fabrics) ? (payload.fabrics as Fabric[]) : []);
      } catch (loadError: unknown) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "We couldn't load the fabric catalogue.");
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  async function loadVariants(fabricId: string) {
    const response = await fetch(`/api/fabrics/${fabricId}/variants`, { credentials: "same-origin" });
    const payload: unknown = await response.json();
    if (!response.ok) throw new Error(readResponseError(payload, "We couldn't load fabric variants."));
    const variants = isRecord(payload) && Array.isArray(payload.variants) ? (payload.variants as FabricVariant[]) : [];
    setVariantsByFabric((current) => ({ ...current, [fabricId]: variants }));
  }

  async function openFabric(fabric: Fabric) {
    setOpenId(fabric.id);
    setDrafts((current) => ({ ...current, [fabric.id]: current[fabric.id] ?? draftFrom(fabric) }));
    if (!variantsByFabric[fabric.id]) {
      try {
        await loadVariants(fabric.id);
      } catch (loadError: unknown) {
        setError(loadError instanceof Error ? loadError.message : "We couldn't load fabric variants.");
      }
    }
  }

  async function saveFabric(fabric: Fabric) {
    const draft = drafts[fabric.id];
    if (!draft) return;
    setBusyId(fabric.id);
    setError(null);
    try {
      const response = await fetch(`/api/fabrics/${fabric.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          composition: draft.composition,
          weight: draft.weight,
          season: draft.season,
          colour: draft.colour,
          supplier: draft.supplier || null,
        }),
      });
      const payload: unknown = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(readResponseError(payload, "We couldn't save this fabric."));
      const updated = payload as Fabric;
      setFabrics((current) => (current ? current.map((entry) => (entry.id === updated.id ? updated : entry)) : current));
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "We couldn't save this fabric.");
    } finally {
      setBusyId(null);
    }
  }

  async function setStatus(fabric: Fabric, status: FabricStatus) {
    setBusyId(fabric.id);
    setError(null);
    try {
      const response = await fetch(`/api/fabrics/${fabric.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const payload: unknown = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(readResponseError(payload, "We couldn't update this fabric's status."));
      const updated = payload as Fabric;
      setFabrics((current) => (current ? current.map((entry) => (entry.id === updated.id ? updated : entry)) : current));
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "We couldn't update this fabric's status.");
    } finally {
      setBusyId(null);
    }
  }

  async function createVariant(fabricId: string) {
    const colour = (newVariantColour[fabricId] ?? "").trim();
    if (!colour) return;
    setBusyId(fabricId);
    setError(null);
    try {
      const response = await fetch(`/api/fabrics/${fabricId}/variants`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ colour }),
      });
      const payload: unknown = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(readResponseError(payload, "We couldn't add this variant."));
      setNewVariantColour((current) => ({ ...current, [fabricId]: "" }));
      await loadVariants(fabricId);
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "We couldn't add this variant.");
    } finally {
      setBusyId(null);
    }
  }

  async function patchVariant(fabricId: string, variantId: string, patch: { colour?: string; isAvailable?: boolean }) {
    setBusyId(variantId);
    setError(null);
    try {
      const response = await fetch(`/api/fabrics/${fabricId}/variants/${variantId}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const payload: unknown = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(readResponseError(payload, "We couldn't update this variant."));
      const updated = payload as FabricVariant;
      setVariantsByFabric((current) => ({
        ...current,
        [fabricId]: (current[fabricId] ?? []).map((entry) => (entry.id === updated.id ? updated : entry)),
      }));
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "We couldn't update this variant.");
    } finally {
      setBusyId(null);
    }
  }

  if (fabrics === null) {
    return <p className="customer-profile-empty">Loading…</p>;
  }

  return (
    <div className="fabric-catalogue">
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {fabrics.length === 0 ? (
        <p className="customer-profile-empty">No fabrics in the catalogue yet.</p>
      ) : (
        <ul className="customer-list fabric-catalogue-list">
          {fabrics.map((fabric) => {
            const isOpen = openId === fabric.id;
            const draft = drafts[fabric.id] ?? draftFrom(fabric);
            const variants = variantsByFabric[fabric.id] ?? [];
            return (
              <li key={fabric.id} className="fabric-catalogue-item">
                <button type="button" className="fabric-catalogue-summary" onClick={() => void (isOpen ? setOpenId(null) : openFabric(fabric))}>
                  <strong>{fabric.name}</strong>
                  <span className="customer-profile-value">{fabric.composition} · {fabric.colour}</span>
                  <span className={`order-status-pill fabric-status-${fabric.status.toLowerCase()}`}>{fabric.status}</span>
                </button>
                {isOpen ? (
                  <div className="fabric-catalogue-detail">
                    {canManage ? (
                      <>
                        <div className="measurement-field-grid">
                          {(["name", "composition", "weight", "season", "colour", "supplier"] as const).map((field) => (
                            <label key={field} className="login-field">
                              <span>{field === "name" ? "Name" : field[0].toUpperCase() + field.slice(1)}</span>
                              <input
                                value={draft[field]}
                                disabled={busyId === fabric.id}
                                onChange={(event) => setDrafts((current) => ({
                                  ...current,
                                  [fabric.id]: { ...draft, [field]: event.target.value },
                                }))}
                              />
                            </label>
                          ))}
                        </div>
                        <div className="order-detail-transitions">
                          <button type="button" className="showroom-cta-button" onClick={() => void saveFabric(fabric)} disabled={busyId === fabric.id}>
                            {busyId === fabric.id ? "Saving…" : "Save"}
                          </button>
                          <button type="button" className="showroom-link-button" onClick={() => setDrafts((current) => ({ ...current, [fabric.id]: draftFrom(fabric) }))}>
                            Cancel
                          </button>
                          {fabric.status === "ACTIVE" ? (
                            <button type="button" className="showroom-link-button" onClick={() => void setStatus(fabric, "INACTIVE")} disabled={busyId === fabric.id}>
                              Retire
                            </button>
                          ) : (
                            <button type="button" className="showroom-cta-button" onClick={() => void setStatus(fabric, "ACTIVE")} disabled={busyId === fabric.id}>
                              Reactivate
                            </button>
                          )}
                        </div>
                      </>
                    ) : (
                      <p className="customer-profile-value">{fabric.season} · {fabric.weight}{fabric.supplier ? ` · ${fabric.supplier}` : ""}</p>
                    )}

                    <span className="customer-profile-card-label">Variants</span>
                    {variants.length === 0 ? <p className="customer-profile-empty">No variants.</p> : (
                      <ul className="customer-list">
                        {variants.map((variant) => (
                          <li key={variant.id} className="fabric-variant-row">
                            <span className="customer-profile-value">
                              {variant.colour}
                              <span className={`order-status-pill fabric-availability-${variant.isAvailable ? "available" : "unavailable"}`}>
                                {variant.isAvailable ? "AVAILABLE" : "UNAVAILABLE"}
                              </span>
                            </span>
                            {canManage ? (
                              <div className="order-materials-picker">
                                <button
                                  type="button"
                                  className="showroom-link-button"
                                  disabled={busyId === variant.id}
                                  onClick={() => void patchVariant(fabric.id, variant.id, { isAvailable: !variant.isAvailable })}
                                >
                                  {variant.isAvailable ? "Mark unavailable" : "Mark available"}
                                </button>
                              </div>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                    {canManage ? (
                      <div className="order-materials-picker">
                        <input
                          aria-label="New variant colour"
                          placeholder="New colourway"
                          value={newVariantColour[fabric.id] ?? ""}
                          disabled={busyId === fabric.id}
                          onChange={(event) => setNewVariantColour((current) => ({ ...current, [fabric.id]: event.target.value }))}
                        />
                        <button type="button" className="showroom-link-button" onClick={() => void createVariant(fabric.id)} disabled={busyId === fabric.id}>
                          Add variant
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
