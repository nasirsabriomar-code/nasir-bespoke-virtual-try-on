import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import {
  handleCreateFabricRequest,
  handleCreateFabricVariantRequest,
  handleListFabricsRequest,
  handleListFabricVariantsRequest,
} from "@/lib/fabric-handler";
import { createFakeCustomerRepository } from "./customer-fake-repository";
import { authAs, jsonRequest, MANAGER_USER, OWNER_USER, STAFF_USER } from "./customer-test-http";

const repository = createFakeCustomerRepository();

beforeEach(() => {
  repository.reset();
});

const VALID_FABRIC = {
  name: "Italian Super 120 Wool",
  composition: "100% Wool",
  weight: "260g/m²",
  season: "All Season",
  colour: "Navy",
  supplier: "Loro Piana",
};

async function createTestFabric() {
  const response = await handleCreateFabricRequest(
    jsonRequest("http://localhost/api/fabrics", "POST", VALID_FABRIC),
    { authenticate: authAs(OWNER_USER), repository },
  );
  return response.json();
}

// ============================================================
// CREATE / RETRIEVE
// ============================================================

test("MANAGER/OWNER can create a fabric", async () => {
  const response = await handleCreateFabricRequest(
    jsonRequest("http://localhost/api/fabrics", "POST", VALID_FABRIC),
    { authenticate: authAs(OWNER_USER), repository },
  );
  assert.equal(response.status, 201);
  const fabric = await response.json();
  assert.equal(fabric.name, "Italian Super 120 Wool");
  assert.equal(fabric.status, "ACTIVE");
  assert.match(fabric.id, /^[0-9a-f-]{36}$/);
});

test("defaults a new fabric to ACTIVE status when not specified", async () => {
  const fabric = await createTestFabric();
  assert.equal(fabric.status, "ACTIVE");
});

test("accepts an explicit INACTIVE status", async () => {
  const response = await handleCreateFabricRequest(
    jsonRequest("http://localhost/api/fabrics", "POST", { ...VALID_FABRIC, status: "INACTIVE" }),
    { authenticate: authAs(OWNER_USER), repository },
  );
  assert.equal(response.status, 201);
  const fabric = await response.json();
  assert.equal(fabric.status, "INACTIVE");
});

