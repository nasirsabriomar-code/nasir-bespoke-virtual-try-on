const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function normalizeOrigin(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

function getExpectedOrigins(request: Request) {
  const origins = new Set<string>();
  const requestOrigin = normalizeOrigin(request.url);
  if (requestOrigin) origins.add(requestOrigin);

  // Framework dev/proxy layers may normalize Request.url to an internal host.
  // The browser cannot choose the HTTP Host header independently of its target,
  // so matching Origin against Host remains a valid same-origin check.
  const host = request.headers.get("host")?.trim();
  if (host) {
    const protocol = requestOrigin ? new URL(requestOrigin).protocol : "https:";
    const hostOrigin = normalizeOrigin(`${protocol}//${host}`);
    if (hostOrigin) origins.add(hostOrigin);
  }

  for (const configured of (process.env.AUTH_ALLOWED_ORIGINS ?? "").split(",")) {
    const origin = normalizeOrigin(configured.trim());
    if (origin) origins.add(origin);
  }

  return origins;
}

export function isSameOriginRequest(request: Request) {
  if (!STATE_CHANGING_METHODS.has(request.method.toUpperCase())) return true;
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;

  const origin = normalizeOrigin(request.headers.get("origin") ?? "");
  if (!origin) return false;
  return getExpectedOrigins(request).has(origin);
}
