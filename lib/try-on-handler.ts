import { checkUploadRateLimit } from "@/lib/rate-limit";
import { parseBackgroundControl } from "@/lib/tryon/background-control";
import { parseFabricGuidance } from "@/lib/tryon/fabric-guidance";
import { sanitizeGenerationMetadata } from "@/lib/tryon/metadata";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { APIConnectionTimeoutError } from "openai";
import { AuthConfigurationError } from "@/lib/auth/config";
import { requireRequestUser } from "@/lib/auth/session";
import { CatalogCompatibilityError, validateCatalogSelection } from "@/lib/catalog/compatibility";
import { findCatalogSelection } from "@/lib/catalog/store";
import type { CatalogSelection, ReferenceImage, SelectionMode, StyleOption, TryOnSelection } from "@/lib/catalog/types";
import { getPrivateLevel1Asset } from "@/lib/catalog/level1-assets";
import { Level1CatalogueError, type CuratedAsset, type ResolvedLevel1Design } from "@/lib/catalog/level1-types";
import { buildLevel1TryOnPrompt, type FabricRegion } from "@/lib/catalog/level1-prompt";
import { resolveLevel1Design } from "@/lib/catalog/level1-store";
import { MissingApiKeyError } from "@/lib/openai";
import {
  SplitOutfitError,
  resolveSplitOutfitRecipe,
  readSplitReference,
  type ResolvedSplitOutfit,
  type SplitReferenceRole,
} from "@/lib/split-outfit/generation";
import { buildSplitOutfitPrompt } from "@/lib/split-outfit/prompt";
import { hasPhotographedWaistcoat } from "@/lib/split-outfit/image-map";
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
import {
  checkGenerationRateLimit,
  RateLimitConfigurationError,
} from "@/lib/rate-limit";
import { isSameOriginRequest } from "@/lib/request-security";
import { readBoundedBody, readBoundedJson, RequestBodyTooLargeError } from "@/lib/request-body";
import { generateTryOn } from "@/lib/tryon";
import { grayscaleConstruction } from "@/lib/tryon/neutralize-construction";
import type { TryOnInput, TryOnOutput } from "@/lib/tryon/types";
import { buildTryOnPrompt } from "@/lib/tryon/prompt";
import { resolveImageGenerationConfig, type ImageGenerationConfig } from "@/lib/tryon/model-config";
import {
  BespokeConfigurationError,
  buildOutfitSpecification,
  compileVisualizationPrompt,
  parseSubmittedBespokeConfiguration,
  resolveBespokeConfiguration,
  selectBespokeReferenceImages,
} from "@/lib/bespoke/engine";
import { storeGenerationAssets, type GenerationAssetRefs } from "@/lib/generation-storage";
import {
  consumeUploadSlots,
  findUsableUploadSlots,
  isPermanentHistoryConfigured,
  persistPermanentGeneration,
  type UploadRole,
  type UploadSlot,
} from "@/lib/highres/ledger";
import {
  HighResolutionUploadError,
  assertHighResolutionStorage,
  removeConsumedUploadObjects,
  requiredRolesForRequest,
  uploadSlotToFile,
} from "@/lib/highres/uploads";
import {
  getRequestDevice,
  recordUsageEvent,
  type UsageEvent,
  type UsageStatus,
} from "@/lib/usage-history";
import { MAX_REQUEST_BYTES, UploadValidationError, detectImageMime } from "@/lib/validation";
import { validateImageFile } from "@/lib/validate-image";

import { GENERATION_STATE_HEADER, RESULT_SAVED_HEADER } from "@/lib/generation-recovery";

const UPLOADS_UNAVAILABLE_MESSAGE = "One or more upload sessions expired or were already used. Please upload the images again.";

const JSON_HEADERS = {
  "Cache-Control": "no-store, private",
  "Content-Type": "application/json",
  "X-Content-Type-Options": "nosniff",
};

type RouteDependencies = {
  authenticate: typeof requireRequestUser;
  rateLimit: typeof checkGenerationRateLimit;
  generate: (input: TryOnInput) => Promise<TryOnOutput>;
  recordUsage?: typeof recordUsageEvent;
  resolveSelection?: typeof findCatalogSelection;
  resolveLevel1Selection?: typeof resolveLevel1Design;
  readLevel1Reference?: (asset: CuratedAsset, role: "curated-design" | "curated-detail") => Promise<TryOnInput["references"][number]>;
  resolveSplitSelection?: typeof resolveSplitOutfitRecipe;
  readSplitReference?: (option: ResolvedSplitOutfit["upper"], role: SplitReferenceRole) => Promise<TryOnInput["references"][number]>;
};

const DEFAULT_DEPENDENCIES: RouteDependencies = {
  authenticate: requireRequestUser,
  rateLimit: checkGenerationRateLimit,
  generate: generateTryOn,
  recordUsage: recordUsageEvent,
  resolveSelection: findCatalogSelection,
  resolveLevel1Selection: resolveLevel1Design,
  readLevel1Reference: readLevel1Reference,
  resolveSplitSelection: resolveSplitOutfitRecipe,
  readSplitReference: readSplitReference,
};

function jsonError(error: string, status: number, headers?: HeadersInit) {
  return Response.json(
    { error },
    { status, headers: { ...JSON_HEADERS, ...headers } },
  );
}

function imageResultResponse(bytes: Uint8Array, contentType: string, extraHeaders?: HeadersInit) {
  const exactBytes = bytes.slice();
  return new Response(exactBytes, {
    status: 200,
    headers: {
      "Cache-Control": "no-store, private",
      "Content-Disposition": 'inline; filename="nasir-bespoke-try-on.jpg"',
      "Content-Type": contentType,
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders,
    },
  });
}

function generationResultResponse(generationId: string, metadata?: TryOnOutput["metadata"], extraHeaders?: HeadersInit) {
  return Response.json({
    generationId,
    resultUrl: `/api/history/${encodeURIComponent(generationId)}/asset/result`,
    originalUrl: `/api/history/${encodeURIComponent(generationId)}/asset/person`,
    metadata,
  }, {
    status: 200,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  });
}

/**
 * A result the model produced but storage could not keep. It is streamed back
 * once so the paid image is not discarded; staff are told to download it.
 */
function unsavedResultResponse(bytes: Uint8Array, contentType: string, generationId: string, extraHeaders?: HeadersInit) {
  const exactBytes = bytes.slice();
  return new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(exactBytes);
      controller.close();
    },
  }), {
    status: 200,
    headers: {
      "Cache-Control": "no-store, private",
      "Content-Disposition": 'inline; filename="nasir-bespoke-try-on.png"',
      "Content-Type": contentType,
      "X-Content-Type-Options": "nosniff",
      [RESULT_SAVED_HEADER]: "false",
      "X-Generation-Id": generationId,
      ...extraHeaders,
    },
  });
}

/** Tracks whether this request reached the paid provider call, or deferred to an existing key. */
type RequestState = { generationStarted: boolean; deferredToKey: boolean };

async function replayOrBlockIdempotency(username: string, key: string, state?: RequestState) {
  const decision = await resolveIdempotencyForRequest(username, key);
  if (decision.kind === "absent") return null;
  if (state) state.deferredToKey = true;
  if (decision.kind === "replay") return replayIdempotentResult(decision.record);
  return jsonError("A try-on is already in progress. Please wait for it to finish.", 409, {
    [GENERATION_STATE_HEADER]: "in-progress",
  });
}

