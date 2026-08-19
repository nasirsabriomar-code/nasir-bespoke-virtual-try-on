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
 * an outfit) but may NOT create or edit a customer record or record a new
 * measurement version — the two actions with real, hard-to-undo
 * consequences (a wrong phone number merges into someone else's history; a
 * wrong measurement drives a physical garment) are reserved for
 * MANAGER/OWNER.
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
  | "outfit:read";

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
];

const STAFF_ACTIONS: CustomerAction[] = [
  "customer:read",
  "measurement:read",
  "session:create",
  "session:read",
  "session:update",
  "outfit:create",
  "outfit:read",
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
