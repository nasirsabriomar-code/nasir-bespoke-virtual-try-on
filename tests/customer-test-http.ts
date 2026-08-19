export const OWNER_USER = { username: "owner1", displayName: "Owner One", passwordHash: "unused", role: "OWNER" as const };
export const MANAGER_USER = { username: "manager1", displayName: "Manager One", passwordHash: "unused", role: "MANAGER" as const };
export const STAFF_USER = { username: "staff1", displayName: "Staff One", passwordHash: "unused", role: "STAFF" as const };

export function sameOriginHeaders(extra: Record<string, string> = {}) {
  return {
    origin: "http://localhost",
    host: "localhost",
    "sec-fetch-site": "same-origin",
    "content-type": "application/json",
    ...extra,
  };
}

export function jsonRequest(url: string, method: string, body?: unknown, headers: Record<string, string> = {}) {
  return new Request(url, {
    method,
    headers: sameOriginHeaders(headers),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

export function authAs(user: typeof OWNER_USER | typeof MANAGER_USER | typeof STAFF_USER | null) {
  return async () => user;
}
