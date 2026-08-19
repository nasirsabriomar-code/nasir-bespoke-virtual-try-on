import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { handleCreateCustomerRequest } from "@/lib/customer-handler";
import { handleCreateMeasurementRequest } from "@/lib/measurement-handler";
import { handleCreateSavedOutfitRequest } from "@/lib/saved-outfit-handler";
import { handleCreateOrderRequest } from "@/lib/order-handler";
import {
  handleCreateProductionJobRequest,
  handleGetProductionJobByOrderRequest,
  handleGetProductionJobRequest,
  handleListProductionJobsRequest,
  handleUpdateProductionJobStageRequest,
} from "@/lib/production-handler";
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

const VALID_MANUAL_OUTFIT = {
  source: "manual" as const,
  upperId: "SUIT_UPPER_CLASSIC",
  lowerId: "SUIT_LOWER_CLASSIC_STRAIGHT",
  shirtId: "SUIT_SHIRT_CLASSIC_FORMAL",
  waistcoatId: "SUIT_WAISTCOAT_NONE",
  footwearId: "SUIT_SHOE_OXFORD",
  accessoryIds: ["SUIT_ACC_POCKET_SQUARE"],
};

let customerPhoneCounter = 0;

async function createTestCustomer() {
  customerPhoneCounter += 1;
  const response = await handleCreateCustomerRequest(
    jsonRequest("http://localhost/api/customers", "POST", {
      name: "Zafar Iqbal",
      phone: `+92 300 44444${String(customerPhoneCounter).padStart(2, "0")}`,
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

/** Creates a CONFIRMED production job for the given order (MANAGER by default) and returns the parsed job. */
async function createProductionJob(
  orderId: string,
  options: { assignedStaffId?: string | null; user?: Parameters<typeof authAs>[0] } = {},
) {
  const body: Record<string, unknown> = {};
  if (options.assignedStaffId !== undefined) body.assignedStaffId = options.assignedStaffId;
  const response = await handleCreateProductionJobRequest(
    jsonRequest(`http://localhost/api/orders/${orderId}/production`, "POST", body),
    orderId,
    { authenticate: authAs(options.user ?? MANAGER_USER), repository },
  );
  const payload = await response.json();
  return payload.job;
}

async function patchStage(jobId: string, body: Record<string, unknown>, user: Parameters<typeof authAs>[0]) {
  return handleUpdateProductionJobStageRequest(
    jsonRequest(`http://localhost/api/production/${jobId}`, "PATCH", body),
    jobId,
    { authenticate: authAs(user), repository },
  );
}

// ============================================================
// CREATE / RETRIEVE
// ============================================================

test("creates a valid production job with an assigned staff member", async () => {
  const order = await createTestOrder();
  const response = await handleCreateProductionJobRequest(
    jsonRequest(`http://localhost/api/orders/${order.id}/production`, "POST", {
      assignedStaffId: MASTER_TAILOR_USER.username,
    }),
    order.id,
    { authenticate: authAs(MANAGER_USER), repository },
  );
  assert.equal(response.status, 201);
  const payload = await response.json();
  assert.equal(payload.job.orderId, order.id);
  assert.equal(payload.job.currentStage, "CONFIRMED");
  assert.equal(payload.job.assignedStaffId, MASTER_TAILOR_USER.username);
  assert.equal(payload.history.length, 1);
  assert.equal(payload.history[0].fromStage, null);
  assert.equal(payload.history[0].toStage, "CONFIRMED");
});

test("creates a production job with no assignedStaffId (defaults to null)", async () => {
  const order = await createTestOrder();
  const response = await handleCreateProductionJobRequest(
    jsonRequest(`http://localhost/api/orders/${order.id}/production`, "POST", {}),
    order.id,
    { authenticate: authAs(MANAGER_USER), repository },
  );
  assert.equal(response.status, 201);
  const payload = await response.json();
  assert.equal(payload.job.assignedStaffId, null);
});

test("rejects a second production job for the same order (409)", async () => {
  const order = await createTestOrder();
  await createProductionJob(order.id);
  const response = await handleCreateProductionJobRequest(
    jsonRequest(`http://localhost/api/orders/${order.id}/production`, "POST", {}),
    order.id,
    { authenticate: authAs(MANAGER_USER), repository },
  );
  assert.equal(response.status, 409);
});

test("rejects creating a production job for an unknown order id (404)", async () => {
  const response = await handleCreateProductionJobRequest(
    jsonRequest("http://localhost/api/orders/00000000-0000-4000-8000-000000000000/production", "POST", {}),
    "00000000-0000-4000-8000-000000000000",
    { authenticate: authAs(MANAGER_USER), repository },
  );
  assert.equal(response.status, 404);
});

test("gets a production job by order id", async () => {
  const order = await createTestOrder();
  const job = await createProductionJob(order.id);
  const response = await handleGetProductionJobByOrderRequest(
    jsonRequest(`http://localhost/api/orders/${order.id}/production`, "GET"),
    order.id,
    { authenticate: authAs(MANAGER_USER), repository },
  );
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.job.id, job.id);
  assert.equal(payload.history.length, 1);
});

test("gets a production job by job id", async () => {
  const order = await createTestOrder();
  const job = await createProductionJob(order.id);
  const response = await handleGetProductionJobRequest(
    jsonRequest(`http://localhost/api/production/${job.id}`, "GET"),
    job.id,
    { authenticate: authAs(MANAGER_USER), repository },
  );
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.job.id, job.id);
});

test("lists all production jobs", async () => {
  const orderA = await createTestOrder();
  const orderB = await createTestOrder();
  await createProductionJob(orderA.id);
  await createProductionJob(orderB.id);
  const response = await handleListProductionJobsRequest(
    jsonRequest("http://localhost/api/production", "GET"),
    { authenticate: authAs(MANAGER_USER), repository },
  );
  assert.equal(response.status, 200);
  const { jobs } = await response.json();
  assert.equal(jobs.length, 2);
});

test("lists production jobs filtered by stage", async () => {
  const orderA = await createTestOrder();
  const orderB = await createTestOrder();
  const jobA = await createProductionJob(orderA.id);
  await createProductionJob(orderB.id);
  await patchStage(jobA.id, { toStage: "FABRIC_READY" }, MANAGER_USER);

  const response = await handleListProductionJobsRequest(
    jsonRequest("http://localhost/api/production?stage=FABRIC_READY", "GET"),
    { authenticate: authAs(MANAGER_USER), repository },
  );
  assert.equal(response.status, 200);
  const { jobs } = await response.json();
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].id, jobA.id);
});

