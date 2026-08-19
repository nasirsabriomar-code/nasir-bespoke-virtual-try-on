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
  | "order:material:update";

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
];

const ROLE_PERMISSIONS: Record<StaffRole, ReadonlySet<CustomerAction>> = {
  OWNER: new Set(ALL_ACTIONS),
  MANAGER: new Set(ALL_ACTIONS),
  STAFF: new Set(STAFF_ACTIONS),
};

export function canPerform(role: StaffRole, action: CustomerAction): boolean {
  return ROLE_PERMISSIONS[role]?.has(action) ?? false;
}

/** Least-privilege default for any staff identity with no explicit role on file. */
export const DEFAULT_STAFF_ROLE: StaffRole = "STAFF";

export function isStaffRole(value: unknown): value is StaffRole {
  return value === "OWNER" || value === "MANAGER" || value === "STAFF";
}
