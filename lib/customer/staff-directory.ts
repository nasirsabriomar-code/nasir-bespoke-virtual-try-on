import "server-only";

import { getAuthorizedUsers } from "@/lib/auth/config";
import { CustomerValidationError } from "./validation";
import type { AssignableStaff } from "./types";

const ASSIGNABLE_ROLE = "MASTER_TAILOR";

export type StaffDirectory = {
  listAssignable(): AssignableStaff[];
  assertAssignable(username: string): void;
};

function toAssignable(user: { username: string; displayName: string; role?: string }): AssignableStaff | null {
  if (user.role !== ASSIGNABLE_ROLE) return null;
  return { username: user.username, displayName: user.displayName, role: ASSIGNABLE_ROLE };
}

/**
 * Default assignee source: the AUTH_USERS_JSON(_BASE64) allowlist, filtered
 * to MASTER_TAILOR. Never returns passwordHash or other auth secrets.
 * There is no Staff table — this is a safe projection of identities the
 * server already uses to authenticate.
 */
export const allowlistStaffDirectory: StaffDirectory = {
  listAssignable() {
    return getAuthorizedUsers()
      .map(toAssignable)
      .filter((entry): entry is AssignableStaff => entry !== null);
  },
  assertAssignable(username: string) {
    const match = getAuthorizedUsers().find((user) => user.username === username && user.role === ASSIGNABLE_ROLE);
    if (!match) {
      throw new CustomerValidationError("invalid_staff_id", "Please provide a valid staff username.");
    }
  },
};
