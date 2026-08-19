import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { handleCreateCustomerRequest } from "@/lib/customer-handler";
import { handleCreateMeasurementRequest } from "@/lib/measurement-handler";
import { handleCreateSavedOutfitRequest } from "@/lib/saved-outfit-handler";
import { handleCreateOrderRequest } from "@/lib/order-handler";
import {
  handleCreateProductionJobRequest,
  handleUpdateProductionJobStageRequest,
} from "@/lib/production-handler";
import {
  handleCreateProductionNoteRequest,
  handleListProductionNotesRequest,
} from "@/lib/production-notes-handler";
import { CustomerValidationError } from "@/lib/customer/validation";
import type { AssignableStaff } from "@/lib/customer/types";
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

const TEST_ASSIGNABLE: AssignableStaff[] = [
  { username: MASTER_TAILOR_USER.username, displayName: MASTER_TAILOR_USER.displayName, role: "MASTER_TAILOR" },
  { username: "othertailor", displayName: "Other Tailor", role: "MASTER_TAILOR" },
  { username: "tailora", displayName: "Tailor A", role: "MASTER_TAILOR" },
  { username: "tailorb", displayName: "Tailor B", role: "MASTER_TAILOR" },
];

const testStaffDirectory = {
  listAssignable: () => TEST_ASSIGNABLE,
  assertAssignable(username: string) {
    if (!TEST_ASSIGNABLE.some((staff) => staff.username === username)) {
      throw new CustomerValidationError("invalid_staff_id", "Please provide a valid staff username.");
    }
  },
};

function prodDeps(user: Parameters<typeof authAs>[0]) {
  return { authenticate: authAs(user), repository, staffDirectory: testStaffDirectory };
}

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

const UNKNOWN_JOB_ID = "00000000-0000-4000-8000-000000000000";
const NOTE_MAX_LENGTH = 2000;
const PATH_TO_FINAL_QC = ["FABRIC_READY", "CUTTING", "STITCHING", "FIRST_TRIAL", "FINAL_QC"] as const;
const PATH_TO_COMPLETED = [
  "FABRIC_READY",
  "CUTTING",
  "STITCHING",
  "FIRST_TRIAL",
  "FINAL_QC",
  "READY_FOR_DELIVERY",
  "COMPLETED",
] as const;

let customerPhoneCounter = 0;

async function createTestCustomer() {
  customerPhoneCounter += 1;
  const response = await handleCreateCustomerRequest(
    jsonRequest("http://localhost/api/customers", "POST", {
      name: "Zafar Iqbal",
      phone: `+92 300 55555${String(customerPhoneCounter).padStart(2, "0")}`,
      email: null,
      preferences: { preferredStyles: [], preferredColours: [], preferredFit: null, preferredOccasions: [] },
    }),
    prodDeps(OWNER_USER),
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
    prodDeps(OWNER_USER),
  );
  return response.json();
}

async function saveOutfit(customerId: string) {
  const response = await handleCreateSavedOutfitRequest(
    jsonRequest(`http://localhost/api/customers/${customerId}/outfits`, "POST", VALID_MANUAL_OUTFIT),
    customerId,
    prodDeps(STAFF_USER),
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
    prodDeps(STAFF_USER),
  );
  return response.json();
}

async function createProductionJob(
  orderId: string,
  options: { assignedStaffId?: string | null; user?: Parameters<typeof authAs>[0] } = {},
) {
  const body: Record<string, unknown> = {};
  if (options.assignedStaffId !== undefined) body.assignedStaffId = options.assignedStaffId;
  const response = await handleCreateProductionJobRequest(
    jsonRequest(`http://localhost/api/orders/${orderId}/production`, "POST", body),
    orderId,
    prodDeps(options.user ?? MANAGER_USER),
  );
  const payload = await response.json();
  return payload.job;
}

async function patchStage(jobId: string, body: Record<string, unknown>, user: Parameters<typeof authAs>[0]) {
  return handleUpdateProductionJobStageRequest(
    jsonRequest(`http://localhost/api/production/${jobId}`, "PATCH", body),
    jobId,
    prodDeps(user),
  );
}

async function advanceStages(jobId: string, stages: readonly string[]) {
  for (const toStage of stages) {
    const response = await patchStage(jobId, { toStage }, MANAGER_USER);
    assert.equal(response.status, 200, `transition to ${toStage} should succeed`);
  }
}

