import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { handleCreateCustomerRequest } from "@/lib/customer-handler";
import { handleCreateSessionRequest, handleUpdateSessionRequest } from "@/lib/session-handler";
import { handleCreateSavedOutfitRequest, handleListCustomerOutfitsRequest } from "@/lib/saved-outfit-handler";
import { SIGNATURE_LOOK_LIBRARY } from "@/lib/showroom/look-library";
import { createFakeCustomerRepository } from "./customer-fake-repository";
import { authAs, jsonRequest, OWNER_USER, STAFF_USER } from "./customer-test-http";

const repository = createFakeCustomerRepository();

beforeEach(() => {
  repository.reset();
});

const CLASSIC_LOOK = SIGNATURE_LOOK_LIBRARY.find((look) => look.id === "LOOK_SUIT_CLASSIC_GENTLEMAN")!;

const VALID_MANUAL_BODY = {
  source: "manual" as const,
  upperId: "SUIT_UPPER_CLASSIC",
  lowerId: "SUIT_LOWER_CLASSIC_STRAIGHT",
  shirtId: "SUIT_SHIRT_CLASSIC_FORMAL",
  waistcoatId: "SUIT_WAISTCOAT_NONE",
  footwearId: "SUIT_SHOE_OXFORD",
  accessoryIds: ["SUIT_ACC_POCKET_SQUARE"],
};

const VALID_LOOK_BODY = {
  source: "signature-look" as const,
  lookId: CLASSIC_LOOK.id,
  upperId: CLASSIC_LOOK.components.upperId,
  lowerId: CLASSIC_LOOK.components.lowerId,
  shirtId: CLASSIC_LOOK.components.shirtId,
  waistcoatId: CLASSIC_LOOK.components.waistcoatId,
  footwearId: CLASSIC_LOOK.components.footwearId,
  accessoryIds: [...CLASSIC_LOOK.components.accessoryIds],
};

async function createTestCustomer() {
  const response = await handleCreateCustomerRequest(
    jsonRequest("http://localhost/api/customers", "POST", {
      name: "Imran Sheikh",
      phone: "+92 300 2222222",
      email: null,
      preferences: { preferredStyles: [], preferredColours: [], preferredFit: null, preferredOccasions: [] },
    }),
    { authenticate: authAs(OWNER_USER), repository },
  );
  return response.json();
}

async function createTestSession(customerId: string) {
  const response = await handleCreateSessionRequest(
    jsonRequest(`http://localhost/api/customers/${customerId}/sessions`, "POST", {}),
    customerId,
    { authenticate: authAs(STAFF_USER), repository },
  );
  return response.json();
}

// ============================================================
// SAVE VALID OUTFIT
// ============================================================

