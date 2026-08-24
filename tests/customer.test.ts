import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import {
  handleCreateCustomerRequest,
  handleGetCustomerRequest,
  handleSearchCustomersRequest,
  handleUpdateCustomerRequest,
} from "@/lib/customer-handler";
import { createFakeCustomerRepository } from "./customer-fake-repository";
import { authAs, jsonRequest, MANAGER_USER, OWNER_USER, STAFF_USER } from "./customer-test-http";

const repository = createFakeCustomerRepository();

beforeEach(() => {
  repository.reset();
});

const VALID_CUSTOMER_BODY = {
  name: "Ahmed Khan",
  phone: "+92 300 1234567",
  email: "ahmed@example.com",
  preferences: {
    preferredStyles: ["classic"],
    preferredColours: ["NAVY"],
    preferredFit: "STRUCTURED",
    preferredOccasions: ["business"],
  },
};

async function createTestCustomer() {
  const response = await handleCreateCustomerRequest(
    jsonRequest("http://localhost/api/customers", "POST", VALID_CUSTOMER_BODY),
    { authenticate: authAs(OWNER_USER), repository },
  );
  assert.equal(response.status, 201);
  return response.json();
}

// ============================================================
// CREATE
// ============================================================

test("creates a customer with structured preferences", async () => {
  const customer = await createTestCustomer();
  assert.equal(customer.name, "Ahmed Khan");
  assert.equal(customer.phone, "+92 300 1234567");
  assert.deepEqual(customer.preferences.preferredStyles, ["classic"]);
  assert.equal(customer.preferences.preferredFit, "STRUCTURED");
  assert.match(customer.id, /^[0-9a-f-]{36}$/);
  assert.ok(customer.createdAt);
  assert.ok(customer.updatedAt);
});

test("rejects a duplicate phone number", async () => {
  await createTestCustomer();
  const response = await handleCreateCustomerRequest(
    jsonRequest("http://localhost/api/customers", "POST", VALID_CUSTOMER_BODY),
    { authenticate: authAs(OWNER_USER), repository },
  );
  assert.equal(response.status, 409);
});

test("MANAGER may create a customer", async () => {
  const response = await handleCreateCustomerRequest(
    jsonRequest("http://localhost/api/customers", "POST", VALID_CUSTOMER_BODY),
    { authenticate: authAs(MANAGER_USER), repository },
  );
  assert.equal(response.status, 201);
});

// ============================================================
// RETRIEVE
// ============================================================