// ============================================================
// STAGE TRANSITIONS
// ============================================================

test("walks the full valid production path as MANAGER: CONFIRMED -> ... -> COMPLETED", async () => {
  const order = await createTestOrder();
  const job = await createProductionJob(order.id);
  assert.equal(job.currentStage, "CONFIRMED");

  const path = [
    "FABRIC_READY",
    "CUTTING",
    "STITCHING",
    "FIRST_TRIAL",
    "FINAL_QC",
    "READY_FOR_DELIVERY",
    "COMPLETED",
  ];

  let expectedHistoryLength = 1;
  for (const toStage of path) {
    const response = await patchStage(job.id, { toStage }, MANAGER_USER);
    assert.equal(response.status, 200, `transition to ${toStage} should succeed`);
    const payload = await response.json();
    assert.equal(payload.job.currentStage, toStage);
    expectedHistoryLength += 1;
    assert.equal(payload.history.length, expectedHistoryLength);
  }
});

test("supports the FIRST_TRIAL -> ALTERATION -> FIRST_TRIAL loop", async () => {
  const order = await createTestOrder();
  const job = await createProductionJob(order.id);
  for (const toStage of ["FABRIC_READY", "CUTTING", "STITCHING", "FIRST_TRIAL"]) {
    await patchStage(job.id, { toStage }, MANAGER_USER);
  }

  const toAlteration = await patchStage(job.id, { toStage: "ALTERATION" }, MANAGER_USER);
  assert.equal(toAlteration.status, 200);
  assert.equal((await toAlteration.json()).job.currentStage, "ALTERATION");

  const backToTrial = await patchStage(job.id, { toStage: "FIRST_TRIAL" }, MANAGER_USER);
  assert.equal(backToTrial.status, 200);
  assert.equal((await backToTrial.json()).job.currentStage, "FIRST_TRIAL");
});

