"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ShowroomJourney } from "@/components/showroom/ShowroomJourney";
import { buildSplitOutfitSummary } from "@/lib/split-outfit/compatibility";
import type { SplitOutfitState } from "@/lib/split-outfit/types";
import type { Customer, ShowroomSession, ShowroomSessionStatus } from "@/lib/customer/types";
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

async function patchSession(sessionId: string, patch: { status: ShowroomSessionStatus }): Promise<ShowroomSession> {
  const response = await fetch(`/api/sessions/${sessionId}`, {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const payload: unknown = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(readResponseError(payload, "We couldn't update this session."));
  return payload as ShowroomSession;
}

/**
 * Phase 3B/3C customer memory layer, wrapping the existing Phase 3A
 * ShowroomJourney rather than replacing it. "Continue without a customer"
 * skips straight into the unchanged Phase 3A journey — this is deliberately
 * optional, so existing anonymous/manual Split flows are never blocked by
 * the new customer domain, and a deployment with no database configured
 * (DATABASE_URL unset) still fully supports the existing workflow.
 *
 * Session lifecycle driven from here: OPEN -> EXPLORING happens
 * automatically the moment staff enters the workspace (browsing the
 * Signature Look / customization flow IS "exploring"); -> OUTFIT_SELECTED
 * happens as a side effect of saving an outfit (server-side, see
 * lib/saved-outfit-handler.ts); -> COMPLETED/CANCELLED are explicit staff
 * actions here. Every transition re-validates server-side against the same
 * state machine (lib/customer/validation.ts) regardless of what this UI
 * requests.
 */
export function CustomerGate({ state, onChange }: CustomerGateProps) {
  const [step, setStep] = useState<GateStep>("search");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [session, setSession] = useState<ShowroomSession | null>(null);
  const [provenance, setProvenance] = useState<SignatureLookProvenance>({ type: "manual" });
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sessionActionError, setSessionActionError] = useState<string | null>(null);
  const [isUpdatingSession, setIsUpdatingSession] = useState(false);

  const summary = useMemo(() => buildSplitOutfitSummary(state), [state]);

  useEffect(() => {
    if (step !== "in-session" || !session || session.status !== "OPEN") return;
    let active = true;
    patchSession(session.id, { status: "EXPLORING" })
      .then((updated) => {
        if (active) setSession(updated);
      })
      .catch(() => {
        // Non-fatal: staying in OPEN status doesn't block the rest of the flow.
      });
    return () => {
      active = false;
    };
  }, [step, session]);

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
      if (session) {
        // The server already advanced the session to OUTFIT_SELECTED as a
        // side effect of the save above — refresh the local copy so the
        // "Complete Session" action becomes available immediately.
        setSession((current) => (current ? { ...current, status: "OUTFIT_SELECTED", finalOutfitSnapshotId: (payload as { id: string }).id } : current));
      }
    } catch (error: unknown) {
      setSaveStatus("error");
      setSaveError(error instanceof Error ? error.message : "We couldn't save this outfit.");
    }
  }, [customer, session, provenance, state]);

  const completeSession = useCallback(async () => {
    if (!session) return;
    setIsUpdatingSession(true);
    setSessionActionError(null);
    try {
      const updated = await patchSession(session.id, { status: "COMPLETED" });
      setSession(updated);
    } catch (error: unknown) {
      setSessionActionError(error instanceof Error ? error.message : "We couldn't complete this session.");
    } finally {
      setIsUpdatingSession(false);
    }
  }, [session]);

  const cancelSession = useCallback(async () => {
    if (!session) return;
    setIsUpdatingSession(true);
    setSessionActionError(null);
    try {
      const updated = await patchSession(session.id, { status: "CANCELLED" });
      setSession(updated);
    } catch (error: unknown) {
      setSessionActionError(error instanceof Error ? error.message : "We couldn't cancel this session.");
    } finally {
      setIsUpdatingSession(false);
    }
  }, [session]);

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

  const sessionIsTerminal = session?.status === "COMPLETED" || session?.status === "CANCELLED";

  return (
    <div className="customer-in-session-wrap">
      {customer ? (
        <div className="customer-session-banner">
          <span>
            Showroom session for <strong>{customer.name}</strong>
            {session ? ` — ${session.status}` : ""}
          </span>
          <div className="customer-session-banner-actions">
            <button
              type="button"
              className="showroom-cta-button customer-save-button"
              onClick={() => void saveOutfit()}
              disabled={summary.recipeStatus !== "VALID" || saveStatus === "saving" || sessionIsTerminal}
            >
              {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved ✓" : "Save Outfit to Customer History"}
            </button>
            {session && !sessionIsTerminal ? (
              <>
                <button
                  type="button"
                  className="showroom-cta-button"
                  onClick={() => void completeSession()}
                  disabled={session.status !== "OUTFIT_SELECTED" || isUpdatingSession}
                  title={session.status !== "OUTFIT_SELECTED" ? "Save an outfit before completing the session" : undefined}
                >
                  Complete Session
                </button>
                <button type="button" className="showroom-link-button" onClick={() => void cancelSession()} disabled={isUpdatingSession}>
                  Cancel Session
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
      {saveError ? <p className="form-error" role="alert">{saveError}</p> : null}
      {sessionActionError ? <p className="form-error" role="alert">{sessionActionError}</p> : null}
      {sessionIsTerminal ? (
        <p className="split-section-intro">
          This session is {session?.status.toLowerCase()}. Return to search to start a new visit.
        </p>
      ) : null}
      <ShowroomJourney state={state} onChange={onChange} onProvenanceChange={handleProvenanceChange} />
    </div>
  );
}
