import "server-only";

import { AuthConfigurationError } from "@/lib/auth/config";
import { requireRequestUser } from "@/lib/auth/session";
import { isSameOriginRequest } from "@/lib/request-security";
import { SplitRecipeValidationError } from "@/lib/split-outfit/generation-compiler";
import {
  OutfitProvenanceError,
  resolveFinalOutfitSnapshot,
  type RawOutfitFields,
} from "@/lib/showroom/final-outfit";
import { SIGNATURE_LOOK_LIBRARY } from "@/lib/showroom/look-library";
import type { SignatureLook } from "@/lib/showroom/types";

/**
 * POST /api/showroom/finalize-outfit — the server trust boundary between a
 * showroom configuration (a curated Look, a manual build, or a customized
 * Look) and a normalized FinalOutfitSnapshot. Performs NO paid generation,
 * NO order creation, NO customer persistence, and NEVER invokes OpenAI —
 * this endpoint is pure recipe validation + normalization.
 *
 * The browser may submit only the minimal component selection IDs plus a
 * declared source ("manual" or "signature-look" + lookId). Everything else
 * a client might try to assert about the recipe — recipeStatus,
 * materialGroups, activeMaterialSlots, a prompt, a model/provider, a
 * reference URL/asset ID/private path/checksum, or a finalOutfitId — has no
 * field name in the allow-list below and is therefore structurally
 * impossible to submit.
 *
 * Provenance/recipe resolution itself lives in ONE shared function
 * (resolveFinalOutfitSnapshot, lib/showroom/final-outfit.ts) that this route
 * and the Phase 3B /api/customers/[id]/outfits route both call — there is no
 * second, duplicated implementation of "validate provenance, validate
 * recipe, build snapshot."
 */

const JSON_HEADERS = {
  "Cache-Control": "no-store, private",
  "Content-Type": "application/json",
  "X-Content-Type-Options": "nosniff",
};

const ALLOWED_FIELDS = new Set([
  "source",
  "lookId",
  "upperId",
  "lowerId",
  "shirtId",
  "waistcoatId",
  "footwearId",
  "accessoryIds",
]);

type FinalizeDependencies = {
  authenticate: typeof requireRequestUser;
  /** Injectable for tests only — defaults to the real curated library. */
  lookLibrary?: SignatureLook[];
};

const DEFAULT_DEPENDENCIES: FinalizeDependencies = {
  authenticate: requireRequestUser,
};

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status, headers: JSON_HEADERS });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function handleFinalizeOutfitRequest(
  request: Request,
  dependencies: FinalizeDependencies = DEFAULT_DEPENDENCIES,
) {
  const requestId = crypto.randomUUID();
  const lookLibrary = dependencies.lookLibrary ?? SIGNATURE_LOOK_LIBRARY;

  if (!isSameOriginRequest(request)) {
    return jsonError("This request was blocked. Please refresh and try again.", 403);
  }

  let user;
  try {
    user = await dependencies.authenticate(request);
  } catch (error) {
    if (error instanceof AuthConfigurationError) {
      console.error("authentication_configuration_error", { requestId, route: "showroom-finalize-outfit" });
      return jsonError("Authentication is not configured.", 503);
    }
    throw error;
  }
  if (!user) return jsonError("Your session has expired. Please sign in again.", 401);

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return jsonError("Please submit your recipe as JSON.", 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("The submitted recipe is malformed.", 400);
  }

  if (!isRecord(body)) {
    return jsonError("The submitted recipe is malformed.", 400);
  }

  const unexpectedField = Object.keys(body).find((key) => !ALLOWED_FIELDS.has(key));
  if (unexpectedField) {
    return jsonError("Unexpected field in the submitted recipe.", 400);
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

  let snapshot;
  try {
    snapshot = resolveFinalOutfitSnapshot(fields, lookLibrary);
  } catch (error) {
    if (error instanceof OutfitProvenanceError || error instanceof SplitRecipeValidationError) {
      return jsonError(error.message, 400);
    }
    throw error;
  }

  console.info("showroom_finalize_outfit", { requestId, username: user.username, source: snapshot.source.type });

  return Response.json(snapshot, { status: 200, headers: JSON_HEADERS });
}