function notesUrl(jobId: string) {
  return `http://localhost/api/production/${jobId}/notes`;
}

function listNotes(jobId: string, user: Parameters<typeof authAs>[0]) {
  return handleListProductionNotesRequest(jsonRequest(notesUrl(jobId), "GET"), jobId, prodDeps(user));
}

function createNote(
  jobId: string,
  payload: Record<string, unknown>,
  user: Parameters<typeof authAs>[0],
  headers: Record<string, string> = {},
) {
  return handleCreateProductionNoteRequest(
    jsonRequest(notesUrl(jobId), "POST", payload, headers),
    jobId,
    prodDeps(user),
  );
}

async function listedNotes(jobId: string, user: Parameters<typeof authAs>[0] = OWNER_USER) {
  const response = await listNotes(jobId, user);
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.ok(Array.isArray(payload.notes), "GET must return { notes }");
  return payload.notes as Array<{ body: string; createdBy?: string }>;
}

// ============================================================
// CREATE / LIST
// ============================================================

test("GET lists notes as { notes } and starts empty for a new job", async () => {
  const order = await createTestOrder();
  const job = await createProductionJob(order.id);
  const response = await listNotes(job.id, OWNER_USER);
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.deepEqual(payload.notes, []);
});

test("POST accepts { body } only and returns 201", async () => {
  const order = await createTestOrder();
  const job = await createProductionJob(order.id);
  const response = await createNote(job.id, { body: "Sleeve 1cm short on the left." }, OWNER_USER);
  assert.equal(response.status, 201);
});

test("lists notes oldest-first after multiple creates", async () => {
  const order = await createTestOrder();
  const job = await createProductionJob(order.id);
  const first = await createNote(job.id, { body: "first note" }, OWNER_USER);
  assert.equal(first.status, 201);
  const second = await createNote(job.id, { body: "second note" }, MANAGER_USER);
  assert.equal(second.status, 201);

  const notes = await listedNotes(job.id, OWNER_USER);
  assert.equal(notes.length, 2);
  assert.equal(notes[0].body, "first note");
  assert.equal(notes[1].body, "second note");
});

test("stores HTML in the note body as a plain string, including tags", async () => {
  const order = await createTestOrder();
  const job = await createProductionJob(order.id);
  const html = "<script>alert(1)</script><b>sleeve too tight</b>";
  const created = await createNote(job.id, { body: html }, OWNER_USER);
  assert.equal(created.status, 201);

  const notes = await listedNotes(job.id, OWNER_USER);
  assert.equal(notes.length, 1);
  assert.equal(notes[0].body, html);
});

test("createdBy on a stored note is the authenticated staff identity, never a client claim", async () => {
  const order = await createTestOrder();
  const job = await createProductionJob(order.id);
  const created = await createNote(job.id, { body: "Let out the waist 2cm." }, MANAGER_USER);
  assert.equal(created.status, 201);

  const notes = await listedNotes(job.id, OWNER_USER);
  assert.equal(notes.length, 1);
  assert.equal(notes[0].createdBy, MANAGER_USER.username);
});

test("accepts a note body at the 2000-character limit", async () => {
  const order = await createTestOrder();
  const job = await createProductionJob(order.id);
  const body = "x".repeat(NOTE_MAX_LENGTH);
  const response = await createNote(job.id, { body }, OWNER_USER);
  assert.equal(response.status, 201);
  const notes = await listedNotes(job.id, OWNER_USER);
  assert.equal(notes[0].body, body);
});

// ============================================================
// ROLE SCOPING
// ============================================================

for (const user of [STAFF_USER, STYLE_CONSULTANT_USER]) {
  test(`${user.role} is rejected listing production notes (403)`, async () => {
    const order = await createTestOrder();
    const job = await createProductionJob(order.id);
    const response = await listNotes(job.id, user);
    assert.equal(response.status, 403);
  });

  test(`${user.role} is rejected creating a production note (403)`, async () => {
    const order = await createTestOrder();
    const job = await createProductionJob(order.id);
    const response = await createNote(job.id, { body: "should not persist" }, user);
    assert.equal(response.status, 403);
  });
}

