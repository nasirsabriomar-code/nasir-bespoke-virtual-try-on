import "server-only";

import { AuthConfigurationError } from "@/lib/auth/config";
import { requireRequestUser } from "@/lib/auth/session";
import {
  acquireGenerationLock,
  GenerationGuardUnavailableError,
  parseIdempotencyKey,
  releaseGenerationLock,
  resolveIdempotencyForRequest,
  writeIdempotencyRecord,
  type GenerationLease,
  type IdempotencyRecord,
} from "@/lib/generation-guard";
import { storeGenerationAssets, type GenerationAssetRefs } from "@/lib/generation-storage";
import { checkGenerationRateLimit, RateLimitConfigurationError } from "@/lib/rate-limit";
import { isSameOriginRequest } from "@/lib/request-security";
import {
  compileSplitGenerationPlan,
  MaterialGroupValidationError,
  SplitRecipeValidationError,
  validateMaterialUploads,
  validateSplitRecipe,
  type NormalizedSplitRecipe,
  type SplitGenerationPlan,
  type SplitTryOnClientRequest,
} from "@/lib/split-outfit/generation-compiler";
import { isSplitGenerationEnabled } from "@/lib/split-outfit/generation-config";
import type { TryOnImage } from "@/lib/tryon/types";
import { getRequestDevice, recordUsageEvent, type UsageEvent, type UsageStatus } from "@/lib/usage-history";
import { MAX_IMAGE_BYTES, UploadValidationError, validateImageFile } from "@/lib/validation";

/**
 * This is a dedicated, isolated handler for Split Outfit generation — a NEW
 * route (/api/split-try-on), NOT an extension of lib/try-on-handler.ts. Full
 * Outfit's proven security/orchestration pipeline is untouched by this file.
 * Low-level primitives (auth, idempotency, generation lock, rate limit,
 * upload validation, storage, history) are reused unchanged; the request
 * shape, allow-list, and recipe/material validation are entirely new and
 * specific to Split.
 *
 * Vercel Functions cap request/response payloads at 4.5MB. A Split request
 * carries a customer photo plus up to SPLIT_MAX_MATERIAL_GROUPS material
 * swatches, each capped at the SAME MAX_IMAGE_BYTES ceiling as every other
 * upload in this app (unchanged, per-file). For every Suit v1 rule today,
 * getCanonicalMaterialGroups() always yields exactly ONE upload-required
 * group (see lib/split-outfit/compatibility.ts) — the ceiling below reserves
 * headroom for one additional group so a future rule change does not
 * silently need a fresh size-limit review.
 */
export const SPLIT_MAX_MATERIAL_GROUPS = 2;
export const SPLIT_MAX_REQUEST_BYTES = MAX_IMAGE_BYTES * (1 + SPLIT_MAX_MATERIAL_GROUPS) + 200_000;

const JSON_HEADERS = {
  "Cache-Control": "no-store, private",
  "Content-Type": "application/json",
  "X-Content-Type-Options": "nosniff",
};

const MATERIAL_FIELD_PREFIX = "material:";
// Strict allow-list. Every other multipart field name fails closed —
// including any client attempt to submit a prompt, a reference URL/path, a
// model/provider/quality selection, a recipeStatus claim, activeMaterialSlots,
// materialLinkGroups, or an arbitrary material-slot list. None of those has
// a field name here, so none of them can ever reach parsing logic below.
const STATIC_ALLOWED_FIELDS = new Set([
  "family",
  "upperId",
  "lowerId",
  "shirtId",
  "waistcoatId",
  "footwearId",
  "accessoryIds",
  "person",
]);

export type SplitGenerationResult = {
  bytes: Uint8Array;
  contentType: "image/jpeg";
  metadata: { provider: string; model: string; quality: string; durationMs: number };
};

type RouteDependencies = {
  authenticate: typeof requireRequestUser;
  rateLimit: typeof checkGenerationRateLimit;
  generate: (plan: SplitGenerationPlan) => Promise<SplitGenerationResult>;
  recordUsage?: typeof recordUsageEvent;
};

