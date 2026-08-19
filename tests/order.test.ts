import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { handleCreateCustomerRequest } from "@/lib/customer-handler";
import { handleCreateMeasurementRequest } from "@/lib/measurement-handler";
import { handleCreateSavedOutfitRequest } from "@/lib/saved-outfit-handler";
import {
  handleCreateOrderRequest,
  handleGetOrderRequest,
  handleListCustomerOrdersRequest,
  handleUpdateOrderStatusRequest,
} from "@/lib/order-handler";
import { createFakeCustomerRepository } from "./customer-fake-repository";
import { authAs, jsonRequest, MANAGER_USER, OWNER_USER, STAFF_USER } from "./customer-test-http";

const repository = createFakeCustomerRepository();

beforeEach(() => {
  repository.reset();
});

const VALID_MANUAL_OUTFIT = {
  source: "manual" as const,
  upperId: "SUIT_UPPER_CLASSIC",
  lowerId: "SUIT_LOWER_CLASSIC_STRAIGHT",
  shirtId: "SUIT_SHIRT_CLASSIC_FORMAL",
  waistcoatId: "SUIT_WAISTCOAT_NONE",
  footwearId: "SUIT_SHOE_OXFORD",
  accessoryIds: ["SUIT_ACC_POCKET_SQUARE"],
};

async function createTestCustomer() {
  const response = await handleCreateCustomerRequest(
    jsonRequest("http://localhost/api/customers", "POST", {
      name: "Zafar Iqbal",
      phone: "+92 300 4444444",
      email: null,
      preferences: { preferredStyles: [], preferredColours: [], preferredFit: null, preferredOccasions: [] },
    }),
    { authenticate: authAs(OWNER_USER), repository },
  );
  return response.json();
}

async function recordMeasurement(customerId: string) {
  const response = await handleCreateMeasurementRequest(
    jsonRequest(`http://localhost/api/customers/${customerId}/measurements`, "POST", {
      jacketMeasurements: { chest: 40, shoulder: 17 },
      trouserMeasurements: { waist: 32 },
      shirtMeasurements: { neck: 15.5 },
    }),
    customerId,
    { authenticate: authAs(OWNER_USER), repository },
  );
  return response.json();
}

async function saveOutfit(customerId: string) {
  const response = await handleCreateSavedOutfitRequest(
    jsonRequest(`http://localhost/api/customers/${customerId}/outfits`, "POST", VALID_MANUAL_OUTFIT),
    customerId,
    { authenticate: authAs(STAFF_USER), repository },
  );
  return response.json();
}

async function setUpCustomerWithOutfitAndMeasurement() {
  const customer = await createTestCustomer();
  const measurement = await recordMeasurement(customer.id);
  const outfit = await saveOutfit(customer.id);
  return { customer, measurement, outfit };
}

// ============================================================
// CREATE / RETRIEVE
// ============================================================

