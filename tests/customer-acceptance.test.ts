import assert from "node:assert/strict";
import test from "node:test";
import { handleCreateCustomerRequest, handleSearchCustomersRequest, handleUpdateCustomerRequest } from "@/lib/customer-handler";
import { handleCreateMeasurementRequest, handleGetMeasurementHistoryRequest } from "@/lib/measurement-handler";
import { handleCreateSessionRequest, handleUpdateSessionRequest } from "@/lib/session-handler";
import { handleCreateSavedOutfitRequest, handleListCustomerOutfitsRequest } from "@/lib/saved-outfit-handler";
import { SIGNATURE_LOOK_LIBRARY } from "@/lib/showroom/look-library";
import { createFakeCustomerRepository } from "./customer-fake-repository";
import { authAs, jsonRequest, MANAGER_USER, OWNER_USER, STAFF_USER } from "./customer-test-http";

/**
 * Simulates a real, complete showroom visit end-to-end, exactly as
 * described in the Phase 3C task's ACCEPTANCE TEST section — a first visit
 * that creates the customer's full record, and a second visit that proves
 * everything from the first visit actually persisted. Runs against the
 * in-memory fake repository (the same CustomerRepository contract the real
 * Prisma repository implements) — the repository instance is intentionally
 * NOT reset between the two "visits" in this file, since the whole point is
 * proving state survives across separate requests.
 */

const repository = createFakeCustomerRepository();
const THREE_PIECE_LOOK = SIGNATURE_LOOK_LIBRARY.find((look) => look.id === "LOOK_SUIT_THREE_PIECE_GENTLEMAN")!;