function replayIdempotentResult(record: Extract<IdempotencyRecord, { status: "complete" } | { status: "complete_generation" } | { status: "failed" }>) {
  if (record.status === "failed") return jsonError(record.error, record.httpStatus, { "Idempotency-Replayed": "true" });
  if (record.status === "complete_generation") return generationResultResponse(record.generationId, undefined, { "Idempotency-Replayed": "true" });
  return imageResultResponse(Uint8Array.from(Buffer.from(record.body, "base64")), record.contentType, {
    "Idempotency-Replayed": "true",
  });
}

function getExactlyOneFile(formData: FormData, name: string) {
  const values = formData.getAll(name);
  return values.length === 1 && values[0] instanceof File ? values[0] : null;
}

const ALLOWED_MULTIPART_FIELDS = new Set([
  "person",
  "outfit",
  "fabric",
  "lowerFabric",
  "shirtFabric",
  "waistcoatFabric",
  "backgroundControl",
  "fabricGuidance",
  "selectionMode",
  "upperGarmentId",
  "lowerGarmentId",
  "garmentSubtypeId",
  "upperStyleId",
  "lowerStyleId",
  "turbanStyleId",
  "shoeStyleId",
  "turbanId",
  "shoeId",
  "bespokeConfiguration",
  "categoryId",
  "designId",
  "variantId",
  "fabricRegion",
  "quality",
  "splitRecipe",
]);

const LEVEL1_ALLOWED_FIELDS = new Set(["backgroundControl", "fabricGuidance", "person", "fabric", "lowerFabric", "selectionMode", "categoryId", "designId", "variantId", "fabricRegion", "quality"]);
const SPLIT_ALLOWED_FIELDS = new Set(["backgroundControl", "fabricGuidance", "person", "fabric", "lowerFabric", "shirtFabric", "waistcoatFabric", "selectionMode", "splitRecipe", "fabricRegion", "quality"]);

function hasDisallowedFields(names: Iterable<string>, allowed: Set<string>) {
  for (const name of names) {
    if (!allowed.has(name)) return true;
  }
  return false;
}

function hasUnexpectedFields(formData: FormData) {
  return hasDisallowedFields(formData.keys(), ALLOWED_MULTIPART_FIELDS);
}

function hasLevel1ForbiddenFields(names: Iterable<string>) {
  return hasDisallowedFields(names, LEVEL1_ALLOWED_FIELDS);
}

function hasSplitForbiddenFields(names: Iterable<string>) {
  return hasDisallowedFields(names, SPLIT_ALLOWED_FIELDS);
}

function getExactlyOneText(formData: FormData, name: string, required: boolean) {
  const values = formData.getAll(name);
  if (values.length === 0 && !required) return undefined;
  if (values.length !== 1 || typeof values[0] !== "string") return null;
  const value = values[0].trim();
  return value || (required ? null : undefined);
}

type ReferenceRole = TryOnInput["references"][number]["role"];

async function readReference(reference: ReferenceImage, role: ReferenceRole) {
  // Catalog paths are seeded and controlled by the server; never accept a browser-supplied path.
  if (!reference.path.startsWith("/catalog/") || reference.path.includes("..")) {
    throw new Error("Catalog reference path is invalid.");
  }
  const absolutePath = path.join(process.cwd(), "public", reference.path.slice(1));
  const bytes = await readFile(absolutePath);
  const extension = path.extname(absolutePath).toLowerCase();
  const mime = extension === ".png" ? "image/png" : extension === ".webp" ? "image/webp" : "image/jpeg";
  return {
    role,
    image: { file: new File([bytes], `${role}-reference${extension}`, { type: mime }), mime },
  } as const;
}

async function buildReferenceInputs(selection?: CatalogSelection) {
  const references: Array<Awaited<ReturnType<typeof readReference>>> = [];
  if (!selection) return references;
  if (selection.upper.category !== "no-change") {
    const upperReference = selection.upper.aiReferences[0] ?? selection.upper.displayReference;
    references.push(await readReference(upperReference, "upper"));
  }

  if (selection.upper.pieceType === "upper" && selection.lower && selection.lower.category !== "no-change") {
    const lowerReference = selection.lower.aiReferences[0] ?? selection.lower.displayReference;
    references.push(await readReference(lowerReference, "lower"));
  }
  if (selection.subtype && selection.subtype.id !== selection.upper.id) {
    const subtypeReference = selection.subtype.aiReferences[0] ?? selection.subtype.displayReference;
    references.push(await readReference(subtypeReference, "subtype"));
  }
  const firstStyleReference = (style: StyleOption | undefined) => style?.aiReferences[0];
  const upperStyleReference = firstStyleReference(selection.upperStyle);
  const lowerStyleReference = firstStyleReference(selection.lowerStyle);
  const turbanStyleReference = firstStyleReference(selection.turbanStyle);
  const shoeStyleReference = firstStyleReference(selection.shoeStyle);
  if (upperStyleReference) references.push(await readReference(upperStyleReference, "upper-style"));
  if (lowerStyleReference) references.push(await readReference(lowerStyleReference, "lower-style"));
  if (selection.turban.aiReferences.length) references.push(await readReference(selection.turban.aiReferences[0], "turban"));
  if (turbanStyleReference) references.push(await readReference(turbanStyleReference, "turban-style"));
  if (selection.shoes.aiReferences.length) references.push(await readReference(selection.shoes.aiReferences[0], "shoes"));
  if (shoeStyleReference) references.push(await readReference(shoeStyleReference, "shoe-style"));
  return references;
}

async function buildBespokeReferenceInputs(references: ReferenceImage[]) {
  return Promise.all(references.map((reference, index) => readReference(reference, index === 0 ? "bespoke-detail-1" : "bespoke-detail-2")));
}

async function readLevel1Reference(asset: CuratedAsset, role: "curated-design" | "curated-detail"): Promise<TryOnInput["references"][number]> {
  const privateAsset = await getPrivateLevel1Asset(asset.id);
  const blob = privateAsset?.blob;
  if (!privateAsset || !blob || blob.statusCode !== 200 || !blob.stream) {
    throw new Level1CatalogueError("asset_unavailable", "The approved catalogue reference is temporarily unavailable. Please try again shortly.");
  }
  const bytes = new Uint8Array(await new Response(blob.stream).arrayBuffer());
  const contentType = privateAsset.asset.contentType;
  if (!contentType) throw new Level1CatalogueError("asset_unavailable", "The approved catalogue reference is temporarily unavailable. Please try again shortly.");
  const detectedMime = detectImageMime(bytes);
  if (detectedMime !== contentType || (blob.blob.contentType && blob.blob.contentType.split(";", 1)[0]?.toLowerCase() !== contentType)) {
    throw new Level1CatalogueError("asset_unavailable", "The approved catalogue reference is invalid. Please contact an administrator.");
  }
  const file = new File([bytes], `${asset.id}.${contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg"}`, { type: contentType });
  const validated = await validateImageFile(file, "the approved catalogue reference");
  if (asset.checksum && createHash("sha256").update(bytes).digest("hex") !== asset.checksum) {
    throw new Level1CatalogueError("asset_unavailable", "The approved catalogue reference is invalid. Please contact an administrator.");
  }
  return {
    role,
    image: {
      file: validated.file,
      mime: validated.mime,
    },
  };
}

function safeProviderError(error: unknown) {
  const record = error && typeof error === "object" ? error as Record<string, unknown> : null;
  return {
    errorName: error instanceof Error ? error.name : "UnknownError",
    status: typeof record?.status === "number" ? record.status : undefined,
    code: typeof record?.code === "string" ? record.code : undefined,
    providerRequestId: typeof record?.requestID === "string"
      ? record.requestID
      : typeof record?.request_id === "string" ? record.request_id : undefined,
  };
}

