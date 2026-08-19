import "server-only";

import {
  authorizeStaffRequest,
  DEFAULT_CUSTOMER_DEPENDENCIES,
  getRepository,
  hasUnexpectedFields,
  jsonError,
  mapDomainErrorToResponse,
  parseJsonBody,
  type CustomerDependencies,
} from "@/lib/customer/http";
import { CustomerNotFoundError, SessionNotFoundError, type SessionUpdateInput } from "@/lib/customer/repository";
import {
  assertValidSessionTransition,
  isNonEmptyString,
  isShowroomSessionStatus,
  CustomerValidationError,
} from "@/lib/customer/validation";

/**
 * Showroom Session domain routes: create + list
 * (/api/customers/[customerId]/sessions), status/occasion/look updates
 * (/api/sessions/[sessionId]). `finalOutfitSnapshotId` is deliberately NOT
 * in the PATCH allow-list — it is only ever set as a side effect of saving
 * an outfit for this session (see lib/saved-outfit-handler.ts), never by a
 * direct client PATCH.
 */

const CREATE_ALLOWED_FIELDS = new Set(["occasion"]);
const UPDATE_ALLOWED_FIELDS = new Set(["status", "occasion", "selectedLookId"]);

function validateOccasion(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || value.length === 0 || value.length > 60) {
    throw new CustomerValidationError("invalid_occasion", "Please provide a valid occasion.");
  }
  return value;
}

export async function handleCreateSessionRequest(
  request: Request,
  customerId: string,
  dependencies: CustomerDependencies = DEFAULT_CUSTOMER_DEPENDENCIES,
) {
  const authOrResponse = await authorizeStaffRequest(request, dependencies, "session:create");
  if (authOrResponse instanceof Response) return authOrResponse;

  const bodyOrResponse = await parseJsonBody(request);
  if (bodyOrResponse instanceof Response) return bodyOrResponse;
  const body = bodyOrResponse;

  const unexpectedField = hasUnexpectedFields(body, CREATE_ALLOWED_FIELDS);
  if (unexpectedField) return jsonError("Unexpected field in the submitted session.", 400);

  const repository = getRepository(dependencies);

  try {
    const customer = await repository.getCustomerById(customerId);
    if (!customer) throw new CustomerNotFoundError();

    const occasion = validateOccasion(body.occasion);
    const session = await repository.createSession({ customerId, occasion, createdBy: authOrResponse.username });
    return Response.json(session, { status: 201, headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    const mapped = mapDomainErrorToResponse(error);
    if (mapped) return mapped;
    throw error;
  }
}

export async function handleListCustomerSessionsRequest(
  request: Request,
  customerId: string,
  dependencies: CustomerDependencies = DEFAULT_CUSTOMER_DEPENDENCIES,
) {
  const authOrResponse = await authorizeStaffRequest(request, dependencies, "session:read");
  if (authOrResponse instanceof Response) return authOrResponse;

  const repository = getRepository(dependencies);

  try {
    const customer = await repository.getCustomerById(customerId);
    if (!customer) throw new CustomerNotFoundError();

    const sessions = await repository.listCustomerSessions(customerId);
    return Response.json({ sessions }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    const mapped = mapDomainErrorToResponse(error);
    if (mapped) return mapped;
    throw error;
  }
}

export async function handleUpdateSessionRequest(
  request: Request,
  sessionId: string,
  dependencies: CustomerDependencies = DEFAULT_CUSTOMER_DEPENDENCIES,
) {
  const authOrResponse = await authorizeStaffRequest(request, dependencies, "session:update");
  if (authOrResponse instanceof Response) return authOrResponse;

  const bodyOrResponse = await parseJsonBody(request);
  if (bodyOrResponse instanceof Response) return bodyOrResponse;
  const body = bodyOrResponse;

  const unexpectedField = hasUnexpectedFields(body, UPDATE_ALLOWED_FIELDS);
  if (unexpectedField) return jsonError("Unexpected field in the submitted session update.", 400);

  const repository = getRepository(dependencies);

  try {
    const existing = await repository.getSessionById(sessionId);
    if (!existing) throw new SessionNotFoundError();

    const patch: SessionUpdateInput = {};

    if (body.status !== undefined) {
      if (!isShowroomSessionStatus(body.status)) {
        return jsonError("Unknown session status.", 400);
      }
      assertValidSessionTransition(existing.status, body.status);
      patch.status = body.status;
    }
    if (body.occasion !== undefined) patch.occasion = validateOccasion(body.occasion);
    if (body.selectedLookId !== undefined) {
      if (body.selectedLookId !== null && !isNonEmptyString(body.selectedLookId)) {
        return jsonError("Invalid selected look reference.", 400);
      }
      patch.selectedLookId = body.selectedLookId as string | null;
    }

    const session = await repository.updateSession(sessionId, patch);
    if (!session) throw new SessionNotFoundError();
    return Response.json(session, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    const mapped = mapDomainErrorToResponse(error);
    if (mapped) return mapped;
    throw error;
  }
}