test("MASTER_TAILOR may list notes on a job assigned to them", async () => {
  const order = await createTestOrder();
  const job = await createProductionJob(order.id, { assignedStaffId: MASTER_TAILOR_USER.username });
  await createNote(job.id, { body: "assigned tailor note" }, MASTER_TAILOR_USER);
  const notes = await listedNotes(job.id, MASTER_TAILOR_USER);
  assert.equal(notes.length, 1);
  assert.equal(notes[0].body, "assigned tailor note");
});

test("MASTER_TAILOR may create a note on a job assigned to them", async () => {
  const order = await createTestOrder();
  const job = await createProductionJob(order.id, { assignedStaffId: MASTER_TAILOR_USER.username });
  const response = await createNote(job.id, { body: "Need more canvas in the chest." }, MASTER_TAILOR_USER);
  assert.equal(response.status, 201);
});

test("MASTER_TAILOR listing notes on a job not assigned to them returns 404", async () => {
  const order = await createTestOrder();
  const job = await createProductionJob(order.id, { assignedStaffId: "othertailor" });
  const response = await listNotes(job.id, MASTER_TAILOR_USER);
  assert.equal(response.status, 404);
});

test("MASTER_TAILOR creating a note on a job not assigned to them returns 404", async () => {
  const order = await createTestOrder();
  const job = await createProductionJob(order.id, { assignedStaffId: "othertailor" });
  const response = await createNote(job.id, { body: "should not persist" }, MASTER_TAILOR_USER);
  assert.equal(response.status, 404);
});

test("MASTER_TAILOR listing notes on an unassigned job returns 404", async () => {
  const order = await createTestOrder();
  const job = await createProductionJob(order.id, { assignedStaffId: null });
  const response = await listNotes(job.id, MASTER_TAILOR_USER);
  assert.equal(response.status, 404);
});

test("MASTER_TAILOR creating a note on an unassigned job returns 404", async () => {
  const order = await createTestOrder();
  const job = await createProductionJob(order.id, { assignedStaffId: null });
  const response = await createNote(job.id, { body: "should not persist" }, MASTER_TAILOR_USER);
  assert.equal(response.status, 404);
});

test("QC_STAFF may list notes on any job regardless of assignment or stage", async () => {
  const order = await createTestOrder();
  const job = await createProductionJob(order.id, { assignedStaffId: "othertailor" });
  await createNote(job.id, { body: "visible to QC" }, OWNER_USER);
  const notes = await listedNotes(job.id, QC_STAFF_USER);
  assert.equal(notes.length, 1);
  assert.equal(notes[0].body, "visible to QC");
});

test("QC_STAFF may create a note when the job is at FINAL_QC", async () => {
  const order = await createTestOrder();
  const job = await createProductionJob(order.id, { assignedStaffId: "othertailor" });
  await advanceStages(job.id, PATH_TO_FINAL_QC);
  const response = await createNote(job.id, { body: "QC: restitch the buttonhole." }, QC_STAFF_USER);
  assert.equal(response.status, 201);
  const notes = await listedNotes(job.id, QC_STAFF_USER);
  assert.equal(notes.some((note) => note.body === "QC: restitch the buttonhole."), true);
});

test("QC_STAFF creating a note when the job is not at FINAL_QC returns 403", async () => {
  const order = await createTestOrder();
  const job = await createProductionJob(order.id);
  const response = await createNote(job.id, { body: "should not persist" }, QC_STAFF_USER);
  assert.equal(response.status, 403);
});

test("OWNER may read and create notes on a COMPLETED job", async () => {
  const order = await createTestOrder();
  const job = await createProductionJob(order.id, { assignedStaffId: "othertailor" });
  await advanceStages(job.id, PATH_TO_COMPLETED);
  const created = await createNote(job.id, { body: "owner note on completed job" }, OWNER_USER);
  assert.equal(created.status, 201);
  const notes = await listedNotes(job.id, OWNER_USER);
  assert.equal(notes.some((note) => note.body === "owner note on completed job"), true);
});