test("supports the FINAL_QC -> ALTERATION loop", async () => {
  const order = await createTestOrder();
  const job = await createProductionJob(order.id);
  for (const toStage of ["FABRIC_READY", "CUTTING", "STITCHING", "FIRST_TRIAL", "FINAL_QC"]) {
    await patchStage(job.id, { toStage }, MANAGER_USER);
  }

  const response = await patchStage(job.id, { toStage: "ALTERATION" }, MANAGER_USER);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).job.currentStage, "ALTERATION");
});

test("CANCELLED is reachable from a non-terminal stage as MANAGER", async () => {
  const order = await createTestOrder();
  const job = await createProductionJob(order.id);
  const response = await patchStage(job.id, { toStage: "CANCELLED" }, MANAGER_USER);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).job.currentStage, "CANCELLED");
});

test("rejects an impossible direct jump: CONFIRMED -> STITCHING", async () => {
  const order = await createTestOrder();
  const job = await createProductionJob(order.id);
  const response = await patchStage(job.id, { toStage: "STITCHING" }, MANAGER_USER);
  assert.equal(response.status, 400);
});

test("rejects any transition out of a terminal COMPLETED production job", async () => {
  const order = await createTestOrder();
  const job = await createProductionJob(order.id);
  const path = ["FABRIC_READY", "CUTTING", "STITCHING", "FIRST_TRIAL", "FINAL_QC", "READY_FOR_DELIVERY", "COMPLETED"];
  for (const toStage of path) {
    const step = await patchStage(job.id, { toStage }, MANAGER_USER);
    assert.equal(step.status, 200, `transition to ${toStage} should succeed`);
  }
  const response = await patchStage(job.id, { toStage: "FABRIC_READY" }, MANAGER_USER);
  assert.equal(response.status, 400);
});

test("rejects any transition out of a terminal CANCELLED production job", async () => {
  const order = await createTestOrder();
  const job = await createProductionJob(order.id);
  await patchStage(job.id, { toStage: "CANCELLED" }, MANAGER_USER);
  const response = await patchStage(job.id, { toStage: "FABRIC_READY" }, MANAGER_USER);
  assert.equal(response.status, 400);
});

test("a same-stage transition (toStage === currentStage) succeeds as a no-op, per assertValidProductionTransition", async () => {
  const order = await createTestOrder();
  const job = await createProductionJob(order.id);
  const response = await patchStage(job.id, { toStage: "CONFIRMED" }, MANAGER_USER);
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.job.currentStage, "CONFIRMED");
  assert.equal(payload.history.length, 2, "a same-stage PATCH still appends a new history entry");
  assert.equal(payload.history[1].fromStage, "CONFIRMED");
  assert.equal(payload.history[1].toStage, "CONFIRMED");
});

// ============================================================
// ROLE SCOPING
// ============================================================

test("OWNER may cancel a production job at any stage regardless of assignment", async () => {
  const order = await createTestOrder();
  const job = await createProductionJob(order.id, { assignedStaffId: "othertailor" });
  const response = await patchStage(job.id, { toStage: "CANCELLED" }, OWNER_USER);
  assert.equal(response.status, 200);
});

test("MANAGER may cancel a production job at any stage regardless of assignment", async () => {
  const order = await createTestOrder();
  const job = await createProductionJob(order.id, { assignedStaffId: "othertailor" });
  const response = await patchStage(job.id, { toStage: "CANCELLED" }, MANAGER_USER);
  assert.equal(response.status, 200);
});

