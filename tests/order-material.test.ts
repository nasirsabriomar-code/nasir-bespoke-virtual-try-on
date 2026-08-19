import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { handleCreateCustomerRequest } from "@/lib/customer-handler";
import { handleCreateMeasurementRequest } from "@/lib/measurement-handler";
import { handleCreateSavedOutfitRequest } from "@/lib/saved-outfit-handler";
import { handleCreateOrderRequest } from "@/lib/order-handler";
import { handleCreateFabricRequest, handleCreateFabricVariantRequest } from "@/lib/fabric-handler";
import { handleListOrderMaterialsRequest, handleSetOrderMaterialRequest } from "@/lib/order-material-handler";
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

async function createTestOrder() {
  const customer = await createTestCustomer();
  await recordMeasurement(customer.id);
  const outfit = await saveOutfit(customer.id);
  const response = await handleCreateOrderRequest(
    jsonRequest(`http://localhost/api/customers/${customer.id}/orders`, "POST", { savedOutfitId: outfit.id }),
    customer.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  return response.json();
}

async function createTestFabric(overrides: Record<string, unknown> = {}) {
  const response = await handleCreateFabricRequest(
    jsonRequest("http://localhost/api/fabrics", "POST", {
      name: "Italian Super 120 Wool",
      composition: "100% Wool",
      weight: "260g/m²",
      season: "All Season",
      colour: "Navy",
      supplier: "Loro Piana",
      ...overrides,
    }),
    { authenticate: authAs(OWNER_USER), repository },
  );
  return response.json();
}

async function createTestVariant(fabricId: string, overrides: Record<string, unknown> = {}) {
  const response = await handleCreateFabricVariantRequest(
    jsonRequest(`http://localhost/api/fabrics/${fabricId}/variants`, "POST", { colour: "Navy", ...overrides }),
    fabricId,
    { authenticate: authAs(OWNER_USER), repository },
  );
  return response.json();
}

// ============================================================
// ATTACH / PRESERVE
// ============================================================

test("attaches a fabric to an order", async () => {
  const order = await createTestOrder();
  const fabric = await createTestFabric();
  const response = await handleSetOrderMaterialRequest(
    jsonRequest(`http://localhost/api/orders/${order.id}/materials`, "POST", {
      role: "SUIT_FABRIC",
      fabricId: fabric.id,
    }),
    order.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(response.status, 201);
  const snapshot = await response.json();
  assert.equal(snapshot.orderId, order.id);
  assert.equal(snapshot.role, "SUIT_FABRIC");
  assert.equal(snapshot.fabricId, fabric.id);
  assert.equal(snapshot.fabricName, "Italian Super 120 Wool");
  assert.equal(snapshot.selectedBy, STAFF_USER.username);
});

test("attaches a fabric with a variant, copying the variant colour", async () => {
  const order = await createTestOrder();
  const fabric = await createTestFabric({ name: "Egyptian Cotton", colour: "White" });
  const variant = await createTestVariant(fabric.id, { colour: "Ivory" });
  const response = await handleSetOrderMaterialRequest(
    jsonRequest(`http://localhost/api/orders/${order.id}/materials`, "POST", {
      role: "SHIRT_FABRIC",
      fabricId: fabric.id,
      fabricVariantId: variant.id,
    }),
    order.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(response.status, 201);
  const snapshot = await response.json();
  assert.equal(snapshot.fabricVariantId, variant.id);
  assert.equal(snapshot.variantColour, "Ivory");
});

test("supports independent selections for SUIT_FABRIC and SHIRT_FABRIC on the same order", async () => {
  const order = await createTestOrder();
  const suitFabric = await createTestFabric({ name: "Italian Super 120 Wool" });
  const shirtFabric = await createTestFabric({ name: "Egyptian Cotton", colour: "White" });

  await handleSetOrderMaterialRequest(
    jsonRequest(`http://localhost/api/orders/${order.id}/materials`, "POST", { role: "SUIT_FABRIC", fabricId: suitFabric.id }),
    order.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  await handleSetOrderMaterialRequest(
    jsonRequest(`http://localhost/api/orders/${order.id}/materials`, "POST", { role: "SHIRT_FABRIC", fabricId: shirtFabric.id }),
    order.id,
    { authenticate: authAs(STAFF_USER), repository },
  );

  const response = await handleListOrderMaterialsRequest(
    jsonRequest(`http://localhost/api/orders/${order.id}/materials`, "GET"),
    order.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  const { materials } = await response.json();
  assert.equal(materials.length, 2);
  const roles = materials.map((m: { role: string }) => m.role).sort();
  assert.deepEqual(roles, ["SHIRT_FABRIC", "SUIT_FABRIC"]);
});

test("re-selecting the same role replaces the prior selection rather than appending", async () => {
  const order = await createTestOrder();
  const firstFabric = await createTestFabric({ name: "Italian Super 120 Wool" });
  const secondFabric = await createTestFabric({ name: "Loro Piana Cashmere" });

  await handleSetOrderMaterialRequest(
    jsonRequest(`http://localhost/api/orders/${order.id}/materials`, "POST", { role: "SUIT_FABRIC", fabricId: firstFabric.id }),
    order.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  await handleSetOrderMaterialRequest(
    jsonRequest(`http://localhost/api/orders/${order.id}/materials`, "POST", { role: "SUIT_FABRIC", fabricId: secondFabric.id }),
    order.id,
    { authenticate: authAs(STAFF_USER), repository },
  );

  const response = await handleListOrderMaterialsRequest(
    jsonRequest(`http://localhost/api/orders/${order.id}/materials`, "GET"),
    order.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  const { materials } = await response.json();
  assert.equal(materials.length, 1);
  assert.equal(materials[0].fabricName, "Loro Piana Cashmere");
});

test("the attached snapshot is a standalone copy, not a live reference (survives independently of the catalogue)", async () => {
  const order = await createTestOrder();
  const fabric = await createTestFabric({ name: "Italian Super 120 Wool", colour: "Navy", composition: "100% Wool" });
  await handleSetOrderMaterialRequest(
    jsonRequest(`http://localhost/api/orders/${order.id}/materials`, "POST", { role: "SUIT_FABRIC", fabricId: fabric.id }),
    order.id,
    { authenticate: authAs(STAFF_USER), repository },
  );

  const response = await handleListOrderMaterialsRequest(
    jsonRequest(`http://localhost/api/orders/${order.id}/materials`, "GET"),
    order.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  const { materials } = await response.json();
  // Every descriptive field is present directly on the snapshot row itself
  // (not merely a fabricId to join against) — this is what "do not only
  // reference live catalogue records" means structurally.
  assert.equal(materials[0].fabricName, "Italian Super 120 Wool");
  assert.equal(materials[0].colour, "Navy");
  assert.equal(materials[0].composition, "100% Wool");
  assert.equal(materials[0].fabricId, fabric.id, "the FK is retained for traceability, alongside the copy");
});

// ============================================================
// SECURITY
// ============================================================

test("rejects a fake/unknown fabric ID", async () => {
  const order = await createTestOrder();
  const response = await handleSetOrderMaterialRequest(
    jsonRequest(`http://localhost/api/orders/${order.id}/materials`, "POST", {
      role: "SUIT_FABRIC",
      fabricId: "00000000-0000-4000-8000-000000000000",
    }),
    order.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(response.status, 404);
});

test("rejects a fake/unknown fabric variant ID", async () => {
  const order = await createTestOrder();
  const fabric = await createTestFabric();
  const response = await handleSetOrderMaterialRequest(
    jsonRequest(`http://localhost/api/orders/${order.id}/materials`, "POST", {
      role: "SUIT_FABRIC",
      fabricId: fabric.id,
      fabricVariantId: "00000000-0000-4000-8000-000000000000",
    }),
    order.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(response.status, 404);
});

test("rejects a variant that belongs to a different fabric", async () => {
  const order = await createTestOrder();
  const fabricA = await createTestFabric({ name: "Fabric A" });
  const fabricB = await createTestFabric({ name: "Fabric B" });
  const variantOfB = await createTestVariant(fabricB.id);

  const response = await handleSetOrderMaterialRequest(
    jsonRequest(`http://localhost/api/orders/${order.id}/materials`, "POST", {
      role: "SUIT_FABRIC",
      fabricId: fabricA.id,
      fabricVariantId: variantOfB.id,
    }),
    order.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(response.status, 404);
});

test("rejects selecting a retired (INACTIVE) fabric", async () => {
  const order = await createTestOrder();
  const fabric = await createTestFabric({ status: "INACTIVE" });
  const response = await handleSetOrderMaterialRequest(
    jsonRequest(`http://localhost/api/orders/${order.id}/materials`, "POST", { role: "SUIT_FABRIC", fabricId: fabric.id }),
    order.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(response.status, 400);
});

test("rejects selecting an unavailable variant", async () => {
  const order = await createTestOrder();
  const fabric = await createTestFabric();
  const variant = await createTestVariant(fabric.id, { isAvailable: false });
  const response = await handleSetOrderMaterialRequest(
    jsonRequest(`http://localhost/api/orders/${order.id}/materials`, "POST", {
      role: "SUIT_FABRIC",
      fabricId: fabric.id,
      fabricVariantId: variant.id,
    }),
    order.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(response.status, 400);
});

test("rejects an unknown material role", async () => {
  const order = await createTestOrder();
  const fabric = await createTestFabric();
  const response = await handleSetOrderMaterialRequest(
    jsonRequest(`http://localhost/api/orders/${order.id}/materials`, "POST", { role: "TROUSER_FABRIC", fabricId: fabric.id }),
    order.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(response.status, 400);
});

test("rejects a fake/unknown order (order ownership)", async () => {
  const fabric = await createTestFabric();
  const response = await handleSetOrderMaterialRequest(
    jsonRequest("http://localhost/api/orders/00000000-0000-4000-8000-000000000000/materials", "POST", {
      role: "SUIT_FABRIC",
      fabricId: fabric.id,
    }),
    "00000000-0000-4000-8000-000000000000",
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(response.status, 404);
});

test("rejects a client-supplied fabricName/composition snapshot payload", async () => {
  const order = await createTestOrder();
  const fabric = await createTestFabric();
  const response = await handleSetOrderMaterialRequest(
    jsonRequest(`http://localhost/api/orders/${order.id}/materials`, "POST", {
      role: "SUIT_FABRIC",
      fabricId: fabric.id,
      fabricName: "Forged Fabric Name",
      composition: "Forged Composition",
    }),
    order.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(response.status, 400);
});

test("rejects a client-supplied selectedBy (identity) claim", async () => {
  const order = await createTestOrder();
  const fabric = await createTestFabric();
  const response = await handleSetOrderMaterialRequest(
    jsonRequest(`http://localhost/api/orders/${order.id}/materials`, "POST", {
      role: "SUIT_FABRIC",
      fabricId: fabric.id,
      selectedBy: "impersonated-staff",
    }),
    order.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(response.status, 400);
});

test("rejects a client-supplied selectedAt timestamp claim", async () => {
  const order = await createTestOrder();
  const fabric = await createTestFabric();
  const response = await handleSetOrderMaterialRequest(
    jsonRequest(`http://localhost/api/orders/${order.id}/materials`, "POST", {
      role: "SUIT_FABRIC",
      fabricId: fabric.id,
      selectedAt: "2000-01-01T00:00:00.000Z",
    }),
    order.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(response.status, 400);
});

test("rejects unauthenticated access", async () => {
  const order = await createTestOrder();
  const fabric = await createTestFabric();
  const response = await handleSetOrderMaterialRequest(
    jsonRequest(`http://localhost/api/orders/${order.id}/materials`, "POST", { role: "SUIT_FABRIC", fabricId: fabric.id }),
    order.id,
    { authenticate: authAs(null), repository },
  );
  assert.equal(response.status, 401);
});

test("rejects a cross-origin request", async () => {
  const order = await createTestOrder();
  const fabric = await createTestFabric();
  const response = await handleSetOrderMaterialRequest(
    jsonRequest(`http://localhost/api/orders/${order.id}/materials`, "POST", { role: "SUIT_FABRIC", fabricId: fabric.id }, {
      origin: "https://evil.example",
      "sec-fetch-site": "cross-site",
    }),
    order.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(response.status, 403);
});

test("MANAGER may also attach materials (not STAFF-exclusive)", async () => {
  const order = await createTestOrder();
  const fabric = await createTestFabric();
  const response = await handleSetOrderMaterialRequest(
    jsonRequest(`http://localhost/api/orders/${order.id}/materials`, "POST", { role: "SUIT_FABRIC", fabricId: fabric.id }),
    order.id,
    { authenticate: authAs(MANAGER_USER), repository },
  );
  assert.equal(response.status, 201);
});
