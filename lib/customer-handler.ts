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
import {
  validateCustomerEmail,
  validateCustomerName,
  validateCustomerPhone,
  validateCustomerPreferences,
} from "@/lib/customer/validation";

/**
 * Customer domain routes: search/create (/api/customers), get/update
 * (/api/customers/[customerId]). Server controls id, createdAt, updatedAt —
 * a client can never supply or override any of these (they simply have no
 * field name in the allow-lists below).
 */

const CREATE_ALLOWED_FIELDS = new Set(["name", "phone", "email", "preferences"]);
const UPDATE_ALLOWED_FIELDS = new Set(["name", "email", "preferences"]);

export async function handleCreateCustomerRequest(
  request: Request,
  dependencies: CustomerDependencies = DEFAULT_CUSTOMER_DEPENDENCIES,
) {
  const authOrResponse = await authorizeStaffRequest(request, dependencies, "customer:create");
  if (authOrResponse instanceof Response) return authOrResponse;

  const bodyOrResponse = await parseJsonBody(request);
  if (bodyOrResponse instanceof Response) return bodyOrResponse;
  const body = bodyOrResponse;

  const unexpectedField = hasUnexpectedFields(body, CREATE_ALLOWED_FIELDS);
  if (unexpectedField) return jsonError("Unexpected field in the submitted customer.", 400);

  try {
    const name = validateCustomerName(body.name);
    const phone = validateCustomerPhone(body.phone);
    const email = validateCustomerEmail(body.email);
    const preferences = validateCustomerPreferences(body.preferences);

    const customer = await getRepository(dependencies).createCustomer({ name, phone, email, preferences });
    return Response.json(customer, { status: 201, headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    const mapped = mapDomainErrorToResponse(error);
    if (mapped) return mapped;
    throw error;
  }
}

export async function handleSearchCustomersRequest(
  request: Request,
  dependencies: CustomerDependencies = DEFAULT_CUSTOMER_DEPENDENCIES,
) {
  const authOrResponse = await authorizeStaffRequest(request, dependencies, "customer:read");
  if (authOrResponse instanceof Response) return authOrResponse;

  const url = new URL(request.url);
  const rawQuery = url.searchParams.get("q");
  const query = rawQuery && rawQuery.trim().length > 0 ? rawQuery.trim().slice(0, 200) : null;

  try {
    const customers = await getRepository(dependencies).searchCustomers(query, 25);
    return Response.json({ customers }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    const mapped = mapDomainErrorToResponse(error);
    if (mapped) return mapped;
    throw error;
  }
}

export async function handleGetCustomerRequest(
  request: Request,
  customerId: string,
  dependencies: CustomerDependencies = DEFAULT_CUSTOMER_DEPENDENCIES,
) {
  const authOrResponse = await authorizeStaffRequest(request, dependencies, "customer:read");
  if (authOrResponse instanceof Response) return authOrResponse;

  try {
    const customer = await getRepository(dependencies).getCustomerById(customerId);
    if (!customer) return jsonError("Customer not found.", 404);
    return Response.json(customer, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    const mapped = mapDomainErrorToResponse(error);
    if (mapped) return mapped;
    throw error;
  }
}

export async function handleUpdateCustomerRequest(
  request: Request,
  customerId: string,
  dependencies: CustomerDependencies = DEFAULT_CUSTOMER_DEPENDENCIES,
) {
  const authOrResponse = await authorizeStaffRequest(request, dependencies, "customer:update");
  if (authOrResponse instanceof Response) return authOrResponse;

  const bodyOrResponse = await parseJsonBody(request);
  if (bodyOrResponse instanceof Response) return bodyOrResponse;
  const body = bodyOrResponse;

  const unexpectedField = hasUnexpectedFields(body, UPDATE_ALLOWED_FIELDS);
  if (unexpectedField) return jsonError("Unexpected field in the submitted update.", 400);

  try {
    const patch: { name?: string; email?: string | null; preferences?: ReturnType<typeof validateCustomerPreferences> } = {};
    if (body.name !== undefined) patch.name = validateCustomerName(body.name);
    if (body.email !== undefined) patch.email = validateCustomerEmail(body.email);
    if (body.preferences !== undefined) patch.preferences = validateCustomerPreferences(body.preferences);

    const customer = await getRepository(dependencies).updateCustomer(customerId, patch);
    if (!customer) return jsonError("Customer not found.", 404);
    return Response.json(customer, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    const mapped = mapDomainErrorToResponse(error);
    if (mapped) return mapped;
    throw error;
  }
}