test("MASTER_TAILOR cannot cancel a job even when it is assigned to them and at FINAL_QC", async () => {
  const order = await createTestOrder();
  const job = await createProductionJob(order.id, { assignedStaffId: MASTER_TAILOR_USER.username });
  for (const toStage of ["FABRIC_READY", "CUTTING", "STITCHING", "FIRST_TRIAL", "FINAL_QC"]) {
    await patchStage(job.id, { toStage }, MANAGER_USER);
  }
  const response = await patchStage(job.id, { toStage: "CANCELLED" }, MASTER_TAILOR_USER);
  assert.equal(response.status, 403);
});

test("QC_STAFF cannot cancel a job even at FINAL_QC", async () => {
  const order = await createTestOrder();
  const job = await createProductionJob(order.id);
  for (const toStage of ["FABRIC_READY", "CUTTING", "STITCHING", "FIRST_TRIAL", "FINAL_QC"]) {
    await patchStage(job.id, { toStage }, MANAGER_USER);
  }
  const response = await patchStage(job.id, { toStage: "CANCELLED" }, QC_STAFF_USER);
  assert.equal(response.status, 403);
});

test("QC_STAFF may update a job that is currently at FINAL_QC", async () => {
  const order = await createTestOrder();
  const job = await createProductionJob(order.id);
  for (const toStage of ["FABRIC_READY", "CUTTING", "STITCHING", "FIRST_TRIAL", "FINAL_QC"]) {
    await patchStage(job.id, { toStage }, MANAGER_USER);
  }
  const response = await patchStage(job.id, { toStage: "READY_FOR_DELIVERY" }, QC_STAFF_USER);
  assert.equal(response.status, 200);
});

test("QC_STAFF is rejected updating a job whose current stage is not FINAL_QC", async () => {
  const order = await createTestOrder();
  const job = await createProductionJob(order.id);
  const response = await patchStage(job.id, { toStage: "FABRIC_READY" }, QC_STAFF_USER);
  assert.equal(response.status, 403);
});

test("MASTER_TAILOR may update the stage of a job assigned to them (not at FINAL_QC)", async () => {
  const order = await createTestOrder();
  const job = await createProductionJob(order.id, { assignedStaffId: MASTER_TAILOR_USER.username });
  const response = await patchStage(job.id, { toStage: "FABRIC_READY" }, MASTER_TAILOR_USER);
  assert.equal(response.status, 200);
});

test("MASTER_TAILOR is rejected updating a job that is not assigned to them", async () => {
  const order = await createTestOrder();
  const job = await createProductionJob(order.id, { assignedStaffId: "othertailor" });
  const response = await patchStage(job.id, { toStage: "FABRIC_READY" }, MASTER_TAILOR_USER);
  assert.equal(response.status, 403);
});

test("MASTER_TAILOR is rejected making the FINAL_QC outcome decision even when the job is assigned to them", async () => {
  const order = await createTestOrder();
  const job = await createProductionJob(order.id, { assignedStaffId: MASTER_TAILOR_USER.username });
  for (const toStage of ["FABRIC_READY", "CUTTING", "STITCHING", "FIRST_TRIAL", "FINAL_QC"]) {
    await patchStage(job.id, { toStage }, MANAGER_USER);
  }
  const response = await patchStage(job.id, { toStage: "READY_FOR_DELIVERY" }, MASTER_TAILOR_USER);
  assert.equal(response.status, 403);
});

test("OWNER/MANAGER may update any job's stage regardless of assignment", async () => {
  const order = await createTestOrder();
  const job = await createProductionJob(order.id, { assignedStaffId: "othertailor" });
  const response = await patchStage(job.id, { toStage: "FABRIC_READY" }, OWNER_USER);
  assert.equal(response.status, 200);
});

test("STAFF is rejected attempting any production stage update (lacks production:update)", async () => {
  const order = await createTestOrder();
  const job = await createProductionJob(order.id);
  const response = await patchStage(job.id, { toStage: "FABRIC_READY" }, STAFF_USER);
  assert.equal(response.status, 403);
});

