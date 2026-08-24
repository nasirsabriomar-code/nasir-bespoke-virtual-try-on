import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { handleCreateCustomerRequest } from "@/lib/customer-handler";
import { handleCreateMeasurementRequest, handleGetMeasurementHistoryRequest } from "@/lib/measurement-handler";
import { createFakeCustomerRepository } from "./customer-fake-repository";
import { authAs, jsonRequest, MANAGER_USER, OWNER_USER, STAFF_USER } from "./customer-test-http";

const repository = createFakeCustomerRepository();

beforeEach(() => {
  repository.reset();
});

const VALID_CUSTOMER_BODY = {
  name: "Bilal Rana",
  phone: "+92 300 9999999",
  email: null,
  preferences: { preferredStyles: [], preferredColours: [], preferredFit: null, preferredOccasions: [] },
};

async function createTestCustomer() {
  const response = await handleCreateCustomerRequest(
    jsonRequest("http://localhost/api/customers", "POST", VALID_CUSTOMER_BODY),
    { authenticate: authAs(OWNER_USER), repository },
  );
  return response.json();
}

const V1_MEASUREMENTS = {
  jacketMeasurements: { chest: 42, shoulder: 18 },
  trouserMeasurements: { waist: 34, inseam: 32 },
  shirtMeasurements: { neck: 16 },
};

test("creates the first measurement version (version 1)", async () => {
  const customer = await createTestCustomer();
  const response = await handleCreateMeasurementRequest(
    jsonRequest(`http://localhost/api/customers/${customer.id}/measurements`, "POST", V1_MEASUREMENTS),
    customer.id,
    { authenticate: authAs(MANAGER_USER), repository },
  );
  assert.equal(response.status, 201);
  const measurement = await response.json();
  assert.equal(measurement.version, 1);
  assert.equal(measurement.jacketMeasurements.chest, 42);
  assert.equal(measurement.recordedBy, MANAGER_USER.username, "recordedBy is always server-derived from the authenticated staff identity");
});

test("a second fitting creates version 2, never overwriting version 1", async () => {
  const customer = await createTestCustomer();
  await handleCreateMeasurementRequest(
    jsonRequest(`http://localhost/api/customers/${customer.id}/measurements`, "POST", V1_MEASUREMENTS),
    customer.id,
    { authenticate: authAs(MANAGER_USER), repository },
  );
  const secondResponse = await handleCreateMeasurementRequest(
    jsonRequest(`http://localhost/api/customers/${customer.id}/measurements`, "POST", {
      jacketMeasurements: { chest: 44, shoulder: 18 },
      trouserMeasurements: { waist: 35, inseam: 32 },
      shirtMeasurements: { neck: 16.5 },
    }),
    customer.id,
    { authenticate: authAs(MANAGER_USER), repository },
  );
  assert.equal(secondResponse.status, 201);
  const v2 = await secondResponse.json();
  assert.equal(v2.version, 2);
  assert.equal(v2.jacketMeasurements.chest, 44);
});

test("history is ordered latest-first and every old version remains retrievable unchanged", async () => {
  const customer = await createTestCustomer();
  await handleCreateMeasurementRequest(
    jsonRequest(`http://localhost/api/customers/${customer.id}/measurements`, "POST", V1_MEASUREMENTS),
    customer.id,
    { authenticate: authAs(OWNER_USER), repository },
  );
  await handleCreateMeasurementRequest(
    jsonRequest(`http://localhost/api/customers/${customer.id}/measurements`, "POST", {
      jacketMeasurements: { chest: 44 },
      trouserMeasurements: {},
      shirtMeasurements: {},
    }),
    customer.id,
    { authenticate: authAs(OWNER_USER), repository },
  );

  const response = await handleGetMeasurementHistoryRequest(
    jsonRequest(`http://localhost/api/customers/${customer.id}/measurements`, "GET"),
    customer.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(response.status, 200);
  const { history } = await response.json();
  assert.equal(history.length, 2);
  assert.equal(history[0].version, 2, "the latest version must be first");
  assert.equal(history[0].jacketMeasurements.chest, 44);
  assert.equal(history[1].version, 1, "the original version 1 must still be retrievable, unmodified");
  assert.equal(history[1].jacketMeasurements.chest, 42);
  assert.equal(history[1].jacketMeasurements.shoulder, 18);
});

test("rejects a measurement field name not on the allow-list (controlled, not uncontrolled JSON)", async () => {
  const customer = await createTestCustomer();
  const response = await handleCreateMeasurementRequest(
    jsonRequest(`http://localhost/api/customers/${customer.id}/measurements`, "POST", {
      jacketMeasurements: { chestCircumferenceInInches: 42 },
      trouserMeasurements: {},
      shirtMeasurements: {},
    }),
    customer.id,
    { authenticate: authAs(OWNER_USER), repository },
  );
  assert.equal(response.status, 400);
});

test("rejects a non-numeric or out-of-range measurement value", async () => {
  const customer = await createTestCustomer();
  const response = await handleCreateMeasurementRequest(
    jsonRequest(`http://localhost/api/customers/${customer.id}/measurements`, "POST", {
      jacketMeasurements: { chest: "forty-two" },
      trouserMeasurements: {},
      shirtMeasurements: {},
    }),
    customer.id,
    { authenticate: authAs(OWNER_USER), repository },
  );
  assert.equal(response.status, 400);
});

test("rejects an unexpected recordedBy field — recordedBy is always server-derived, never client-supplied", async () => {
  const customer = await createTestCustomer();
  const response = await handleCreateMeasurementRequest(
    jsonRequest(`http://localhost/api/customers/${customer.id}/measurements`, "POST", {
      ...V1_MEASUREMENTS,
      recordedBy: "someone-else",
    }),
    customer.id,
    { authenticate: authAs(OWNER_USER), repository },
  );
  assert.equal(response.status, 400);
});

test("rejects invalid ownership: creating a measurement for a nonexistent customer", async () => {
  const response = await handleCreateMeasurementRequest(
    jsonRequest("http://localhost/api/customers/00000000-0000-4000-8000-000000000000/measurements", "POST", V1_MEASUREMENTS),
    "00000000-0000-4000-8000-000000000000",
    { authenticate: authAs(OWNER_USER), repository },
  );
  assert.equal(response.status, 404);
});

test("STAFF may read measurement history but may not record a new version", async () => {
  const customer = await createTestCustomer();
  const createResponse = await handleCreateMeasurementRequest(
    jsonRequest(`http://localhost/api/customers/${customer.id}/measurements`, "POST", V1_MEASUREMENTS),
    customer.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(createResponse.status, 403);

  const readResponse = await handleGetMeasurementHistoryRequest(
    jsonRequest(`http://localhost/api/customers/${customer.id}/measurements`, "GET"),
    customer.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(readResponse.status, 200);
});
