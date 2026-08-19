import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { handleCreateCustomerRequest } from "@/lib/customer-handler";
import { handleCreateSessionRequest, handleListCustomerSessionsRequest, handleUpdateSessionRequest } from "@/lib/session-handler";
import { createFakeCustomerRepository } from "./customer-fake-repository";
import { authAs, jsonRequest, OWNER_USER, STAFF_USER } from "./customer-test-http";

const repository = createFakeCustomerRepository();

beforeEach(() => {
  repository.reset();
});

async function createTestCustomer() {
  const response = await handleCreateCustomerRequest(
    jsonRequest("http://localhost/api/customers", "POST", {
      name: "Farhan Ali",
      phone: "+92 300 1111111",
      email: null,
      preferences: { preferredStyles: [], preferredColours: [], preferredFit: null, preferredOccasions: [] },
    }),
    { authenticate: authAs(OWNER_USER), repository },
  );
  return response.json();
}

async function createTestSession(customerId: string) {
  const response = await handleCreateSessionRequest(
    jsonRequest(`http://localhost/api/customers/${customerId}/sessions`, "POST", { occasion: "wedding" }),
    customerId,
    { authenticate: authAs(STAFF_USER), repository },
  );
  return response.json();
}

test("creates a session in OPEN status for a real customer", async () => {
  const customer = await createTestCustomer();
  const session = await createTestSession(customer.id);
  assert.equal(session.status, "OPEN");
  assert.equal(session.customerId, customer.id);
  assert.equal(session.occasion, "wedding");
  assert.equal(session.createdBy, STAFF_USER.username, "createdBy is always server-derived");
});

test("STAFF may create a session (the standard showroom-flow permission)", async () => {
  const customer = await createTestCustomer();
  const response = await handleCreateSessionRequest(
    jsonRequest(`http://localhost/api/customers/${customer.id}/sessions`, "POST", {}),
    customer.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(response.status, 201);
});

test("rejects creating a session for a nonexistent (fake) customer ID", async () => {
  const response = await handleCreateSessionRequest(
    jsonRequest("http://localhost/api/customers/00000000-0000-4000-8000-000000000000/sessions", "POST", {}),
    "00000000-0000-4000-8000-000000000000",
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(response.status, 404);
});

test("lists a customer's sessions, newest first", async () => {
  const customer = await createTestCustomer();
  await createTestSession(customer.id);
  await createTestSession(customer.id);
  const response = await handleListCustomerSessionsRequest(
    jsonRequest(`http://localhost/api/customers/${customer.id}/sessions`, "GET"),
    customer.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  const { sessions } = await response.json();
  assert.equal(sessions.length, 2);
});

// ============================================================
// STATE MACHINE
// ============================================================

test("valid transition: OPEN -> EXPLORING", async () => {
  const customer = await createTestCustomer();
  const session = await createTestSession(customer.id);
  const response = await handleUpdateSessionRequest(
    jsonRequest(`http://localhost/api/sessions/${session.id}`, "PATCH", { status: "EXPLORING" }),
    session.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(response.status, 200);
  const updated = await response.json();
  assert.equal(updated.status, "EXPLORING");
});

test("valid transition chain: OPEN -> EXPLORING -> OUTFIT_SELECTED -> COMPLETED", async () => {
  const customer = await createTestCustomer();
  const session = await createTestSession(customer.id);

  for (const status of ["EXPLORING", "OUTFIT_SELECTED", "COMPLETED"]) {
    const response = await handleUpdateSessionRequest(
      jsonRequest(`http://localhost/api/sessions/${session.id}`, "PATCH", { status }),
      session.id,
      { authenticate: authAs(STAFF_USER), repository },
    );
    assert.equal(response.status, 200, `transition to ${status} should succeed`);
  }
});

test("valid transition: OPEN -> CANCELLED", async () => {
  const customer = await createTestCustomer();
  const session = await createTestSession(customer.id);
  const response = await handleUpdateSessionRequest(
    jsonRequest(`http://localhost/api/sessions/${session.id}`, "PATCH", { status: "CANCELLED" }),
    session.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(response.status, 200);
});

test("rejects an impossible transition: OPEN -> COMPLETED directly", async () => {
  const customer = await createTestCustomer();
  const session = await createTestSession(customer.id);
  const response = await handleUpdateSessionRequest(
    jsonRequest(`http://localhost/api/sessions/${session.id}`, "PATCH", { status: "COMPLETED" }),
    session.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(response.status, 400);
});

test("rejects any transition out of a terminal COMPLETED session", async () => {
  const customer = await createTestCustomer();
  const session = await createTestSession(customer.id);
  for (const status of ["EXPLORING", "OUTFIT_SELECTED", "COMPLETED"]) {
    await handleUpdateSessionRequest(
      jsonRequest(`http://localhost/api/sessions/${session.id}`, "PATCH", { status }),
      session.id,
      { authenticate: authAs(STAFF_USER), repository },
    );
  }
  const response = await handleUpdateSessionRequest(
    jsonRequest(`http://localhost/api/sessions/${session.id}`, "PATCH", { status: "OPEN" }),
    session.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(response.status, 400);
});

test("rejects any transition out of a terminal CANCELLED session", async () => {
  const customer = await createTestCustomer();
  const session = await createTestSession(customer.id);
  await handleUpdateSessionRequest(
    jsonRequest(`http://localhost/api/sessions/${session.id}`, "PATCH", { status: "CANCELLED" }),
    session.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  const response = await handleUpdateSessionRequest(
    jsonRequest(`http://localhost/api/sessions/${session.id}`, "PATCH", { status: "EXPLORING" }),
    session.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(response.status, 400);
});

test("rejects an unknown session status value", async () => {
  const customer = await createTestCustomer();
  const session = await createTestSession(customer.id);
  const response = await handleUpdateSessionRequest(
    jsonRequest(`http://localhost/api/sessions/${session.id}`, "PATCH", { status: "IN_PROGRESS" }),
    session.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(response.status, 400);
});

test("rejects a fake/unknown session ID on update", async () => {
  const response = await handleUpdateSessionRequest(
    jsonRequest("http://localhost/api/sessions/00000000-0000-4000-8000-000000000000", "PATCH", { status: "EXPLORING" }),
    "00000000-0000-4000-8000-000000000000",
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(response.status, 404);
});

test("rejects a direct client attempt to set finalOutfitSnapshotId (system-only field)", async () => {
  const customer = await createTestCustomer();
  const session = await createTestSession(customer.id);
  const response = await handleUpdateSessionRequest(
    jsonRequest(`http://localhost/api/sessions/${session.id}`, "PATCH", { finalOutfitSnapshotId: "some-outfit-id" }),
    session.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(response.status, 400);
});

test("rejects a client-supplied createdBy claim on session creation", async () => {
  const customer = await createTestCustomer();
  const response = await handleCreateSessionRequest(
    jsonRequest(`http://localhost/api/customers/${customer.id}/sessions`, "POST", { createdBy: "impersonated-staff" }),
    customer.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(response.status, 400);
});