test("creates a valid order from a saved outfit", async () => {
  const { customer, outfit } = await setUpCustomerWithOutfitAndMeasurement();
  const response = await handleCreateOrderRequest(
    jsonRequest(`http://localhost/api/customers/${customer.id}/orders`, "POST", { savedOutfitId: outfit.id }),
    customer.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(response.status, 201);
  const order = await response.json();
  assert.equal(order.customerId, customer.id);
  assert.equal(order.savedOutfitId, outfit.id);
  assert.equal(order.status, "DRAFT");
  assert.match(order.id, /^[0-9a-f-]{36}$/);
  assert.equal(order.createdBy, STAFF_USER.username);
});

test("preserves the full outfit snapshot on the order", async () => {
  const { customer, outfit } = await setUpCustomerWithOutfitAndMeasurement();
  const response = await handleCreateOrderRequest(
    jsonRequest(`http://localhost/api/customers/${customer.id}/orders`, "POST", { savedOutfitId: outfit.id }),
    customer.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  const order = await response.json();
  assert.deepEqual(order.outfitSnapshot, outfit.outfitSnapshot);
  assert.equal(order.outfitSnapshot.recipeStatus, "VALID");
  assert.equal(order.outfitSnapshot.components.upperId, "SUIT_UPPER_CLASSIC");
});

test("preserves the exact measurement snapshot at order time", async () => {
  const { customer, measurement, outfit } = await setUpCustomerWithOutfitAndMeasurement();
  const response = await handleCreateOrderRequest(
    jsonRequest(`http://localhost/api/customers/${customer.id}/orders`, "POST", { savedOutfitId: outfit.id }),
    customer.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  const order = await response.json();
  assert.equal(order.measurementSnapshot.measurementProfileId, measurement.id);
  assert.equal(order.measurementSnapshot.version, 1);
  assert.equal(order.measurementSnapshot.jacketMeasurements.chest, 40);
  assert.equal(order.measurementSnapshot.recordedBy, OWNER_USER.username);
});

test("a later measurement version never changes an already-placed order's snapshot", async () => {
  const { customer, outfit } = await setUpCustomerWithOutfitAndMeasurement();
  const orderResponse = await handleCreateOrderRequest(
    jsonRequest(`http://localhost/api/customers/${customer.id}/orders`, "POST", { savedOutfitId: outfit.id }),
    customer.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  const order = await orderResponse.json();
  assert.equal(order.measurementSnapshot.version, 1);
  assert.equal(order.measurementSnapshot.jacketMeasurements.chest, 40);

  // Record a NEW measurement version after the order was placed.
  await handleCreateMeasurementRequest(
    jsonRequest(`http://localhost/api/customers/${customer.id}/measurements`, "POST", {
      jacketMeasurements: { chest: 44 },
      trouserMeasurements: {},
      shirtMeasurements: {},
    }),
    customer.id,
    { authenticate: authAs(OWNER_USER), repository },
  );

  const refetched = await handleGetOrderRequest(
    jsonRequest(`http://localhost/api/orders/${order.id}`, "GET"),
    order.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  const refetchedOrder = await refetched.json();
  assert.equal(refetchedOrder.measurementSnapshot.version, 1, "the order's own snapshot must stay pinned to version 1");
  assert.equal(refetchedOrder.measurementSnapshot.jacketMeasurements.chest, 40, "the order's snapshot must never pick up a later measurement");
});

test("retrieves a single order by id", async () => {
  const { customer, outfit } = await setUpCustomerWithOutfitAndMeasurement();
  const created = await (
    await handleCreateOrderRequest(
      jsonRequest(`http://localhost/api/customers/${customer.id}/orders`, "POST", { savedOutfitId: outfit.id }),
      customer.id,
      { authenticate: authAs(STAFF_USER), repository },
    )
  ).json();

  const response = await handleGetOrderRequest(
    jsonRequest(`http://localhost/api/orders/${created.id}`, "GET"),
    created.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(response.status, 200);
  const fetched = await response.json();
  assert.equal(fetched.id, created.id);
});

test("lists a customer's orders, newest first", async () => {
  const { customer, outfit } = await setUpCustomerWithOutfitAndMeasurement();
  await handleCreateOrderRequest(
    jsonRequest(`http://localhost/api/customers/${customer.id}/orders`, "POST", { savedOutfitId: outfit.id }),
    customer.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  const response = await handleListCustomerOrdersRequest(
    jsonRequest(`http://localhost/api/customers/${customer.id}/orders`, "GET"),
    customer.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(response.status, 200);
  const { orders } = await response.json();
  assert.equal(orders.length, 1);
});

test("STAFF may create and read orders", async () => {
  const { customer, outfit } = await setUpCustomerWithOutfitAndMeasurement();
  const response = await handleCreateOrderRequest(
    jsonRequest(`http://localhost/api/customers/${customer.id}/orders`, "POST", { savedOutfitId: outfit.id }),
    customer.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(response.status, 201);
});

// ============================================================
// SECURITY
// ============================================================

test("rejects a fake/unknown customer ID", async () => {
  const response = await handleCreateOrderRequest(
    jsonRequest("http://localhost/api/customers/00000000-0000-4000-8000-000000000000/orders", "POST", {
      savedOutfitId: "irrelevant",
    }),
    "00000000-0000-4000-8000-000000000000",
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(response.status, 404);
});

test("rejects a fake/unknown saved outfit ID", async () => {
  const customer = await createTestCustomer();
  await recordMeasurement(customer.id);
  const response = await handleCreateOrderRequest(
    jsonRequest(`http://localhost/api/customers/${customer.id}/orders`, "POST", {
      savedOutfitId: "00000000-0000-4000-8000-000000000000",
    }),
    customer.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(response.status, 404);
});

test("rejects a saved outfit that belongs to a different customer", async () => {
  const { outfit } = await setUpCustomerWithOutfitAndMeasurement();
  const otherCustomer = await handleCreateCustomerRequest(
    jsonRequest("http://localhost/api/customers", "POST", {
      name: "Second Customer",
      phone: "+92 300 5555555",
      email: null,
      preferences: { preferredStyles: [], preferredColours: [], preferredFit: null, preferredOccasions: [] },
    }),
    { authenticate: authAs(OWNER_USER), repository },
  ).then((r) => r.json());
  await recordMeasurement(otherCustomer.id);

  const response = await handleCreateOrderRequest(
    jsonRequest(`http://localhost/api/customers/${otherCustomer.id}/orders`, "POST", { savedOutfitId: outfit.id }),
    otherCustomer.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(response.status, 404);
});

test("rejects order creation when the customer has no measurements on file (fake/missing measurements)", async () => {
  const customer = await createTestCustomer();
  const outfit = await saveOutfit(customer.id);
  const response = await handleCreateOrderRequest(
    jsonRequest(`http://localhost/api/customers/${customer.id}/orders`, "POST", { savedOutfitId: outfit.id }),
    customer.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(response.status, 400);
});

test("rejects a client-supplied timestamp on order creation", async () => {
  const { customer, outfit } = await setUpCustomerWithOutfitAndMeasurement();
  const response = await handleCreateOrderRequest(
    jsonRequest(`http://localhost/api/customers/${customer.id}/orders`, "POST", {
      savedOutfitId: outfit.id,
      createdAt: "2000-01-01T00:00:00.000Z",
    }),
    customer.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(response.status, 400);
});

test("rejects a client-supplied outfitSnapshot on order creation", async () => {
  const { customer, outfit } = await setUpCustomerWithOutfitAndMeasurement();
  const response = await handleCreateOrderRequest(
    jsonRequest(`http://localhost/api/customers/${customer.id}/orders`, "POST", {
      savedOutfitId: outfit.id,
      outfitSnapshot: { schemaVersion: 1, recipeStatus: "VALID" },
    }),
    customer.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(response.status, 400);
});

test("rejects a client-supplied measurementSnapshot on order creation", async () => {
  const { customer, outfit } = await setUpCustomerWithOutfitAndMeasurement();
  const response = await handleCreateOrderRequest(
    jsonRequest(`http://localhost/api/customers/${customer.id}/orders`, "POST", {
      savedOutfitId: outfit.id,
      measurementSnapshot: { version: 999, jacketMeasurements: { chest: 999 } },
    }),
    customer.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(response.status, 400);
});

test("rejects a client-supplied status (escalation) on order creation", async () => {
  const { customer, outfit } = await setUpCustomerWithOutfitAndMeasurement();
  const response = await handleCreateOrderRequest(
    jsonRequest(`http://localhost/api/customers/${customer.id}/orders`, "POST", {
      savedOutfitId: outfit.id,
      status: "DELIVERED",
    }),
    customer.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(response.status, 400);
});

test("rejects a client-supplied createdBy (identity) claim on order creation", async () => {
  const { customer, outfit } = await setUpCustomerWithOutfitAndMeasurement();
  const response = await handleCreateOrderRequest(
    jsonRequest(`http://localhost/api/customers/${customer.id}/orders`, "POST", {
      savedOutfitId: outfit.id,
      createdBy: "impersonated-staff",
    }),
    customer.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(response.status, 400);
});

test("rejects an invalid/unknown status on order update", async () => {
  const { customer, outfit } = await setUpCustomerWithOutfitAndMeasurement();
  const order = await (
    await handleCreateOrderRequest(
      jsonRequest(`http://localhost/api/customers/${customer.id}/orders`, "POST", { savedOutfitId: outfit.id }),
      customer.id,
      { authenticate: authAs(STAFF_USER), repository },
    )
  ).json();

  const response = await handleUpdateOrderStatusRequest(
    jsonRequest(`http://localhost/api/orders/${order.id}`, "PATCH", { status: "SHIPPED_TO_MOON" }),
    order.id,
    { authenticate: authAs(MANAGER_USER), repository },
  );
  assert.equal(response.status, 400);
});

test("rejects a fake/unknown order ID", async () => {
  const response = await handleGetOrderRequest(
    jsonRequest("http://localhost/api/orders/00000000-0000-4000-8000-000000000000", "GET"),
    "00000000-0000-4000-8000-000000000000",
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(response.status, 404);
});

test("rejects unauthenticated access", async () => {
  const response = await handleCreateOrderRequest(
    jsonRequest("http://localhost/api/customers/x/orders", "POST", { savedOutfitId: "y" }),
    "x",
    { authenticate: authAs(null), repository },
  );
  assert.equal(response.status, 401);
});

test("rejects STAFF updating order status (reserved for MANAGER/OWNER)", async () => {
  const { customer, outfit } = await setUpCustomerWithOutfitAndMeasurement();
  const order = await (
    await handleCreateOrderRequest(
      jsonRequest(`http://localhost/api/customers/${customer.id}/orders`, "POST", { savedOutfitId: outfit.id }),
      customer.id,
      { authenticate: authAs(STAFF_USER), repository },
    )
  ).json();

  const response = await handleUpdateOrderStatusRequest(
    jsonRequest(`http://localhost/api/orders/${order.id}`, "PATCH", { status: "CONFIRMED" }),
    order.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(response.status, 403);
});

test("rejects a cross-origin request", async () => {
  const response = await handleCreateOrderRequest(
    jsonRequest("http://localhost/api/customers/x/orders", "POST", { savedOutfitId: "y" }, {
      origin: "https://evil.example",
      "sec-fetch-site": "cross-site",
    }),
    "x",
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(response.status, 403);
});

// ============================================================
// LIFECYCLE
// ============================================================

async function createOrderForLifecycleTest() {
  const { customer, outfit } = await setUpCustomerWithOutfitAndMeasurement();
  const order = await (
    await handleCreateOrderRequest(
      jsonRequest(`http://localhost/api/customers/${customer.id}/orders`, "POST", { savedOutfitId: outfit.id }),
      customer.id,
      { authenticate: authAs(STAFF_USER), repository },
    )
  ).json();
  return order;
}

test("allows DRAFT -> CONFIRMED", async () => {
  const order = await createOrderForLifecycleTest();
  const response = await handleUpdateOrderStatusRequest(
    jsonRequest(`http://localhost/api/orders/${order.id}`, "PATCH", { status: "CONFIRMED" }),
    order.id,
    { authenticate: authAs(MANAGER_USER), repository },
  );
  assert.equal(response.status, 200);
  const updated = await response.json();
  assert.equal(updated.status, "CONFIRMED");
});

test("allows CONFIRMED -> TAILORING", async () => {
  const order = await createOrderForLifecycleTest();
  await handleUpdateOrderStatusRequest(
    jsonRequest(`http://localhost/api/orders/${order.id}`, "PATCH", { status: "CONFIRMED" }),
    order.id,
    { authenticate: authAs(MANAGER_USER), repository },
  );
  const response = await handleUpdateOrderStatusRequest(
    jsonRequest(`http://localhost/api/orders/${order.id}`, "PATCH", { status: "TAILORING" }),
    order.id,
    { authenticate: authAs(MANAGER_USER), repository },
  );
  assert.equal(response.status, 200);
  const updated = await response.json();
  assert.equal(updated.status, "TAILORING");
});

test("allows TAILORING -> TRIAL", async () => {
  const order = await createOrderForLifecycleTest();
  for (const status of ["CONFIRMED", "TAILORING"]) {
    await handleUpdateOrderStatusRequest(
      jsonRequest(`http://localhost/api/orders/${order.id}`, "PATCH", { status }),
      order.id,
      { authenticate: authAs(MANAGER_USER), repository },
    );
  }
  const response = await handleUpdateOrderStatusRequest(
    jsonRequest(`http://localhost/api/orders/${order.id}`, "PATCH", { status: "TRIAL" }),
    order.id,
    { authenticate: authAs(MANAGER_USER), repository },
  );
  assert.equal(response.status, 200);
  const updated = await response.json();
  assert.equal(updated.status, "TRIAL");
});

test("rejects DELIVERED -> DRAFT", async () => {
  const order = await createOrderForLifecycleTest();
  for (const status of ["CONFIRMED", "TAILORING", "TRIAL", "QUALITY_CHECK", "READY", "DELIVERED"]) {
    const stepResponse = await handleUpdateOrderStatusRequest(
      jsonRequest(`http://localhost/api/orders/${order.id}`, "PATCH", { status }),
      order.id,
      { authenticate: authAs(MANAGER_USER), repository },
    );
    assert.equal(stepResponse.status, 200, `transition to ${status} should succeed`);
  }

  const response = await handleUpdateOrderStatusRequest(
    jsonRequest(`http://localhost/api/orders/${order.id}`, "PATCH", { status: "DRAFT" }),
    order.id,
    { authenticate: authAs(MANAGER_USER), repository },
  );
  assert.equal(response.status, 400);
});

test("rejects any transition out of a terminal CANCELLED order", async () => {
  const order = await createOrderForLifecycleTest();
  await handleUpdateOrderStatusRequest(
    jsonRequest(`http://localhost/api/orders/${order.id}`, "PATCH", { status: "CANCELLED" }),
    order.id,
    { authenticate: authAs(MANAGER_USER), repository },
  );
  const response = await handleUpdateOrderStatusRequest(
    jsonRequest(`http://localhost/api/orders/${order.id}`, "PATCH", { status: "CONFIRMED" }),
    order.id,
    { authenticate: authAs(MANAGER_USER), repository },
  );
  assert.equal(response.status, 400);
});

test("rejects an impossible direct jump: DRAFT -> TAILORING", async () => {
  const order = await createOrderForLifecycleTest();
  const response = await handleUpdateOrderStatusRequest(
    jsonRequest(`http://localhost/api/orders/${order.id}`, "PATCH", { status: "TAILORING" }),
    order.id,
    { authenticate: authAs(MANAGER_USER), repository },
  );
  assert.equal(response.status, 400);
});

test("rejects updating a fake/unknown order ID", async () => {
  const response = await handleUpdateOrderStatusRequest(
    jsonRequest("http://localhost/api/orders/00000000-0000-4000-8000-000000000000", "PATCH", { status: "CONFIRMED" }),
    "00000000-0000-4000-8000-000000000000",
    { authenticate: authAs(MANAGER_USER), repository },
  );
  assert.equal(response.status, 404);
});
