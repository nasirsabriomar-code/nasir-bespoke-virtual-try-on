// Deliberately NOT "server-only" (unlike every sibling lib/auth file): this
// module is dev-only CLI tooling, invoked by scripts/merge-auth-users.mjs
// outside the Next.js server runtime, and must stay importable from plain
// Node via `node --import=tsx`.

export type MergeableAuthUser = {
  username: string;
  displayName: string;
  passwordHash: string;
  role?: string;
};

export class AuthMergeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthMergeError";
  }
}

const USERNAME_PATTERN = /^[a-z0-9._-]{2,64}$/;
const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;
const STAFF_ROLE_VALUES = ["OWNER", "MANAGER", "STAFF", "STYLE_CONSULTANT", "MASTER_TAILOR", "QC_STAFF"];

function decodeBlob(base64: string): unknown {
  try {
    return JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
  } catch {
    throw new AuthMergeError("One of the provided values is not valid base64-encoded JSON.");
  }
}

function validateEntry(entry: unknown): MergeableAuthUser {
  if (!entry || typeof entry !== "object") {
    throw new AuthMergeError("Each allowlist entry must be an object.");
  }
  const record = entry as Record<string, unknown>;
  const username = String(record.username ?? "").trim().toLowerCase();
  const displayName = String(record.displayName ?? "").trim();
  const passwordHash = String(record.passwordHash ?? "");
  const role = record.role === undefined ? undefined : String(record.role).toUpperCase();

  if (!USERNAME_PATTERN.test(username)) {
    throw new AuthMergeError(`Invalid username: "${username || "(empty)"}".`);
  }
  if (displayName.length < 1 || displayName.length > 80) {
    throw new AuthMergeError(`Invalid display name for "${username}".`);
  }
  if (!BCRYPT_HASH_PATTERN.test(passwordHash)) {
    throw new AuthMergeError(
      `"${username}" does not carry a valid bcrypt password hash — only merge already-hashed blobs produced by "npm run auth:create-user".`,
    );
  }
  if (role !== undefined && !STAFF_ROLE_VALUES.includes(role)) {
    throw new AuthMergeError(`Invalid role "${role}" for "${username}".`);
  }

  return role ? { username, displayName, passwordHash, role } : { username, displayName, passwordHash };
}

/**
 * Merges one or more AUTH_USERS_JSON_BASE64 blobs — each the one-user
 * output of `npm run auth:create-user` — into a single multi-user
 * allowlist in the exact shape lib/auth/config.ts's getAuthorizedUsers()
 * consumes. Never touches a plaintext password: every input already
 * carries a bcrypt hash, produced interactively by the caller. A
 * duplicate username is resolved by last-blob-wins (matches how
 * re-running auth:create-user for the same username already overwrites,
 * rather than merges).
 */
export function mergeAuthUserBlobs(base64Blobs: string[]): string {
  if (base64Blobs.length === 0) {
    throw new AuthMergeError("Provide at least one AUTH_USERS_JSON_BASE64 value to merge.");
  }

  const byUsername = new Map<string, MergeableAuthUser>();
  for (const blob of base64Blobs) {
    const decoded = decodeBlob(blob);
    if (!Array.isArray(decoded) || decoded.length < 1) {
      throw new AuthMergeError("Each value must decode to a non-empty JSON array of allowlist entries.");
    }
    for (const entry of decoded) {
      const user = validateEntry(entry);
      byUsername.set(user.username, user);
    }
  }

  const merged = [...byUsername.values()];
  if (merged.length > 50) {
    throw new AuthMergeError("Merged allowlist exceeds the 50-user limit enforced by getAuthorizedUsers().");
  }

  return Buffer.from(JSON.stringify(merged)).toString("base64");
}
