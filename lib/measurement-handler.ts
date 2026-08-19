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
import { CustomerNotFoundError } from "@/lib/customer/repository";
import {
  validateJacketMeasurements,
  validateShirtMeasurements,
  validateTrouserMeasurements,
} from "@/lib/customer/validation";

/**
 * Measurement domain routes (/api/customers/[customerId]/measurements) —
 * append-only history. POST always creates the NEXT version for the
 * customer; there is no update/delete endpoint, so a measurement can never
 * be silently overwritten. `recordedBy` is always the authenticated staff
 * username — never a client-supplied field (it has no field name in the
 * allow-list).
 */

const CREATE_ALLOWED_FIELDS = new Set(["jacketMeasurements", "trouserMeasurements", "shirtMeasurements"]);

export async function handleCreateMeasurementRequest(
  request: Request,
  customerId: string,
  dependencies: CustomerDependencies = DEFAULT_CUSTOMER_DEPENDENCIES,
) {
  const authOrResponse = await authorizeStaffRequest(request, dependencies, "measurement:create");
  if (authOrResponse instanceof Response) return authOrResponse;

  const bodyOrResponse = await parseJsonBody(request);
  if (bodyOrResponse instanceof Response) return bodyOrResponse;
  const body = bodyOrResponse;

  const unexpectedField = hasUnexpectedFields(body, CREATE_ALLOWED_FIELDS);
  if (unexpectedField) return jsonError("Unexpected field in the submitted measurements.", 400);

  const repository = getRepository(dependencies);

  try {
    const customer = await repository.getCustomerById(customerId);
    if (!customer) throw new CustomerNotFoundError();

    const jacketMeasurements = validateJacketMeasurements(body.jacketMeasurements);
    const trouserMeasurements = validateTrouserMeasurements(body.trouserMeasurements);
    const shirtMeasurements = validateShirtMeasurements(body.shirtMeasurements);

    const measurement = await repository.createMeasurementVersion({
      customerId,
      jacketMeasurements,
      trouserMeasurements,
      shirtMeasurements,
      recordedBy: authOrResponse.username,
    });
    return Response.json(measurement, { status: 201, headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    const mapped = mapDomainErrorToResponse(error);
    if (mapped) return mapped;
    throw error;
  }
}

export async function handleGetMeasurementHistoryRequest(
  request: Request,
  customerId: string,
  dependencies: CustomerDependencies = DEFAULT_CUSTOMER_DEPENDENCIES,
) {
  const authOrResponse = await authorizeStaffRequest(request, dependencies, "measurement:read");
  if (authOrResponse instanceof Response) return authOrResponse;

  const repository = getRepository(dependencies);

  try {
    const customer = await repository.getCustomerById(customerId);
    if (!customer) throw new CustomerNotFoundError();

    const history = await repository.getMeasurementHistory(customerId);
    return Response.json({ history }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    const mapped = mapDomainErrorToResponse(error);
    if (mapped) return mapped;
    throw error;
  }
}
