import { NextResponse } from "next/server";
import { AuthConfigurationError } from "@/lib/auth/config";
import {
  getLegacySessionCookieName,
  getSessionCookieName,
  getSessionCookieOptions,
  getSessionTokenFromRequest,
  revokeSessionToken,
} from "@/lib/auth/session";
import { isSameOriginRequest } from "@/lib/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { error: "This sign-out request was blocked. Please refresh and try again." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    await revokeSessionToken(getSessionTokenFromRequest(request));
  } catch (error) {
    console.error("session_revocation_failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
      configurationError: error instanceof AuthConfigurationError,
    });
    return NextResponse.json(
      { error: "We couldn't sign you out safely. Please try again." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  // Next's internal request URL can differ from the browser's host behind a
  // proxy or on loopback. A relative redirect stays on the authenticated origin.
  const response = new NextResponse(null, { status: 303, headers: { Location: "/login", "Cache-Control": "no-store, private" } });
  response.cookies.set(getSessionCookieName(), "", {
    ...getSessionCookieOptions(),
    maxAge: 0,
  });
  const legacyCookieName = getLegacySessionCookieName();
  if (legacyCookieName) {
    response.cookies.set(legacyCookieName, "", {
      ...getSessionCookieOptions(),
      maxAge: 0,
    });
  }
  return response;
}
