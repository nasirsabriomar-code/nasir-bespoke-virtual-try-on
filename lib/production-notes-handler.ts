import "server-only";

import {
  authorizeStaffRequest,
  DEFAULT_CUSTOMER_DEPENDENCIES,
  getRepository,
  hasUnexpectedFields,
  jsonError,
  mapDomainErrorToResponse,
  parseJsonBody,
  type CustomerDependencies,
} from "@/lib/customer/http";
import { ProductionJobNotFoundError } from "@/lib/customer/repository";
import { validateProductionNoteBody } from "@/lib/customer/validation";
import { canCreateProductionNote, canReadProductionJob } from "@/lib/customer/permissions";
import type { StaffRole } from "@/lib/customer/types";

/**
 * Production notes (Phase 4F): GET/POST /api/production/[jobId]/notes.
 *
 * Append-only operational atelier context on a production job — never a
 * write to measurements, preferences, or order/fabric snapshots. No PATCH
 * or DELETE. The client may send `{ body }` only; `createdBy` is always
 * the authenticated staff username.
 *
 * Flat grants are production:note:read / production:note:create
 * (OWNER/MANAGER/MASTER_TAILOR/QC_STAFF — not STAFF, not STYLE_CONSULTANT).
 * After canPerform(), a missing job and a job outside the caller's read
 * scope are both ProductionJobNotFoundError (404), matching other
 * production reads. QC_STAFF may only create when currentStage is FINAL_QC.
 */

const CREATE_ALLOWED_FIELDS = new Set(["body"]);

async function loadAccessibleJob(
  repository: ReturnType<typeof getRepository>,
  jobId: string,
  role: StaffRole,
  username: string,
) {
  const job = await repository.getProductionJobById(jobId);
  if (!job) throw new ProductionJobNotFoundError();
  if (!canReadProductionJob(role, username, job.assignedStaffId)) {
    throw new ProductionJobNotFoundError();
  }
  return job;
}

export async function handleListProductionNotesRequest(
  request: Request,
  jobId: string,
  dependencies: CustomerDependencies = DEFAULT_CUSTOMER_DEPENDENCIES,
) {
  const authOrResponse = await authorizeStaffRequest(request, dependencies, "production:note:read");
  if (authOrResponse instanceof Response) return authOrResponse;

  const repository = getRepository(dependencies);

  try {
    await loadAccessibleJob(repository, jobId, authOrResponse.role, authOrResponse.username);
    const notes = await repository.listProductionNotes(jobId);
    return Response.json({ notes }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    const mapped = mapDomainErrorToResponse(error);
    if (mapped) return mapped;
    throw error;
  }
}

export async function handleCreateProductionNoteRequest(
  request: Request,
  jobId: string,
  dependencies: CustomerDependencies = DEFAULT_CUSTOMER_DEPENDENCIES,
) {
  const authOrResponse = await authorizeStaffRequest(request, dependencies, "production:note:create");
  if (authOrResponse instanceof Response) return authOrResponse;

  const bodyOrResponse = await parseJsonBody(request);
  if (bodyOrResponse instanceof Response) return bodyOrResponse;
  const body = bodyOrResponse;

  const unexpectedField = hasUnexpectedFields(body, CREATE_ALLOWED_FIELDS);
  if (unexpectedField) return jsonError("Unexpected field in the submitted production note.", 400);

  const repository = getRepository(dependencies);

  try {
    const noteBody = validateProductionNoteBody(body.body);
    const job = await loadAccessibleJob(repository, jobId, authOrResponse.role, authOrResponse.username);

    if (!canCreateProductionNote(authOrResponse.role, job.currentStage)) {
      return jsonError("You do not have permission to add a note to this production job.", 403);
    }

    const note = await repository.createProductionNote({
      productionJobId: jobId,
      body: noteBody,
      createdBy: authOrResponse.username,
    });
    return Response.json(note, { status: 201, headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    const mapped = mapDomainErrorToResponse(error);
    if (mapped) return mapped;
    throw error;
  }
}
