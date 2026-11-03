import "server-only";

export type AuthorizedUser = {
  username: string;
  displayName: string;
  passwordHash: string;
  role?: "staff" | "admin";
  authVersion?: string;
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
      const role = record.role ?? "staff";
      const authVersion = record.authVersion ?? "1";
      if ((role !== "staff" && role !== "admin") || typeof authVersion !== "string" || !/^[a-zA-Z0-9._-]{1,64}$/.test(authVersion)) throw new AuthConfigurationError();

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
      return { username, displayName, passwordHash, role, authVersion };
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