// Resolved at module load so an invalid IMAGE_* setting fails at boot, not on a paid request.
const IMAGE_CONFIG = resolveImageGenerationConfig();

/** Provider/model/quality for usage records when the provider returned no metadata. */
export function usageModelFallback(metadata: Partial<TryOnOutput["metadata"]> | undefined, config: ImageGenerationConfig = IMAGE_CONFIG) {
  return {
    provider: metadata?.provider ?? "openai",
    model: metadata?.model ?? config.model,
    quality: metadata?.quality ?? config.quality,
  };
}

async function recordUsageSafely(
  dependencies: RouteDependencies,
  request: Request,
  username: string,
  requestId: string,
  status: UsageStatus,
  durationMs: number,
  metadata?: Partial<TryOnOutput["metadata"]>,
  generation?: NonNullable<UsageEvent["generation"]>,
  assets?: GenerationAssetRefs,
) {
  if (!dependencies.recordUsage) return;
  const event: UsageEvent = {
    id: requestId,
    occurredAt: new Date().toISOString(),
    username,
    status,
    device: getRequestDevice(request),
    durationMs,
    ...usageModelFallback(metadata),
    metadata: sanitizeGenerationMetadata(metadata),
    generation,
    assets,
  };
  // Each store is written independently: a generation must stay findable in
  // whichever one succeeds. Neither failure may fail a try-on the model has run.
  const writes = await Promise.allSettled([
    dependencies.recordUsage(event),
    persistPermanentGeneration(event),
  ]);
  for (const write of writes) {
    if (write.status === "rejected") {
      console.error("try_on_usage_history_failed", {
        requestId,
        errorName: write.reason instanceof Error ? write.reason.name : "UnknownError",
      });
    }
  }
}

function isTimeoutError(error: unknown) {
  // The SDK's timeout error keeps the default name "Error", so check its type.
  return error instanceof APIConnectionTimeoutError
    || (error instanceof Error && error.name.toLowerCase().includes("timeout"));
}

const HIGHRES_TEXT_FIELDS = [
  "backgroundControl",
  "fabricGuidance",
  "selectionMode", "upperGarmentId", "lowerGarmentId", "garmentSubtypeId",
  "upperStyleId", "lowerStyleId", "turbanStyleId", "shoeStyleId", "turbanId", "shoeId",
  "bespokeConfiguration", "categoryId", "designId", "variantId", "fabricRegion",
  "splitRecipe",
] as const;

type HighResolutionRequest = {
  uploads?: Partial<Record<UploadRole, string>>;
  [key: string]: unknown;
};

async function handleHighResolutionRequest(
  request: Request,
  dependencies: RouteDependencies,
  state: RequestState,
): Promise<Response> {
  if (!isSameOriginRequest(request)) return jsonError("This request was blocked. Please refresh and try again.", 403);
  let user;
  try {
    user = await dependencies.authenticate(request);
  } catch (error) {
    if (error instanceof AuthConfigurationError) return jsonError("Authentication is not configured.", 503);
    throw error;
  }
  if (!user) return jsonError("Your session has expired. Please sign in again.", 401);
  let consumedSlots: UploadSlot[] | null = null;
  let admissionLease: GenerationLease | null = null;
  try {
    const existingKey = parseIdempotencyKey(request);
    if (existingKey === "") return jsonError("Invalid idempotency key.", 400);
    if (existingKey) {
      const replay = await replayOrBlockIdempotency(user.username, existingKey, state);
      if (replay) return replay;
    }
    assertHighResolutionStorage();
    if (process.env.NODE_ENV === "production" && !isPermanentHistoryConfigured()) {
      return jsonError("Permanent generation history is not configured.", 503);
    }
    const parsed = await readBoundedJson(request, 64 * 1024);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return jsonError("The try-on selection is invalid.", 400);
    const body = parsed as HighResolutionRequest;
    if (body.fabricGuidance !== undefined && typeof body.fabricGuidance !== "string") return jsonError("Invalid fabric reference settings.", 400);
    if (body.backgroundControl !== undefined && typeof body.backgroundControl !== "string") return jsonError("Invalid garment edit region.", 400);
    const fabricGuidance = parseFabricGuidance(body.fabricGuidance);
    const backgroundControl = parseBackgroundControl(body.backgroundControl);
    const uploads = body.uploads;
    if (!uploads || typeof uploads !== "object" || Array.isArray(uploads) || "quality" in body) {
      return jsonError("Please upload your images again and use the fixed medium-quality studio pipeline.", 400);
    }
    const mode = typeof body.selectionMode === "string" ? body.selectionMode : undefined;
    const ids: Partial<Record<UploadRole, string>> = {};
    for (const role of ["person", "fabric", "lowerFabric", "shirtFabric", "waistcoatFabric", "outfit"] as const) {
      const value = uploads[role];
      if (value !== undefined && (typeof value !== "string" || !/^[0-9a-f-]{36}$/i.test(value))) return jsonError("An uploaded image reference is invalid.", 400);
      if (typeof value === "string") ids[role] = value;
    }
    const fields: Record<string, string | undefined> = {};
    const presentNames = new Set<string>(Object.keys(ids));
    for (const field of HIGHRES_TEXT_FIELDS) {
      const value = body[field];
      if (value !== undefined) {
        if (typeof value !== "string") return jsonError("The try-on selection is invalid.", 400);
        const trimmed = value.trim();
        if (trimmed) {
          fields[field] = trimmed;
          presentNames.add(field);
        }
      }
    }
    const required = requiredRolesForRequest(mode, {
      outfit: Boolean(ids.outfit),
      lowerFabric: Boolean(ids.lowerFabric),
      fabric: Boolean(ids.fabric),
      shirtFabric: Boolean(ids.shirtFabric),
      waistcoatFabric: Boolean(ids.waistcoatFabric),
    });
    if (required.some((role) => !ids[role])) return jsonError("Please upload the required person, fabric, and outfit images.", 400);
    // Check the uploads now but consume them only once the lock and rate limit
    // allow a paid call. A rejected request must leave them reusable.
    const requiredIds = required.map((role) => ids[role] as string);
    const slots = await findUsableUploadSlots(user.username, requiredIds);
    if (!slots) return jsonError(UPLOADS_UNAVAILABLE_MESSAGE, 409);
    const slotByRole = new Map(slots.map((slot) => [slot.role, slot]));
    if (required.some((role) => !slotByRole.has(role))) return jsonError("Uploaded images did not match the requested roles.", 400);
    // Reject busy or rate-limited accounts before downloading full-resolution
    // inputs. Keep this lease through preparation and execution.
    admissionLease = await acquireGenerationLock(user.username);
    if (!admissionLease) {
      if (existingKey) {
        const replay = await replayOrBlockIdempotency(user.username, existingKey, state);
        if (replay) return replay;
      }
      return jsonError("A try-on is already in progress. Please wait for it to finish.", 409);
    }
    if (existingKey) {
      const replay = await replayOrBlockIdempotency(user.username, existingKey, state);
      if (replay) return replay;
    }
    const rateLimit = await dependencies.rateLimit(user.username);
    const rateHeaders = generationRateHeaders(rateLimit);
    if (!rateLimit.allowed) return generationRateRejection(rateLimit, rateHeaders);
    const [person, fabric, outfit, lowerFabric, shirtFabric, waistcoatFabric] = await Promise.all([
      uploadSlotToFile(slotByRole.get("person")!),
      slotByRole.get("fabric") ? uploadSlotToFile(slotByRole.get("fabric")!) : Promise.resolve(undefined),
      slotByRole.get("outfit") ? uploadSlotToFile(slotByRole.get("outfit")!) : Promise.resolve(undefined),
      slotByRole.get("lowerFabric") ? uploadSlotToFile(slotByRole.get("lowerFabric")!) : Promise.resolve(undefined),
      slotByRole.get("shirtFabric") ? uploadSlotToFile(slotByRole.get("shirtFabric")!) : Promise.resolve(undefined),
      slotByRole.get("waistcoatFabric") ? uploadSlotToFile(slotByRole.get("waistcoatFabric")!) : Promise.resolve(undefined),
    ]);
    return await executeTryOnSubmission({
      request,
      requestId: crypto.randomUUID(),
      user,
      idempotencyKey: existingKey,
      dependencies,
      state,
      highResolution: true,
      lease: admissionLease,
      rateHeaders,
      claimUploads: async () => {
        consumedSlots = await consumeUploadSlots(user.username, requiredIds);
        return Boolean(consumedSlots);
      },
      fields,
      presentNames,
      files: {
        person: person.file,
        ...(fabric ? { fabric: fabric.file } : {}),
        ...(outfit ? { outfit: outfit.file } : {}),
        ...(lowerFabric ? { lowerFabric: lowerFabric.file } : {}),
        ...(shirtFabric ? { shirtFabric: shirtFabric.file } : {}),
        ...(waistcoatFabric ? { waistcoatFabric: waistcoatFabric.file } : {}),
      },
      hasLowerFabricField: Boolean(lowerFabric),
      fabricGuidance,
      backgroundControl,
      qualityValue: undefined,
    });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return jsonError("The try-on selection is too large.", 413);
    if (error instanceof HighResolutionUploadError) return jsonError(error.message, error.status);
    if (error instanceof UploadValidationError) return jsonError(error.message, error.code === "file_too_large" ? 413 : 400);
    if (error instanceof AuthConfigurationError) return jsonError("Authentication is not configured.", 503);
    console.error("highres_tryon_prepare_failed", { errorName: error instanceof Error ? error.name : "UnknownError" });
    if (error instanceof SyntaxError) return jsonError("We couldn't prepare the full-resolution images. Please upload them again.", 400);
    // Everything else here is a storage or control-plane outage, which new uploads would not fix.
    return jsonError("Generation is temporarily unavailable. Please try again shortly.", 503);
  } finally {
    // Consumed slots are single-use, so these temporary customer photos are never
    // needed again, whether or not the generation succeeded. Success keeps its own
    // copy. Unconsumed slots stay for a retry; expired ones are removed by cron.
    if (admissionLease) {
      await releaseGenerationLock(admissionLease).catch(() => console.error("generation_lock_release_failed", { route: "try-on" }));
    }
    if (consumedSlots) await removeConsumedUploadObjects(consumedSlots);
  }
}

