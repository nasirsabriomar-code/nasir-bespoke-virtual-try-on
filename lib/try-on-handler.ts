import { readFile } from "node:fs/promises";
import path from "node:path";
import { AuthConfigurationError } from "@/lib/auth/config";
import { requireRequestUser } from "@/lib/auth/session";
import { CatalogCompatibilityError, validateCatalogSelection } from "@/lib/catalog/compatibility";
import { findCatalogSelection } from "@/lib/catalog/store";
import type { CatalogSelection, ReferenceImage, StyleOption, TryOnSelection } from "@/lib/catalog/types";
import { getPrivateLevel1Asset } from "@/lib/catalog/level1-assets";
import { Level1CatalogueError, type CuratedAsset, type ResolvedLevel1Design } from "@/lib/catalog/level1-types";
import { buildLevel1TryOnPrompt, type FabricRegion } from "@/lib/catalog/level1-prompt";
import { resolveLevel1Design } from "@/lib/catalog/level1-store";
import { MissingApiKeyError } from "@/lib/openai";
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
import { generateTryOn } from "@/lib/tryon";
import type { TryOnInput, TryOnOutput } from "@/lib/tryon/types";
import { buildTryOnPrompt } from "@/lib/tryon/prompt";
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
  getRequestDevice,
  recordUsageEvent,
  type UsageEvent,
  type UsageStatus,
} from "@/lib/usage-history";
import {
  MAX_REQUEST_BYTES,
  UploadValidationError,
  validateImageFile,
} from "@/lib/validation";

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
};

