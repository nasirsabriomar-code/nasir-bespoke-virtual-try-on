import type { StaffRole } from "./types";

/**
 * The smallest correct authorization boundary for the customer memory
 * domain — not a general RBAC platform. One flat action → role-set lookup;
 * no resource-level ownership/assignment model (none was requested).
 *
 * OWNER and MANAGER are intentionally identical in this milestone: there is
 * no owner-only operation yet (no user management, no deletion, no billing)
 * — the distinction exists in the type system now so a genuinely owner-only
 * action can be added later without redesigning this module.
 *
 * STAFF may run the full showroom flow end-to-end (create a session, save
 * an outfit, create an order) but may NOT create or edit a customer record,
 * record a new measurement version, or move an order through its
 * production lifecycle — these are the actions with real, hard-to-undo
 * consequences (a wrong phone number merges into someone else's history; a
 * wrong measurement drives a physical garment; an order moved into
 * TAILORING commits atelier resources) and are reserved for MANAGER/OWNER.
 * Creating the order itself (DRAFT) is still a STAFF action — it is the
 * natural conclusion of the showroom flow STAFF already owns end-to-end;
 * everything that happens to the order AFTER that is a MANAGER/OWNER call.
 *
 * Fabric catalogue entries are curated business data — creating/editing a
 * fabric (fabric:create) is reserved for MANAGER/OWNER, same rationale as
 * customer:create. fabric:read is open to STAFF (they need to browse the
 * catalogue while placing an order). Attaching a fabric selection to an
 * order (order:material:update) is STAFF-permitted: like order:create, it
 * is part of the same showroom finalization STAFF already owns end-to-end,
 * and is a selection, not a production-lifecycle change — it is deliberately
 * NOT bundled with order:update (status transitions), which stays
 * MANAGER/OWNER only.
 *
 * Phase 4C adds three narrow atelier-operations roles, each granted ONLY
 * the actions its one job requires — deliberately not "STAFF plus a bit
 * more," to satisfy "do not allow production staff to edit customer truth"
 * structurally rather than by convention:
 *   - STYLE_CONSULTANT: read-only "customer/order visibility" — every
 *     *:read action, zero create/update actions anywhere, including its
 *     own production:read (it can see the Production section on an order
 *     it can already view, but cannot create a job or move a stage).
 *   - MASTER_TAILOR: production:read + production:update ONLY. No
 *     customer/order/fabric access at all — they work from the Atelier
 *     Dashboard (production-domain data only), not the Customer Profile
 *     tree. lib/production-handler.ts additionally scopes both actions to
 *     jobs where assignedStaffId matches their own username, and excludes
 *     them from making the FINAL_QC outcome decision or from moving a job
 *     to CANCELLED — both reserved for QC_STAFF/MANAGER/OWNER respectively.
 *   - QC_STAFF: production:read + production:update ONLY, same isolation
 *     as MASTER_TAILOR. lib/production-handler.ts additionally restricts
 *     their production:update to jobs currently AT the FINAL_QC stage —
 *     "quality stage updates" only, nothing else.
 * production:create (a MANAGER/OWNER call, same rationale as order:update)
 * is intentionally absent from all three new roles.
 * production:assign (Phase 4D) is likewise MANAGER/OWNER only — listing
 * assignable tailors and writing assignedStaffId. MASTER_TAILOR/QC_STAFF
 * keep production:update for stage movement of in-scope jobs but cannot
 * assign or reassign.
 */
export type CustomerAction =
  | "customer:create"
  | "customer:read"
  | "customer:update"
  | "measurement:create"
  | "measurement:read"
  | "session:create"
  | "session:read"
  | "session:update"
  | "outfit:create"
  | "outfit:read"
  | "order:create"
  | "order:read"
  | "order:update"
  | "fabric:create"
  | "fabric:read"
  | "order:material:update"
  | "production:create"
  | "production:read"
  | "production:update"
  | "production:assign";

const ALL_ACTIONS: CustomerAction[] = [
  "customer:create",
  "customer:read",
  "customer:update",
  "measurement:create",
  "measurement:read",
  "session:create",
  "session:read",
  "session:update",
  "outfit:create",
  "outfit:read",
  "order:create",
  "order:read",
  "order:update",
  "fabric:create",
  "fabric:read",
  "order:material:update",
  "production:create",
  "production:read",
  "production:update",
  "production:assign",
];

const STAFF_ACTIONS: CustomerAction[] = [
  "customer:read",
  "measurement:read",
  "session:create",
  "session:read",
  "session:update",
  "outfit:create",
  "outfit:read",
  "order:create",
  "order:read",
  "fabric:read",
  "order:material:update",
  "production:read",
];

const READ_ONLY_ACTIONS: CustomerAction[] = [
  "customer:read",
  "measurement:read",
  "session:read",
  "outfit:read",
  "order:read",
  "fabric:read",
  "production:read",
];

const PRODUCTION_STAFF_ACTIONS: CustomerAction[] = ["production:read", "production:update"];

const ROLE_PERMISSIONS: Record<StaffRole, ReadonlySet<CustomerAction>> = {
  OWNER: new Set(ALL_ACTIONS),
  MANAGER: new Set(ALL_ACTIONS),
  STAFF: new Set(STAFF_ACTIONS),
  STYLE_CONSULTANT: new Set(READ_ONLY_ACTIONS),
  MASTER_TAILOR: new Set(PRODUCTION_STAFF_ACTIONS),
  QC_STAFF: new Set(PRODUCTION_STAFF_ACTIONS),
};

export function canPerform(role: StaffRole, action: CustomerAction): boolean {
  return ROLE_PERMISSIONS[role]?.has(action) ?? false;
}

/** Least-privilege default for any staff identity with no explicit role on file. */
export const DEFAULT_STAFF_ROLE: StaffRole = "STAFF";

const STAFF_ROLE_VALUES: readonly StaffRole[] = ["OWNER", "MANAGER", "STAFF", "STYLE_CONSULTANT", "MASTER_TAILOR", "QC_STAFF"];

export function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === "string" && STAFF_ROLE_VALUES.includes(value as StaffRole);
}

/**
 * Resource-level scoping for production jobs, layered on top of the flat
 * production:read/production:update grant above (canPerform() must already
 * have passed before this is consulted). Not part of the general
 * CustomerAction model because it is the one place in this domain that
 * needs per-resource checks — see the STYLE_CONSULTANT/MASTER_TAILOR/
 * QC_STAFF doc comment above for the full rationale.
 *
 * OWNER/MANAGER/STAFF/STYLE_CONSULTANT: unrestricted (their flat grant is
 * the whole story — STYLE_CONSULTANT only ever has production:read, never
 * production:update, so it never reaches the update check below).
 */
export function canReadProductionJob(role: StaffRole, username: string, assignedStaffId: string | null): boolean {
  if (role === "MASTER_TAILOR") return assignedStaffId === username;
  return true;
}

export function canUpdateProductionJob(
  role: StaffRole,
  username: string,
  currentStage: string,
  assignedStaffId: string | null,
  toStage: string,
): boolean {
  // Cancelling a job is a managerial call, regardless of who initiated the request.
  if (toStage === "CANCELLED") return role === "OWNER" || role === "MANAGER";
  if (role === "QC_STAFF") return currentStage === "FINAL_QC";
  if (role === "MASTER_TAILOR") return assignedStaffId === username && currentStage !== "FINAL_QC";
  return role === "OWNER" || role === "MANAGER";
}
