"use client";

import { useEffect, useState } from "react";
import { LogoutButton } from "@/components/LogoutButton";
import { UsageHistory } from "@/components/UsageHistory";
import { ProductionAssignment, assigneeLabel } from "@/components/customer/ProductionAssignment";
import type { AssignableStaff, ProductionJob, ProductionStage } from "@/lib/customer/types";

type AtelierDashboardProps = {
  displayName: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
function readResponseError(payload: unknown, fallback: string) {
  return isRecord(payload) && typeof payload.error === "string" ? payload.error : fallback;
}

function shortId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

type Column = { title: string; stages: ProductionStage[] };

const COLUMNS: Column[] = [
  { title: "Incoming", stages: ["CONFIRMED", "FABRIC_READY"] },
  { title: "Cutting", stages: ["CUTTING"] },
  { title: "Stitching", stages: ["STITCHING"] },
  { title: "Trial", stages: ["FIRST_TRIAL", "ALTERATION"] },
  { title: "QC", stages: ["FINAL_QC"] },
];

const ACTIVE_STAGES: ProductionStage[] = COLUMNS.flatMap((column) => column.stages);

/**
 * A minimal production dashboard for tailor/QC staff — four columns of
 * active jobs grouped by stage. Not an ERP grid: read-only, no in-place
 * stage transitions here (those live on Order Detail's Production section).
 */
export function AtelierDashboard({ displayName }: AtelierDashboardProps) {
  const [jobs, setJobs] = useState<ProductionJob[] | null>(null);
  const [assignees, setAssignees] = useState<AssignableStaff[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setError(null);
      try {
        const [jobsResponse, assigneesResponse] = await Promise.all([
          fetch("/api/production", { credentials: "same-origin" }),
          fetch("/api/production/assignees", { credentials: "same-origin" }),
        ]);
        if (!active) return;
        const payload: unknown = await jobsResponse.json();
        if (!jobsResponse.ok) throw new Error(readResponseError(payload, "We couldn't load production jobs."));
        setJobs(isRecord(payload) && Array.isArray(payload.jobs) ? (payload.jobs as ProductionJob[]) : []);
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
      } catch (loadError: unknown) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "We couldn't load production jobs.");
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="atelier-shell">
      <header className="atelier-mobile-header">
        <div className="atelier-mobile-brand">
          <span className="atelier-monogram" aria-hidden="true">N</span>
          <span><strong>NASIR BESPOKE</strong><small>Private atelier</small></span>
        </div>
        <div className="atelier-mobile-actions">
          <UsageHistory />
          <LogoutButton />
        </div>
      </header>
      <aside className="atelier-sidebar" aria-label="Nasir Bespoke navigation">
        <div className="atelier-sidebar-top">
          <span className="atelier-monogram" aria-hidden="true">N</span>
          <span className="atelier-brand"><strong>NASIR BESPOKE</strong><span>Private atelier</span></span>
        </div>
        <nav className="atelier-nav" aria-label="Primary navigation">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- plain full-page nav back to the try-on flow, consistent with /atelier's own nav link. */}
          <a href="/" className="atelier-nav-link">New Creation</a>
          <span className="atelier-nav-link is-active"><span aria-hidden="true">✦</span>Atelier</span>
          <UsageHistory />
        </nav>
        <div className="atelier-sidebar-footer">
          <div className="atelier-user">
            <span className="user-initial" aria-hidden="true">{displayName.charAt(0).toUpperCase()}</span>
            <span><strong>{displayName}</strong><small>Showroom access</small></span>
          </div>
          <LogoutButton />
        </div>
      </aside>
      <section className="atelier-main">
        <div className="atelier-dashboard-header">
          <div>
            <p className="eyebrow">Nasir Bespoke</p>
            <h1>Atelier Dashboard</h1>
          </div>
          <p className="customer-profile-value">
            {jobs?.filter((job) => ACTIVE_STAGES.includes(job.currentStage)).length ?? 0} active jobs
          </p>
        </div>

        {error ? <p className="form-error" role="alert">{error}</p> : null}

        {jobs === null ? (
          <p className="customer-profile-empty">Loading…</p>
        ) : jobs.length === 0 ? (
          <p className="customer-profile-empty">No active production jobs yet.</p>
        ) : (
          <div className="atelier-dashboard-columns">
            {COLUMNS.map((column) => {
              const columnJobs = jobs.filter((job) => column.stages.includes(job.currentStage));
              return (
                <div key={column.title} className="atelier-dashboard-column">
                  <span className="customer-profile-card-label">{column.title}</span>
                  {columnJobs.length === 0 ? (
                    <p className="customer-profile-empty">No jobs.</p>
                  ) : (
                    columnJobs.map((job) => (
                      <div key={job.id} className="atelier-dashboard-job">
                        <span className="atelier-dashboard-job-id">{shortId(job.orderId)}</span>
                        <span className={`order-status-pill production-stage-${job.currentStage.toLowerCase()}`}>{job.currentStage}</span>
                        {assignees ? (
                          <ProductionAssignment
                            key={`${job.id}:${job.assignedStaffId ?? "none"}`}
                            job={job}
                            assignees={assignees}
                            onAssigned={(updated) => {
                              setJobs((current) =>
                                current ? current.map((entry) => (entry.id === updated.id ? updated : entry)) : current,
                              );
                            }}
                            onError={setError}
                          />
                        ) : (
                          <span className="customer-profile-value">{assigneeLabel(null, job.assignedStaffId)}</span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
