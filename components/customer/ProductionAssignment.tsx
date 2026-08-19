"use client";

import { useState } from "react";
import type { AssignableStaff, ProductionJob, ProductionStageHistoryEntry } from "@/lib/customer/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
function readResponseError(payload: unknown, fallback: string) {
  return isRecord(payload) && typeof payload.error === "string" ? payload.error : fallback;
}

function labelFor(assignees: AssignableStaff[], username: string | null): string {
  if (!username) return "Unassigned";
  return assignees.find((staff) => staff.username === username)?.displayName ?? username;
}

type ProductionAssignmentProps = {
  job: ProductionJob;
  assignees: AssignableStaff[];
  disabled?: boolean;
  onAssigned: (job: ProductionJob, history: ProductionStageHistoryEntry[]) => void;
  onError: (message: string) => void;
};

/**
 * Owner/Manager-only assign/reassign control. Submits the current stage as
 * a no-op toStage plus assignedStaffId — the server re-validates permission
 * and assignee eligibility independently of this UI.
 */
export function ProductionAssignment({ job, assignees, disabled, onAssigned, onError }: ProductionAssignmentProps) {
  const [draft, setDraft] = useState(job.assignedStaffId ?? "");
  const [isSaving, setIsSaving] = useState(false);

  async function save() {
    const next = draft === "" ? null : draft;
    if (next === job.assignedStaffId) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/production/${job.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toStage: job.currentStage, assignedStaffId: next }),
      });
      const payload: unknown = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(readResponseError(payload, "We couldn't update this assignment."));
      const updated = isRecord(payload) && isRecord(payload.job) ? (payload.job as ProductionJob) : job;
      const history = isRecord(payload) && Array.isArray(payload.history) ? (payload.history as ProductionStageHistoryEntry[]) : [];
      onAssigned(updated, history);
    } catch (saveError: unknown) {
      onError(saveError instanceof Error ? saveError.message : "We couldn't update this assignment.");
    } finally {
      setIsSaving(false);
    }
  }

  if (assignees.length === 0) {
    return <p className="customer-profile-empty">No assignable tailors are configured.</p>;
  }

  return (
    <div className="order-materials-picker production-assignment-picker">
      <select
        id={`assign-${job.id}`}
        aria-label="Assigned tailor"
        value={draft}
        disabled={disabled || isSaving}
        onChange={(event) => setDraft(event.target.value)}
      >
        <option value="">Unassigned</option>
        {assignees.map((staff) => (
          <option key={staff.username} value={staff.username}>
            {staff.displayName}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="showroom-cta-button"
        onClick={() => void save()}
        disabled={disabled || isSaving || (draft === "" ? job.assignedStaffId === null : draft === job.assignedStaffId)}
      >
        {isSaving ? "Saving…" : job.assignedStaffId ? "Reassign" : "Assign"}
      </button>
      <span className="customer-profile-value">{labelFor(assignees, job.assignedStaffId)}</span>
    </div>
  );
}

export function assigneeLabel(assignees: AssignableStaff[] | null, username: string | null): string {
  if (!username) return "Unassigned";
  if (!assignees) return username;
  return labelFor(assignees, username);
}
