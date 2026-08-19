import "server-only";

import { AuthConfigurationError } from "@/lib/auth/config";
import { requireRequestUser } from "@/lib/auth/session";
import { isSameOriginRequest } from "@/lib/request-security";
import { SplitRecipeValidationError, validateSplitRecipe, type SplitTryOnClientRequest } from "@/lib/split-outfit/generation-compiler";
import { buildFinalOutfitSnapshot, type FinalOutfitSnapshot, type FinalOutfitSource } from "@/lib/showroom/final-outfit";
import { isRecipeIdenticalToLook } from "@/lib/showroom/look-application";
import { SIGNATURE_LOOK_LIBRARY } from "@/lib/showroom/look-library";
import { getActiveValidatedSignatureLooks } from "@/lib/showroom/look-validation";
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
 * impossible to submit. Recipe validity and canonical material grouping are
 * always independently recomputed server-side via validateSplitRecipe()
 * (lib/split-outfit/generation-compiler.ts) — the SAME authority
 * /api/split-try-on uses. There is no second, duplicated compatibility
 * table here.
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

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
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

  const { source, lookId, upperId, lowerId, shirtId, waistcoatId, footwearId, accessoryIds } = body;

  if (source !== "manual" && source !== "signature-look") {
    return jsonError("Unknown outfit source.", 400);
  }

  // Provenance shape must be internally consistent with the declared
  // source: a manual build must not also carry a lookId, and a
  // signature-look source must carry exactly one.
  if (source === "manual" && lookId !== undefined) {
    return jsonError("A manual build must not reference a Signature Look.", 400);
  }
  if (source === "signature-look" && !isNonEmptyString(lookId)) {
    return jsonError("A Signature Look source must include a valid look ID.", 400);
  }

  let sourceLook: SignatureLook | null = null;
  if (source === "signature-look" && typeof lookId === "string") {
    // Only an ACTIVE, independently re-validated look may ever be claimed as
    // provenance — an inactive, draft, or (defensively) invalid look is
    // rejected identically to an unknown one, never distinguished in a way
    // that would leak its existence.
    sourceLook = getActiveValidatedSignatureLooks(lookLibrary).find((look) => look.id === lookId) ?? null;
    if (!sourceLook) {
      return jsonError("This Signature Look could not be found.", 400);
    }
    if (sourceLook.family !== "suit") {
      return jsonError("This Signature Look does not match the current outfit family.", 400);
    }
  }

  if (
    !isNonEmptyString(upperId) ||
    !isNonEmptyString(lowerId) ||
    !isNonEmptyString(shirtId) ||
    (waistcoatId !== null && !isNonEmptyString(waistcoatId)) ||
    !isNonEmptyString(footwearId) ||
    !Array.isArray(accessoryIds) ||
    !accessoryIds.every((id) => typeof id === "string")
  ) {
    return jsonError("Please submit a complete outfit recipe.", 400);
  }

  const clientRequest: SplitTryOnClientRequest = {
    family: "suit",
    upperId,
    lowerId,
    shirtId,
    waistcoatId: waistcoatId as string | null,
    footwearId,
    accessoryIds: accessoryIds as string[],
  };

  let recipe;
  try {
    recipe = validateSplitRecipe(clientRequest);
  } catch (error) {
    if (error instanceof SplitRecipeValidationError) return jsonError(error.message, 400);
    throw error;
  }

  const source_: FinalOutfitSource = sourceLook
    ? {
      type: "signature-look",
      lookId: sourceLook.id,
      customized: !isRecipeIdenticalToLook(
        {
          family: recipe.family,
          upperId: recipe.components.upper.id,
          lowerId: recipe.components.lower.id,
          shirtId: recipe.components.shirt.id,
          waistcoatId: recipe.components.waistcoat ? recipe.components.waistcoat.id : "SUIT_WAISTCOAT_NONE",
          footwearId: recipe.components.footwear.id,
          accessoryIds: recipe.components.accessories.map((accessory) => accessory.id),
          materials: {},
        },
        sourceLook,
      ),
    }
    : { type: "manual" };

  const snapshot: FinalOutfitSnapshot = buildFinalOutfitSnapshot(recipe, source_);

  console.info("showroom_finalize_outfit", { requestId, username: user.username, source: snapshot.source.type });

  return Response.json(snapshot, { status: 200, headers: JSON_HEADERS });
}