export async function handleTryOnRequest(
  request: Request,
  dependencies: RouteDependencies = DEFAULT_DEPENDENCIES,
): Promise<Response> {
  const state: RequestState = { generationStarted: false, deferredToKey: false };
  const response = (request.headers.get("content-type") || "").toLowerCase().startsWith("application/json")
    ? await handleHighResolutionRequest(request, dependencies, state)
    : await handleMultipartRequest(request, dependencies, state);
  // Tell the client this request never reached the paid call, so it must not
  // wait on a key that was never recorded. Replays and in-progress answers
  // describe an existing key and keep their own meaning.
  if (!response.ok && !state.generationStarted && !state.deferredToKey) {
    response.headers.set(GENERATION_STATE_HEADER, "not-started");
  }
  return response;
}

type GenerationRateLimit = Awaited<ReturnType<typeof checkGenerationRateLimit>>;

function generationRateHeaders(rateLimit: GenerationRateLimit) {
  return {
    "X-RateLimit-Limit": String(rateLimit.limit),
    "X-RateLimit-Remaining": String(rateLimit.remaining),
    "X-RateLimit-Reset": String(Math.ceil(rateLimit.resetAt / 1000)),
  };
}

function generationRateRejection(rateLimit: GenerationRateLimit, headers: HeadersInit) {
  return jsonError("You've made several try-ons in a short period. Please wait a moment and try again.", 429, {
    ...headers,
    "Retry-After": String(Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000))),
  });
}

type ValidatedSubmissionInput = {
  request: Request;
  requestId: string;
  user: NonNullable<Awaited<ReturnType<RouteDependencies["authenticate"]>>>;
  idempotencyKey: string | null | undefined;
  dependencies: RouteDependencies;
  state: RequestState;
  highResolution: boolean;
  lease: GenerationLease | null;
  rateHeaders: HeadersInit;
  claimUploads?: () => Promise<boolean>;
  fields: Record<string, string | undefined>;
  presentNames: Iterable<string>;
  files: Partial<Record<"person" | "outfit" | "fabric" | "lowerFabric" | "shirtFabric" | "waistcoatFabric", File | null>>;
  hasLowerFabricField: boolean;
  fabricGuidance: ReturnType<typeof parseFabricGuidance>;
  backgroundControl: ReturnType<typeof parseBackgroundControl>;
  qualityValue: string | null | undefined;
};

