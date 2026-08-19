import "server-only";

import type { TryOnImage, TryOnInput } from "@/lib/tryon/types";
import { SPLIT_CATALOGUE_BY_FAMILY } from "./catalogue";
import {
  deriveActiveMaterialSlots,
  findSplitOption,
  getCanonicalMaterialGroups,
  getMaterialLinkGroups,
  getMissingRequiredComponents,
  getSplitOutfitRecipeStatus,
} from "./compatibility";
import { getSplitReferencePolicy } from "./reference-policy";
import {
  resolveSplitReferenceAsset,
  SplitReferenceAssetError,
  type SplitReferenceAssetErrorCode,
  type SplitReferenceAssetReader,
} from "./reference-assets";
import type {
  CanonicalMaterialGroup,
  MaterialSlotId,
  MaterialSlotState,
  SplitComponentOption,
  SplitOutfitFamily,
  SplitOutfitState,
} from "./types";

/**
 * Split Outfit generation compiler (Phase 2a foundation).
 *
 * Responsibilities: (A) validate/normalize an untrusted client request into
 * a server-owned NormalizedSplitRecipe, (B) derive canonical material groups
 * server-side, (C) build deterministic per-component construction metadata,
 * (D) build ONE ordered authority list that both the image array and the
 * prompt's numbered role mapping are derived from (they cannot drift because
 * they are two views of the same list), (E) compile the Split prompt, and
 * (F) assemble a provider-ready generation plan.
 *
 * This module deliberately does NOT: authenticate requests, rate-limit,
 * acquire/release Redis generation locks, write usage history, or invoke the
 * OpenAI provider. Those remain the route handler's job (lib/split-try-on-handler.ts)
 * so this module can be fully unit-tested without any request/session context
 * and without any real Blob or provider access.
 */

// ============================================================
// A. CLIENT REQUEST → NORMALIZED RECIPE
// ============================================================

/** The untrusted shape a client may submit. Nothing else is accepted. */
export type SplitTryOnClientRequest = {
  family: string;
  upperId: string;
  lowerId: string;
  shirtId: string;
  waistcoatId: string | null;
  footwearId: string;
  accessoryIds: string[];
};

export type SplitRecipeValidationErrorCode =
  | "malformed_request"
  | "unknown_family"
  | "unknown_component"
  | "recipe_incomplete"
  | "recipe_conflict";

export class SplitRecipeValidationError extends Error {
  constructor(
    public readonly code: SplitRecipeValidationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SplitRecipeValidationError";
  }
}

/**
 * A server-owned, fully-validated Split recipe. `recipeStatus` is the
 * literal "VALID" by construction — validateSplitRecipe() is the ONLY way
 * to produce one, and it throws for anything INCOMPLETE or CONFLICT rather
 * than ever returning a partially-valid value. Downstream code (authority
 * planning, prompt compilation, reference resolution) can therefore assume
 * every component is mutually compatible without re-checking.
 */
