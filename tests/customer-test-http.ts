export const OWNER_USER = { username: "owner1", displayName: "Owner One", passwordHash: "unused", role: "OWNER" as const };
export const MANAGER_USER = { username: "manager1", displayName: "Manager One", passwordHash: "unused", role: "MANAGER" as const };
export const STAFF_USER = { username: "staff1", displayName: "Staff One", passwordHash: "unused", role: "STAFF" as const };
export const STYLE_CONSULTANT_USER = { username: "consultant1", displayName: "Consultant One", passwordHash: "unused", role: "STYLE_CONSULTANT" as const };
export const MASTER_TAILOR_USER = { username: "tailor1", displayName: "Tailor One", passwordHash: "unused", role: "MASTER_TAILOR" as const };
export const QC_STAFF_USER = { username: "qc1", displayName: "QC One", passwordHash: "unused", role: "QC_STAFF" as const };

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

export function authAs(
  user:
    | typeof OWNER_USER
    | typeof MANAGER_USER
    | typeof STAFF_USER
    | typeof STYLE_CONSULTANT_USER
    | typeof MASTER_TAILOR_USER
    | typeof QC_STAFF_USER
    | null,
) {
  return async () => user;
}
