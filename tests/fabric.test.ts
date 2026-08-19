import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import {
  handleCreateFabricRequest,
  handleCreateFabricVariantRequest,
  handleGetFabricRequest,
  handleListFabricsRequest,
  handleListFabricVariantsRequest,
  handleUpdateFabricRequest,
  handleUpdateFabricVariantRequest,
} from "@/lib/fabric-handler";
import { createFakeCustomerRepository } from "./customer-fake-repository";
import {
  authAs,
  jsonRequest,
  MANAGER_USER,
  MASTER_TAILOR_USER,
  OWNER_USER,
  QC_STAFF_USER,
  STAFF_USER,
  STYLE_CONSULTANT_USER,
} from "./customer-test-http";

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

// ============================================================
// PHASE 4E — EDIT / RETIRE / VARIANTS
// ============================================================

test("OWNER can edit fabric metadata and the change persists", async () => {
  const fabric = await createTestFabric();
  const response = await handleUpdateFabricRequest(
    jsonRequest(`http://localhost/api/fabrics/${fabric.id}`, "PATCH", { name: "Updated Super 120", colour: "Charcoal" }),
    fabric.id,
    { authenticate: authAs(OWNER_USER), repository },
  );
  assert.equal(response.status, 200);
  const updated = await response.json();
  assert.equal(updated.name, "Updated Super 120");
  assert.equal(updated.colour, "Charcoal");
  assert.equal(updated.composition, "100% Wool");

  const stored = await handleGetFabricRequest(
    jsonRequest(`http://localhost/api/fabrics/${fabric.id}`, "GET"),
    fabric.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(stored.status, 200);
  const body = await stored.json();
  assert.equal(body.name, "Updated Super 120");
});

test("MANAGER can retire and reactivate a fabric", async () => {
  const fabric = await createTestFabric();
  const retired = await handleUpdateFabricRequest(
    jsonRequest(`http://localhost/api/fabrics/${fabric.id}`, "PATCH", { status: "INACTIVE" }),
    fabric.id,
    { authenticate: authAs(MANAGER_USER), repository },
  );
  assert.equal(retired.status, 200);
  assert.equal((await retired.json()).status, "INACTIVE");

  const listed = await handleListFabricsRequest(
    jsonRequest("http://localhost/api/fabrics", "GET"),
    { authenticate: authAs(STAFF_USER), repository },
  );
  const { fabrics } = await listed.json();
  assert.equal(fabrics[0].status, "INACTIVE");

  const reactivated = await handleUpdateFabricRequest(
    jsonRequest(`http://localhost/api/fabrics/${fabric.id}`, "PATCH", { status: "ACTIVE" }),
    fabric.id,
    { authenticate: authAs(MANAGER_USER), repository },
  );
  assert.equal((await reactivated.json()).status, "ACTIVE");
});

test("STAFF may read a retired fabric but cannot edit it", async () => {
  const fabric = await createTestFabric();
  await handleUpdateFabricRequest(
    jsonRequest(`http://localhost/api/fabrics/${fabric.id}`, "PATCH", { status: "INACTIVE" }),
    fabric.id,
    { authenticate: authAs(OWNER_USER), repository },
  );
  const read = await handleGetFabricRequest(
    jsonRequest(`http://localhost/api/fabrics/${fabric.id}`, "GET"),
    fabric.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(read.status, 200);
  assert.equal((await read.json()).status, "INACTIVE");

  const mutate = await handleUpdateFabricRequest(
    jsonRequest(`http://localhost/api/fabrics/${fabric.id}`, "PATCH", { name: "Hacked" }),
    fabric.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(mutate.status, 403);
});

test("MANAGER can edit a variant colour and toggle availability", async () => {
  const fabric = await createTestFabric();
  const created = await handleCreateFabricVariantRequest(
    jsonRequest(`http://localhost/api/fabrics/${fabric.id}/variants`, "POST", { colour: "Charcoal" }),
    fabric.id,
    { authenticate: authAs(MANAGER_USER), repository },
  );
  const variant = await created.json();

  const renamed = await handleUpdateFabricVariantRequest(
    jsonRequest(`http://localhost/api/fabrics/${fabric.id}/variants/${variant.id}`, "PATCH", { colour: "Midnight" }),
    fabric.id,
    variant.id,
    { authenticate: authAs(MANAGER_USER), repository },
  );
  assert.equal(renamed.status, 200);
  assert.equal((await renamed.json()).colour, "Midnight");

  const unavailable = await handleUpdateFabricVariantRequest(
    jsonRequest(`http://localhost/api/fabrics/${fabric.id}/variants/${variant.id}`, "PATCH", { isAvailable: false }),
    fabric.id,
    variant.id,
    { authenticate: authAs(MANAGER_USER), repository },
  );
  assert.equal((await unavailable.json()).isAvailable, false);

  const restored = await handleUpdateFabricVariantRequest(
    jsonRequest(`http://localhost/api/fabrics/${fabric.id}/variants/${variant.id}`, "PATCH", { isAvailable: true }),
    fabric.id,
    variant.id,
    { authenticate: authAs(MANAGER_USER), repository },
  );
  assert.equal((await restored.json()).isAvailable, true);
});

test("STYLE_CONSULTANT, MASTER_TAILOR, and QC_STAFF cannot mutate the catalogue", async () => {
  const fabric = await createTestFabric();
  for (const user of [STYLE_CONSULTANT_USER, MASTER_TAILOR_USER, QC_STAFF_USER]) {
    const response = await handleUpdateFabricRequest(
      jsonRequest(`http://localhost/api/fabrics/${fabric.id}`, "PATCH", { name: "No" }),
      fabric.id,
      { authenticate: authAs(user), repository },
    );
    assert.equal(response.status, 403, user.role);
  }
});

test("rejects updating an unknown fabric", async () => {
  const response = await handleUpdateFabricRequest(
    jsonRequest("http://localhost/api/fabrics/00000000-0000-4000-8000-000000000000", "PATCH", { name: "Ghost" }),
    "00000000-0000-4000-8000-000000000000",
    { authenticate: authAs(OWNER_USER), repository },
  );
  assert.equal(response.status, 404);
});

test("rejects updating an unknown variant", async () => {
  const fabric = await createTestFabric();
  const response = await handleUpdateFabricVariantRequest(
    jsonRequest(`http://localhost/api/fabrics/${fabric.id}/variants/00000000-0000-4000-8000-000000000000`, "PATCH", { colour: "Navy" }),
    fabric.id,
    "00000000-0000-4000-8000-000000000000",
    { authenticate: authAs(OWNER_USER), repository },
  );
  assert.equal(response.status, 404);
});

test("rejects updating a variant that belongs to a different fabric", async () => {
  const fabricA = await createTestFabric();
  const fabricB = await (await handleCreateFabricRequest(
    jsonRequest("http://localhost/api/fabrics", "POST", { ...VALID_FABRIC, name: "Other Cloth" }),
    { authenticate: authAs(OWNER_USER), repository },
  )).json();
  const variant = await (await handleCreateFabricVariantRequest(
    jsonRequest(`http://localhost/api/fabrics/${fabricA.id}/variants`, "POST", { colour: "Charcoal" }),
    fabricA.id,
    { authenticate: authAs(MANAGER_USER), repository },
  )).json();

  const response = await handleUpdateFabricVariantRequest(
    jsonRequest(`http://localhost/api/fabrics/${fabricB.id}/variants/${variant.id}`, "PATCH", { colour: "Stolen" }),
    fabricB.id,
    variant.id,
    { authenticate: authAs(OWNER_USER), repository },
  );
  assert.equal(response.status, 404);
});

test("rejects a client-supplied id or createdAt on fabric update", async () => {
  const fabric = await createTestFabric();
  const withId = await handleUpdateFabricRequest(
    jsonRequest(`http://localhost/api/fabrics/${fabric.id}`, "PATCH", { name: "X", id: "forged" }),
    fabric.id,
    { authenticate: authAs(OWNER_USER), repository },
  );
  assert.equal(withId.status, 400);
  const withCreatedAt = await handleUpdateFabricRequest(
    jsonRequest(`http://localhost/api/fabrics/${fabric.id}`, "PATCH", { createdAt: "2000-01-01T00:00:00.000Z" }),
    fabric.id,
    { authenticate: authAs(OWNER_USER), repository },
  );
  assert.equal(withCreatedAt.status, 400);
});

test("rejects an unknown fabric status on update", async () => {
  const fabric = await createTestFabric();
  const response = await handleUpdateFabricRequest(
    jsonRequest(`http://localhost/api/fabrics/${fabric.id}`, "PATCH", { status: "ARCHIVED" }),
    fabric.id,
    { authenticate: authAs(OWNER_USER), repository },
  );
  assert.equal(response.status, 400);
});

test("rejects an empty fabric update", async () => {
  const fabric = await createTestFabric();
  const response = await handleUpdateFabricRequest(
    jsonRequest(`http://localhost/api/fabrics/${fabric.id}`, "PATCH", {}),
    fabric.id,
    { authenticate: authAs(OWNER_USER), repository },
  );
  assert.equal(response.status, 400);
});

test("rejects unauthenticated fabric updates", async () => {
  const response = await handleUpdateFabricRequest(
    jsonRequest("http://localhost/api/fabrics/x", "PATCH", { name: "X" }),
    "x",
    { authenticate: authAs(null), repository },
  );
  assert.equal(response.status, 401);
});

test("rejects a cross-origin fabric update", async () => {
  const fabric = await createTestFabric();
  const response = await handleUpdateFabricRequest(
    jsonRequest(`http://localhost/api/fabrics/${fabric.id}`, "PATCH", { name: "X" }, {
      origin: "https://evil.example",
      "sec-fetch-site": "cross-site",
    }),
    fabric.id,
    { authenticate: authAs(OWNER_USER), repository },
  );
  assert.equal(response.status, 403);
});

test("rejects a cross-origin variant update", async () => {
  const fabric = await createTestFabric();
  const variant = await (await handleCreateFabricVariantRequest(
    jsonRequest(`http://localhost/api/fabrics/${fabric.id}/variants`, "POST", { colour: "Charcoal" }),
    fabric.id,
    { authenticate: authAs(MANAGER_USER), repository },
  )).json();
  const response = await handleUpdateFabricVariantRequest(
    jsonRequest(`http://localhost/api/fabrics/${fabric.id}/variants/${variant.id}`, "PATCH", { isAvailable: false }, {
      origin: "https://evil.example",
      "sec-fetch-site": "cross-site",
    }),
    fabric.id,
    variant.id,
    { authenticate: authAs(OWNER_USER), repository },
  );
  assert.equal(response.status, 403);
});
