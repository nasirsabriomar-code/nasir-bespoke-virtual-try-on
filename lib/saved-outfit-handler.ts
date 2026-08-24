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
import { CustomerNotFoundError, InvalidReferenceError } from "@/lib/customer/repository";
import { isNonEmptyString } from "@/lib/customer/validation";
import {
  OutfitProvenanceError,
  resolveFinalOutfitSnapshot,
  type RawOutfitFields,
} from "@/lib/showroom/final-outfit";
import { SplitRecipeValidationError } from "@/lib/split-outfit/generation-compiler";
import { SIGNATURE_LOOK_LIBRARY } from "@/lib/showroom/look-library";
import type { SignatureLook } from "@/lib/showroom/types";

/**
 * Saved Outfit domain routes (/api/customers/[customerId]/outfits) — the
 * bridge from a live showroom configuration into persistent customer
 * history. The browser may submit ONLY the same minimal fields
 * /api/showroom/finalize-outfit accepts (declared source + component
 * selection IDs), plus an optional sessionId. The full FinalOutfitSnapshot
 * is always reconstructed server-side by resolveFinalOutfitSnapshot() (the
 * SAME function the Phase 3A finalize endpoint uses) — a client can never
 * submit a pre-built `outfitSnapshot` object directly, which is exactly
 * what would let it forge recipeStatus/materialGroups/provenance. This is
 * "Store a validated snapshot representation... reject invalid snapshot
 * data" enforced structurally, not by convention.
 */

const CREATE_ALLOWED_FIELDS = new Set([
  "sessionId",
  "source",
  "lookId",
  "upperId",
  "lowerId",
  "shirtId",
  "waistcoatId",
  "footwearId",
  "accessoryIds",
]);

type SavedOutfitDependencies = CustomerDependencies & {
  /** Injectable for tests only — defaults to the real curated library. */
  lookLibrary?: SignatureLook[];
};

export async function handleCreateSavedOutfitRequest(
  request: Request,
  customerId: string,
  dependencies: SavedOutfitDependencies = DEFAULT_CUSTOMER_DEPENDENCIES,
) {
  const authOrResponse = await authorizeStaffRequest(request, dependencies, "outfit:create");
  if (authOrResponse instanceof Response) return authOrResponse;

  const bodyOrResponse = await parseJsonBody(request);
  if (bodyOrResponse instanceof Response) return bodyOrResponse;
  const body = bodyOrResponse;

  const unexpectedField = hasUnexpectedFields(body, CREATE_ALLOWED_FIELDS);
  if (unexpectedField) return jsonError("Unexpected field in the submitted outfit.", 400);

  if (body.sessionId !== undefined && body.sessionId !== null && !isNonEmptyString(body.sessionId)) {
    return jsonError("Invalid session reference.", 400);
  }
  const sessionId = (body.sessionId as string | null | undefined) ?? null;

  const repository = getRepository(dependencies);
  const lookLibrary = dependencies.lookLibrary ?? SIGNATURE_LOOK_LIBRARY;

  try {
    const customer = await repository.getCustomerById(customerId);
    if (!customer) throw new CustomerNotFoundError();

    if (sessionId) {
      const session = await repository.getSessionById(sessionId);
      if (!session || session.customerId !== customerId) {
        throw new InvalidReferenceError("This session does not belong to this customer.");
      }
      if (session.status === "COMPLETED" || session.status === "CANCELLED") {
        throw new InvalidReferenceError("This session is no longer open for outfit selection.");
      }
    }

    const fields: RawOutfitFields = {
      source: body.source,
      lookId: body.lookId,
      upperId: body.upperId,
      lowerId: body.lowerId,
      shirtId: body.shirtId,
      waistcoatId: body.waistcoatId,
      footwearId: body.footwearId,
      accessoryIds: body.accessoryIds,
    };
    const snapshot = resolveFinalOutfitSnapshot(fields, lookLibrary);

    const savedOutfit = await repository.createSavedOutfit({
      customerId,
      sessionId,
      sourceType: snapshot.source.type,
      sourceLookId: snapshot.source.type === "signature-look" ? snapshot.source.lookId : null,
      outfitSnapshot: snapshot,
      createdBy: authOrResponse.username,
    });

    if (sessionId) {
      await repository.updateSession(sessionId, {
        finalOutfitSnapshotId: savedOutfit.id,
        status: "OUTFIT_SELECTED",
      });
    }

    return Response.json(savedOutfit, { status: 201, headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    if (error instanceof OutfitProvenanceError || error instanceof SplitRecipeValidationError) {
      return jsonError(error.message, 400);
    }
    const mapped = mapDomainErrorToResponse(error);
    if (mapped) return mapped;
    throw error;
  }
}

export async function handleListCustomerOutfitsRequest(
  request: Request,
  customerId: string,
  dependencies: CustomerDependencies = DEFAULT_CUSTOMER_DEPENDENCIES,
) {
  const authOrResponse = await authorizeStaffRequest(request, dependencies, "outfit:read");
  if (authOrResponse instanceof Response) return authOrResponse;

  const repository = getRepository(dependencies);

  try {
    const customer = await repository.getCustomerById(customerId);
    if (!customer) throw new CustomerNotFoundError();

    const outfits = await repository.listCustomerOutfits(customerId);
    return Response.json({ outfits }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    const mapped = mapDomainErrorToResponse(error);
    if (mapped) return mapped;
    throw error;
  }
}
