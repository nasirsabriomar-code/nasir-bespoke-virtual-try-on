"use client";

import { useEffect, useState } from "react";
import { PRODUCTION_STAGE_TRANSITIONS } from "@/lib/customer/validation";
import type { AssignableStaff, ProductionJob, ProductionStage, ProductionStageHistoryEntry } from "@/lib/customer/types";
import { ProductionAssignment } from "./ProductionAssignment";

type OrderProductionProps = {
  orderId: string;
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

/**
 * Order Detail's "Production" section (Phase 4C) — shows the production job
 * for this order (if any), its stage history, and the valid next-stage
 * actions. The server independently re-validates every transition and role
 * check regardless of which button is shown here.
 */
export function OrderProduction({ orderId }: OrderProductionProps) {
  const [job, setJob] = useState<ProductionJob | null | undefined>(undefined);
  const [history, setHistory] = useState<ProductionStageHistoryEntry[]>([]);
  const [assignees, setAssignees] = useState<AssignableStaff[] | null>(null);
  const [pendingAssignee, setPendingAssignee] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      setError(null);
      try {
        const [jobResponse, assigneesResponse] = await Promise.all([
          fetch(`/api/orders/${orderId}/production`, { credentials: "same-origin" }),
          fetch("/api/production/assignees", { credentials: "same-origin" }),
        ]);
        if (!active) return;
        if (assigneesResponse.ok) {
          const assigneesPayload: unknown = await assigneesResponse.json();
          setAssignees(
            isRecord(assigneesPayload) && Array.isArray(assigneesPayload.assignees)
              ? (assigneesPayload.assignees as AssignableStaff[])
              : [],
          );
        } else {
          setAssignees(null);
        }
        if (jobResponse.status === 404) {
          setJob(null);
          setHistory([]);
          return;
        }
        const payload: unknown = await jobResponse.json();
        if (!jobResponse.ok) throw new Error(readResponseError(payload, "We couldn't load this order's production job."));
        setJob(isRecord(payload) && isRecord(payload.job) ? (payload.job as ProductionJob) : null);
        setHistory(isRecord(payload) && Array.isArray(payload.history) ? (payload.history as ProductionStageHistoryEntry[]) : []);
      } catch (loadError: unknown) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "We couldn't load this order's production job.");
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [orderId]);

  async function startProduction() {
    setIsStarting(true);
    setError(null);
    try {
      const response = await fetch(`/api/orders/${orderId}/production`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pendingAssignee ? { assignedStaffId: pendingAssignee } : {}),
      });
      const payload: unknown = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(readResponseError(payload, "We couldn't start production for this order."));
      setJob(isRecord(payload) && isRecord(payload.job) ? (payload.job as ProductionJob) : null);
      setHistory(isRecord(payload) && Array.isArray(payload.history) ? (payload.history as ProductionStageHistoryEntry[]) : []);
    } catch (startError: unknown) {
      setError(startError instanceof Error ? startError.message : "We couldn't start production for this order.");
    } finally {
      setIsStarting(false);
    }
  }

  async function moveTo(next: ProductionStage) {
    if (!job) return;
    setIsUpdating(true);
    setError(null);
    try {
      const response = await fetch(`/api/production/${job.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toStage: next }),
      });
      const payload: unknown = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(readResponseError(payload, "We couldn't update this production job."));
      setJob(isRecord(payload) && isRecord(payload.job) ? (payload.job as ProductionJob) : null);
      setHistory(isRecord(payload) && Array.isArray(payload.history) ? (payload.history as ProductionStageHistoryEntry[]) : []);
    } catch (updateError: unknown) {
      setError(updateError instanceof Error ? updateError.message : "We couldn't update this production job.");
    } finally {
      setIsUpdating(false);
    }
  }

  if (job === undefined) {
    return (
      <div className="order-detail-section order-production">
        <span className="customer-profile-card-label">Production</span>
        <p className="customer-profile-empty">Loading…</p>
      </div>
    );
  }

  if (job === null) {
    return (
      <div className="order-detail-section order-production">
        <span className="customer-profile-card-label">Production</span>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <p className="customer-profile-empty">No production job started yet.</p>
        {assignees && assignees.length > 0 ? (
          <div className="order-materials-picker production-assignment-picker">
            <select
              aria-label="Assigned tailor"
              value={pendingAssignee}
              disabled={isStarting}
              onChange={(event) => setPendingAssignee(event.target.value)}
            >
              <option value="">Unassigned</option>
              {assignees.map((staff) => (
                <option key={staff.username} value={staff.username}>{staff.displayName}</option>
              ))}
            </select>
          </div>
        ) : null}
        <button type="button" className="showroom-cta-button" onClick={() => void startProduction()} disabled={isStarting}>
          {isStarting ? "Starting…" : "Start Production"}
        </button>
      </div>
    );
  }

  const nextStages = PRODUCTION_STAGE_TRANSITIONS[job.currentStage] ?? [];

  return (
    <div className="order-detail-section order-production">
      <span className="customer-profile-card-label">Production</span>
      {error ? <p className="form-error" role="alert">{error}</p> : null}

      <div className="order-detail-grid">
        <div className="order-detail-field">
          <span className="customer-profile-card-label">Current Stage</span>
          <p className="customer-profile-value">
            <span className={`order-status-pill production-stage-${job.currentStage.toLowerCase()}`}>{job.currentStage}</span>
          </p>
        </div>
        <div className="order-detail-field">
          <span className="customer-profile-card-label">Assigned Staff</span>
          {assignees ? (
            <ProductionAssignment
              key={`${job.id}:${job.assignedStaffId ?? "none"}`}
              job={job}
              assignees={assignees}
              disabled={isUpdating}
              onAssigned={(updated, nextHistory) => {
                setJob(updated);
                setHistory(nextHistory);
              }}
              onError={setError}
            />
          ) : (
            <p className="customer-profile-value">{job.assignedStaffId ?? "Unassigned"}</p>
          )}
        </div>
        <div className="order-detail-field">
          <span className="customer-profile-card-label">Last Updated</span>
          <p className="customer-profile-value">{formatDateTime(job.updatedAt)}</p>
        </div>
      </div>

      <ul className="customer-list">
        {history.map((entry) => (
          <li key={entry.id}>
            {entry.fromStage ?? "Created"} → {entry.toStage} — {entry.changedBy} — {formatDateTime(entry.createdAt)}
          </li>
        ))}
      </ul>

      {nextStages.length > 0 ? (
        <div className="order-detail-transitions">
          {nextStages.map((stage) => (
            <button
              key={stage}
              type="button"
              className={stage === "CANCELLED" ? "showroom-link-button" : "showroom-cta-button"}
              onClick={() => void moveTo(stage)}
              disabled={isUpdating}
            >
              Move to {stage}
            </button>
          ))}
        </div>
      ) : (
        <p className="customer-profile-empty">This job is in a final state.</p>
      )}
    </div>
  );
}
