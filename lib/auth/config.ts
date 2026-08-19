import "server-only";
import { DEFAULT_STAFF_ROLE, isStaffRole } from "@/lib/customer/permissions";
import type { StaffRole } from "@/lib/customer/types";

export type AuthorizedUser = {
  username: string;
  displayName: string;
  passwordHash: string;
  /**
   * Customer-domain authorization role (see lib/customer/permissions.ts).
   * Optional here so every pre-existing test/dev fixture that constructs an
   * authenticated-user object without a role keeps compiling — callers that
   * need a role (lib/customer/http.ts's authorizeStaffRequest) default a
   * missing one to the least-privilege STAFF, never an elevated role.
   * getAuthorizedUsers() below always populates this from the real
   * allowlist (defaulting to STAFF itself when an entry omits it).
   */
  role?: StaffRole;
};

export class AuthConfigurationError extends Error {
  constructor() {
    super("Authentication is not configured correctly.");
    this.name = "AuthConfigurationError";
  }
}

function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

function isBcryptHash(value: string) {
  return /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(value);
}

export function getAuthorizedUsers(): AuthorizedUser[] {
  const encoded = process.env.AUTH_USERS_JSON_BASE64;
  const raw = encoded
    ? Buffer.from(encoded, "base64").toString("utf8")
    : process.env.AUTH_USERS_JSON;
  if (!raw) throw new AuthConfigurationError();

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 50) {
      throw new AuthConfigurationError();
    }

    const usernames = new Set<string>();
    return parsed.map((entry) => {
      if (!entry || typeof entry !== "object") throw new AuthConfigurationError();

      const record = entry as Record<string, unknown>;
      const username = normalizeUsername(String(record.username ?? ""));
      const displayName = String(record.displayName ?? "").trim();
      const passwordHash = String(record.passwordHash ?? "");
      // Optional in the allowlist entry so existing deployments' encoded
      // AUTH_USERS_JSON_BASE64 keeps working unchanged — an entry with no
      // role field gets the least-privilege default, never elevated access.
      const role = isStaffRole(record.role) ? record.role : DEFAULT_STAFF_ROLE;

      if (
        !/^[a-z0-9._-]{2,64}$/.test(username) ||
        displayName.length < 1 ||
        displayName.length > 80 ||
        !isBcryptHash(passwordHash) ||
        usernames.has(username)
      ) {
        throw new AuthConfigurationError();
      }

      usernames.add(username);
      return { username, displayName, passwordHash, role };
    });
  } catch (error) {
    if (error instanceof AuthConfigurationError) throw error;
    throw new AuthConfigurationError();
  }
}

export function findAuthorizedUser(username: string) {
  const normalized = normalizeUsername(username);
  return getAuthorizedUsers().find((user) => user.username === normalized) ?? null;
}