test("STYLE_CONSULTANT is rejected attempting any production stage update (lacks production:update)", async () => {
  const order = await createTestOrder();
  const job = await createProductionJob(order.id);
  const response = await patchStage(job.id, { toStage: "FABRIC_READY" }, STYLE_CONSULTANT_USER);
  assert.equal(response.status, 403);
});

test("reassignment via assignedStaffId is rejected for a MASTER_TAILOR even when otherwise validly updating their own assigned job's stage", async () => {
  const order = await createTestOrder();
  const job = await createProductionJob(order.id, { assignedStaffId: MASTER_TAILOR_USER.username });
  const response = await patchStage(
    job.id,
    { toStage: "FABRIC_READY", assignedStaffId: "othertailor" },
    MASTER_TAILOR_USER,
  );
  assert.equal(response.status, 403);
});

test("reassignment to explicitly null via assignedStaffId is rejected for a MASTER_TAILOR", async () => {
  const order = await createTestOrder();
  const job = await createProductionJob(order.id, { assignedStaffId: MASTER_TAILOR_USER.username });
  const response = await patchStage(job.id, { toStage: "FABRIC_READY", assignedStaffId: null }, MASTER_TAILOR_USER);
  assert.equal(response.status, 403);
});

test("MANAGER may reassign a production job while also updating its stage", async () => {
  const order = await createTestOrder();
  const job = await createProductionJob(order.id, { assignedStaffId: "othertailor" });
  const response = await patchStage(
    job.id,
    { toStage: "FABRIC_READY", assignedStaffId: MASTER_TAILOR_USER.username },
    MANAGER_USER,
  );
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.job.assignedStaffId, MASTER_TAILOR_USER.username);
});

test("MASTER_TAILOR reading a job by order id that is not assigned to them returns 404", async () => {
  const order = await createTestOrder();
  await createProductionJob(order.id, { assignedStaffId: "othertailor" });
  const response = await handleGetProductionJobByOrderRequest(
    jsonRequest(`http://localhost/api/orders/${order.id}/production`, "GET"),
    order.id,
    { authenticate: authAs(MASTER_TAILOR_USER), repository },
  );
  assert.equal(response.status, 404);
});

test("MASTER_TAILOR reading a job by job id that is not assigned to them returns 404", async () => {
  const order = await createTestOrder();
  const job = await createProductionJob(order.id, { assignedStaffId: "othertailor" });
  const response = await handleGetProductionJobRequest(
    jsonRequest(`http://localhost/api/production/${job.id}`, "GET"),
    job.id,
    { authenticate: authAs(MASTER_TAILOR_USER), repository },
  );
  assert.equal(response.status, 404);
});

test("MASTER_TAILOR reading a job assigned to them succeeds", async () => {
  const order = await createTestOrder();
  const job = await createProductionJob(order.id, { assignedStaffId: MASTER_TAILOR_USER.username });
  const response = await handleGetProductionJobRequest(
    jsonRequest(`http://localhost/api/production/${job.id}`, "GET"),
    job.id,
    { authenticate: authAs(MASTER_TAILOR_USER), repository },
  );
  assert.equal(response.status, 200);
});

for (const user of [OWNER_USER, MANAGER_USER, STAFF_USER, STYLE_CONSULTANT_USER, QC_STAFF_USER]) {
  test(`${user.role} has unrestricted read access to a production job assigned to someone else`, async () => {
    const order = await createTestOrder();
    const job = await createProductionJob(order.id, { assignedStaffId: "othertailor" });
    const response = await handleGetProductionJobRequest(
      jsonRequest(`http://localhost/api/production/${job.id}`, "GET"),
      job.id,
      { authenticate: authAs(user), repository },
    );
    assert.equal(response.status, 200);
  });
}