test("retrieves the fabric catalogue", async () => {
  await createTestFabric();
  const response = await handleListFabricsRequest(
    jsonRequest("http://localhost/api/fabrics", "GET"),
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(response.status, 200);
  const { fabrics } = await response.json();
  assert.equal(fabrics.length, 1);
  assert.equal(fabrics[0].name, "Italian Super 120 Wool");
});

test("supplier is optional and defaults to null", async () => {
  const response = await handleCreateFabricRequest(
    jsonRequest("http://localhost/api/fabrics", "POST", { ...VALID_FABRIC, supplier: undefined }),
    { authenticate: authAs(OWNER_USER), repository },
  );
  const fabric = await response.json();
  assert.equal(fabric.supplier, null);
});

// ============================================================
// VARIANTS
// ============================================================

test("creates a variant for an existing fabric", async () => {
  const fabric = await createTestFabric();
  const response = await handleCreateFabricVariantRequest(
    jsonRequest(`http://localhost/api/fabrics/${fabric.id}/variants`, "POST", { colour: "Charcoal" }),
    fabric.id,
    { authenticate: authAs(MANAGER_USER), repository },
  );
  assert.equal(response.status, 201);
  const variant = await response.json();
  assert.equal(variant.fabricId, fabric.id);
  assert.equal(variant.colour, "Charcoal");
  assert.equal(variant.isAvailable, true);
});

test("a variant can be created as unavailable", async () => {
  const fabric = await createTestFabric();
  const response = await handleCreateFabricVariantRequest(
    jsonRequest(`http://localhost/api/fabrics/${fabric.id}/variants`, "POST", { colour: "Charcoal", isAvailable: false }),
    fabric.id,
    { authenticate: authAs(MANAGER_USER), repository },
  );
  const variant = await response.json();
  assert.equal(variant.isAvailable, false);
});

test("lists a fabric's variants", async () => {
  const fabric = await createTestFabric();
  await handleCreateFabricVariantRequest(
    jsonRequest(`http://localhost/api/fabrics/${fabric.id}/variants`, "POST", { colour: "Charcoal" }),
    fabric.id,
    { authenticate: authAs(MANAGER_USER), repository },
  );
  const response = await handleListFabricVariantsRequest(
    jsonRequest(`http://localhost/api/fabrics/${fabric.id}/variants`, "GET"),
    fabric.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(response.status, 200);
  const { variants } = await response.json();
  assert.equal(variants.length, 1);
  assert.equal(variants[0].colour, "Charcoal");
});

test("rejects creating a variant for a fake/unknown fabric ID", async () => {
  const response = await handleCreateFabricVariantRequest(
    jsonRequest("http://localhost/api/fabrics/00000000-0000-4000-8000-000000000000/variants", "POST", { colour: "Navy" }),
    "00000000-0000-4000-8000-000000000000",
    { authenticate: authAs(MANAGER_USER), repository },
  );
  assert.equal(response.status, 404);
});

test("rejects listing variants for a fake/unknown fabric ID", async () => {
  const response = await handleListFabricVariantsRequest(
    jsonRequest("http://localhost/api/fabrics/00000000-0000-4000-8000-000000000000/variants", "GET"),
    "00000000-0000-4000-8000-000000000000",
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(response.status, 404);
});

// ============================================================
// SECURITY / VALIDATION
// ============================================================

test("STAFF may read the fabric catalogue but not create a fabric", async () => {
  const readResponse = await handleListFabricsRequest(
    jsonRequest("http://localhost/api/fabrics", "GET"),
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(readResponse.status, 200);

  const createResponse = await handleCreateFabricRequest(
    jsonRequest("http://localhost/api/fabrics", "POST", VALID_FABRIC),
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(createResponse.status, 403);
});

test("STAFF may not create a fabric variant", async () => {
  const fabric = await createTestFabric();
  const response = await handleCreateFabricVariantRequest(
    jsonRequest(`http://localhost/api/fabrics/${fabric.id}/variants`, "POST", { colour: "Charcoal" }),
    fabric.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(response.status, 403);
});

test("rejects a fabric with a missing/blank required field", async () => {
  const response = await handleCreateFabricRequest(
    jsonRequest("http://localhost/api/fabrics", "POST", { ...VALID_FABRIC, name: "   " }),
    { authenticate: authAs(OWNER_USER), repository },
  );
  assert.equal(response.status, 400);
});

test("rejects an unknown fabric status value", async () => {
  const response = await handleCreateFabricRequest(
    jsonRequest("http://localhost/api/fabrics", "POST", { ...VALID_FABRIC, status: "DISCONTINUED" }),
    { authenticate: authAs(OWNER_USER), repository },
  );
  assert.equal(response.status, 400);
});

test("rejects an unexpected field on fabric creation", async () => {
  const response = await handleCreateFabricRequest(
    jsonRequest("http://localhost/api/fabrics", "POST", { ...VALID_FABRIC, price: 500 }),
    { authenticate: authAs(OWNER_USER), repository },
  );
  assert.equal(response.status, 400);
});

test("rejects unauthenticated access", async () => {
  const response = await handleListFabricsRequest(
    jsonRequest("http://localhost/api/fabrics", "GET"),
    { authenticate: authAs(null), repository },
  );
  assert.equal(response.status, 401);
});

test("rejects a cross-origin request", async () => {
  const response = await handleCreateFabricRequest(
    jsonRequest("http://localhost/api/fabrics", "POST", VALID_FABRIC, {
      origin: "https://evil.example",
      "sec-fetch-site": "cross-site",
    }),
    { authenticate: authAs(OWNER_USER), repository },
  );
  assert.equal(response.status, 403);
});