test("MANAGER may read and create notes on a CANCELLED job", async () => {
  const order = await createTestOrder();
  const job = await createProductionJob(order.id, { assignedStaffId: "othertailor" });
  const cancelled = await patchStage(job.id, { toStage: "CANCELLED" }, MANAGER_USER);
  assert.equal(cancelled.status, 200);
  const created = await createNote(job.id, { body: "manager note on cancelled job" }, MANAGER_USER);
  assert.equal(created.status, 201);
  const notes = await listedNotes(job.id, MANAGER_USER);
  assert.equal(notes.some((note) => note.body === "manager note on cancelled job"), true);
});

// ============================================================
// SECURITY
// ============================================================

test("SECURITY: rejects listing notes for an unknown job (404)", async () => {
  const response = await listNotes(UNKNOWN_JOB_ID, OWNER_USER);
  assert.equal(response.status, 404);
});

test("SECURITY: rejects creating a note for an unknown job (404)", async () => {
  const response = await createNote(UNKNOWN_JOB_ID, { body: "orphan note" }, OWNER_USER);
  assert.equal(response.status, 404);
});

for (const [field, forged] of [
  ["createdBy", "impersonated-staff"],
  ["createdAt", "2000-01-01T00:00:00.000Z"],
  ["id", "forged-id"],
] as const) {
  test(`SECURITY: rejects a client-supplied ${field} on note creation`, async () => {
    const order = await createTestOrder();
    const job = await createProductionJob(order.id);
    const response = await createNote(job.id, { body: "legitimate text", [field]: forged }, OWNER_USER);
    assert.equal(response.status, 400);
  });
}

test("SECURITY: rejects an unexpected extra field on note creation", async () => {
  const order = await createTestOrder();
  const job = await createProductionJob(order.id);
  const response = await createNote(
    job.id,
    { body: "legitimate text", productionJobId: "forged-job" },
    OWNER_USER,
  );
  assert.equal(response.status, 400);
});

test("SECURITY: rejects a missing body field", async () => {
  const order = await createTestOrder();
  const job = await createProductionJob(order.id);
  const response = await createNote(job.id, {}, OWNER_USER);
  assert.equal(response.status, 400);
});

for (const [label, body] of [
  ["empty", ""],
  ["whitespace-only", "   "],
  ["whitespace-and-newlines", " \n\t "],
] as const) {
  test(`SECURITY: rejects a ${label} note body`, async () => {
    const order = await createTestOrder();
    const job = await createProductionJob(order.id);
    const response = await createNote(job.id, { body }, OWNER_USER);
    assert.equal(response.status, 400);
  });
}

test("SECURITY: rejects a note body longer than 2000 characters", async () => {
  const order = await createTestOrder();
  const job = await createProductionJob(order.id);
  const response = await createNote(job.id, { body: "x".repeat(NOTE_MAX_LENGTH + 1) }, OWNER_USER);
  assert.equal(response.status, 400);
});

test("SECURITY: rejects a non-string note body", async () => {
  const order = await createTestOrder();
  const job = await createProductionJob(order.id);
  const response = await createNote(job.id, { body: 123 }, OWNER_USER);
  assert.equal(response.status, 400);
});

test("SECURITY: rejects an unauthenticated request to list notes", async () => {
  const order = await createTestOrder();
  const job = await createProductionJob(order.id);
  const response = await listNotes(job.id, null);
  assert.equal(response.status, 401);
});

test("SECURITY: rejects an unauthenticated request to create a note", async () => {
  const order = await createTestOrder();
  const job = await createProductionJob(order.id);
  const response = await createNote(job.id, { body: "should not persist" }, null);
  assert.equal(response.status, 401);
});

test("SECURITY: rejects a cross-origin request to create a note", async () => {
  const response = await createNote(
    "x",
    { body: "csrf" },
    MANAGER_USER,
    { origin: "https://evil.example", "sec-fetch-site": "cross-site" },
  );
  assert.equal(response.status, 403);
});

// ============================================================
// LIFECYCLE
// ============================================================

test("notes survive a stage change: the original body is still listed after advancing", async () => {
  const order = await createTestOrder();
  const job = await createProductionJob(order.id);
  const original = "Cut on the stripe, not across it.";
  const created = await createNote(job.id, { body: original }, OWNER_USER);
  assert.equal(created.status, 201);

  await advanceStages(job.id, ["FABRIC_READY"]);

  const notes = await listedNotes(job.id, OWNER_USER);
  assert.equal(notes.length, 1);
  assert.equal(notes[0].body, original);
});