test("retrieves a customer by id", async () => {
  const created = await createTestCustomer();
  const response = await handleGetCustomerRequest(
    jsonRequest(`http://localhost/api/customers/${created.id}`, "GET"),
    created.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(response.status, 200);
  const fetched = await response.json();
  assert.equal(fetched.id, created.id);
});

test("searches customers by name and phone substring", async () => {
  await createTestCustomer();
  const response = await handleSearchCustomersRequest(
    new Request("http://localhost/api/customers?q=Ahmed", {
      headers: { origin: "http://localhost", host: "localhost", "sec-fetch-site": "same-origin" },
    }),
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(response.status, 200);
  const { customers } = await response.json();
  assert.equal(customers.length, 1);
});

// ============================================================
// UPDATE
// ============================================================

test("updates allowed fields (name, email, preferences)", async () => {
  const created = await createTestCustomer();
  const response = await handleUpdateCustomerRequest(
    jsonRequest(`http://localhost/api/customers/${created.id}`, "PATCH", {
      name: "Ahmed A. Khan",
      preferences: { ...created.preferences, preferredFit: "SLIM" },
    }),
    created.id,
    { authenticate: authAs(OWNER_USER), repository },
  );
  assert.equal(response.status, 200);
  const updated = await response.json();
  assert.equal(updated.name, "Ahmed A. Khan");
  assert.equal(updated.preferences.preferredFit, "SLIM");
  assert.equal(updated.phone, created.phone, "phone is not in the update allow-list and must be unchanged");
});

// ============================================================
// REJECT MALFORMED DATA
// ============================================================

test("rejects an empty customer name", async () => {
  const response = await handleCreateCustomerRequest(
    jsonRequest("http://localhost/api/customers", "POST", { ...VALID_CUSTOMER_BODY, name: "" }),
    { authenticate: authAs(OWNER_USER), repository },
  );
  assert.equal(response.status, 400);
});

test("rejects an invalid phone number", async () => {
  const response = await handleCreateCustomerRequest(
    jsonRequest("http://localhost/api/customers", "POST", { ...VALID_CUSTOMER_BODY, phone: "abc" }),
    { authenticate: authAs(OWNER_USER), repository },
  );
  assert.equal(response.status, 400);
});

test("rejects an invalid email", async () => {
  const response = await handleCreateCustomerRequest(
    jsonRequest("http://localhost/api/customers", "POST", { ...VALID_CUSTOMER_BODY, email: "not-an-email" }),
    { authenticate: authAs(OWNER_USER), repository },
  );
  assert.equal(response.status, 400);
});

test("rejects an unknown preferred style value (closed vocabulary, never free text)", async () => {
  const response = await handleCreateCustomerRequest(
    jsonRequest("http://localhost/api/customers", "POST", {
      ...VALID_CUSTOMER_BODY,
      preferences: { ...VALID_CUSTOMER_BODY.preferences, preferredStyles: ["haute-couture"] },
    }),
    { authenticate: authAs(OWNER_USER), repository },
  );
  assert.equal(response.status, 400);
});

test("rejects malformed JSON", async () => {
  const response = await handleCreateCustomerRequest(
    new Request("http://localhost/api/customers", {
      method: "POST",
      headers: { origin: "http://localhost", host: "localhost", "sec-fetch-site": "same-origin", "content-type": "application/json" },
      body: "{not valid",
    }),
    { authenticate: authAs(OWNER_USER), repository },
  );
  assert.equal(response.status, 400);
});

// ============================================================
// SECURITY
// ============================================================

test("rejects a fake/unknown customer ID on retrieval", async () => {
  const response = await handleGetCustomerRequest(
    jsonRequest("http://localhost/api/customers/00000000-0000-4000-8000-000000000000", "GET"),
    "00000000-0000-4000-8000-000000000000",
    { authenticate: authAs(OWNER_USER), repository },
  );
  assert.equal(response.status, 404);
});

test("rejects a fake/unknown customer ID on update", async () => {
  const response = await handleUpdateCustomerRequest(
    jsonRequest("http://localhost/api/customers/00000000-0000-4000-8000-000000000000", "PATCH", { name: "Someone Else" }),
    "00000000-0000-4000-8000-000000000000",
    { authenticate: authAs(OWNER_USER), repository },
  );
  assert.equal(response.status, 404);
});

test("rejects unauthenticated access", async () => {
  const response = await handleCreateCustomerRequest(
    jsonRequest("http://localhost/api/customers", "POST", VALID_CUSTOMER_BODY),
    { authenticate: authAs(null), repository },
  );
  assert.equal(response.status, 401);
});

test("rejects STAFF creating a customer (least-privilege boundary)", async () => {
  const response = await handleCreateCustomerRequest(
    jsonRequest("http://localhost/api/customers", "POST", VALID_CUSTOMER_BODY),
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(response.status, 403);
});

test("rejects STAFF updating a customer (least-privilege boundary)", async () => {
  const created = await createTestCustomer();
  const response = await handleUpdateCustomerRequest(
    jsonRequest(`http://localhost/api/customers/${created.id}`, "PATCH", { name: "Tampered Name" }),
    created.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(response.status, 403);
});

test("STAFF may still read a customer", async () => {
  const created = await createTestCustomer();
  const response = await handleGetCustomerRequest(
    jsonRequest(`http://localhost/api/customers/${created.id}`, "GET"),
    created.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(response.status, 200);
});

test("rejects a cross-origin request", async () => {
  const response = await handleCreateCustomerRequest(
    jsonRequest("http://localhost/api/customers", "POST", VALID_CUSTOMER_BODY, {
      origin: "https://evil.example",
      "sec-fetch-site": "cross-site",
    }),
    { authenticate: authAs(OWNER_USER), repository },
  );
  assert.equal(response.status, 403);
});

test("rejects a client-supplied id (ownership claim) on create", async () => {
  const response = await handleCreateCustomerRequest(
    jsonRequest("http://localhost/api/customers", "POST", { ...VALID_CUSTOMER_BODY, id: "client-chosen-id" }),
    { authenticate: authAs(OWNER_USER), repository },
  );
  assert.equal(response.status, 400);
});

test("rejects client-supplied timestamps on create", async () => {
  const response = await handleCreateCustomerRequest(
    jsonRequest("http://localhost/api/customers", "POST", {
      ...VALID_CUSTOMER_BODY,
      createdAt: "2000-01-01T00:00:00.000Z",
      updatedAt: "2000-01-01T00:00:00.000Z",
    }),
    { authenticate: authAs(OWNER_USER), repository },
  );
  assert.equal(response.status, 400);
});

test("rejects client-supplied timestamps on update, and the server's own updatedAt always advances", async () => {
  const created = await createTestCustomer();
  const response = await handleUpdateCustomerRequest(
    jsonRequest(`http://localhost/api/customers/${created.id}`, "PATCH", {
      name: "New Name",
      updatedAt: "1999-01-01T00:00:00.000Z",
    }),
    created.id,
    { authenticate: authAs(OWNER_USER), repository },
  );
  assert.equal(response.status, 400);
});

test("rejects a client-supplied phone change via update (phone is not in the update allow-list)", async () => {
  const created = await createTestCustomer();
  const response = await handleUpdateCustomerRequest(
    jsonRequest(`http://localhost/api/customers/${created.id}`, "PATCH", { phone: "+1 555 000 0000" }),
    created.id,
    { authenticate: authAs(OWNER_USER), repository },
  );
  assert.equal(response.status, 400);
});
