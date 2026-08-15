import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { AuthConfigurationError, findAuthorizedUser } from "@/lib/auth/config";
import { activateSession, isSessionActive, revokeSession } from "@/lib/auth/session-store";

const SESSION_ISSUER = "nasir-bespoke-try-on";
const SESSION_AUDIENCE = "nasir-bespoke-staff";

function getSessionSecret() {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret || new TextEncoder().encode(secret).byteLength < 32) {
    throw new AuthConfigurationError();
  }
  return new TextEncoder().encode(secret);
}

function getSessionTtlSeconds() {
  const parsed = Number.parseInt(process.env.AUTH_SESSION_TTL_HOURS ?? "12", 10);
  const hours = Number.isFinite(parsed) && parsed >= 1 && parsed <= 168 ? parsed : 12;
  return hours * 60 * 60;
}

function shouldPersistSession() {
  const value = process.env.AUTH_SESSION_PERSISTENT?.trim().toLowerCase();
  return value === "true" || value === "1" || value === "yes";
}

export function getSessionCookieName() {
  return process.env.NODE_ENV === "production"
    ? "__Host-nasir-bespoke-session-v2"
    : "nasir-bespoke-session";
}

export function getLegacySessionCookieName() {
  return process.env.NODE_ENV === "production"
    ? "__Host-nasir-bespoke-session"
    : null;
}

export function getSessionCookieOptions() {
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    priority: "high" as const,
  };

  // Session cookies disappear when the browser session ends. Persistence is
  // opt-in so a device does not stay signed in after the browser is closed.
  return shouldPersistSession()
    ? { ...options, maxAge: getSessionTtlSeconds() }
    : options;
}

export async function createSessionToken(username: string) {
  const user = findAuthorizedUser(username);
  if (!user) throw new AuthConfigurationError();

  const sessionId = crypto.randomUUID();
  const ttlSeconds = getSessionTtlSeconds();

  const token = await new SignJWT({ type: "staff-session" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(user.username)
    .setJti(sessionId)
    .setIssuer(SESSION_ISSUER)
    .setAudience(SESSION_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(getSessionSecret());
  await activateSession(sessionId, user.username, ttlSeconds);
  return token;
}

export async function getCurrentUserFromToken(token: string | null | undefined) {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSessionSecret(), {
      algorithms: ["HS256"],
      issuer: SESSION_ISSUER,
      audience: SESSION_AUDIENCE,
    });

    if (
      payload.type !== "staff-session" ||
      typeof payload.sub !== "string" ||
      typeof payload.jti !== "string"
    ) return null;
    const user = findAuthorizedUser(payload.sub);
    if (!user || !(await isSessionActive(payload.jti, user.username))) return null;
    return user;
  } catch (error) {
    if (error instanceof AuthConfigurationError) throw error;
    return null;
  }
}

export async function revokeSessionToken(token: string | null | undefined) {
  if (!token) return;
  try {
    const { payload } = await jwtVerify(token, getSessionSecret(), {
      algorithms: ["HS256"],
      issuer: SESSION_ISSUER,
      audience: SESSION_AUDIENCE,
    });
    if (typeof payload.jti === "string") await revokeSession(payload.jti);
  } catch (error) {
    if (error instanceof AuthConfigurationError) throw error;
  }
}

function readCookie(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return null;
  for (const pair of cookieHeader.split(";")) {
    const separator = pair.indexOf("=");
    if (separator < 0) continue;
    const key = pair.slice(0, separator).trim();
    if (key !== name) continue;
    return decodeURIComponent(pair.slice(separator + 1).trim());
  }
  return null;
}

export function getSessionTokenFromRequest(request: Request) {
  return readCookie(request.headers.get("cookie"), getSessionCookieName());
}

export async function requireRequestUser(request: Request) {
  return getCurrentUserFromToken(getSessionTokenFromRequest(request));
}