async function defaultGenerate(): Promise<SplitGenerationResult> {
  // Unreachable in a live request: SPLIT_GENERATION_ENABLED is checked
  // first, before any of this handler's other work, and defaults to false.
  // Real provider wiring (mapping a SplitGenerationPlan into an actual
  // generateTryOn() call) is explicitly out of scope for this milestone.
  throw new Error("Split generation provider is not yet implemented.");
}

const DEFAULT_DEPENDENCIES: RouteDependencies = {
  authenticate: requireRequestUser,
  rateLimit: checkGenerationRateLimit,
  generate: defaultGenerate,
  recordUsage: recordUsageEvent,
};

function jsonError(error: string, status: number, headers?: HeadersInit) {
  return Response.json({ error }, { status, headers: { ...JSON_HEADERS, ...headers } });
}

function imageResultResponse(bytes: Uint8Array, contentType: string, extraHeaders?: HeadersInit) {
  return new Response(bytes.slice(), {
    status: 200,
    headers: {
      "Cache-Control": "no-store, private",
      "Content-Disposition": 'inline; filename="nasir-bespoke-split-try-on.jpg"',
      "Content-Type": contentType,
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders,
    },
  });
}

async function replayOrBlockIdempotency(username: string, key: string) {
  const decision = await resolveIdempotencyForRequest(username, key);
  if (decision.kind === "replay") return replayIdempotentResult(decision.record);
  if (decision.kind === "in_progress") {
    return jsonError("A try-on is already in progress. Please wait for it to finish.", 409);
  }
  return null;
}

function replayIdempotentResult(record: Extract<IdempotencyRecord, { status: "complete" } | { status: "failed" }>) {
  if (record.status === "failed") return jsonError(record.error, record.httpStatus);
  return imageResultResponse(Uint8Array.from(Buffer.from(record.body, "base64")), record.contentType, {
    "Idempotency-Replayed": "true",
  });
}

function hasUnexpectedSplitFields(formData: FormData) {
  for (const [name] of formData.entries()) {
    if (STATIC_ALLOWED_FIELDS.has(name)) continue;
    if (name.startsWith(MATERIAL_FIELD_PREFIX)) continue;
    return true;
  }
  return false;
}

function getExactlyOneString(formData: FormData, name: string): string | null | undefined {
  const values = formData.getAll(name);
  if (values.length === 0) return undefined;
  if (values.length !== 1 || typeof values[0] !== "string") return null;
  return values[0];
}

function getStrings(formData: FormData, name: string): string[] | null {
  const values = formData.getAll(name);
  if (values.some((value) => typeof value !== "string")) return null;
  return values as string[];
}

function getExactlyOneFile(formData: FormData, name: string): File | null | undefined {
  const values = formData.getAll(name);
  if (values.length === 0) return undefined;
  if (values.length !== 1 || !(values[0] instanceof File)) return null;
  return values[0];
}

function getMaterialFieldNames(formData: FormData): string[] {
  const names = new Set<string>();
  for (const [name] of formData.entries()) {
    if (name.startsWith(MATERIAL_FIELD_PREFIX)) names.add(name);
  }
  return [...names];
}

