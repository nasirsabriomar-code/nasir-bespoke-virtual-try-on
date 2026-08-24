import "server-only";

import {
  authorizeStaffRequest,
  DEFAULT_CUSTOMER_DEPENDENCIES,
  getRepository,
  getStaffDirectory,
  hasUnexpectedFields,
  jsonError,
  mapDomainErrorToResponse,
  parseJsonBody,
  type CustomerDependencies,
} from "@/lib/customer/http";
import { OrderNotFoundError, ProductionJobNotFoundError } from "@/lib/customer/repository";
import {
  assertValidProductionTransition,
  isProductionStage,
  validateAssignedStaffId,
} from "@/lib/customer/validation";
import { canPerform, canReadProductionJob, canUpdateProductionJob } from "@/lib/customer/permissions";
import type { ProductionJob, ProductionStage } from "@/lib/customer/types";
import type { StaffDirectory } from "@/lib/customer/staff-directory";

/**
 * Production Job routes (Phase 4C): create + get-by-order
 * (/api/orders/[orderId]/production), get-by-id + update-stage
 * (/api/production/[jobId]), list for the Atelier Dashboard
 * (/api/production).
 *
 * Tracks how an accepted Order moves through the workshop — deliberately
 * NOT an ERP, inventory, or supplier-management system. Every stage change
 * is preserved in ProductionStageHistory (never only overwritten), and
 * every response below embeds that history so the UI never needs a second
 * round-trip to answer "how did this job get here."
 *
 * Beyond the flat production:create/read/update permission grant (see
 * lib/customer/permissions.ts), MASTER_TAILOR and QC_STAFF are additionally
 * scoped per-resource by canReadProductionJob()/canUpdateProductionJob() —
 * a fake/unauthorized job ID and a real job outside a role's scope are
 * deliberately indistinguishable (both 404), matching the existing
 * SavedOutfitNotFoundError precedent of never leaking cross-resource
 * existence.
 */

const CREATE_ALLOWED_FIELDS = new Set(["assignedStaffId"]);
const UPDATE_ALLOWED_FIELDS = new Set(["toStage", "assignedStaffId"]);

function resolveAssignableStaffId(value: unknown, directory: StaffDirectory): string | null {
  const assignedStaffId = validateAssignedStaffId(value);
  if (assignedStaffId !== null) directory.assertAssignable(assignedStaffId);
  return assignedStaffId;
}

async function loadJobWithHistory(
  repository: ReturnType<typeof getRepository>,
  job: ProductionJob,
) {
  const history = await repository.listProductionStageHistory(job.id);
  return { job, history };
}