test("MASTER_TAILOR's production job list is filtered to only jobs assigned to them", async () => {
  const orderA = await createTestOrder();
  const orderB = await createTestOrder();
  const ownJob = await createProductionJob(orderA.id, { assignedStaffId: MASTER_TAILOR_USER.username });
  await createProductionJob(orderB.id, { assignedStaffId: "othertailor" });

  const response = await handleListProductionJobsRequest(
    jsonRequest("http://localhost/api/production", "GET"),
    { authenticate: authAs(MASTER_TAILOR_USER), repository },
  );
  assert.equal(response.status, 200);
  const { jobs } = await response.json();
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].id, ownJob.id);
});

for (const user of [STYLE_CONSULTANT_USER, STAFF_USER, QC_STAFF_USER, MANAGER_USER, OWNER_USER]) {
  test(`${user.role}'s production job list includes ALL jobs regardless of assignment`, async () => {
    const orderA = await createTestOrder();
    const orderB = await createTestOrder();
    await createProductionJob(orderA.id, { assignedStaffId: "tailorA" });
    await createProductionJob(orderB.id, { assignedStaffId: "tailorB" });

    const response = await handleListProductionJobsRequest(
      jsonRequest("http://localhost/api/production", "GET"),
      { authenticate: authAs(user), repository },
    );
    assert.equal(response.status, 200);
    const { jobs } = await response.json();
    assert.equal(jobs.length, 2);
  });
}

// ============================================================
// SECURITY
// ============================================================

test("SECURITY: rejects STAFF and STYLE_CONSULTANT attempting a stage update (lack production:update)", async () => {
  const order = await createTestOrder();
  const job = await createProductionJob(order.id);
  for (const user of [STAFF_USER, STYLE_CONSULTANT_USER]) {
    const response = await patchStage(job.id, { toStage: "FABRIC_READY" }, user);
    assert.equal(response.status, 403, `${user.role} should be rejected`);
  }
});

test("SECURITY: rejects an injection-style attempt to jump straight from CONFIRMED to COMPLETED", async () => {
  const order = await createTestOrder();
  const job = await createProductionJob(order.id);
  const response = await patchStage(job.id, { toStage: "COMPLETED" }, MANAGER_USER);
  assert.equal(response.status, 400);
});

test("SECURITY: rejects creating a production job against a fake/unknown order ID", async () => {
  const response = await handleCreateProductionJobRequest(
    jsonRequest("http://localhost/api/orders/00000000-0000-4000-8000-000000000000/production", "POST", {}),
    "00000000-0000-4000-8000-000000000000",
    { authenticate: authAs(MANAGER_USER), repository },
  );
  assert.equal(response.status, 404);
});

test("SECURITY: rejects getting a fake/unknown production job ID", async () => {
  const response = await handleGetProductionJobRequest(
    jsonRequest("http://localhost/api/production/00000000-0000-4000-8000-000000000000", "GET"),
    "00000000-0000-4000-8000-000000000000",
    { authenticate: authAs(MANAGER_USER), repository },
  );
  assert.equal(response.status, 404);
});

test("SECURITY: rejects updating a fake/unknown production job ID", async () => {
  const response = await patchStage("00000000-0000-4000-8000-000000000000", { toStage: "FABRIC_READY" }, MANAGER_USER);
  assert.equal(response.status, 404);
});

test("SECURITY: rejects a client-supplied id field on production job creation", async () => {
  const order = await createTestOrder();
  const response = await handleCreateProductionJobRequest(
    jsonRequest(`http://localhost/api/orders/${order.id}/production`, "POST", { id: "forged-id" }),
    order.id,
    { authenticate: authAs(MANAGER_USER), repository },
  );
  assert.equal(response.status, 400);
});

test("SECURITY: rejects a client-supplied id field on a stage update", async () => {
  const order = await createTestOrder();
  const job = await createProductionJob(order.id);
  const response = await patchStage(job.id, { toStage: "FABRIC_READY", id: "forged-id" }, MANAGER_USER);
  assert.equal(response.status, 400);
});