export type NormalizedSplitRecipe = {
  family: SplitOutfitFamily;
  components: {
    upper: SplitComponentOption;
    lower: SplitComponentOption;
    shirt: SplitComponentOption;
    waistcoat: SplitComponentOption | null;
    footwear: SplitComponentOption;
    accessories: SplitComponentOption[];
  };
  activeMaterialSlots: MaterialSlotState[];
  materialLinkGroups: MaterialSlotId[][];
  materialGroups: CanonicalMaterialGroup[];
  recipeStatus: "VALID";
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isKnownFamily(value: string): value is SplitOutfitFamily {
  return Object.prototype.hasOwnProperty.call(SPLIT_CATALOGUE_BY_FAMILY, value);
}

/**
 * Validates an untrusted client request and returns a NormalizedSplitRecipe,
 * or throws SplitRecipeValidationError. This is the ONLY entry point that may
 * construct a NormalizedSplitRecipe — there is no other constructor, and the
 * type's `recipeStatus: "VALID"` literal makes an invalid recipe impossible
 * to represent once past this function.
 *
 * Re-runs the SAME deterministic compatibility rule engine
 * (lib/split-outfit/compatibility.ts) the client UI already uses — there is
 * no second, server-authored rule table. A client asserting "this is valid"
 * is never trusted; validity is independently recomputed from the submitted
 * component IDs alone.
 */
export function validateSplitRecipe(request: unknown): NormalizedSplitRecipe {
  if (!request || typeof request !== "object") {
    throw new SplitRecipeValidationError("malformed_request", "The submitted recipe is malformed.");
  }
  const record = request as Record<string, unknown>;
  const { family, upperId, lowerId, shirtId, waistcoatId, footwearId, accessoryIds } = record;

  if (
    !isNonEmptyString(family) ||
    !isNonEmptyString(upperId) ||
    !isNonEmptyString(lowerId) ||
    !isNonEmptyString(shirtId) ||
    !isNonEmptyString(footwearId) ||
    (waistcoatId !== null && !isNonEmptyString(waistcoatId)) ||
    !Array.isArray(accessoryIds) ||
    !accessoryIds.every(isNonEmptyString)
  ) {
    throw new SplitRecipeValidationError("malformed_request", "The submitted recipe is malformed.");
  }

  if (!isKnownFamily(family)) {
    throw new SplitRecipeValidationError("unknown_family", "Unknown outfit family.");
  }

  if (new Set(accessoryIds).size !== accessoryIds.length) {
    throw new SplitRecipeValidationError("malformed_request", "Duplicate accessory selection.");
  }

  // findSplitOption scopes its lookup to SPLIT_CATALOGUE_BY_FAMILY[family]
  // only, so an ID that exists but belongs to a different family (or does
  // not exist at all) resolves to null here — both "unknown" and
  // "cross-family" component attempts fail identically and safely.
  const upper = findSplitOption(family, upperId);
  const lower = findSplitOption(family, lowerId);
  const shirt = findSplitOption(family, shirtId);
  const waistcoat = waistcoatId === null ? null : findSplitOption(family, waistcoatId);
  const footwear = findSplitOption(family, footwearId);
  const accessories = accessoryIds.map((id) => findSplitOption(family, id));

  if (!upper || upper.categoryId !== "upper") {
    throw new SplitRecipeValidationError("unknown_component", "Unknown or invalid upper garment.");
  }
  if (!lower || lower.categoryId !== "lower") {
    throw new SplitRecipeValidationError("unknown_component", "Unknown or invalid lower garment.");
  }
  if (!shirt || shirt.categoryId !== "inner-shirt") {
    throw new SplitRecipeValidationError("unknown_component", "Unknown or invalid shirt.");
  }
  if (waistcoatId !== null && (!waistcoat || waistcoat.categoryId !== "inner-waistcoat")) {
    throw new SplitRecipeValidationError("unknown_component", "Unknown or invalid waistcoat.");
  }
  if (!footwear || footwear.categoryId !== "footwear") {
    throw new SplitRecipeValidationError("unknown_component", "Unknown or invalid footwear.");
  }
  if (accessories.some((accessory) => !accessory || accessory.categoryId !== "accessory")) {
    throw new SplitRecipeValidationError("unknown_component", "Unknown or invalid accessory.");
  }

  const resolvedAccessories = accessories as SplitComponentOption[];

  // Reconstruct a plain SplitOutfitState from ONLY the validated IDs — never
  // sanitized. sanitizeSplitOutfitState() silently repairs stale state for
  // UX; the server must instead honestly detect and reject a combination
  // that was never valid, which is exactly what getSplitOutfitRecipeStatus
  // (unsanitized) already does for the client's own CONFLICT display.
  const state: SplitOutfitState = {
    family,
    upperId: upper.id,
    lowerId: lower.id,
    shirtId: shirt.id,
    waistcoatId: waistcoat ? waistcoat.id : null,
    footwearId: footwear.id,
    accessoryIds: resolvedAccessories.map((accessory) => accessory.id),
    materials: {},
  };

  const status = getSplitOutfitRecipeStatus(state);
  if (status === "CONFLICT") {
    throw new SplitRecipeValidationError("recipe_conflict", "This component combination is not valid together.");
  }
  if (status === "INCOMPLETE") {
    const missing = getMissingRequiredComponents(state);
    throw new SplitRecipeValidationError("recipe_incomplete", `This recipe is missing: ${missing.join(", ")}.`);
  }

  return {
    family,
    components: { upper, lower, shirt, waistcoat, footwear, accessories: resolvedAccessories },
    activeMaterialSlots: deriveActiveMaterialSlots(state),
    materialLinkGroups: getMaterialLinkGroups(state),
    materialGroups: getCanonicalMaterialGroups(state),
    recipeStatus: "VALID",
  };
}

// ============================================================
// B. MATERIAL GROUP (UPLOAD) VALIDATION
// ============================================================

export type MaterialGroupValidationErrorCode =
  | "unexpected_material_group"
  | "missing_material_group"
  | "extra_material_group";

export class MaterialGroupValidationError extends Error {
  constructor(
    public readonly code: MaterialGroupValidationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "MaterialGroupValidationError";
  }
}

/**
 * Validates a client-submitted {canonicalGroupId -> File} map against the
 * groups independently derived by validateSplitRecipe() (via
 * getCanonicalMaterialGroups). The server never trusts a client-declared
 * group name or grouping — every expected group ID here was recomputed from
 * the validated recipe, not read from client input. Rejects unexpected,
 * missing, or extra groups outright; never silently repairs the submission.
 * (Rejecting more than one file for the same field name is the route
 * handler's job at FormData-parsing time, before a Map is even built here.)
 */
export function validateMaterialUploads(
  recipe: NormalizedSplitRecipe,
  uploads: ReadonlyMap<string, File>,
): ReadonlyMap<string, File> {
  const expectedGroupIds = new Set(recipe.materialGroups.map((group) => group.groupId));
  const submittedGroupIds = new Set(uploads.keys());

  for (const groupId of submittedGroupIds) {
    if (!expectedGroupIds.has(groupId)) {
      throw new MaterialGroupValidationError("unexpected_material_group", `Unexpected material group: ${groupId}.`);
    }
  }
  for (const groupId of expectedGroupIds) {
    if (!submittedGroupIds.has(groupId)) {
      throw new MaterialGroupValidationError("missing_material_group", `Missing required material group: ${groupId}.`);
    }
  }
  if (submittedGroupIds.size !== expectedGroupIds.size) {
    throw new MaterialGroupValidationError("extra_material_group", "An unexpected number of material groups were submitted.");
  }
  return uploads;
}

// ============================================================
// D. ORDERED AUTHORITY MODEL
// ------------------------------------------------------------
// ONE ordered list drives both the provider image array AND the prompt's
// numbered "Image N" role mapping — there is no second, independently
// authored ordering anywhere. See buildSplitReferences() and
// compileSplitPrompt(), which both derive purely from this same array.
// ============================================================

export type CompiledSplitImageSource =
  | { kind: "customer" }
  | { kind: "construction-reference"; componentId: string; assetRole: "split-upper-construction" | "split-waistcoat-construction" }
  | { kind: "material"; groupId: string };

export type CompiledSplitAuthority = {
  /** Unique, stable key — also used as the reference filename/role label. */
  role: string;
  /** Component IDs (or "customer") this authority governs and ONLY this authority governs. */
  governs: string[];
  /** Declared image intent. Absent for text-only authorities. Resolved separately (async). */
  imageSource?: CompiledSplitImageSource;
  /** Authority prose. Always present, image-bearing or not. */
  instructions: string;
};

export type ResolvedSplitAuthority = CompiledSplitAuthority & {
  /** Present iff imageSource was declared AND resolution actually found bytes. */
  resolvedImage?: TryOnImage;
  /**
   * Present iff this authority declared a "construction-reference" image
   * intent and resolution failed with a typed error (asset not registered/
   * pending/unavailable, or a failed integrity check). Never set for
   * "customer"/"material" kinds — those resolve directly from validated
   * client input, not the reference-asset registry. Draft compilation uses
   * this only to fall back to text-only; provider-readiness uses it to
   * classify MISSING_REQUIRED_REFERENCE vs REFERENCE_INTEGRITY_FAILURE.
   */
  imageResolutionError?: { code: SplitReferenceAssetErrorCode };
};

const CUSTOMER_AUTHORITY_TEXT = [
  "CUSTOMER PHOTO AUTHORITY — CRITICAL:",
  "This image is the sole authority for the customer's identity, face, skin tone, age appearance, hair, facial hair, natural body size, build, proportions, height, pose, posture, expression, hands, camera perspective, framing, lighting, shadows, and background.",
  "PERMANENT RULE: the garment must adapt to the customer. The customer must never be altered, slimmed, reshaped, beautified, or replaced to match the garment, a reference photo, or a mannequin. No reference person may influence body, identity, or pose.",
].join(" ");

function constructionAuthorityText(option: SplitComponentOption, hasImage: boolean) {
  const subtitle = option.subtitle ? `${option.subtitle}. ` : "";
  const base = `${option.name} — ${subtitle}${option.description}`;
  const details = option.details?.length ? ` Key construction details: ${option.details.join(", ")}.` : "";
  return hasImage
    ? `CONSTRUCTION AUTHORITY (image + text) — governs ONLY this garment piece; ignore any body, pose, person, or scene visible in the reference image, and never let it influence any other garment piece: ${base}${details}`
    : `CONSTRUCTION INSTRUCTION (text-only, no reference image) — governs ONLY this garment piece: ${base}${details}`;
}

function materialAuthorityText(group: CanonicalMaterialGroup) {
  return `MATERIAL AUTHORITY — this uploaded swatch is the sole colour, pattern, weave, texture, sheen, and finish authority for: ${group.label}. Ignore any person, body, garment construction, or scene visible in the swatch photo. Do not apply this material to any garment piece outside this group.`;
}

const RENDERED_ACCESSORY_IDS = new Set(["SUIT_ACC_TIE", "SUIT_ACC_BOW_TIE", "SUIT_ACC_POCKET_SQUARE"]);

function accessoryInstructionText(option: SplitComponentOption) {
  return RENDERED_ACCESSORY_IDS.has(option.id)
    ? `ACCESSORY (renders in the final image, text-only construction) — governs ONLY this accessory: ${option.name} — ${option.description}`
    : `ACCESSORY STYLING DETAIL (secondary styling instruction, not a distinct visual focus) — governs ONLY this accessory: ${option.name} — ${option.description}`;
}

/**
 * Builds the complete, deterministic, ordered authority list for a
 * NormalizedSplitRecipe. Pure and synchronous — no I/O, no Blob access, no
 * provider call.
 *
 * Fixed order: customer, then material authorities (suit fabric before
 * shirt fabric — see getCanonicalMaterialGroups, whose canonical IDs
 * already sort "jacket-primary..." before "shirt-material" with no extra
 * ordering logic needed here), then REQUIRED construction references
 * (upper, then waistcoat when a real one is selected), then TEXT_ONLY
 * construction instructions (lower, shirt, footwear), then accessories.
 * Customer is always first, so customer is always "Image 1" once imaged
 * authorities are numbered; the two material swatches are always Image 2
 * and Image 3 when both resolve.
 */
export function buildSplitAuthorityPlan(recipe: NormalizedSplitRecipe): CompiledSplitAuthority[] {
  const authorities: CompiledSplitAuthority[] = [];

  authorities.push({
    role: "customer",
    governs: ["customer"],
    imageSource: { kind: "customer" },
    instructions: CUSTOMER_AUTHORITY_TEXT,
  });

  for (const group of recipe.materialGroups) {
    authorities.push({
      role: `material:${group.groupId}`,
      governs: group.slotIds,
      imageSource: { kind: "material", groupId: group.groupId },
      instructions: materialAuthorityText(group),
    });
  }

  // Required image-construction authorities. Policy is looked up from the
  // single reference-policy table (lib/split-outfit/reference-policy.ts) —
  // never hardcoded here — so a component's image-vs-text treatment always
  // comes from one place.
  const upperPolicy = getSplitReferencePolicy(recipe.components.upper.id);
  authorities.push({
    role: `construction:${recipe.components.upper.id}`,
    governs: [recipe.components.upper.id],
    ...(upperPolicy !== "TEXT_ONLY"
      ? { imageSource: { kind: "construction-reference" as const, componentId: recipe.components.upper.id, assetRole: "split-upper-construction" as const } }
      : {}),
    instructions: constructionAuthorityText(recipe.components.upper, upperPolicy !== "TEXT_ONLY"),
  });

  // "SUIT_WAISTCOAT_NONE" is a real catalogue option (an explicit "no
  // waistcoat" choice), not a null/absent value — same convention as
  // deriveActiveMaterialSlots in compatibility.ts. getSplitReferencePolicy
  // structurally returns TEXT_ONLY for it, so it can never require or
  // resolve a reference — but it also gets no authority entry at all here,
  // since there is no physical garment to describe.
  if (recipe.components.waistcoat && recipe.components.waistcoat.id !== "SUIT_WAISTCOAT_NONE") {
    const waistcoatPolicy = getSplitReferencePolicy(recipe.components.waistcoat.id);
    authorities.push({
      role: `construction:${recipe.components.waistcoat.id}`,
      governs: [recipe.components.waistcoat.id],
      ...(waistcoatPolicy !== "TEXT_ONLY"
        ? { imageSource: { kind: "construction-reference" as const, componentId: recipe.components.waistcoat.id, assetRole: "split-waistcoat-construction" as const } }
        : {}),
      instructions: constructionAuthorityText(recipe.components.waistcoat, waistcoatPolicy !== "TEXT_ONLY"),
    });
  }

  authorities.push({
    role: `construction:${recipe.components.lower.id}`,
    governs: [recipe.components.lower.id],
    instructions: constructionAuthorityText(recipe.components.lower, false),
  });
  authorities.push({
    role: `construction:${recipe.components.shirt.id}`,
    governs: [recipe.components.shirt.id],
    instructions: constructionAuthorityText(recipe.components.shirt, false),
  });
  authorities.push({
    role: `construction:${recipe.components.footwear.id}`,
    governs: [recipe.components.footwear.id],
    instructions: constructionAuthorityText(recipe.components.footwear, false),
  });

  for (const accessory of recipe.components.accessories) {
    authorities.push({
      role: `accessory:${accessory.id}`,
      governs: [accessory.id],
      instructions: accessoryInstructionText(accessory),
    });
  }

  return authorities;
}

// ============================================================
// Authority image resolution (async — the only I/O in this module)
// ============================================================

export type SplitAuthorityResolutionInputs = {
  person: TryOnImage;
  /** Canonical groupId -> validated, already-magic-byte-checked image. */
  materialUploads: ReadonlyMap<string, TryOnImage>;
  /** Injectable for tests; defaults to the real Blob-backed reader. */
  referenceReader?: SplitReferenceAssetReader;
};

/**
 * Resolves declared image intents into actual bytes. A construction
 * reference with no registered asset yet (the common case today — see
 * lib/split-outfit/reference-assets.ts, empty registry) resolves to no
 * image and the authority stays text-only for DRAFT purposes; its
 * `instructions` prose is unchanged, so no information is lost, only the
 * image authority. A registered-but-not-ready or integrity-failed asset is
 * caught (never left to crash the whole compile) and recorded on
 * `imageResolutionError` so provider-readiness can classify it precisely —
 * draft compilation must stay resilient even when a REQUIRED reference is
 * broken; only prepareProviderReadySplitGeneration() enforces the policy.
 */
export async function resolveSplitAuthorityImages(
  authorities: CompiledSplitAuthority[],
  inputs: SplitAuthorityResolutionInputs,
): Promise<ResolvedSplitAuthority[]> {
  const resolved: ResolvedSplitAuthority[] = [];
  for (const authority of authorities) {
    if (!authority.imageSource) {
      resolved.push({ ...authority });
      continue;
    }
    if (authority.imageSource.kind === "customer") {
      resolved.push({ ...authority, resolvedImage: inputs.person });
      continue;
    }
    if (authority.imageSource.kind === "material") {
      const image = inputs.materialUploads.get(authority.imageSource.groupId);
      resolved.push(image ? { ...authority, resolvedImage: image } : { ...authority });
      continue;
    }
    try {
      const found = await resolveSplitReferenceAsset(
        authority.imageSource.componentId,
        authority.imageSource.assetRole,
        inputs.referenceReader,
      );
      if (!found) {
        resolved.push({ ...authority });
        continue;
      }
      resolved.push({
        ...authority,
        resolvedImage: {
          file: new File([new Uint8Array(found.bytes)], `${authority.imageSource.componentId}-construction`, { type: found.contentType }),
          mime: found.contentType,
        },
      });
    } catch (error) {
      if (error instanceof SplitReferenceAssetError) {
        resolved.push({ ...authority, imageResolutionError: { code: error.code } });
        continue;
      }
      throw error;
    }
  }
  return resolved;
}

// ============================================================
// E. PROMPT COMPILATION
// ============================================================

/**
 * Compiles the Split prompt from the SAME resolved authority list that
 * produces the image array (buildSplitReferences). Image numbering is
 * derived purely by filtering this one array for resolvedImage, in order —
 * there is no second, independently maintained numbering scheme, closing
 * the exact drift risk identified in the Full Outfit prompt/provider pair.
 */
export function compileSplitPrompt(authorities: ResolvedSplitAuthority[]): string {
  const imaged = authorities.filter((authority) => authority.resolvedImage);
  const roleLines = [
    "IMAGE ROLE MAPPING (critical):",
    ...imaged.map((authority, index) => `Image ${index + 1} — ${authority.role}.`),
  ];

  return [
    "You are the controlled visualization engine for NASIR BESPOKE, a luxury men's bespoke tailoring business. This is exclusively a men's clothing and men's formalwear system. Generate one photorealistic edit, not a new studio portrait or fashion editorial.",
    "EDIT PRIORITY (non-negotiable): Image 1 (the customer photo) remains the same photograph, subject, composition, camera, lighting, environment, and scene except where a construction or material authority below explicitly instructs a garment change.",
    roleLines.join("\n"),
    ...authorities.map((authority) => authority.instructions),
    "REALISM: use physically credible bespoke tailoring around the customer's actual frame — natural shoulder placement, sleeves, folds, drape, gravity, compression, tension, closures, waist behavior, trouser break, and hem. Preserve anatomically correct hands and limbs. Do not add duplicate clothing, random accessories not listed above, invented embroidery, extra limbs, text, a border, a collage, split screen, or an explanation. Return only one finished photograph.",
  ].join("\n\n");
}

/**
 * Builds the ordered reference-image array for the provider, from the same
 * resolved authority list compileSplitPrompt() reads. The customer image is
 * excluded here (it is TryOnInput's separate top-level `person` field, as
 * with every existing Full Outfit / Level1 generation) but still occupies
 * "Image 1" in the prompt numbering above, since numbering is computed over
 * ALL imaged authorities including the customer one.
 */
export function buildSplitReferences(authorities: ResolvedSplitAuthority[]): TryOnInput["references"] {
  const references: TryOnInput["references"] = [];
  for (const authority of authorities) {
    if (!authority.resolvedImage || authority.imageSource?.kind === "customer") continue;
    if (authority.imageSource?.kind === "material") {
      references.push({ role: "split-material", image: authority.resolvedImage });
      continue;
    }
    if (authority.imageSource?.kind === "construction-reference") {
      references.push({ role: authority.imageSource.assetRole, image: authority.resolvedImage });
    }
  }
  return references;
}

// ============================================================
// F. GENERATION READINESS
// ------------------------------------------------------------
// Draft compilation (compileSplitGenerationDraft) may describe an
// unresolved REQUIRED image authority — this is what keeps compilation
// usable in tests/development without any real reference photography.
// Provider-ready compilation (prepareProviderReadySplitGeneration) is the
// ONLY path that may ever be handed to the actual provider, and it fails
// closed — never silently downgrading a REQUIRED authority to text-only —
// whenever readiness is not READY.
// ============================================================

export type SplitGenerationReadiness =
  | { status: "READY" }
  | { status: "MISSING_REQUIRED_REFERENCE"; componentIds: string[] }
  | { status: "REFERENCE_INTEGRITY_FAILURE"; componentIds: string[] };

const INTEGRITY_ERROR_CODES = new Set<SplitReferenceAssetErrorCode>(["checksum_mismatch", "content_mismatch"]);

/**
 * Computes provider readiness from a resolved authority list. Only
 * `governs`-scoped catalogue component IDs (e.g. "SUIT_UPPER_CLASSIC") ever
 * appear in the result — never a private path, checksum, token, or any
 * other Blob/storage internal, so this is always safe to surface (even
 * indirectly) to the browser as a generic "not ready" state.
 */
export function computeSplitGenerationReadiness(authorities: ResolvedSplitAuthority[]): SplitGenerationReadiness {
  const missing: string[] = [];
  const integrityFailed: string[] = [];

  for (const authority of authorities) {
    if (authority.imageSource?.kind !== "construction-reference") continue;
    const componentId = authority.imageSource.componentId;
    if (getSplitReferencePolicy(componentId) !== "REQUIRED") continue;
    if (authority.resolvedImage) continue;

    if (authority.imageResolutionError && INTEGRITY_ERROR_CODES.has(authority.imageResolutionError.code)) {
      integrityFailed.push(componentId);
    } else {
      // Covers: no registry entry at all, pending/inactive, or a transient
      // Blob-unavailable error — all "the required reference isn't usable
      // right now," as distinct from "it exists but failed verification."
      missing.push(componentId);
    }
  }

  if (integrityFailed.length > 0) return { status: "REFERENCE_INTEGRITY_FAILURE", componentIds: integrityFailed };
  if (missing.length > 0) return { status: "MISSING_REQUIRED_REFERENCE", componentIds: missing };
  return { status: "READY" };
}

export class SplitGenerationNotReadyError extends Error {
  constructor(public readonly readiness: Exclude<SplitGenerationReadiness, { status: "READY" }>) {
    super("Split generation is not provider-ready.");
    this.name = "SplitGenerationNotReadyError";
  }
}

// ============================================================
// G. GENERATION PLAN ASSEMBLY (no provider invocation, ever, in this module)
// ============================================================

export type SplitGenerationPlan = {
  recipe: NormalizedSplitRecipe;
  authorities: ResolvedSplitAuthority[];
  person: TryOnImage;
  references: TryOnInput["references"];
  prompt: string;
};

export type SplitGenerationDraft = SplitGenerationPlan & {
  readiness: SplitGenerationReadiness;
};

/**
 * Compiles a DRAFT generation plan. May describe an unresolved REQUIRED
 * image authority (falls back to text-only prose, per
 * resolveSplitAuthorityImages) — this is what keeps the compiler usable in
 * tests/development without any real reference photography. The attached
 * `readiness` field reports whether this draft would actually be
 * provider-ready; the draft itself is still fully returned either way, so
 * callers/tests can inspect exactly what was (or wasn't) resolved. Never
 * calls the OpenAI provider or any generation function — always compiles
 * only.
 */
export async function compileSplitGenerationDraft(
  recipe: NormalizedSplitRecipe,
  inputs: SplitAuthorityResolutionInputs,
): Promise<SplitGenerationDraft> {
  const plan = buildSplitAuthorityPlan(recipe);
  const authorities = await resolveSplitAuthorityImages(plan, inputs);
  return {
    recipe,
    authorities,
    person: inputs.person,
    references: buildSplitReferences(authorities),
    prompt: compileSplitPrompt(authorities),
    readiness: computeSplitGenerationReadiness(authorities),
  };
}

/**
 * Compiles a PROVIDER-READY generation plan, or throws
 * `SplitGenerationNotReadyError`. This is the only function whose output
 * may ever be handed to `generateTryOn()` — it never silently downgrades a
 * REQUIRED image authority to text-only; if even one REQUIRED authority
 * failed to resolve (missing, pending, unavailable, or a failed integrity
 * check), generation is refused before any provider call. Still does not
 * call the provider itself — that remains the route handler's job, gated
 * additionally by SPLIT_GENERATION_ENABLED and every existing security
 * check (auth, lock, rate limit) that runs before this is ever reached.
 */
export async function prepareProviderReadySplitGeneration(
  recipe: NormalizedSplitRecipe,
  inputs: SplitAuthorityResolutionInputs,
): Promise<SplitGenerationPlan> {
  const draft = await compileSplitGenerationDraft(recipe, inputs);
  if (draft.readiness.status !== "READY") {
    throw new SplitGenerationNotReadyError(draft.readiness);
  }
  return {
    recipe: draft.recipe,
    authorities: draft.authorities,
    person: draft.person,
    references: draft.references,
    prompt: draft.prompt,
  };
}