const DEFAULT_DEPENDENCIES: RouteDependencies = {
  authenticate: requireRequestUser,
  rateLimit: checkGenerationRateLimit,
  generate: generateTryOn,
  recordUsage: recordUsageEvent,
  resolveSelection: findCatalogSelection,
  resolveLevel1Selection: resolveLevel1Design,
  readLevel1Reference: readLevel1Reference,
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

function getExactlyOneFile(formData: FormData, name: string) {
  const values = formData.getAll(name);
  return values.length === 1 && values[0] instanceof File ? values[0] : null;
}

function hasUnexpectedFields(formData: FormData) {
  for (const [name] of formData.entries()) {
    if (![
      "person",
      "outfit",
      "fabric",
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
      "fabricRegion",
    ].includes(name)) return true;
  }
  return false;
}

function hasLevel1ForbiddenFields(formData: FormData) {
  const level1Fields = new Set(["person", "fabric", "selectionMode", "categoryId", "designId", "fabricRegion"]);
  for (const [name] of formData.entries()) {
    if (!level1Fields.has(name)) return true;
  }
  return false;
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
  const bytes = await new Response(blob.stream).arrayBuffer();
  const contentType = privateAsset.asset.contentType;
  if (!contentType) throw new Level1CatalogueError("asset_unavailable", "The approved catalogue reference is temporarily unavailable. Please try again shortly.");
  return {
    role,
    image: {
      file: new File([bytes], `${asset.id}.${contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg"}`, { type: contentType }),
      mime: contentType,
    },
  };
}

function safeProviderError(error: unknown) {
  const record = error && typeof error === "object" ? error as Record<string, unknown> : null;
  return {
    errorName: error instanceof Error ? error.name : "UnknownError",
    status: typeof record?.status === "number" ? record.status : undefined,
    code: typeof record?.code === "string" ? record.code : undefined,
    providerRequestId: typeof record?.request_id === "string" ? record.request_id : undefined,
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
  try {
    await dependencies.recordUsage({
      id: requestId,
      occurredAt: new Date().toISOString(),
      username,
      status,
      device: getRequestDevice(request),
      durationMs,
      provider: metadata?.provider ?? "openai",
      model: metadata?.model ?? "gpt-image-2.5-sunburst",
      quality: metadata?.quality ?? "medium",
      generation,
      assets,
    });
  } catch (error) {
    // Usage history must never make a try-on fail after the model has run.
    console.error("try_on_usage_history_failed", {
      requestId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
  }
}

export async function handleTryOnRequest(
  request: Request,
  dependencies: RouteDependencies = DEFAULT_DEPENDENCIES,
) {
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
      const blocked = await replayOrBlockIdempotency(user.username, idempotencyKey);
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

  const startedAt = Date.now();
  let generationAttempted = false;
  let lease: GenerationLease | null = null;
  let rateHeaders: HeadersInit = {};
  try {
    const formData = await request.formData();
    const selectionModeValue = getExactlyOneText(formData, "selectionMode", false);
    if (selectionModeValue === null || (selectionModeValue && selectionModeValue !== "catalog" && selectionModeValue !== "outfit" && selectionModeValue !== "level1")) {
      return jsonError("Please choose a valid generation mode.", 400, rateHeaders);
    }
    const selectionMode: "catalog" | "outfit" | "level1" = selectionModeValue === "level1"
      ? "level1"
      : selectionModeValue === "outfit"
      ? "outfit"
      : selectionModeValue === "catalog"
        ? "catalog"
        : getExactlyOneFile(formData, "outfit") ? "outfit" : "catalog";
    const personFile = getExactlyOneFile(formData, "person");
    const outfitFile = getExactlyOneFile(formData, "outfit");
    const fabricFile = getExactlyOneFile(formData, "fabric");
    const upperGarmentId = getExactlyOneText(formData, "upperGarmentId", false);
    const lowerGarmentId = getExactlyOneText(formData, "lowerGarmentId", false);
    const garmentSubtypeId = getExactlyOneText(formData, "garmentSubtypeId", false);
    const upperStyleId = getExactlyOneText(formData, "upperStyleId", false);
    const lowerStyleId = getExactlyOneText(formData, "lowerStyleId", false);
    const turbanStyleId = getExactlyOneText(formData, "turbanStyleId", false);
    const shoeStyleId = getExactlyOneText(formData, "shoeStyleId", false);
    const turbanId = getExactlyOneText(formData, "turbanId", false);
    const shoeId = getExactlyOneText(formData, "shoeId", false);
    const bespokeConfigurationText = getExactlyOneText(formData, "bespokeConfiguration", false);
    const categoryId = getExactlyOneText(formData, "categoryId", false);
    const designId = getExactlyOneText(formData, "designId", false);

    const invalidCommonInput = !personFile || !fabricFile || bespokeConfigurationText === null || hasUnexpectedFields(formData);
    const invalidModeInput = selectionMode === "outfit"
      ? !outfitFile
      : selectionMode === "level1"
        ? !categoryId || !designId || hasLevel1ForbiddenFields(formData)
        : !upperGarmentId || !turbanId || !shoeId;
    if (invalidCommonInput || invalidModeInput) {
      return jsonError(
        selectionMode === "outfit"
          ? "Please upload a person photo, outfit photo, and fabric photo."
          : selectionMode === "level1"
            ? "Please upload a person photo and fabric photo, then choose a curated design."
            : "Please upload a person photo and fabric photo, then choose a men's garment and accessories.",
        400,
        rateHeaders,
      );
    }

    const fabricRegionValue = getExactlyOneText(formData, "fabricRegion", false);
    if (fabricRegionValue === null || (fabricRegionValue && !["upper", "lower", "both"].includes(fabricRegionValue))) {
      return jsonError("Please choose a valid fabric application: upper, lower, or both.", 400, rateHeaders);
    }
    const fabricRegion: FabricRegion = fabricRegionValue === "upper" || fabricRegionValue === "lower" ? fabricRegionValue : "both";

    const [person, outfit, fabric] = await Promise.all([
      validateImageFile(personFile, "a person photo"),
      selectionMode === "outfit" && outfitFile ? validateImageFile(outfitFile, "an outfit photo") : Promise.resolve(undefined),
      validateImageFile(fabricFile, "a fabric photo"),
    ]);

    const selectionIds: TryOnSelection = selectionMode === "level1"
      ? { mode: "level1", categoryId: categoryId as string, designId: designId as string }
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
      level1Resolved = await (dependencies.resolveLevel1Selection ?? resolveLevel1Design)(categoryId as string, designId as string);
    }
    if (idempotencyKey) {
      const blocked = await replayOrBlockIdempotency(user.username, idempotencyKey);
      if (blocked) return blocked;
    }

    try {
      lease = await acquireGenerationLock(user.username);
    } catch (error) {
      if (error instanceof GenerationGuardUnavailableError) {
        console.error("generation_guard_unavailable", { requestId, route: "try-on" });
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
    rateHeaders = {
      "X-RateLimit-Limit": String(rateLimit.limit),
      "X-RateLimit-Remaining": String(rateLimit.remaining),
      "X-RateLimit-Reset": String(Math.ceil(rateLimit.resetAt / 1000)),
    };
    if (!rateLimit.allowed) {
      console.warn("try_on_rate_limited", {
        requestId,
        username: user.username,
        blockedBy: rateLimit.blockedBy,
      });
      return jsonError(
        "You've made several try-ons in a short period. Please wait a moment and try again.",
        429,
        {
          ...rateHeaders,
          "Retry-After": String(Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000))),
        },
      );
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
    const references = level1Resolved
      ? level1ReferenceInputs
      : [...await buildReferenceInputs(catalogSelection), ...bespokeReferenceInputs];
    const basePrompt = level1Resolved
      ? buildLevel1TryOnPrompt(level1Resolved, fabricRegion)
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
    const result = await dependencies.generate({
      person,
      ...(selectionMode === "outfit" && outfit ? { outfit } : {}),
      fabric,
      references,
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
        fabric: fabric.file,
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
    await recordUsageSafely(
      dependencies,
      request,
      user.username,
      requestId,
      "success",
      Date.now() - startedAt,
      result.metadata,
      level1Resolved ? {
        mode: "level1",
        categoryId: level1Resolved.category.id,
        categoryName: level1Resolved.category.name,
        curatedDesignId: level1Resolved.design.id,
        curatedDesignName: level1Resolved.design.customer.name,
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
      } : { mode: "outfit" },
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
        await writeIdempotencyRecord(user.username, idempotencyKey, {
          status: "complete",
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

    return imageResultResponse(result.bytes, result.contentType, rateHeaders);
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    if (generationAttempted) {
      if (idempotencyKey) {
        const isTimeout = error instanceof Error && error.name.toLowerCase().includes("timeout");
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
          model: "gpt-image-2.5-sunburst",
          quality: "medium",
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
        model: "gpt-image-2.5-sunburst",
        durationMs,
      });
      return jsonError("OpenAI API key is not configured.", 503, rateHeaders);
    }

    const errorMetadata = safeProviderError(error);
    const isTimeout = errorMetadata.errorName.toLowerCase().includes("timeout");
    console.error("try_on_generation_failed", {
      requestId,
      username: user.username,
      success: false,
      provider: "openai",
      model: "gpt-image-2.5-sunburst",
      durationMs,
      ...errorMetadata,
    });

    return jsonError(
      isTimeout
        ? "The generation took too long. Please try again."
        : "We couldn't create the try-on. Please try again.",
      isTimeout ? 504 : 502,
      rateHeaders,
    );
  } finally {
    if (lease) {
      try {
        await releaseGenerationLock(lease);
      } catch (error) {
        console.error("generation_lock_release_failed", {
          requestId,
          errorName: error instanceof Error ? error.name : "UnknownError",
        });
      }
    }
  }
}