async function handleMultipartRequest(
  request: Request,
  dependencies: RouteDependencies,
  state: RequestState,
): Promise<Response> {
  const requestId = crypto.randomUUID();

  if (!isSameOriginRequest(request)) {
    return jsonError("This request was blocked. Please refresh and try again.", 403);
  }

  let user;
  try {
    user = await dependencies.authenticate(request);
  } catch (error) {
    if (error instanceof AuthConfigurationError) {
      console.error("authentication_configuration_error", { requestId, route: "try-on" });
      return jsonError("Authentication is not configured.", 503);
    }
    throw error;
  }

  if (!user) {
    return jsonError("Your session has expired. Please sign in again.", 401);
  }

  const idempotencyKey = parseIdempotencyKey(request);
  if (idempotencyKey === "") {
    return jsonError("Invalid idempotency key.", 400);
  }

  if (idempotencyKey) {
    try {
      const blocked = await replayOrBlockIdempotency(user.username, idempotencyKey, state);
      if (blocked) return blocked;
    } catch (error) {
      if (error instanceof GenerationGuardUnavailableError) {
        console.error("generation_guard_unavailable", { requestId, route: "try-on" });
        return jsonError("Generation is temporarily unavailable. Please try again shortly.", 503);
      }
      throw error;
    }
  }

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    return jsonError("Please upload a person photo and fabric photo. Choose a library look or upload an outfit photo.", 400);
  }

  const declaredLength = Number.parseInt(request.headers.get("content-length") || "0", 10);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    return jsonError("The uploaded images are too large. Please choose smaller images.", 413);
  }

  let lease: GenerationLease | null = null;
  try {
    const admission = await checkUploadRateLimit(user.username, "complete");
    if (!admission.allowed) return generationRateRejection(admission, generationRateHeaders(admission));
    lease = await acquireGenerationLock(user.username);
    if (!lease) return jsonError("A try-on is already in progress. Please wait for it to finish.", 409);

    const formData = await new Response(await readBoundedBody(request, MAX_REQUEST_BYTES), {
      headers: { "content-type": contentType },
    }).formData();
    if (hasUnexpectedFields(formData)) {
      return jsonError("Please upload a person photo and fabric photo, then choose a men's garment and accessories.", 400);
    }
    const selectionModeValue = getExactlyOneText(formData, "selectionMode", false);
    if (selectionModeValue === null) {
      return jsonError("Please choose a valid generation mode.", 400);
    }
    const rawGuidance = getExactlyOneText(formData, "fabricGuidance", false);
    if (rawGuidance === null) return jsonError("Invalid fabric reference settings.", 400);
    const fabricGuidance = parseFabricGuidance(rawGuidance);
    const rawBackground = getExactlyOneText(formData, "backgroundControl", false);
    if (rawBackground === null) return jsonError("Invalid garment edit region.", 400);
    const backgroundControl = parseBackgroundControl(rawBackground);
    const qualityValue = getExactlyOneText(formData, "quality", false);
    const fieldNames = [
      "selectionMode", "upperGarmentId", "lowerGarmentId", "garmentSubtypeId",
      "upperStyleId", "lowerStyleId", "turbanStyleId", "shoeStyleId", "turbanId", "shoeId",
      "bespokeConfiguration", "categoryId", "designId", "variantId", "fabricRegion", "splitRecipe",
    ] as const;
    const fields: Record<string, string | undefined> = {};
    for (const name of fieldNames) {
      const value = getExactlyOneText(formData, name, false);
      if (value === null) return jsonError("The try-on selection is invalid.", 400);
      fields[name] = value;
    }

    return await executeTryOnSubmission({
      request,
      requestId,
      user,
      idempotencyKey,
      dependencies,
      state,
      highResolution: false,
      lease,
      rateHeaders: {},
      fields,
      presentNames: [...formData.keys()],
      files: {
        person: getExactlyOneFile(formData, "person"),
        outfit: getExactlyOneFile(formData, "outfit"),
        fabric: getExactlyOneFile(formData, "fabric"),
        lowerFabric: getExactlyOneFile(formData, "lowerFabric"),
        shirtFabric: getExactlyOneFile(formData, "shirtFabric"),
        waistcoatFabric: getExactlyOneFile(formData, "waistcoatFabric"),
      },
      hasLowerFabricField: formData.has("lowerFabric"),
      fabricGuidance,
      backgroundControl,
      qualityValue,
    });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return jsonError("The uploaded images are too large. Please choose smaller images.", 413);
    }
    if (error instanceof UploadValidationError) {
      return jsonError(error.message, error.code === "file_too_large" ? 413 : 400);
    }
    if (error instanceof GenerationGuardUnavailableError || error instanceof RateLimitConfigurationError) {
      console.error("generation_control_unavailable", { requestId, route: "try-on" });
      return jsonError("Generation is temporarily unavailable. Please try again shortly.", 503);
    }
    throw error;
  } finally {
    if (lease) {
      await releaseGenerationLock(lease).catch((error) => {
        console.error("generation_lock_release_failed", {
          requestId,
          errorName: error instanceof Error ? error.name : "UnknownError",
        });
      });
    }
  }
}