test("SECURITY: rejects client-supplied createdAt/updatedAt on production job creation", async () => {
  const order = await createTestOrder();
  const response = await handleCreateProductionJobRequest(
    jsonRequest(`http://localhost/api/orders/${order.id}/production`, "POST", {
      createdAt: "2000-01-01T00:00:00.000Z",
      updatedAt: "2000-01-01T00:00:00.000Z",
    }),
    order.id,
    { authenticate: authAs(MANAGER_USER), repository },
  );
  assert.equal(response.status, 400);
});

test("SECURITY: rejects client-supplied createdAt/updatedAt on a stage update", async () => {
  const order = await createTestOrder();
  const job = await createProductionJob(order.id);
  const response = await patchStage(
    job.id,
    { toStage: "FABRIC_READY", updatedAt: "2000-01-01T00:00:00.000Z" },
    MANAGER_USER,
  );
  assert.equal(response.status, 400);
});

test("SECURITY: rejects a client-supplied history array on production job creation", async () => {
  const order = await createTestOrder();
  const response = await handleCreateProductionJobRequest(
    jsonRequest(`http://localhost/api/orders/${order.id}/production`, "POST", { history: [] }),
    order.id,
    { authenticate: authAs(MANAGER_USER), repository },
  );
  assert.equal(response.status, 400);
});

test("SECURITY: rejects a client-supplied changedBy (identity) claim on a stage update", async () => {
  const order = await createTestOrder();
  const job = await createProductionJob(order.id);
  const response = await patchStage(
    job.id,
    { toStage: "FABRIC_READY", changedBy: "impersonated-staff" },
    MANAGER_USER,
  );
  assert.equal(response.status, 400);
});

test("SECURITY: rejects an unauthenticated request to create a production job", async () => {
  const order = await createTestOrder();
  const response = await handleCreateProductionJobRequest(
    jsonRequest(`http://localhost/api/orders/${order.id}/production`, "POST", {}),
    order.id,
    { authenticate: authAs(null), repository },
  );
  assert.equal(response.status, 401);
});

test("SECURITY: rejects an unauthenticated request to get a production job", async () => {
  const order = await createTestOrder();
  const job = await createProductionJob(order.id);
  const response = await handleGetProductionJobRequest(
    jsonRequest(`http://localhost/api/production/${job.id}`, "GET"),
    job.id,
    { authenticate: authAs(null), repository },
  );
  assert.equal(response.status, 401);
});

test("SECURITY: rejects an unauthenticated request to update a production job's stage", async () => {
  const order = await createTestOrder();
  const job = await createProductionJob(order.id);
  const response = await patchStage(job.id, { toStage: "FABRIC_READY" }, null);
  assert.equal(response.status, 401);
});

test("SECURITY: rejects a cross-origin request to create a production job", async () => {
  const response = await handleCreateProductionJobRequest(
    jsonRequest("http://localhost/api/orders/x/production", "POST", {}, {
      origin: "https://evil.example",
      "sec-fetch-site": "cross-site",
    }),
    "x",
    { authenticate: authAs(MANAGER_USER), repository },
  );
  assert.equal(response.status, 403);
});

test("SECURITY: rejects a cross-origin request to update a production job's stage", async () => {
  const response = await handleUpdateProductionJobStageRequest(
    jsonRequest("http://localhost/api/production/x", "PATCH", { toStage: "FABRIC_READY" }, {
      origin: "https://evil.example",
      "sec-fetch-site": "cross-site",
    }),
    "x",
    { authenticate: authAs(MANAGER_USER), repository },
  );
  assert.equal(response.status, 403);
});

test("SECURITY: rejects an unknown/garbage toStage value", async () => {
  const order = await createTestOrder();
  const job = await createProductionJob(order.id);
  const response = await patchStage(job.id, { toStage: "TELEPORTED" }, MANAGER_USER);
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.match(body.error, /Unknown production stage/i);
});

test("SECURITY: rejects an unknown ?stage= filter value on the production job list", async () => {
  const response = await handleListProductionJobsRequest(
    jsonRequest("http://localhost/api/production?stage=BOGUS_STAGE", "GET"),
    { authenticate: authAs(MANAGER_USER), repository },
  );
  assert.equal(response.status, 400);
});
