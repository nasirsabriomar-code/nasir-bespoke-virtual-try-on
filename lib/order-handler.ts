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
  CustomerNotFoundError,
  MeasurementRequiredError,
  SavedOutfitNotFoundError,
  OrderNotFoundError,
} from "@/lib/customer/repository";
import { assertValidOrderTransition, isOrderStatus } from "@/lib/customer/validation";
import type { OrderMeasurementSnapshot } from "@/lib/customer/types";

/**
 * Order domain routes (Phase 4A): create + list
 * (/api/customers/[customerId]/orders), detail + status update
 * (/api/orders/[orderId]). An Order converts an approved SavedOutfit into a
 * persistent bespoke transaction record — it is NOT an ERP: no payments,
 * invoicing, or production-tracking fields exist.
 *
 * The client can never submit a trusted snapshot. `POST .../orders` accepts
 * ONLY `savedOutfitId` — the server independently re-fetches that saved
 * outfit (verifying it belongs to this customer), independently re-fetches
 * the customer's latest measurement version (rejecting the request if none
 * exists yet — an order can never be created without one), and builds both
 * snapshots itself. There is no field name for a client-supplied
 * outfitSnapshot or measurementSnapshot anywhere in the allow-list below.
 */

const CREATE_ALLOWED_FIELDS = new Set(["savedOutfitId"]);
const UPDATE_ALLOWED_FIELDS = new Set(["status"]);

export async function handleCreateOrderRequest(
  request: Request,
  customerId: string,
  dependencies: CustomerDependencies = DEFAULT_CUSTOMER_DEPENDENCIES,
) {
  const authOrResponse = await authorizeStaffRequest(request, dependencies, "order:create");
  if (authOrResponse instanceof Response) return authOrResponse;

  const bodyOrResponse = await parseJsonBody(request);
  if (bodyOrResponse instanceof Response) return bodyOrResponse;
  const body = bodyOrResponse;

  const unexpectedField = hasUnexpectedFields(body, CREATE_ALLOWED_FIELDS);
  if (unexpectedField) return jsonError("Unexpected field in the submitted order.", 400);

  if (typeof body.savedOutfitId !== "string" || body.savedOutfitId.length === 0) {
    return jsonError("Please provide a valid saved outfit reference.", 400);
  }

  const repository = getRepository(dependencies);

  try {
    const customer = await repository.getCustomerById(customerId);
    if (!customer) throw new CustomerNotFoundError();

    // Re-fetched independently — a client can never submit a trusted
    // outfitSnapshot. An outfit that doesn't exist, or belongs to a
    // different customer, is rejected identically (never distinguished, so
    // a probing client can't learn whether an ID exists for someone else).
    const savedOutfit = await repository.getSavedOutfitById(body.savedOutfitId);
    if (!savedOutfit || savedOutfit.customerId !== customerId) {
      throw new SavedOutfitNotFoundError();
    }

    // Re-fetched independently — a client can never submit a trusted
    // measurementSnapshot. An order can never be created for a customer
    // with no measurement on file yet.
    const measurementHistory = await repository.getMeasurementHistory(customerId);
    const latestMeasurement = measurementHistory[0];
    if (!latestMeasurement) throw new MeasurementRequiredError();

    const measurementSnapshot: OrderMeasurementSnapshot = {
      measurementProfileId: latestMeasurement.id,
      version: latestMeasurement.version,
      jacketMeasurements: latestMeasurement.jacketMeasurements,
      trouserMeasurements: latestMeasurement.trouserMeasurements,
      shirtMeasurements: latestMeasurement.shirtMeasurements,
      recordedBy: latestMeasurement.recordedBy,
      recordedAt: latestMeasurement.createdAt,
    };

    const order = await repository.createOrder({
      customerId,
      savedOutfitId: savedOutfit.id,
      outfitSnapshot: savedOutfit.outfitSnapshot,
      measurementSnapshot,
      createdBy: authOrResponse.username,
    });

    return Response.json(order, { status: 201, headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    const mapped = mapDomainErrorToResponse(error);
    if (mapped) return mapped;
    throw error;
  }
}

export async function handleListCustomerOrdersRequest(
  request: Request,
  customerId: string,
  dependencies: CustomerDependencies = DEFAULT_CUSTOMER_DEPENDENCIES,
) {
  const authOrResponse = await authorizeStaffRequest(request, dependencies, "order:read");
  if (authOrResponse instanceof Response) return authOrResponse;

  const repository = getRepository(dependencies);

  try {
    const customer = await repository.getCustomerById(customerId);
    if (!customer) throw new CustomerNotFoundError();

    const orders = await repository.listCustomerOrders(customerId);
    return Response.json({ orders }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    const mapped = mapDomainErrorToResponse(error);
    if (mapped) return mapped;
    throw error;
  }
}

export async function handleGetOrderRequest(
  request: Request,
  orderId: string,
  dependencies: CustomerDependencies = DEFAULT_CUSTOMER_DEPENDENCIES,
) {
  const authOrResponse = await authorizeStaffRequest(request, dependencies, "order:read");
  if (authOrResponse instanceof Response) return authOrResponse;

  const repository = getRepository(dependencies);

  try {
    const order = await repository.getOrderById(orderId);
    if (!order) throw new OrderNotFoundError();
    return Response.json(order, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    const mapped = mapDomainErrorToResponse(error);
    if (mapped) return mapped;
    throw error;
  }
}

export async function handleUpdateOrderStatusRequest(
  request: Request,
  orderId: string,
  dependencies: CustomerDependencies = DEFAULT_CUSTOMER_DEPENDENCIES,
) {
  const authOrResponse = await authorizeStaffRequest(request, dependencies, "order:update");
  if (authOrResponse instanceof Response) return authOrResponse;

  const bodyOrResponse = await parseJsonBody(request);
  if (bodyOrResponse instanceof Response) return bodyOrResponse;
  const body = bodyOrResponse;

  const unexpectedField = hasUnexpectedFields(body, UPDATE_ALLOWED_FIELDS);
  if (unexpectedField) return jsonError("Unexpected field in the submitted order update.", 400);

  if (!isOrderStatus(body.status)) return jsonError("Unknown order status.", 400);

  const repository = getRepository(dependencies);

  try {
    const existing = await repository.getOrderById(orderId);
    if (!existing) throw new OrderNotFoundError();

    assertValidOrderTransition(existing.status, body.status);

    const updated = await repository.updateOrderStatus(orderId, body.status);
    if (!updated) throw new OrderNotFoundError();
    return Response.json(updated, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    const mapped = mapDomainErrorToResponse(error);
    if (mapped) return mapped;
    throw error;
  }
}
