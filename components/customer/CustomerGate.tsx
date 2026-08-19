"use client";

import { useCallback, useMemo, useState } from "react";
import { ShowroomJourney } from "@/components/showroom/ShowroomJourney";
import { buildSplitOutfitSummary } from "@/lib/split-outfit/compatibility";
import type { SplitOutfitState } from "@/lib/split-outfit/types";
import type { Customer, ShowroomSession } from "@/lib/customer/types";
import type { SignatureLookProvenance } from "@/lib/showroom/types";
import { CustomerProfile } from "./CustomerProfile";
import { CustomerSearch } from "./CustomerSearch";

type CustomerGateProps = {
  state: SplitOutfitState;
  onChange: (updater: (prev: SplitOutfitState) => SplitOutfitState) => void;
};

type GateStep = "search" | "profile" | "in-session";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
function readResponseError(payload: unknown, fallback: string) {
  return isRecord(payload) && typeof payload.error === "string" ? payload.error : fallback;
}

/**
 * Phase 3B customer memory layer, wrapping the existing Phase 3A
 * ShowroomJourney rather than replacing it. "Continue without a customer"
 * skips straight into the unchanged Phase 3A journey — this is deliberately
 * optional, so existing anonymous/manual Split flows are never blocked by
 * the new customer domain, and a deployment with no database configured
 * (DATABASE_URL unset) still fully supports the existing workflow.
 */
export function CustomerGate({ state, onChange }: CustomerGateProps) {
  const [step, setStep] = useState<GateStep>("search");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [session, setSession] = useState<ShowroomSession | null>(null);
  const [provenance, setProvenance] = useState<SignatureLookProvenance>({ type: "manual" });
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  const summary = useMemo(() => buildSplitOutfitSummary(state), [state]);

  const handleProvenanceChange = useCallback((next: SignatureLookProvenance) => {
    setProvenance(next);
    setSaveStatus("idle");
  }, []);

  const saveOutfit = useCallback(async () => {
    if (!customer) return;
    setSaveStatus("saving");
    setSaveError(null);
    try {
      const response = await fetch(`/api/customers/${customer.id}/outfits`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(session ? { sessionId: session.id } : {}),
          source: provenance.type,
          ...(provenance.type === "signature-look" ? { lookId: provenance.lookId } : {}),
          upperId: state.upperId,
          lowerId: state.lowerId,
          shirtId: state.shirtId,
          waistcoatId: state.waistcoatId,
          footwearId: state.footwearId,
          accessoryIds: state.accessoryIds,
        }),
      });
      const payload: unknown = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(readResponseError(payload, "We couldn't save this outfit."));
      setSaveStatus("saved");
    } catch (error: unknown) {
      setSaveStatus("error");
      setSaveError(error instanceof Error ? error.message : "We couldn't save this outfit.");
    }
  }, [customer, session, provenance, state]);

  if (step === "search") {
    return (
      <CustomerSearch
        onSelectCustomer={(selected) => {
          setCustomer(selected);
          setStep("profile");
        }}
        onSkip={() => setStep("in-session")}
      />
    );
  }

  if (step === "profile" && customer) {
    return (
      <CustomerProfile
        customer={customer}
        onBack={() => {
          setCustomer(null);
          setStep("search");
        }}
        onStartSession={(startedSession) => {
          setSession(startedSession);
          setStep("in-session");
        }}
      />
    );
  }

  return (
    <div className="customer-in-session-wrap">
      {customer ? (
        <div className="customer-session-banner">
          <span>
            Showroom session for <strong>{customer.name}</strong>
            {session ? ` — ${session.status}` : ""}
          </span>
          <button
            type="button"
            className="showroom-cta-button customer-save-button"
            onClick={() => void saveOutfit()}
            disabled={summary.recipeStatus !== "VALID" || saveStatus === "saving"}
          >
            {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved ✓" : "Save Outfit to Customer History"}
          </button>
        </div>
      ) : null}
      {saveError ? <p className="form-error" role="alert">{saveError}</p> : null}
      <ShowroomJourney state={state} onChange={onChange} onProvenanceChange={handleProvenanceChange} />
    </div>
  );
}