test("full showroom visit: create customer, preferences, measurements, session, Signature Look, customization, save, complete — then a second visit confirms full history", async () => {
  // ============================================================
  // FIRST VISIT
  // ============================================================

  // 1. Create customer: Ahmed Khan
  const createResponse = await handleCreateCustomerRequest(
    jsonRequest("http://localhost/api/customers", "POST", {
      name: "Ahmed Khan",
      phone: "+92 300 7778899",
      email: "ahmed.khan@example.com",
      preferences: { preferredStyles: [], preferredColours: [], preferredFit: null, preferredOccasions: [] },
    }),
    { authenticate: authAs(MANAGER_USER), repository },
  );
  assert.equal(createResponse.status, 201);
  const ahmed = await createResponse.json();
  assert.equal(ahmed.name, "Ahmed Khan");

  // 2. Add preferences: Classic, Navy, Structured
  const preferencesResponse = await handleUpdateCustomerRequest(
    jsonRequest(`http://localhost/api/customers/${ahmed.id}`, "PATCH", {
      preferences: {
        preferredStyles: ["classic"],
        preferredColours: ["NAVY"],
        preferredFit: "STRUCTURED",
        preferredOccasions: ["wedding"],
      },
    }),
    ahmed.id,
    { authenticate: authAs(MANAGER_USER), repository },
  );
  assert.equal(preferencesResponse.status, 200);
  const withPreferences = await preferencesResponse.json();
  assert.deepEqual(withPreferences.preferences.preferredStyles, ["classic"]);
  assert.equal(withPreferences.preferences.preferredFit, "STRUCTURED");

  // 3. Add measurements
  const measurementResponse = await handleCreateMeasurementRequest(
    jsonRequest(`http://localhost/api/customers/${ahmed.id}/measurements`, "POST", {
      jacketMeasurements: { chest: 42, shoulder: 18 },
      trouserMeasurements: { waist: 34, inseam: 32 },
      shirtMeasurements: { neck: 16, chest: 42 },
    }),
    ahmed.id,
    { authenticate: authAs(OWNER_USER), repository },
  );
  assert.equal(measurementResponse.status, 201);
  const firstMeasurement = await measurementResponse.json();
  assert.equal(firstMeasurement.version, 1);

  // 4. Start a wedding-reception showroom session
  const sessionResponse = await handleCreateSessionRequest(
    jsonRequest(`http://localhost/api/customers/${ahmed.id}/sessions`, "POST", { occasion: "wedding" }),
    ahmed.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(sessionResponse.status, 201);
  const session = await sessionResponse.json();
  assert.equal(session.status, "OPEN");

  // Exploring looks — the same transition the UI triggers automatically on entering the workspace.
  const exploringResponse = await handleUpdateSessionRequest(
    jsonRequest(`http://localhost/api/sessions/${session.id}`, "PATCH", { status: "EXPLORING" }),
    session.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(exploringResponse.status, 200);

  // 5 & 6. Select The Three-Piece Gentleman, then customize (swap footwear Oxford -> Derby).
  const saveOutfitResponse = await handleCreateSavedOutfitRequest(
    jsonRequest(`http://localhost/api/customers/${ahmed.id}/outfits`, "POST", {
      sessionId: session.id,
      source: "signature-look",
      lookId: THREE_PIECE_LOOK.id,
      upperId: THREE_PIECE_LOOK.components.upperId,
      lowerId: THREE_PIECE_LOOK.components.lowerId,
      shirtId: THREE_PIECE_LOOK.components.shirtId,
      waistcoatId: THREE_PIECE_LOOK.components.waistcoatId,
      footwearId: "SUIT_SHOE_DERBY", // customized away from the look's default Oxford
      accessoryIds: THREE_PIECE_LOOK.components.accessoryIds,
    }),
    ahmed.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(saveOutfitResponse.status, 201);
  const savedOutfit = await saveOutfitResponse.json();
  assert.equal(savedOutfit.sourceType, "signature-look");
  assert.equal(savedOutfit.sourceLookId, THREE_PIECE_LOOK.id);
  assert.equal(savedOutfit.outfitSnapshot.source.customized, true, "swapping footwear away from the look's default must register as customized");
  assert.equal(savedOutfit.outfitSnapshot.components.footwearId, "SUIT_SHOE_DERBY");

  // Session auto-advanced to OUTFIT_SELECTED as a side effect of the save above.
  const midSession = await repository.getSessionById(session.id);
  assert.equal(midSession?.status, "OUTFIT_SELECTED");
  assert.equal(midSession?.finalOutfitSnapshotId, savedOutfit.id);

  // 7. Complete the session
  const completeResponse = await handleUpdateSessionRequest(
    jsonRequest(`http://localhost/api/sessions/${session.id}`, "PATCH", { status: "COMPLETED" }),
    session.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(completeResponse.status, 200);
  const completedSession = await completeResponse.json();
  assert.equal(completedSession.status, "COMPLETED");

  // ============================================================
  // SECOND VISIT — a fresh set of requests against the SAME repository,
  // proving nothing above was request-scoped or in-memory-per-call only.
  // ============================================================

  // Search for Ahmed
  const searchResponse = await handleSearchCustomersRequest(
    new Request("http://localhost/api/customers?q=Ahmed", {
      headers: { origin: "http://localhost", host: "localhost", "sec-fetch-site": "same-origin" },
    }),
    { authenticate: authAs(STAFF_USER), repository },
  );
  assert.equal(searchResponse.status, 200);
  const { customers: foundCustomers } = await searchResponse.json();
  assert.equal(foundCustomers.length, 1);
  assert.equal(foundCustomers[0].id, ahmed.id);

  // Preferences persisted
  assert.deepEqual(foundCustomers[0].preferences.preferredStyles, ["classic"]);
  assert.deepEqual(foundCustomers[0].preferences.preferredColours, ["NAVY"]);
  assert.equal(foundCustomers[0].preferences.preferredFit, "STRUCTURED");

  // Measurements persisted
  const historyResponse = await handleGetMeasurementHistoryRequest(
    jsonRequest(`http://localhost/api/customers/${ahmed.id}/measurements`, "GET"),
    ahmed.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  const { history } = await historyResponse.json();
  assert.equal(history.length, 1);
  assert.equal(history[0].jacketMeasurements.chest, 42);

  // Previous outfit persisted
  const outfitsResponse = await handleListCustomerOutfitsRequest(
    jsonRequest(`http://localhost/api/customers/${ahmed.id}/outfits`, "GET"),
    ahmed.id,
    { authenticate: authAs(STAFF_USER), repository },
  );
  const { outfits } = await outfitsResponse.json();
  assert.equal(outfits.length, 1);
  assert.equal(outfits[0].sourceLookId, THREE_PIECE_LOOK.id);
  assert.equal(outfits[0].outfitSnapshot.recipeStatus, "VALID");

  // Session history persisted
  const sessions = await repository.listCustomerSessions(ahmed.id);
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].status, "COMPLETED");
});