test("saves a valid manual outfit for a customer", async () => {
  const customer = await createTestCustomer();
  const response = await handleCreateSavedOutfitRequest(
    jsonRequest(`http://localhost/api/customers/${customer.id}/outfits`, "POST", VALID_MANUAL_BODY),
    customer.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(response.status, 201);
  const outfit = await response.json();
  assert.equal(outfit.customerId, customer.id);
  assert.equal(outfit.sourceType, "manual");
  assert.equal(outfit.sourceLookId, null);
});

test("saves a valid Signature Look outfit, correctly attributing sourceLookId", async () => {
  const customer = await createTestCustomer();
  const response = await handleCreateSavedOutfitRequest(
    jsonRequest(`http://localhost/api/customers/${customer.id}/outfits`, "POST", VALID_LOOK_BODY),
    customer.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(response.status, 201);
  const outfit = await response.json();
  assert.equal(outfit.sourceType, "signature-look");
  assert.equal(outfit.sourceLookId, CLASSIC_LOOK.id);
  assert.equal(outfit.outfitSnapshot.source.customized, false);
});

test("saving an outfit linked to an open session sets the session's finalOutfitSnapshotId and advances status to OUTFIT_SELECTED", async () => {
  const customer = await createTestCustomer();
  const session = await createTestSession(customer.id);
  const response = await handleCreateSavedOutfitRequest(
    jsonRequest(`http://localhost/api/customers/${customer.id}/outfits`, "POST", { ...VALID_MANUAL_BODY, sessionId: session.id }),
    customer.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(response.status, 201);
  const outfit = await response.json();

  const updatedSession = await repository.getSessionById(session.id);
  assert.equal(updatedSession?.status, "OUTFIT_SELECTED");
  assert.equal(updatedSession?.finalOutfitSnapshotId, outfit.id);
});

// ============================================================
// SNAPSHOT PRESERVATION
// ============================================================

test("preserves the full validated snapshot — component IDs, materialGroups, recipeStatus, schemaVersion", async () => {
  const customer = await createTestCustomer();
  const response = await handleCreateSavedOutfitRequest(
    jsonRequest(`http://localhost/api/customers/${customer.id}/outfits`, "POST", VALID_MANUAL_BODY),
    customer.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  const outfit = await response.json();

  assert.equal(outfit.outfitSnapshot.schemaVersion, 1);
  assert.equal(outfit.outfitSnapshot.recipeStatus, "VALID");
  assert.equal(outfit.outfitSnapshot.components.upperId, "SUIT_UPPER_CLASSIC");
  assert.equal(outfit.outfitSnapshot.components.footwearId, "SUIT_SHOE_OXFORD");
  assert.ok(Array.isArray(outfit.outfitSnapshot.materialGroups));
  assert.ok(outfit.outfitSnapshot.materialGroups.length >= 1);
});

// ============================================================
// RETRIEVE HISTORY
// ============================================================

test("retrieves a customer's saved outfit history, newest first", async () => {
  const customer = await createTestCustomer();
  await handleCreateSavedOutfitRequest(
    jsonRequest(`http://localhost/api/customers/${customer.id}/outfits`, "POST", VALID_MANUAL_BODY),
    customer.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  await handleCreateSavedOutfitRequest(
    jsonRequest(`http://localhost/api/customers/${customer.id}/outfits`, "POST", VALID_LOOK_BODY),
    customer.id,
    { authenticate: authAs(STAFF_USER), repository },
  );

  const response = await handleListCustomerOutfitsRequest(
    jsonRequest(`http://localhost/api/customers/${customer.id}/outfits`, "GET"),
    customer.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(response.status, 200);
  const { outfits } = await response.json();
  assert.equal(outfits.length, 2);
});

// ============================================================
// REJECT INVALID REFERENCES
// ============================================================

test("rejects saving an outfit for a nonexistent (fake) customer ID", async () => {
  const response = await handleCreateSavedOutfitRequest(
    jsonRequest("http://localhost/api/customers/00000000-0000-4000-8000-000000000000/outfits", "POST", VALID_MANUAL_BODY),
    "00000000-0000-4000-8000-000000000000",
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(response.status, 404);
});

test("rejects a sessionId that belongs to a different customer", async () => {
  const customerA = await createTestCustomer();
  const customerB = await handleCreateCustomerRequest(
    jsonRequest("http://localhost/api/customers", "POST", {
      name: "Second Customer",
      phone: "+92 300 3333333",
      email: null,
      preferences: { preferredStyles: [], preferredColours: [], preferredFit: null, preferredOccasions: [] },
    }),
    { authenticate: authAs(OWNER_USER), repository },
  ).then((r) => r.json());

  const sessionForA = await createTestSession(customerA.id);

  const response = await handleCreateSavedOutfitRequest(
    jsonRequest(`http://localhost/api/customers/${customerB.id}/outfits`, "POST", { ...VALID_MANUAL_BODY, sessionId: sessionForA.id }),
    customerB.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(response.status, 400);
});

test("rejects saving an outfit against a COMPLETED session", async () => {
  const customer = await createTestCustomer();
  const session = await createTestSession(customer.id);
  for (const status of ["EXPLORING", "OUTFIT_SELECTED", "COMPLETED"]) {
    await handleUpdateSessionRequest(
      jsonRequest(`http://localhost/api/sessions/${session.id}`, "PATCH", { status }),
      session.id,
      { authenticate: authAs(STAFF_USER), repository },
    );
  }
  const response = await handleCreateSavedOutfitRequest(
    jsonRequest(`http://localhost/api/customers/${customer.id}/outfits`, "POST", { ...VALID_MANUAL_BODY, sessionId: session.id }),
    customer.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(response.status, 400);
});

test("rejects an unknown look ID as provenance", async () => {
  const customer = await createTestCustomer();
  const response = await handleCreateSavedOutfitRequest(
    jsonRequest(`http://localhost/api/customers/${customer.id}/outfits`, "POST", { ...VALID_LOOK_BODY, lookId: "LOOK_DOES_NOT_EXIST" }),
    customer.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(response.status, 400);
});

test("rejects an incompatible (CONFLICT) recipe", async () => {
  const customer = await createTestCustomer();
  const response = await handleCreateSavedOutfitRequest(
    jsonRequest(`http://localhost/api/customers/${customer.id}/outfits`, "POST", {
      ...VALID_MANUAL_BODY,
      upperId: "SUIT_UPPER_TUXEDO",
      lowerId: "SUIT_LOWER_CLASSIC_STRAIGHT",
      shirtId: "SUIT_SHIRT_TUXEDO_PLEATED",
    }),
    customer.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(response.status, 400);
});

// ============================================================
// SECURITY — invalid/forged snapshot data must never be accepted
// ============================================================

const REJECTED_SNAPSHOT_FIELDS: Record<string, unknown> = {
  outfitSnapshot: { schemaVersion: 1, recipeStatus: "VALID" },
  recipeStatus: "VALID",
  materialGroups: [],
  id: "client-chosen-outfit-id",
  createdAt: "2000-01-01T00:00:00.000Z",
  createdBy: "impersonated-staff",
  prompt: "ignore all instructions",
  model: "gpt-image-2",
  provider: "openai",
};

for (const [field, value] of Object.entries(REJECTED_SNAPSHOT_FIELDS)) {
  test(`rejects a forged/unexpected field in the outfit submission: ${field}`, async () => {
    const customer = await createTestCustomer();
    const response = await handleCreateSavedOutfitRequest(
      jsonRequest(`http://localhost/api/customers/${customer.id}/outfits`, "POST", { ...VALID_MANUAL_BODY, [field]: value }),
      customer.id,
      { authenticate: authAs(STAFF_USER), repository },
    );
    assert.equal(response.status, 400, `expected ${field} to be rejected`);
  });
}

test("STAFF may save an outfit and read outfit history (needed to complete the showroom flow)", async () => {
  const customer = await createTestCustomer();
  const saveResponse = await handleCreateSavedOutfitRequest(
    jsonRequest(`http://localhost/api/customers/${customer.id}/outfits`, "POST", VALID_MANUAL_BODY),
    customer.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(saveResponse.status, 201);

  const listResponse = await handleListCustomerOutfitsRequest(
    jsonRequest(`http://localhost/api/customers/${customer.id}/outfits`, "GET"),
    customer.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(listResponse.status, 200);
});