async function recordSplitUsageSafely(
  dependencies: RouteDependencies,
  request: Request,
  username: string,
  requestId: string,
  status: UsageStatus,
  durationMs: number,
  recipe: NormalizedSplitRecipe | undefined,
  metadata?: Partial<SplitGenerationResult["metadata"]>,
  assets?: GenerationAssetRefs,
) {
  if (!dependencies.recordUsage) return;
  try {
    const generation: NonNullable<UsageEvent["generation"]> | undefined = recipe
      ? {
        mode: "split",
        splitFamily: recipe.family,
        splitUpperId: recipe.components.upper.id,
        splitUpperName: recipe.components.upper.name,
        splitLowerId: recipe.components.lower.id,
        splitLowerName: recipe.components.lower.name,
        splitShirtId: recipe.components.shirt.id,
        splitShirtName: recipe.components.shirt.name,
        ...(recipe.components.waistcoat ? { splitWaistcoatId: recipe.components.waistcoat.id, splitWaistcoatName: recipe.components.waistcoat.name } : {}),
        splitFootwearId: recipe.components.footwear.id,
        splitFootwearName: recipe.components.footwear.name,
        splitAccessoryIds: recipe.components.accessories.map((accessory) => accessory.id),
        splitAccessoryNames: recipe.components.accessories.map((accessory) => accessory.name),
        splitMaterialGroups: recipe.materialGroups.map((group) => ({ groupId: group.groupId, slotIds: group.slotIds })),
      }
      : undefined;
    await dependencies.recordUsage({
      id: requestId,
      occurredAt: new Date().toISOString(),
      username,
      status,
      device: getRequestDevice(request),
      durationMs,
      provider: metadata?.provider ?? "openai",
      model: metadata?.model ?? "gpt-image-2",
      quality: metadata?.quality ?? "medium",
      ...(generation ? { generation } : {}),
      ...(assets ? { assets } : {}),
    });
  } catch (error) {
    console.error("split_try_on_usage_history_failed", {
      requestId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
  }
}

export async function handleSplitTryOnRequest(
  request: Request,
  dependencies: RouteDependencies = DEFAULT_DEPENDENCIES,
) {
  const requestId = crypto.randomUUID();

  // Order below preserves the proven Full Outfit discipline (see
  // lib/try-on-handler.ts), plus one addition at the very front: the
  // server-side generation-enabled flag, checked before ANYTHING else so a
  // disabled deployment (the default) fails as cheaply as possible and the
  // real provider is structurally unreachable.
  if (!isSplitGenerationEnabled()) {
    return jsonError("Split generation is not yet enabled.", 503);
  }

  if (!isSameOriginRequest(request)) {
    return jsonError("This request was blocked. Please refresh and try again.", 403);
  }

  let user;
  try {
    user = await dependencies.authenticate(request);
  } catch (error) {
    if (error instanceof AuthConfigurationError) {
      console.error("authentication_configuration_error", { requestId, route: "split-try-on" });
      return jsonError("Authentication is not configured.", 503);
    }
    throw error;
  }
  if (!user) return jsonError("Your session has expired. Please sign in again.", 401);

  const idempotencyKey = parseIdempotencyKey(request);
  if (idempotencyKey === "") return jsonError("Invalid idempotency key.", 400);

  if (idempotencyKey) {
    try {
      const blocked = await replayOrBlockIdempotency(user.username, idempotencyKey);
      if (blocked) return blocked;
    } catch (error) {
      if (error instanceof GenerationGuardUnavailableError) {
        console.error("generation_guard_unavailable", { requestId, route: "split-try-on" });
        return jsonError("Generation is temporarily unavailable. Please try again shortly.", 503);
      }
      throw error;
    }
  }

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    return jsonError("Please submit a customer photo and your selected recipe.", 400);
  }

  const declaredLength = Number.parseInt(request.headers.get("content-length") || "0", 10);
  if (Number.isFinite(declaredLength) && declaredLength > SPLIT_MAX_REQUEST_BYTES) {
    return jsonError("The uploaded images are too large. Please choose smaller images.", 413);
  }

  const startedAt = Date.now();
  let generationAttempted = false;
  let lease: GenerationLease | null = null;
  let rateHeaders: HeadersInit = {};
  let recipeForUsage: NormalizedSplitRecipe | undefined;

  try {
    const formData = await request.formData();
    if (hasUnexpectedSplitFields(formData)) {
      return jsonError("Unexpected field in the submitted recipe.", 400, rateHeaders);
    }

    const family = getExactlyOneString(formData, "family");
    const upperId = getExactlyOneString(formData, "upperId");
    const lowerId = getExactlyOneString(formData, "lowerId");
    const shirtId = getExactlyOneString(formData, "shirtId");
    const waistcoatIdRaw = getExactlyOneString(formData, "waistcoatId");
    const footwearId = getExactlyOneString(formData, "footwearId");
    const accessoryIds = getStrings(formData, "accessoryIds");
    const personFile = getExactlyOneFile(formData, "person");

    if (
      !family || !upperId || !lowerId || !shirtId || !footwearId ||
      waistcoatIdRaw === null || accessoryIds === null || !personFile
    ) {
      return jsonError("Please submit a complete Split Outfit recipe and a customer photo.", 400, rateHeaders);
    }

    const clientRequest: SplitTryOnClientRequest = {
      family,
      upperId,
      lowerId,
      shirtId,
      waistcoatId: waistcoatIdRaw ?? null,
      footwearId,
      accessoryIds,
    };

    const person = await validateImageFile(personFile, "a customer photo");

    let recipe: NormalizedSplitRecipe;
    try {
      recipe = validateSplitRecipe(clientRequest);
    } catch (error) {
      if (error instanceof SplitRecipeValidationError) return jsonError(error.message, 400, rateHeaders);
      throw error;
    }
    recipeForUsage = recipe;

    // Material fields: exactly one File per submitted field name — a second
    // file under the same field name is rejected right here, before any
    // group-set validation runs, so "multiple files for one server-linked
    // group" is never silently collapsed to the first/last file.
    const materialFieldNames = getMaterialFieldNames(formData);
    if (materialFieldNames.length > SPLIT_MAX_MATERIAL_GROUPS) {
      return jsonError("Too many material groups were submitted.", 400, rateHeaders);
    }
    const materialUploadsRaw = new Map<string, File>();
    for (const fieldName of materialFieldNames) {
      const file = getExactlyOneFile(formData, fieldName);
      if (!file) return jsonError("Each material group must contain exactly one uploaded image.", 400, rateHeaders);
      materialUploadsRaw.set(fieldName.slice(MATERIAL_FIELD_PREFIX.length), file);
    }

    try {
      validateMaterialUploads(recipe, materialUploadsRaw);
    } catch (error) {
      if (error instanceof MaterialGroupValidationError) return jsonError(error.message, 400, rateHeaders);
      throw error;
    }

    const materialImages = new Map<string, TryOnImage>();
    for (const [groupId, file] of materialUploadsRaw) {
      materialImages.set(groupId, await validateImageFile(file, "a material swatch photo"));
    }

    if (idempotencyKey) {
      const blocked = await replayOrBlockIdempotency(user.username, idempotencyKey);
      if (blocked) return blocked;
    }

    // Generation lock — SAME lock as Full Outfit (keyed by username only),
    // so one user cannot run a Split and a Full Outfit generation
    // concurrently, or two Split generations concurrently.
    try {
      lease = await acquireGenerationLock(user.username);
    } catch (error) {
      if (error instanceof GenerationGuardUnavailableError) {
        console.error("generation_guard_unavailable", { requestId, route: "split-try-on" });
        return jsonError("Generation is temporarily unavailable. Please try again shortly.", 503);
      }
      throw error;
    }
    if (!lease) {
      if (idempotencyKey) {
        const blocked = await replayOrBlockIdempotency(user.username, idempotencyKey);
        if (blocked) return blocked;
      }
      return jsonError("A try-on is already in progress. Please wait for it to finish.", 409);
    }

    if (idempotencyKey) {
      const blocked = await replayOrBlockIdempotency(user.username, idempotencyKey);
      if (blocked) return blocked;
    }

    // Generation rate limit — SAME shared per-user/global budget as Full
    // Outfit (checkGenerationRateLimit is keyed by username only; Split
    // deliberately does not get an independent spending allowance).
    let rateLimit;
    try {
      rateLimit = await dependencies.rateLimit(user.username);
    } catch (error) {
      if (error instanceof RateLimitConfigurationError) {
        console.error("rate_limit_configuration_error", { requestId, route: "split-try-on" });
        return jsonError("Generation is temporarily unavailable. Please try again shortly.", 503);
      }
      throw error;
    }
    rateHeaders = {
      "X-RateLimit-Limit": String(rateLimit.limit),
      "X-RateLimit-Remaining": String(rateLimit.remaining),
      "X-RateLimit-Reset": String(Math.ceil(rateLimit.resetAt / 1000)),
    };
    if (!rateLimit.allowed) {
      console.warn("split_try_on_rate_limited", { requestId, username: user.username, blockedBy: rateLimit.blockedBy });
      return jsonError(
        "You've made several try-ons in a short period. Please wait a moment and try again.",
        429,
        { ...rateHeaders, "Retry-After": String(Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000))) },
      );
    }

    const plan = await compileSplitGenerationPlan(recipe, { person, materialUploads: materialImages });

    if (idempotencyKey && lease) {
      await writeIdempotencyRecord(user.username, idempotencyKey, { status: "pending", leaseId: lease.leaseId });
    }

    // Provider invocation. Structurally unreachable in a live production
    // request while SPLIT_GENERATION_ENABLED defaults false (checked at the
    // very top of this function) — this line only ever executes in tests
    // that explicitly force the flag on AND inject a mocked `generate`.
    generationAttempted = true;
    const result = await dependencies.generate(plan);

    let assets: GenerationAssetRefs | undefined;
    try {
      assets = (await storeGenerationAssets({
        generationId: requestId,
        person: person.file,
        references: plan.references.map(({ role, image }) => ({ role, file: image.file })),
        resultBytes: result.bytes,
        resultContentType: result.contentType,
      })) ?? undefined;
    } catch (storageError) {
      console.error("split_try_on_image_history_storage_failed", {
        requestId,
        errorName: storageError instanceof Error ? storageError.name : "UnknownError",
      });
    }

    await recordSplitUsageSafely(dependencies, request, user.username, requestId, "success", Date.now() - startedAt, recipe, result.metadata, assets);
    console.info("split_try_on_generation", { requestId, username: user.username, success: true, ...result.metadata });

    if (idempotencyKey) {
      try {
        await writeIdempotencyRecord(user.username, idempotencyKey, {
          status: "complete",
          contentType: result.contentType,
          body: Buffer.from(result.bytes).toString("base64"),
        });
      } catch (error) {
        if (!(error instanceof GenerationGuardUnavailableError)) throw error;
        console.error("generation_idempotency_store_failed", { requestId, route: "split-try-on" });
      }
    }

    return imageResultResponse(result.bytes, result.contentType, rateHeaders);
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    if (generationAttempted) {
      if (idempotencyKey) {
        const isTimeout = error instanceof Error && error.name.toLowerCase().includes("timeout");
        await writeIdempotencyRecord(user.username, idempotencyKey, {
          status: "failed",
          error: isTimeout ? "The generation took too long. Please try again." : "We couldn't create the try-on. Please try again.",
          httpStatus: isTimeout ? 504 : 502,
        }).catch(() => undefined);
      }
      await recordSplitUsageSafely(dependencies, request, user.username, requestId, "failed", durationMs, recipeForUsage);
    }

    if (error instanceof UploadValidationError) {
      console.warn("split_try_on_validation_failed", { requestId, username: user.username, success: false, code: error.code, durationMs });
      return jsonError(error.message, error.code === "file_too_large" ? 413 : 400, rateHeaders);
    }

    if (!generationAttempted && (error instanceof GenerationGuardUnavailableError || error instanceof RateLimitConfigurationError)) {
      console.error("generation_control_unavailable", { requestId, route: "split-try-on" });
      return jsonError("Generation is temporarily unavailable. Please try again shortly.", 503);
    }

    const isTimeout = error instanceof Error && error.name.toLowerCase().includes("timeout");
    console.error("split_try_on_generation_failed", {
      requestId,
      username: user.username,
      success: false,
      durationMs,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return jsonError(
      isTimeout ? "The generation took too long. Please try again." : "We couldn't create the try-on. Please try again.",
      isTimeout ? 504 : 502,
      rateHeaders,
    );
  } finally {
    if (lease) {
      try {
        await releaseGenerationLock(lease);
      } catch (error) {
        console.error("generation_lock_release_failed", { requestId, errorName: error instanceof Error ? error.name : "UnknownError" });
      }
    }
  }
}
