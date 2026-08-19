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
import {
  FabricNotFoundError,
  FabricVariantNotFoundError,
  InvalidMaterialSelectionError,
  OrderNotFoundError,
} from "@/lib/customer/repository";
import { isMaterialRole } from "@/lib/customer/validation";

/**
 * Order material selection routes (Phase 4B):
 * GET/POST /api/orders/[orderId]/materials.
 *
 * The order's material truth is a server-built COPY, exactly like
 * outfitSnapshot/measurementSnapshot on the order itself. The client may
 * submit ONLY `{ role, fabricId, fabricVariantId? }` — never the descriptive
 * fabric fields (name/composition/weight/season/colour/supplier) directly,
 * which would let it forge a snapshot that doesn't match any real fabric.
 * The server independently re-fetches the named fabric (and variant, if
 * given), validates the selection is currently allowed (fabric ACTIVE,
 * variant belongs to that fabric and is available), and builds the
 * snapshot fields itself. One row per (orderId, role) — POSTing again for
 * the same role replaces the prior selection (a live choice, not an
 * append-only history).
 */

const SET_MATERIAL_ALLOWED_FIELDS = new Set(["role", "fabricId", "fabricVariantId"]);

export async function handleSetOrderMaterialRequest(
  request: Request,
  orderId: string,
  dependencies: CustomerDependencies = DEFAULT_CUSTOMER_DEPENDENCIES,
) {
  const authOrResponse = await authorizeStaffRequest(request, dependencies, "order:material:update");
  if (authOrResponse instanceof Response) return authOrResponse;

  const bodyOrResponse = await parseJsonBody(request);
  if (bodyOrResponse instanceof Response) return bodyOrResponse;
  const body = bodyOrResponse;

  const unexpectedField = hasUnexpectedFields(body, SET_MATERIAL_ALLOWED_FIELDS);
  if (unexpectedField) return jsonError("Unexpected field in the submitted material selection.", 400);

  if (!isMaterialRole(body.role)) return jsonError("Unknown material role.", 400);
  if (typeof body.fabricId !== "string" || body.fabricId.length === 0) {
    return jsonError("Please provide a valid fabric reference.", 400);
  }
  if (body.fabricVariantId !== undefined && body.fabricVariantId !== null && typeof body.fabricVariantId !== "string") {
    return jsonError("Please provide a valid fabric variant reference.", 400);
  }
  const fabricVariantId = (body.fabricVariantId as string | null | undefined) ?? null;

  const repository = getRepository(dependencies);

  try {
    const order = await repository.getOrderById(orderId);
    if (!order) throw new OrderNotFoundError();

    // Re-fetched independently — a client can never submit trusted fabric
    // metadata directly. An unknown fabric ID, and a retired fabric, are
    // both rejected here; nothing distinguishes "not found" from "not
    // currently selectable" beyond the message, since neither leaks
    // anything a legitimate client couldn't already see via GET /api/fabrics.
    const fabric = await repository.getFabricById(body.fabricId);
    if (!fabric) throw new FabricNotFoundError();
    if (fabric.status !== "ACTIVE") {
      throw new InvalidMaterialSelectionError("This fabric is not currently available for selection.");
    }

    let variantColour: string | null = null;
    if (fabricVariantId) {
      const variant = await repository.getFabricVariantById(fabricVariantId);
      if (!variant || variant.fabricId !== fabric.id) throw new FabricVariantNotFoundError();
      if (!variant.isAvailable) {
        throw new InvalidMaterialSelectionError("This fabric variant is not currently available for selection.");
      }
      variantColour = variant.colour;
    }

    const snapshot = await repository.setOrderMaterial({
      orderId,
      role: body.role,
      fabricId: fabric.id,
      fabricVariantId,
      fabricName: fabric.name,
      composition: fabric.composition,
      weight: fabric.weight,
      season: fabric.season,
      colour: fabric.colour,
      supplier: fabric.supplier,
      variantColour,
      selectedBy: authOrResponse.username,
    });

    return Response.json(snapshot, { status: 201, headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    const mapped = mapDomainErrorToResponse(error);
    if (mapped) return mapped;
    throw error;
  }
}

export async function handleListOrderMaterialsRequest(
  request: Request,
  orderId: string,
  dependencies: CustomerDependencies = DEFAULT_CUSTOMER_DEPENDENCIES,
) {
  const authOrResponse = await authorizeStaffRequest(request, dependencies, "order:read");
  if (authOrResponse instanceof Response) return authOrResponse;

  const repository = getRepository(dependencies);

  try {
    const order = await repository.getOrderById(orderId);
    if (!order) throw new OrderNotFoundError();

    const materials = await repository.listOrderMaterials(orderId);
    return Response.json({ materials }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    const mapped = mapDomainErrorToResponse(error);
    if (mapped) return mapped;
    throw error;
  }
}
