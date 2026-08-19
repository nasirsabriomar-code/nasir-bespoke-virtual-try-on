import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { handleCreateCustomerRequest, handleGetCustomerRequest } from "@/lib/customer-handler";
import {
  handleGetFabricRequest,
  handleListFabricsRequest,
  handleUpdateFabricRequest,
  handleUpdateFabricVariantRequest,
} from "@/lib/fabric-handler";
import { handleListOrderMaterialsRequest } from "@/lib/order-material-handler";
import { handleGetProductionJobByOrderRequest, handleListProductionJobsRequest } from "@/lib/production-handler";
import { authAs, jsonRequest, OWNER_USER } from "./customer-test-http";

/**
 * Verifies the "safe by default" gate: with NO repository injected (so the
 * handler falls through to the real, Postgres-backed prismaCustomerRepository)
 * and no DATABASE_URL configured in this test environment, every
 * customer-domain route must fail closed with a 503 — never crash, never
 * silently succeed, never touch a real database. This is the same pattern
 * SPLIT_GENERATION_ENABLED uses for the Split generation provider.
 */

beforeEach(() => {
  delete process.env.DATABASE_URL;
});

test("POST /api/customers returns 503 (not a crash) when the database is not configured", async () => {
  const response = await handleCreateCustomerRequest(
    jsonRequest("http://localhost/api/customers", "POST", {
      name: "Should Never Persist",
      phone: "+92 300 0000000",
      email: null,
      preferences: { preferredStyles: [], preferredColours: [], preferredFit: null, preferredOccasions: [] },
    }),
    { authenticate: authAs(OWNER_USER) },
  );
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.match(body.error, /not yet configured/i);
});

test("GET /api/customers/[id] returns 503 (not a crash) when the database is not configured", async () => {
  const response = await handleGetCustomerRequest(
    jsonRequest("http://localhost/api/customers/00000000-0000-4000-8000-000000000000", "GET"),
    "00000000-0000-4000-8000-000000000000",
    { authenticate: authAs(OWNER_USER) },
  );
  assert.equal(response.status, 503);
});

test("GET /api/fabrics returns 503 (not a crash) when the database is not configured", async () => {
  const response = await handleListFabricsRequest(
    jsonRequest("http://localhost/api/fabrics", "GET"),
    { authenticate: authAs(OWNER_USER) },
  );
  assert.equal(response.status, 503);
});

test("GET /api/fabrics/[id] returns 503 (not a crash) when the database is not configured", async () => {
  const response = await handleGetFabricRequest(
    jsonRequest("http://localhost/api/fabrics/00000000-0000-4000-8000-000000000000", "GET"),
    "00000000-0000-4000-8000-000000000000",
    { authenticate: authAs(OWNER_USER) },
  );
  assert.equal(response.status, 503);
});

test("PATCH /api/fabrics/[id] returns 503 (not a crash) when the database is not configured", async () => {
  const response = await handleUpdateFabricRequest(
    jsonRequest("http://localhost/api/fabrics/00000000-0000-4000-8000-000000000000", "PATCH", { name: "Navy Wool" }),
    "00000000-0000-4000-8000-000000000000",
    { authenticate: authAs(OWNER_USER) },
  );
  assert.equal(response.status, 503);
});

test("PATCH /api/fabrics/[id]/variants/[variantId] returns 503 (not a crash) when the database is not configured", async () => {
  const response = await handleUpdateFabricVariantRequest(
    jsonRequest(
      "http://localhost/api/fabrics/00000000-0000-4000-8000-000000000000/variants/00000000-0000-4000-8000-000000000001",
      "PATCH",
      { isAvailable: false },
    ),
    "00000000-0000-4000-8000-000000000000",
    "00000000-0000-4000-8000-000000000001",
    { authenticate: authAs(OWNER_USER) },
  );
  assert.equal(response.status, 503);
});

test("GET /api/orders/[id]/materials returns 503 (not a crash) when the database is not configured", async () => {
  const response = await handleListOrderMaterialsRequest(
    jsonRequest("http://localhost/api/orders/00000000-0000-4000-8000-000000000000/materials", "GET"),
    "00000000-0000-4000-8000-000000000000",
    { authenticate: authAs(OWNER_USER) },
  );
  assert.equal(response.status, 503);
});

test("GET /api/orders/[id]/production returns 503 (not a crash) when the database is not configured", async () => {
  const response = await handleGetProductionJobByOrderRequest(
    jsonRequest("http://localhost/api/orders/00000000-0000-4000-8000-000000000000/production", "GET"),
    "00000000-0000-4000-8000-000000000000",
    { authenticate: authAs(OWNER_USER) },
  );
  assert.equal(response.status, 503);
});

test("GET /api/production returns 503 (not a crash) when the database is not configured", async () => {
  const response = await handleListProductionJobsRequest(
    jsonRequest("http://localhost/api/production", "GET"),
    { authenticate: authAs(OWNER_USER) },
  );
  assert.equal(response.status, 503);
});
