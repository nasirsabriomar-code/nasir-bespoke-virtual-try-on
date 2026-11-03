import { NextResponse } from "next/server";
import { AuthConfigurationError } from "@/lib/auth/config";
import { verifyCredentials } from "@/lib/auth/credentials";
import {
  createSessionToken,
  getLegacySessionCookieName,
  getSessionCookieName,
  getSessionCookieOptions,
} from "@/lib/auth/session";
import {
  checkLoginRateLimit,
  getRequestIdentifier,
  RateLimitConfigurationError,
} from "@/lib/rate-limit";
import { isSameOriginRequest } from "@/lib/request-security";
import { readBoundedJson, RequestBodyTooLargeError } from "@/lib/request-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RESPONSE_HEADERS = {
  "Cache-Control": "no-store, private",
  "X-Content-Type-Options": "nosniff",
};

function jsonError(error: string, status: number, headers?: HeadersInit) {
  return NextResponse.json(
    { error },
    { status, headers: { ...RESPONSE_HEADERS, ...headers } },
  );
}

function tooManyAttempts(resetAt: number) {
  return jsonError("Too many sign-in attempts. Please wait and try again.", 429, {
    "Retry-After": String(Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))),
  });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return jsonError("This sign-in request was blocked. Please refresh and try again.", 403);
  }

  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return jsonError("Invalid sign-in request.", 400);
  }

  const declaredLength = Number.parseInt(request.headers.get("content-length") ?? "0", 10);
  if (Number.isFinite(declaredLength) && declaredLength > 4_096) {
    return jsonError("Invalid sign-in request.", 413);
  }

  try {
    const rateLimit = await checkLoginRateLimit(getRequestIdentifier(request));
    if (!rateLimit.allowed) return tooManyAttempts(rateLimit.resetAt);

    const body = await readBoundedJson(request, 4_096);
    if (!body || typeof body !== "object") return jsonError("Invalid sign-in request.", 400);
    const record = body as Record<string, unknown>;
    const username = typeof record.username === "string" ? record.username : "";
    const password = typeof record.password === "string" ? record.password : "";

    // Also limit by account so changing address cannot extend password guessing.
    const accountLimit = await checkLoginRateLimit(`account:${username.trim().toLowerCase().slice(0, 64)}`);
    if (!accountLimit.allowed) return tooManyAttempts(accountLimit.resetAt);

    const user = await verifyCredentials(username, password);

    if (!user) return jsonError("The username or password is incorrect.", 401);

    const response = NextResponse.json(
      { ok: true, displayName: user.displayName },
      { status: 200, headers: RESPONSE_HEADERS },
    );
    response.cookies.set(
      getSessionCookieName(),
      await createSessionToken(user.username),
      getSessionCookieOptions(),
    );
    const legacyCookieName = getLegacySessionCookieName();
    if (legacyCookieName) {
      response.cookies.set(legacyCookieName, "", {
        ...getSessionCookieOptions(),
        maxAge: 0,
      });
    }
    return response;
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return jsonError("Invalid sign-in request.", 413);
    if (error instanceof SyntaxError) return jsonError("Invalid sign-in request.", 400);
    if (error instanceof AuthConfigurationError) {
      console.error("authentication_configuration_error");
      return jsonError("Sign-in is not configured. Please contact the administrator.", 503);
    }
    if (error instanceof RateLimitConfigurationError) {
      console.error("rate_limit_configuration_error", { route: "login" });
      return jsonError("Sign-in is temporarily unavailable. Please try again shortly.", 503);
    }

    console.error("login_failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return jsonError("We couldn't sign you in. Please try again.", 500);
  }
}
