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
import { FabricNotFoundError } from "@/lib/customer/repository";
import { CustomerValidationError, validateFabricSupplier, validateFabricTextField } from "@/lib/customer/validation";
import type { FabricStatus } from "@/lib/customer/types";

/**
 * Fabric catalogue routes (Phase 4B): create + list (/api/fabrics), and
 * create + list variants of one fabric (/api/fabrics/[fabricId]/variants).
 *
 * Fabric rows are curated business data — entered directly by staff, never
 * AI-generated or inferred. Creating a fabric is reserved for MANAGER/OWNER
 * (see lib/customer/permissions.ts); reading the catalogue is open to any
 * authenticated staff member, since STAFF need to browse it while placing
 * an order. This is NOT an inventory system: no stock counts, no supplier
 * ordering workflow, no pricing.
 */

const CREATE_FABRIC_ALLOWED_FIELDS = new Set(["name", "composition", "weight", "season", "colour", "supplier", "status"]);
const CREATE_VARIANT_ALLOWED_FIELDS = new Set(["colour", "isAvailable"]);

function isFabricStatus(value: unknown): value is FabricStatus {
  return value === "ACTIVE" || value === "INACTIVE";
}

export async function handleCreateFabricRequest(
  request: Request,
  dependencies: CustomerDependencies = DEFAULT_CUSTOMER_DEPENDENCIES,
) {
  const authOrResponse = await authorizeStaffRequest(request, dependencies, "fabric:create");
  if (authOrResponse instanceof Response) return authOrResponse;

  const bodyOrResponse = await parseJsonBody(request);
  if (bodyOrResponse instanceof Response) return bodyOrResponse;
  const body = bodyOrResponse;

  const unexpectedField = hasUnexpectedFields(body, CREATE_FABRIC_ALLOWED_FIELDS);
  if (unexpectedField) return jsonError("Unexpected field in the submitted fabric.", 400);

  try {
    const name = validateFabricTextField(body.name, "fabric name");
    const composition = validateFabricTextField(body.composition, "composition");
    const weight = validateFabricTextField(body.weight, "weight");
    const season = validateFabricTextField(body.season, "season");
    const colour = validateFabricTextField(body.colour, "colour");
    const supplier = validateFabricSupplier(body.supplier);
    let status: FabricStatus = "ACTIVE";
    if (body.status !== undefined) {
      if (!isFabricStatus(body.status)) {
        throw new CustomerValidationError("invalid_fabric_field", "Unknown fabric status.");
      }
      status = body.status;
    }

    const repository = getRepository(dependencies);
    const fabric = await repository.createFabric({ name, composition, weight, season, colour, supplier, status });
    return Response.json(fabric, { status: 201, headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    const mapped = mapDomainErrorToResponse(error);
    if (mapped) return mapped;
    throw error;
  }
}

export async function handleListFabricsRequest(
  request: Request,
  dependencies: CustomerDependencies = DEFAULT_CUSTOMER_DEPENDENCIES,
) {
  const authOrResponse = await authorizeStaffRequest(request, dependencies, "fabric:read");
  if (authOrResponse instanceof Response) return authOrResponse;

  const repository = getRepository(dependencies);

  try {
    const fabrics = await repository.listFabrics();
    return Response.json({ fabrics }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    const mapped = mapDomainErrorToResponse(error);
    if (mapped) return mapped;
    throw error;
  }
}

export async function handleCreateFabricVariantRequest(
  request: Request,
  fabricId: string,
  dependencies: CustomerDependencies = DEFAULT_CUSTOMER_DEPENDENCIES,
) {
  const authOrResponse = await authorizeStaffRequest(request, dependencies, "fabric:create");
  if (authOrResponse instanceof Response) return authOrResponse;

  const bodyOrResponse = await parseJsonBody(request);
  if (bodyOrResponse instanceof Response) return bodyOrResponse;
  const body = bodyOrResponse;

  const unexpectedField = hasUnexpectedFields(body, CREATE_VARIANT_ALLOWED_FIELDS);
  if (unexpectedField) return jsonError("Unexpected field in the submitted fabric variant.", 400);

  const repository = getRepository(dependencies);

  try {
    const fabric = await repository.getFabricById(fabricId);
    if (!fabric) throw new FabricNotFoundError();

    const colour = validateFabricTextField(body.colour, "variant colour");
    const isAvailable = body.isAvailable === undefined ? true : Boolean(body.isAvailable);

    const variant = await repository.createFabricVariant({ fabricId, colour, isAvailable });
    return Response.json(variant, { status: 201, headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    const mapped = mapDomainErrorToResponse(error);
    if (mapped) return mapped;
    throw error;
  }
}

export async function handleListFabricVariantsRequest(
  request: Request,
  fabricId: string,
  dependencies: CustomerDependencies = DEFAULT_CUSTOMER_DEPENDENCIES,
) {
  const authOrResponse = await authorizeStaffRequest(request, dependencies, "fabric:read");
  if (authOrResponse instanceof Response) return authOrResponse;

  const repository = getRepository(dependencies);

  try {
    const fabric = await repository.getFabricById(fabricId);
    if (!fabric) throw new FabricNotFoundError();

    const variants = await repository.listFabricVariants(fabricId);
    return Response.json({ variants }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    const mapped = mapDomainErrorToResponse(error);
    if (mapped) return mapped;
    throw error;
  }
}
