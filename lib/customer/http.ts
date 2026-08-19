import "server-only";

import { AuthConfigurationError } from "@/lib/auth/config";
import { requireRequestUser } from "@/lib/auth/session";
import { isSameOriginRequest } from "@/lib/request-security";
import { CustomerValidationError } from "./validation";
import {
  CustomerNotFoundError,
  DatabaseConfigurationError,
  DuplicatePhoneError,
  InvalidReferenceError,
  SessionNotFoundError,
  type CustomerRepository,
} from "./repository";
import { prismaCustomerRepository } from "./prisma-repository";
import { canPerform, type CustomerAction } from "./permissions";
import type { StaffRole } from "./types";

/**
 * Shared request-handling primitives for every customer-domain route
 * handler (lib/customer-handler.ts, lib/measurement-handler.ts,
 * lib/session-handler.ts, lib/saved-outfit-handler.ts) — same-origin check,
 * auth, JSON parsing, permission checks, and one central error->HTTP-status
 * mapping, so each handler file only contains its own domain logic.
 */

export const JSON_HEADERS = {
  "Cache-Control": "no-store, private",
  "Content-Type": "application/json",
  "X-Content-Type-Options": "nosniff",
};

export function jsonError(error: string, status: number) {
  return Response.json({ error }, { status, headers: JSON_HEADERS });
}

export type AuthenticatedStaff = { username: string; displayName: string; role: StaffRole };

export type CustomerDependencies = {
  authenticate: typeof requireRequestUser;
  /** Injectable for tests only — defaults to the real Postgres-backed repository. */
  repository?: CustomerRepository;
};

export const DEFAULT_CUSTOMER_DEPENDENCIES: CustomerDependencies = {
  authenticate: requireRequestUser,
};

export function getRepository(dependencies: CustomerDependencies): CustomerRepository {
  return dependencies.repository ?? prismaCustomerRepository;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Runs the shared preflight for every customer-domain endpoint: same-origin
 * (state-changing methods only — isSameOriginRequest is itself a no-op for
 * GET), authentication, and a permission check for the given action.
 * Returns the authenticated staff identity, or a Response to return
 * immediately if any check failed.
 */
export async function authorizeStaffRequest(
  request: Request,
  dependencies: CustomerDependencies,
  action: CustomerAction,
): Promise<AuthenticatedStaff | Response> {
  if (!isSameOriginRequest(request)) {
    return jsonError("This request was blocked. Please refresh and try again.", 403);
  }

  let user;
  try {
    user = await dependencies.authenticate(request);
  } catch (error) {
    if (error instanceof AuthConfigurationError) {
      console.error("authentication_configuration_error", { route: "customer-domain" });
      return jsonError("Authentication is not configured.", 503);
    }
    throw error;
  }
  if (!user) return jsonError("Your session has expired. Please sign in again.", 401);

  // The dev-mode fallback and any legacy allowlist entry without a role
  // resolve to "STAFF" (the auth layer's own least-privilege default) —
  // this is not re-derived here, only trusted from the authenticated user.
  const role: StaffRole = "role" in user && typeof user.role === "string" ? (user.role as StaffRole) : "STAFF";

  if (!canPerform(role, action)) {
    return jsonError("You do not have permission to perform this action.", 403);
  }

  return { username: user.username, displayName: user.displayName, role };
}

export async function parseJsonBody(request: Request): Promise<Record<string, unknown> | Response> {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return jsonError("Please submit the request as JSON.", 400);
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("The request body is malformed.", 400);
  }
  if (!isRecord(body)) return jsonError("The request body is malformed.", 400);
  return body;
}

export function hasUnexpectedFields(body: Record<string, unknown>, allowed: ReadonlySet<string>): string | null {
  return Object.keys(body).find((key) => !allowed.has(key)) ?? null;
}

/**
 * Central error->HTTP mapping. Every customer-domain handler funnels its
 * catch block through this so the status-code policy lives in one place.
 */
export function mapDomainErrorToResponse(error: unknown): Response | null {
  if (error instanceof DatabaseConfigurationError) {
    console.error("customer_database_not_configured", {});
    return jsonError("Customer records are not yet configured for this deployment.", 503);
  }
  if (error instanceof CustomerValidationError) return jsonError(error.message, 400);
  if (error instanceof DuplicatePhoneError) return jsonError(error.message, 409);
  if (error instanceof CustomerNotFoundError) return jsonError(error.message, 404);
  if (error instanceof SessionNotFoundError) return jsonError(error.message, 404);
  if (error instanceof InvalidReferenceError) return jsonError(error.message, 400);
  return null;
}