async function executeTryOnSubmission(input: ValidatedSubmissionInput): Promise<Response> {
  const {
    request,
    requestId,
    user,
    idempotencyKey,
    dependencies,
    state,
    highResolution,
    fields,
    presentNames,
    files,
    hasLowerFabricField,
    fabricGuidance,
    backgroundControl,
    qualityValue,
  } = input;
  const startedAt = Date.now();
  let generationAttempted = false;
  let lease: GenerationLease | null = input.lease;
  let rateHeaders: HeadersInit = input.rateHeaders;
  try {
    const selectionModeValue = fields.selectionMode;
    if (selectionModeValue && selectionModeValue !== "catalog" && selectionModeValue !== "outfit" && selectionModeValue !== "level1" && selectionModeValue !== "split") {
      return jsonError("Please choose a valid generation mode.", 400, rateHeaders);
    }
    const selectionMode: SelectionMode = selectionModeValue === "level1"
      ? "level1"
      : selectionModeValue === "split"
      ? "split"
      : selectionModeValue === "outfit"
      ? "outfit"
      : selectionModeValue === "catalog"
        ? "catalog"
        : files.outfit ? "outfit" : "catalog";
    const personFile = files.person ?? null;
    const outfitFile = files.outfit ?? null;
    const fabricFile = files.fabric ?? null;
    const lowerFabricFile = files.lowerFabric ?? null;
    const shirtFabricFile = files.shirtFabric ?? null;
    const waistcoatFabricFile = files.waistcoatFabric ?? null;
    const upperGarmentId = fields.upperGarmentId;
    const lowerGarmentId = fields.lowerGarmentId;
    const garmentSubtypeId = fields.garmentSubtypeId;
    const upperStyleId = fields.upperStyleId;
    const lowerStyleId = fields.lowerStyleId;
    const turbanStyleId = fields.turbanStyleId;
    const shoeStyleId = fields.shoeStyleId;
    const turbanId = fields.turbanId;
    const shoeId = fields.shoeId;
    const bespokeConfigurationText = fields.bespokeConfiguration;
    const categoryId = fields.categoryId;
    const designId = fields.designId;
    const variantId = fields.variantId;
    const splitRecipeText = fields.splitRecipe;

    const invalidCommonInput = !personFile || (selectionMode !== "split" && !fabricFile);
    const invalidModeInput = selectionMode === "outfit"
      ? !outfitFile
      : selectionMode === "level1"
        ? !categoryId || !designId || hasLevel1ForbiddenFields(presentNames)
        : selectionMode === "split"
          ? !splitRecipeText || hasSplitForbiddenFields(presentNames)
          : !upperGarmentId || !turbanId || !shoeId;
    if (invalidCommonInput || invalidModeInput) {
      return jsonError(
        selectionMode === "outfit"
          ? "Please upload a person photo, outfit photo, and fabric photo."
          : selectionMode === "level1"
            ? "Please upload a person photo and fabric photo, then choose a curated design."
            : selectionMode === "split"
              ? "Please upload a person photo, then complete a modular outfit recipe."
              : "Please upload a person photo and fabric photo, then choose a men's garment and accessories.",
        400,
        rateHeaders,
      );
    }

    const fabricRegionValue = fields.fabricRegion;
    if (fabricRegionValue && !["upper", "lower", "both", "custom", "jacket"].includes(fabricRegionValue)) {
      return jsonError("Please choose a valid fabric application: upper, lower, both, customization, or jacket.", 400, rateHeaders);
    }
    const fabricRegion: FabricRegion = fabricRegionValue === "upper" || fabricRegionValue === "lower" || fabricRegionValue === "custom" || fabricRegionValue === "jacket" ? fabricRegionValue : "both";
    if (selectionMode === "level1" && categoryId === "jackets" && fabricRegion !== "jacket") {
      return jsonError("Jackets accept one jacket fabric only; upper, lower, both, and customization are unavailable.", 400, rateHeaders);
    }
    if (fabricRegion === "jacket" && (selectionMode !== "level1" || categoryId !== "jackets")) {
      return jsonError("The jacket-only fabric application is available only for the Jackets category.", 400, rateHeaders);
    }
    if (fabricRegion === "custom" && selectionMode !== "level1") {
      return jsonError("Customization is only available for Level 1 curated designs.", 400, rateHeaders);
    }
    if (selectionMode === "level1" && fabricRegion === "custom" && (!hasLowerFabricField || !lowerFabricFile)) {
      return jsonError("Please provide a lower fabric or choose to reuse the upper fabric for both regions.", 400, rateHeaders);
    }
    if (hasLowerFabricField && selectionMode !== "split" && (selectionMode !== "level1" || fabricRegion !== "custom")) {
      return jsonError("A lower fabric can only be used with Level 1 Customization or Split Outfit trousers.", 400, rateHeaders);
    }
    if ((shirtFabricFile || waistcoatFabricFile) && selectionMode !== "split") {
      return jsonError("Shirt and waistcoat fabrics are only available in Split Outfit.", 400, rateHeaders);
    }

    if (qualityValue === null || (qualityValue && qualityValue !== "medium")) {
      return jsonError("Studio try-ons use the fixed medium quality setting.", 400, rateHeaders);
    }

    const [person, outfit, fabric] = await Promise.all([
      validateImageFile(personFile, "a person photo"),
      selectionMode === "outfit" && outfitFile ? validateImageFile(outfitFile, "an outfit photo") : Promise.resolve(undefined),
      fabricFile ? validateImageFile(fabricFile, "a fabric photo") : Promise.resolve(undefined),
    ]);
    if (selectionMode !== "split" && !fabric) {
      return jsonError("Please upload a person photo and fabric photo.", 400, rateHeaders);
    }
    const lowerFabric = ((selectionMode === "level1" && fabricRegion === "custom") || selectionMode === "split") && lowerFabricFile
      ? await validateImageFile(lowerFabricFile, "a lower fabric photo")
      : undefined;
    const shirtFabric = selectionMode === "split" && shirtFabricFile
      ? await validateImageFile(shirtFabricFile, "a shirt fabric photo")
      : undefined;
    const waistcoatFabric = selectionMode === "split" && waistcoatFabricFile
      ? await validateImageFile(waistcoatFabricFile, "a waistcoat fabric photo")
      : undefined;
    for (const role of Object.keys(fabricGuidance)) {
      if (!({ fabric, lowerFabric, shirtFabric, waistcoatFabric } as Record<string, unknown>)[role]) throw new UploadValidationError("Fabric settings require a matching uploaded fabric.", "invalid_image");
    }

    let selectionIds: TryOnSelection = selectionMode === "level1"
      ? { mode: "level1", categoryId: categoryId as string, designId: designId as string, ...(variantId ? { variantId } : {}) }
      : selectionMode === "split"
        // Placeholder — overwritten below once resolveSplitOutfitRecipe validates
        // the submitted recipe. selectionIds isn't consumed before that point.
        ? { mode: "split", family: "suit", upperId: null, lowerId: null, shirtId: null, waistcoatId: null, footwearId: null, accessoryIds: [] }
        : {
          mode: selectionMode,
          ...(upperGarmentId ? { upperGarmentId } : {}),
          ...(lowerGarmentId ? { lowerGarmentId } : {}),
          ...(garmentSubtypeId ? { garmentSubtypeId } : {}),
          ...(upperStyleId ? { upperStyleId } : {}),
          ...(lowerStyleId ? { lowerStyleId } : {}),
          ...(turbanStyleId ? { turbanStyleId } : {}),
          ...(shoeStyleId ? { shoeStyleId } : {}),
          ...(turbanId ? { turbanId } : {}),
          ...(shoeId ? { shoeId } : {}),
        };
    let resolved: Awaited<ReturnType<typeof findCatalogSelection>> = null;
    let level1Resolved: ResolvedLevel1Design | undefined;
    let splitResolved: ResolvedSplitOutfit | undefined;
    let catalogSelection: CatalogSelection | undefined;
    let bespokeConfiguration: ReturnType<typeof resolveBespokeConfiguration> | undefined;
    let outfitSpecification: ReturnType<typeof buildOutfitSpecification> | undefined;
    let bespokeReferenceInputs: Array<Awaited<ReturnType<typeof readReference>>> = [];
    if (selectionMode === "catalog") {
      resolved = await (dependencies.resolveSelection ?? findCatalogSelection)(selectionIds as {
        upperGarmentId: string;
        lowerGarmentId?: string;
        garmentSubtypeId?: string;
        upperStyleId?: string;
        lowerStyleId?: string;
        turbanStyleId?: string;
        shoeStyleId?: string;
        turbanId: string;
        shoeId: string;
      });
      if (!resolved) return jsonError("Please choose valid men's garments and accessories.", 400, rateHeaders);
      const resolvedSelection = resolved;
      catalogSelection = {
        upper: resolvedSelection.upper,
        ...(resolvedSelection.lower ? { lower: resolvedSelection.lower } : {}),
        ...(resolvedSelection.subtype ? { subtype: resolvedSelection.subtype } : {}),
        ...(resolvedSelection.upperStyle ? { upperStyle: resolvedSelection.upperStyle } : {}),
        ...(resolvedSelection.lowerStyle ? { lowerStyle: resolvedSelection.lowerStyle } : {}),
        turban: resolvedSelection.turban,
        ...(resolvedSelection.turbanStyle ? { turbanStyle: resolvedSelection.turbanStyle } : {}),
        shoes: resolvedSelection.shoes,
        ...(resolvedSelection.shoeStyle ? { shoeStyle: resolvedSelection.shoeStyle } : {}),
      };
      validateCatalogSelection(catalogSelection);

      if (resolvedSelection.upper.configurationProfileId) {
        if (!bespokeConfigurationText) {
          return jsonError("Please complete the bespoke suit configuration.", 400, rateHeaders);
        }
        const profile = resolvedSelection.catalog.configurationProfiles?.find((item) => item.id === resolvedSelection.upper.configurationProfileId);
        if (!profile) return jsonError("The bespoke suit configuration is unavailable. Please refresh and try again.", 503, rateHeaders);
        bespokeConfiguration = resolveBespokeConfiguration(profile, parseSubmittedBespokeConfiguration(bespokeConfigurationText));
        const composition = bespokeConfiguration.selections["suit-composition"];
        if (composition !== resolvedSelection.subtype?.id) {
          return jsonError("Please choose a suit composition that matches the bespoke configuration.", 400, rateHeaders);
        }
        const configuredShoe = bespokeConfiguration.selections["shoe-family"];
        if (configuredShoe && configuredShoe !== resolvedSelection.shoes.id) {
          return jsonError("Please choose shoes that match the bespoke configuration.", 400, rateHeaders);
        }
        const configuredTurban = bespokeConfiguration.selections["turban-family"];
        if (configuredTurban && configuredTurban !== resolvedSelection.turban.id) {
          return jsonError("Please choose a turban that matches the bespoke configuration.", 400, rateHeaders);
        }
        outfitSpecification = buildOutfitSpecification(catalogSelection, bespokeConfiguration);
        bespokeReferenceInputs = await buildBespokeReferenceInputs(selectBespokeReferenceImages(bespokeConfiguration, outfitSpecification.targetView));
      }
    } else if (selectionMode === "level1") {
      level1Resolved = await (dependencies.resolveLevel1Selection ?? resolveLevel1Design)(categoryId as string, designId as string, variantId ?? undefined);
    } else if (selectionMode === "split") {
      splitResolved = await (dependencies.resolveSplitSelection ?? resolveSplitOutfitRecipe)(splitRecipeText as string);
      selectionIds = { mode: "split", ...splitResolved.state };
      if (waistcoatFabric && !hasPhotographedWaistcoat(splitResolved)) {
        return jsonError("A waistcoat fabric can only be used when a waistcoat is selected.", 400, rateHeaders);
      }
    }
    if (idempotencyKey) {
      const blocked = await replayOrBlockIdempotency(user.username, idempotencyKey, state);
      if (blocked) return blocked;
    }

    if (!highResolution) {
      try {
        lease ??= await acquireGenerationLock(user.username);
      } catch (error) {
        if (error instanceof GenerationGuardUnavailableError) {
          console.error("generation_guard_unavailable", { requestId, route: "try-on" });
          return jsonError("Generation is temporarily unavailable. Please try again shortly.", 503);
        }
        throw error;
      }
      if (!lease) {
        if (idempotencyKey) {
          const blocked = await replayOrBlockIdempotency(user.username, idempotencyKey, state);
          if (blocked) return blocked;
        }
        return jsonError("A try-on is already in progress. Please wait for it to finish.", 409);
      }

      if (idempotencyKey) {
        const blocked = await replayOrBlockIdempotency(user.username, idempotencyKey, state);
        if (blocked) return blocked;
      }

      let rateLimit;
      try {
        rateLimit = await dependencies.rateLimit(user.username);
      } catch (error) {
        if (error instanceof RateLimitConfigurationError) {
          console.error("rate_limit_configuration_error", { requestId, route: "try-on" });
          return jsonError("Generation is temporarily unavailable. Please try again shortly.", 503);
        }
        throw error;
      }
      rateHeaders = generationRateHeaders(rateLimit);
      if (!rateLimit.allowed) {
        console.warn("try_on_rate_limited", {
          requestId,
          username: user.username,
          blockedBy: rateLimit.blockedBy,
        });
        return generationRateRejection(rateLimit, rateHeaders);
      }
    }

    if (input.claimUploads && !(await input.claimUploads())) {
      return jsonError(UPLOADS_UNAVAILABLE_MESSAGE, 409, rateHeaders);
    }

    // Level 1 resolves only trusted server-owned asset IDs. The actual private
    // blob reads happen after the lock and rate checks so a valid session cannot
    // use this endpoint to turn catalogue-reference reads into an unbounded
    // pre-generation workload. Asset-pending designs were rejected above,
    // before the guard/rate-limit path and before any provider call.
    const level1ReferenceInputs = level1Resolved
      ? [
        await (dependencies.readLevel1Reference ?? readLevel1Reference)(level1Resolved.primaryAsset, "curated-design"),
        ...await Promise.all(level1Resolved.detailAssets.map((asset) => (dependencies.readLevel1Reference ?? readLevel1Reference)(asset, "curated-detail"))),
      ]
      : [];
    // Image order contract: person, jacket, trousers, shirt, optional
    // waistcoat, footwear, then fabrics — see lib/split-outfit/image-map.ts.
    const readSplit = dependencies.readSplitReference ?? readSplitReference;
    const splitReferenceInputs = splitResolved
      ? [
        await readSplit(splitResolved.upper, "split-upper"),
        await readSplit(splitResolved.lower, "split-lower"),
        await readSplit(splitResolved.shirt, "split-shirt"),
        ...(splitResolved.waistcoat && splitResolved.waistcoat.id !== "SUIT_WAISTCOAT_NONE"
          ? [await readSplit(splitResolved.waistcoat, "split-waistcoat")]
          : []),
        await readSplit(splitResolved.footwear, "split-footwear"),
      ]
      : [];
    const references = level1Resolved
      ? level1ReferenceInputs
      : splitResolved
        ? splitReferenceInputs
        : [...await buildReferenceInputs(catalogSelection), ...bespokeReferenceInputs];
    const basePrompt = level1Resolved
      ? buildLevel1TryOnPrompt(level1Resolved, fabricRegion)
      : splitResolved
        ? buildSplitOutfitPrompt(splitResolved, {
          jacket: Boolean(fabric),
          trousers: Boolean(lowerFabric),
          shirt: Boolean(shirtFabric),
          waistcoat: Boolean(waistcoatFabric) && hasPhotographedWaistcoat(splitResolved),
        })
        : buildTryOnPrompt(catalogSelection, { outfitProvided: selectionMode === "outfit", bespokeReferenceCount: bespokeReferenceInputs.length });
    const prompt = outfitSpecification && bespokeConfiguration
      ? compileVisualizationPrompt(basePrompt, outfitSpecification, bespokeConfiguration)
      : basePrompt;

    if (idempotencyKey && lease) {
      await writeIdempotencyRecord(user.username, idempotencyKey, {
        status: "pending",
        leaseId: lease.leaseId,
      });
    }

    generationAttempted = true;
    state.generationStarted = true;
    const neutralizeSplit = selectionMode === "split";
    const neutralizeLevel1 = selectionMode === "level1" && (fabricRegion === "both" || fabricRegion === "jacket" || fabricRegion === "custom");
    const preparedReferences = await Promise.all(references.map(async (reference) => {
      const stripSplit = neutralizeSplit && (
        (reference.role === "split-upper" && fabric)
        || (reference.role === "split-lower" && lowerFabric)
        || (reference.role === "split-shirt" && shirtFabric)
        || (reference.role === "split-waistcoat" && waistcoatFabric)
      );
      const stripLevel1 = neutralizeLevel1 && (reference.role === "curated-design" || reference.role === "curated-detail");
      if (!stripSplit && !stripLevel1) return reference;
      return { ...reference, image: await grayscaleConstruction(reference.image) };
    }));
    const result = await dependencies.generate({
      person,
      fabricGuidance,
      backgroundControl,
      ...(selectionMode === "outfit" && outfit ? { outfit } : {}),
      ...(fabric ? { fabric } : {}),
      ...(lowerFabric ? { lowerFabric } : {}),
      ...(shirtFabric ? { shirtFabric } : {}),
      ...(waistcoatFabric ? { waistcoatFabric } : {}),
      references: preparedReferences,
      selection: selectionIds,
      catalogSelection,
      prompt,
      requestId,
    });
    let assets: GenerationAssetRefs | undefined;
    try {
      assets = (await storeGenerationAssets({
        generationId: requestId,
        person: person.file,
        ...(selectionMode === "outfit" && outfit ? { outfit: outfit.file } : {}),
        ...(fabric ? { fabric: fabric.file } : {}),
        ...(lowerFabric ? { lowerFabric: lowerFabric.file } : {}),
        ...(shirtFabric ? { shirtFabric: shirtFabric.file } : {}),
        ...(waistcoatFabric ? { waistcoatFabric: waistcoatFabric.file } : {}),
        references: references.map(({ role, image }) => ({ role, file: image.file })),
        resultBytes: result.bytes,
        resultContentType: result.contentType,
      })) ?? undefined;
    } catch (storageError) {
      console.error("try_on_image_history_storage_failed", {
        requestId,
        errorName: storageError instanceof Error ? storageError.name : "UnknownError",
      });
    }
    const generationSummary: NonNullable<UsageEvent["generation"]> = level1Resolved ? {
        mode: "level1",
        categoryId: level1Resolved.category.id,
        categoryName: level1Resolved.category.name,
        curatedDesignId: level1Resolved.design.id,
        curatedDesignName: level1Resolved.variant ? `${level1Resolved.design.customer.name} — ${level1Resolved.variant.name}` : level1Resolved.design.customer.name,
        ...(level1Resolved.variant ? { curatedVariantId: level1Resolved.variant.id, curatedVariantName: level1Resolved.variant.name } : {}),
        curatedDesignVersion: level1Resolved.design.version,
        curatedAssetStatus: "ready",
        fabricRegion,
      } : selectionMode === "catalog" && resolved ? {
        mode: "catalog",
        upperGarmentId: resolved.upper.id,
        upperGarmentName: resolved.upper.name,
        ...(resolved.lower ? { lowerGarmentId: resolved.lower.id, lowerGarmentName: resolved.lower.name } : {}),
        ...(resolved.subtype ? { garmentSubtypeId: resolved.subtype.id, garmentSubtypeName: resolved.subtype.name } : {}),
        ...(resolved.upperStyle ? { upperStyleId: resolved.upperStyle.id, upperStyleName: resolved.upperStyle.name } : {}),
        ...(resolved.lowerStyle ? { lowerStyleId: resolved.lowerStyle.id, lowerStyleName: resolved.lowerStyle.name } : {}),
        turbanId: resolved.turban.id,
        turbanName: resolved.turban.name,
        ...(resolved.turbanStyle ? { turbanStyleId: resolved.turbanStyle.id, turbanStyleName: resolved.turbanStyle.name } : {}),
        shoeId: resolved.shoes.id,
        shoeName: resolved.shoes.name,
        ...(resolved.shoeStyle ? { shoeStyleId: resolved.shoeStyle.id, shoeStyleName: resolved.shoeStyle.name } : {}),
        ...(outfitSpecification ? { outfitSpecification } : {}),
      } : splitResolved ? {
        mode: "split",
        splitFamily: splitResolved.state.family,
        splitUpperId: splitResolved.upper.id,
        splitUpperName: splitResolved.upper.customer.name,
        splitLowerId: splitResolved.lower.id,
        splitLowerName: splitResolved.lower.customer.name,
        splitShirtId: splitResolved.shirt.id,
        splitShirtName: splitResolved.shirt.customer.name,
        ...(splitResolved.waistcoat ? { splitWaistcoatId: splitResolved.waistcoat.id, splitWaistcoatName: splitResolved.waistcoat.customer.name } : {}),
        splitFootwearId: splitResolved.footwear.id,
        splitFootwearName: splitResolved.footwear.customer.name,
        splitAccessoryIds: splitResolved.accessories.map((accessory) => accessory.id),
        splitAccessoryNames: splitResolved.accessories.map((accessory) => accessory.customer.name),
        splitFabricSlots: {
          jacket: Boolean(fabric),
          trousers: Boolean(lowerFabric),
          shirt: Boolean(shirtFabric),
          waistcoat: Boolean(waistcoatFabric) && hasPhotographedWaistcoat(splitResolved),
        },
        fabricRegion,
      } : { mode: "outfit" };

    if (highResolution && !assets?.result) {
      // The provider has already been paid. Throwing here would discard the
      // image and push staff into a second paid run, so hand it back once.
      console.error("try_on_result_unsaved", { requestId, route: "try-on" });
      await recordUsageSafely(dependencies, request, user.username, requestId, "success", Date.now() - startedAt, result.metadata, generationSummary);
      if (idempotencyKey) {
        await writeIdempotencyRecord(user.username, idempotencyKey, {
          status: "failed",
          error: "This try-on was generated but could not be saved to History. It was only shown once.",
          httpStatus: 502,
        }).catch(() => console.error("generation_idempotency_store_failed", { requestId, route: "try-on" }));
      }
      return unsavedResultResponse(result.bytes, result.contentType, requestId, rateHeaders);
    }

    await recordUsageSafely(
      dependencies,
      request,
      user.username,
      requestId,
      "success",
      Date.now() - startedAt,
      result.metadata,
      generationSummary,
      assets,
    );
    console.info("try_on_generation", {
      requestId,
      username: user.username,
      success: true,
      ...result.metadata,
    });

    if (idempotencyKey) {
      try {
        await writeIdempotencyRecord(user.username, idempotencyKey, highResolution
          ? { status: "complete_generation", generationId: requestId }
          : {
            status: "complete",
            generationId: requestId,
            contentType: result.contentType,
            body: Buffer.from(result.bytes).toString("base64"),
          });
      } catch (error) {
        // The paid call already succeeded. Do not turn a store failure into a
        // client retry that would mint a new key and bill again.
        if (!(error instanceof GenerationGuardUnavailableError)) throw error;
        console.error("generation_idempotency_store_failed", { requestId, route: "try-on" });
      }
    }

    return highResolution
      ? generationResultResponse(requestId, result.metadata, rateHeaders)
      : imageResultResponse(result.bytes, result.contentType, rateHeaders);
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    if (error instanceof RequestBodyTooLargeError) {
      return jsonError("The uploaded images are too large. Please choose smaller images.", 413);
    }
    if (generationAttempted) {
      if (idempotencyKey) {
        const isTimeout = isTimeoutError(error);
        await writeIdempotencyRecord(user.username, idempotencyKey, {
          status: "failed",
          error: isTimeout
            ? "The generation took too long. Please try again."
            : "We couldn't create the try-on. Please try again.",
          httpStatus: isTimeout ? 504 : 502,
        }).catch(() => undefined);
      }
      await recordUsageSafely(
        dependencies,
        request,
        user.username,
        requestId,
        "failed",
        durationMs,
        {
          provider: "openai",
          model: IMAGE_CONFIG.model,
          quality: IMAGE_CONFIG.quality,
        },
      );
    }
    if (error instanceof UploadValidationError) {
      console.warn("try_on_validation_failed", {
        requestId,
        username: user.username,
        success: false,
        code: error.code,
        durationMs,
      });
      return jsonError(error.message, error.code === "file_too_large" ? 413 : 400, rateHeaders);
    }

    if (error instanceof CatalogCompatibilityError) {
      return jsonError(error.message, 400, rateHeaders);
    }

    if (error instanceof BespokeConfigurationError) {
      return jsonError(error.message, 400, rateHeaders);
    }

    if (error instanceof Level1CatalogueError) {
      return jsonError(error.message, error.code === "asset_unavailable" ? 503 : 400, rateHeaders);
    }

    if (error instanceof SplitOutfitError) {
      return jsonError(error.message, error.code === "asset_pending" ? 503 : 400, rateHeaders);
    }

    if (!generationAttempted && (error instanceof GenerationGuardUnavailableError || error instanceof RateLimitConfigurationError)) {
      console.error("generation_control_unavailable", { requestId, route: "try-on" });
      return jsonError("Generation is temporarily unavailable. Please try again shortly.", 503);
    }

    if (error instanceof MissingApiKeyError) {
      console.error("try_on_configuration_error", {
        requestId,
        username: user.username,
        success: false,
        provider: "openai",
        model: IMAGE_CONFIG.model,
        durationMs,
      });
      return jsonError("OpenAI API key is not configured.", 503, rateHeaders);
    }

    const errorMetadata = safeProviderError(error);
    const isTimeout = isTimeoutError(error);
    const isInvalidProviderImage = errorMetadata.code === "invalid_image_file";
    console.error("try_on_generation_failed", {
      requestId,
      username: user.username,
      success: false,
      provider: "openai",
      model: IMAGE_CONFIG.model,
      durationMs,
      ...errorMetadata,
    });

    return jsonError(
      isTimeout
        ? "The generation took too long. Please try again."
        : isInvalidProviderImage
          ? "One of the uploaded images could not be accepted by the image provider. Please use a standard JPG, PNG, or WebP image and try again."
        : "We couldn't create the try-on. Please try again.",
      isTimeout ? 504 : isInvalidProviderImage ? 400 : 502,
      rateHeaders,
    );
  } finally {
    // Lock release for highResolution is owned by handleHighResolutionRequest's finally block;
    // multipart lock release is owned by handleMultipartRequest's finally block.
  }
}