export async function handleCreateProductionJobRequest(
  request: Request,
  orderId: string,
  dependencies: CustomerDependencies = DEFAULT_CUSTOMER_DEPENDENCIES,
) {
  const authOrResponse = await authorizeStaffRequest(request, dependencies, "production:create");
  if (authOrResponse instanceof Response) return authOrResponse;

  const bodyOrResponse = await parseJsonBody(request);
  if (bodyOrResponse instanceof Response) return bodyOrResponse;
  const body = bodyOrResponse;

  const unexpectedField = hasUnexpectedFields(body, CREATE_ALLOWED_FIELDS);
  if (unexpectedField) return jsonError("Unexpected field in the submitted production job.", 400);

  const repository = getRepository(dependencies);

  try {
    const order = await repository.getOrderById(orderId);
    if (!order) throw new OrderNotFoundError();

    const assignedStaffId = resolveAssignableStaffId(body.assignedStaffId, getStaffDirectory(dependencies));

    const job = await repository.createProductionJob({
      orderId,
      assignedStaffId,
      createdBy: authOrResponse.username,
    });

    const payload = await loadJobWithHistory(repository, job);
    return Response.json(payload, { status: 201, headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    const mapped = mapDomainErrorToResponse(error);
    if (mapped) return mapped;
    throw error;
  }
}

export async function handleGetProductionJobByOrderRequest(
  request: Request,
  orderId: string,
  dependencies: CustomerDependencies = DEFAULT_CUSTOMER_DEPENDENCIES,
) {
  const authOrResponse = await authorizeStaffRequest(request, dependencies, "production:read");
  if (authOrResponse instanceof Response) return authOrResponse;

  const repository = getRepository(dependencies);

  try {
    const job = await repository.getProductionJobByOrderId(orderId);
    if (!job) throw new ProductionJobNotFoundError();
    if (!canReadProductionJob(authOrResponse.role, authOrResponse.username, job.assignedStaffId)) {
      throw new ProductionJobNotFoundError();
    }

    const payload = await loadJobWithHistory(repository, job);
    return Response.json(payload, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    const mapped = mapDomainErrorToResponse(error);
    if (mapped) return mapped;
    throw error;
  }
}

export async function handleGetProductionJobRequest(
  request: Request,
  jobId: string,
  dependencies: CustomerDependencies = DEFAULT_CUSTOMER_DEPENDENCIES,
) {
  const authOrResponse = await authorizeStaffRequest(request, dependencies, "production:read");
  if (authOrResponse instanceof Response) return authOrResponse;

  const repository = getRepository(dependencies);

  try {
    const job = await repository.getProductionJobById(jobId);
    if (!job) throw new ProductionJobNotFoundError();
    if (!canReadProductionJob(authOrResponse.role, authOrResponse.username, job.assignedStaffId)) {
      throw new ProductionJobNotFoundError();
    }

    const payload = await loadJobWithHistory(repository, job);
    return Response.json(payload, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    const mapped = mapDomainErrorToResponse(error);
    if (mapped) return mapped;
    throw error;
  }
}

export async function handleUpdateProductionJobStageRequest(
  request: Request,
  jobId: string,
  dependencies: CustomerDependencies = DEFAULT_CUSTOMER_DEPENDENCIES,
) {
  const authOrResponse = await authorizeStaffRequest(request, dependencies, "production:update");
  if (authOrResponse instanceof Response) return authOrResponse;

  const bodyOrResponse = await parseJsonBody(request);
  if (bodyOrResponse instanceof Response) return bodyOrResponse;
  const body = bodyOrResponse;

  const unexpectedField = hasUnexpectedFields(body, UPDATE_ALLOWED_FIELDS);
  if (unexpectedField) return jsonError("Unexpected field in the submitted stage update.", 400);

  if (!isProductionStage(body.toStage)) return jsonError("Unknown production stage.", 400);
  const toStage: ProductionStage = body.toStage;

  const repository = getRepository(dependencies);

  try {
    const existing = await repository.getProductionJobById(jobId);
    if (!existing) throw new ProductionJobNotFoundError();

    if (
      !canUpdateProductionJob(
        authOrResponse.role,
        authOrResponse.username,
        existing.currentStage,
        existing.assignedStaffId,
        toStage,
      )
    ) {
      return jsonError("You do not have permission to update this production job.", 403);
    }

    assertValidProductionTransition(existing.currentStage, toStage);

    // assignedStaffId reassignment is production:assign (OWNER/MANAGER) —
    // MASTER_TAILOR/QC_STAFF may only move the stage of a job already
    // assigned to them, never reassign it.
    let assignedStaffId: string | null | undefined;
    if (body.assignedStaffId !== undefined) {
      if (!canPerform(authOrResponse.role, "production:assign")) {
        return jsonError("You do not have permission to reassign this production job.", 403);
      }
      assignedStaffId = resolveAssignableStaffId(body.assignedStaffId, getStaffDirectory(dependencies));
    }

    const updated = await repository.updateProductionJobStage(jobId, {
      toStage,
      changedBy: authOrResponse.username,
      assignedStaffId,
    });
    if (!updated) throw new ProductionJobNotFoundError();

    const payload = await loadJobWithHistory(repository, updated);
    return Response.json(payload, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    const mapped = mapDomainErrorToResponse(error);
    if (mapped) return mapped;
    throw error;
  }
}

export async function handleListProductionJobsRequest(
  request: Request,
  dependencies: CustomerDependencies = DEFAULT_CUSTOMER_DEPENDENCIES,
) {
  const authOrResponse = await authorizeStaffRequest(request, dependencies, "production:read");
  if (authOrResponse instanceof Response) return authOrResponse;

  const url = new URL(request.url);
  const stageParam = url.searchParams.get("stage");
  if (stageParam !== null && !isProductionStage(stageParam)) {
    return jsonError("Unknown production stage filter.", 400);
  }

  const repository = getRepository(dependencies);

  // MASTER_TAILOR only ever sees jobs assigned to them on the dashboard —
  // enforced by filtering the query itself, not just the response, so
  // there is no risk of a filter bug leaking other tailors' jobs.
  const assignedStaffId = authOrResponse.role === "MASTER_TAILOR" ? authOrResponse.username : undefined;

  try {
    const jobs = await repository.listProductionJobs({
      ...(stageParam ? { stage: stageParam } : {}),
      ...(assignedStaffId ? { assignedStaffId } : {}),
    });
    return Response.json({ jobs }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    const mapped = mapDomainErrorToResponse(error);
    if (mapped) return mapped;
    throw error;
  }
}

export async function handleListAssignableStaffRequest(
  request: Request,
  dependencies: CustomerDependencies = DEFAULT_CUSTOMER_DEPENDENCIES,
) {
  const authOrResponse = await authorizeStaffRequest(request, dependencies, "production:assign");
  if (authOrResponse instanceof Response) return authOrResponse;

  try {
    const assignees = getStaffDirectory(dependencies).listAssignable();
    return Response.json({ assignees }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    const mapped = mapDomainErrorToResponse(error);
    if (mapped) return mapped;
    throw error;
  }
}
