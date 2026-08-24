import { SHOWROOM_OCCASION_VALUES, STYLE_PERSONALITY_VALUES } from "@/lib/showroom/types";
import {
  JACKET_MEASUREMENT_FIELDS,
  SHIRT_MEASUREMENT_FIELDS,
  TROUSER_MEASUREMENT_FIELDS,
} from "./measurement-fields";
import { CUSTOMER_PREFERRED_COLOUR_VALUES, CUSTOMER_PREFERRED_FIT_VALUES, MATERIAL_ROLE_VALUES } from "./types";
import type {
  CustomerPreferences,
  MaterialRole,
  MeasurementBlock,
  OrderStatus,
  ProductionStage,
  ShowroomSessionStatus,
} from "./types";

export type CustomerValidationErrorCode =
  | "malformed_request"
  | "invalid_name"
  | "invalid_phone"
  | "invalid_email"
  | "invalid_preferences"
  | "invalid_measurement_block"
  | "invalid_occasion"
  | "invalid_session_transition"
  | "invalid_source_type"
  | "invalid_order_transition"
  | "invalid_fabric_field"
  | "invalid_material_role"
  | "invalid_production_transition"
  | "invalid_staff_id"
  | "invalid_note_body";

export class CustomerValidationError extends Error {
  constructor(
    public readonly code: CustomerValidationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CustomerValidationError";
  }
}

const PHONE_PATTERN = /^\+?[0-9()\-.\s]{7,20}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_PREFERENCE_ITEMS = 12;

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateCustomerName(value: unknown): string {
  if (!isNonEmptyString(value) || value.trim().length > 120) {
    throw new CustomerValidationError("invalid_name", "Please provide a valid customer name.");
  }
  return value.trim();
}

export function validateCustomerPhone(value: unknown): string {
  if (typeof value !== "string" || !PHONE_PATTERN.test(value.trim())) {
    throw new CustomerValidationError("invalid_phone", "Please provide a valid phone number.");
  }
  return value.trim();
}

export function validateCustomerEmail(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || value.trim().length === 0) return null;
  if (value.trim().length > 254 || !EMAIL_PATTERN.test(value.trim())) {
    throw new CustomerValidationError("invalid_email", "Please provide a valid email address.");
  }
  return value.trim();
}

function validateStringArray<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fieldLabel: string,
): T[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_PREFERENCE_ITEMS) {
    throw new CustomerValidationError("invalid_preferences", `Invalid ${fieldLabel}.`);
  }
  const result: T[] = [];
  for (const entry of value) {
    if (typeof entry !== "string" || !allowed.includes(entry as T)) {
      throw new CustomerValidationError("invalid_preferences", `Unknown ${fieldLabel} value: ${String(entry)}.`);
    }
    result.push(entry as T);
  }
  return [...new Set(result)];
}

/**
 * Validates a (possibly partial, for PATCH) preferences payload into the
 * fully structured CustomerPreferences shape. Every array value is checked
 * against a closed vocabulary — nothing free-form ever reaches storage.
 */
export function validateCustomerPreferences(value: unknown): CustomerPreferences {
  if (value === undefined) {
    return { preferredStyles: [], preferredColours: [], preferredFit: null, preferredOccasions: [] };
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new CustomerValidationError("invalid_preferences", "Preferences must be a structured object.");
  }
  const record = value as Record<string, unknown>;

  const preferredStyles = validateStringArray(record.preferredStyles, STYLE_PERSONALITY_VALUES, "preferred style");
  const preferredColours = validateStringArray(record.preferredColours, CUSTOMER_PREFERRED_COLOUR_VALUES, "preferred colour");
  const preferredOccasions = validateStringArray(record.preferredOccasions, SHOWROOM_OCCASION_VALUES, "preferred occasion");

  let preferredFit: CustomerPreferences["preferredFit"] = null;
  if (record.preferredFit !== undefined && record.preferredFit !== null) {
    if (typeof record.preferredFit !== "string" || !CUSTOMER_PREFERRED_FIT_VALUES.includes(record.preferredFit as never)) {
      throw new CustomerValidationError("invalid_preferences", "Unknown preferred fit value.");
    }
    preferredFit = record.preferredFit as CustomerPreferences["preferredFit"];
  }

  return { preferredStyles, preferredColours, preferredFit, preferredOccasions };
}

/**
 * Validates one garment's measurement block against its versioned allow-list
 * (lib/customer/measurement-fields.ts). Rejects any unknown field name and
 * any non-finite/non-positive value — this is what keeps the underlying Json
 * column controlled rather than an uncontrolled blob.
 */
export function validateMeasurementBlock(value: unknown, allowedFields: readonly string[], label: string): MeasurementBlock {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new CustomerValidationError("invalid_measurement_block", `${label} measurements must be a structured object.`);
  }
  const record = value as Record<string, unknown>;
  const result: MeasurementBlock = {};
  for (const [key, raw] of Object.entries(record)) {
    if (!allowedFields.includes(key)) {
      throw new CustomerValidationError("invalid_measurement_block", `Unknown ${label} measurement field: ${key}.`);
    }
    if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0 || raw > 200) {
      throw new CustomerValidationError("invalid_measurement_block", `Invalid value for ${label} measurement ${key}.`);
    }
    result[key] = raw;
  }
  return result;
}

export function validateJacketMeasurements(value: unknown): MeasurementBlock {
  return validateMeasurementBlock(value, JACKET_MEASUREMENT_FIELDS, "jacket");
}
export function validateTrouserMeasurements(value: unknown): MeasurementBlock {
  return validateMeasurementBlock(value, TROUSER_MEASUREMENT_FIELDS, "trouser");
}
export function validateShirtMeasurements(value: unknown): MeasurementBlock {
  return validateMeasurementBlock(value, SHIRT_MEASUREMENT_FIELDS, "shirt");
}

// ============================================================
// SHOWROOM SESSION STATE MACHINE
// ============================================================

const SESSION_TRANSITIONS: Record<ShowroomSessionStatus, ShowroomSessionStatus[]> = {
  OPEN: ["EXPLORING", "CANCELLED"],
  EXPLORING: ["OUTFIT_SELECTED", "CANCELLED"],
  OUTFIT_SELECTED: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

const SESSION_STATUSES: ShowroomSessionStatus[] = ["OPEN", "EXPLORING", "OUTFIT_SELECTED", "COMPLETED", "CANCELLED"];

export function isShowroomSessionStatus(value: unknown): value is ShowroomSessionStatus {
  return typeof value === "string" && SESSION_STATUSES.includes(value as ShowroomSessionStatus);
}

/**
 * Pure transition-table check — a session may never jump to an
 * unreachable status (e.g. OPEN -> COMPLETED, or anything out of a
 * terminal COMPLETED/CANCELLED state). Throws on an invalid transition;
 * callers should treat "same status" (a no-op PATCH) as always allowed.
 */
export function assertValidSessionTransition(current: ShowroomSessionStatus, next: ShowroomSessionStatus): void {
  if (current === next) return;
  const allowed = SESSION_TRANSITIONS[current] ?? [];
  if (!allowed.includes(next)) {
    throw new CustomerValidationError(
      "invalid_session_transition",
      `Cannot move a session from ${current} to ${next}.`,
    );
  }
}

// ============================================================
// ORDER STATUS STATE MACHINE (Phase 4A)
// ------------------------------------------------------------
// Exported (not server-only) so the client UI can render only the
// currently-valid next-status actions — but this table is never the real
// authority; the server independently re-validates every transition via
// assertValidOrderTransition() regardless of what the client requests.
// ============================================================

export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  DRAFT: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["TAILORING", "CANCELLED"],
  TAILORING: ["TRIAL", "CANCELLED"],
  TRIAL: ["ALTERATION", "QUALITY_CHECK", "CANCELLED"],
  ALTERATION: ["TRIAL", "CANCELLED"],
  QUALITY_CHECK: ["READY", "ALTERATION", "CANCELLED"],
  READY: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

const ORDER_STATUSES: OrderStatus[] = [
  "DRAFT",
  "CONFIRMED",
  "TAILORING",
  "TRIAL",
  "ALTERATION",
  "QUALITY_CHECK",
  "READY",
  "DELIVERED",
  "CANCELLED",
];

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && ORDER_STATUSES.includes(value as OrderStatus);
}

/**
 * Pure transition-table check for orders — mirrors
 * assertValidSessionTransition exactly. A DELIVERED or CANCELLED order can
 * never move again (both terminal); nothing can ever jump back to DRAFT
 * once CONFIRMED.
 */
export function assertValidOrderTransition(current: OrderStatus, next: OrderStatus): void {
  if (current === next) return;
  const allowed = ORDER_STATUS_TRANSITIONS[current] ?? [];
  if (!allowed.includes(next)) {
    throw new CustomerValidationError(
      "invalid_order_transition",
      `Cannot move an order from ${current} to ${next}.`,
    );
  }
}

// ============================================================
// FABRIC (Phase 4B)
// ------------------------------------------------------------
// Fabric fields are plain descriptive strings (never free-form beyond a
// length cap) — curated business data entered by staff, never inferred.
// ============================================================

const FABRIC_TEXT_FIELD_MAX_LENGTH = 120;
const FABRIC_SUPPLIER_MAX_LENGTH = 120;

export function validateFabricTextField(value: unknown, fieldLabel: string): string {
  if (!isNonEmptyString(value) || value.trim().length > FABRIC_TEXT_FIELD_MAX_LENGTH) {
    throw new CustomerValidationError("invalid_fabric_field", `Please provide a valid ${fieldLabel}.`);
  }
  return value.trim();
}

export function validateFabricSupplier(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || value.trim().length === 0) return null;
  if (value.trim().length > FABRIC_SUPPLIER_MAX_LENGTH) {
    throw new CustomerValidationError("invalid_fabric_field", "Please provide a valid supplier name.");
  }
  return value.trim();
}

export function isMaterialRole(value: unknown): value is MaterialRole {
  return typeof value === "string" && MATERIAL_ROLE_VALUES.includes(value as MaterialRole);
}

// ============================================================
// PRODUCTION STAGE STATE MACHINE (Phase 4C)
// ------------------------------------------------------------
// Exported (not server-only) so the client UI can render only the
// currently-valid next-stage actions — but this table is never the real
// authority; the server independently re-validates every transition via
// assertValidProductionTransition() regardless of what the client
// requests, and additionally applies role-based scoping on top (see
// lib/customer/permissions.ts's canUpdateProductionJob).
// ============================================================

export const PRODUCTION_STAGE_TRANSITIONS: Record<ProductionStage, ProductionStage[]> = {
  CONFIRMED: ["FABRIC_READY", "CANCELLED"],
  FABRIC_READY: ["CUTTING", "CANCELLED"],
  CUTTING: ["STITCHING", "CANCELLED"],
  STITCHING: ["FIRST_TRIAL", "CANCELLED"],
  FIRST_TRIAL: ["ALTERATION", "FINAL_QC", "CANCELLED"],
  ALTERATION: ["FIRST_TRIAL", "CANCELLED"],
  FINAL_QC: ["READY_FOR_DELIVERY", "ALTERATION", "CANCELLED"],
  READY_FOR_DELIVERY: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

const PRODUCTION_STAGES: ProductionStage[] = [
  "CONFIRMED",
  "FABRIC_READY",
  "CUTTING",
  "STITCHING",
  "FIRST_TRIAL",
  "ALTERATION",
  "FINAL_QC",
  "READY_FOR_DELIVERY",
  "COMPLETED",
  "CANCELLED",
];

export function isProductionStage(value: unknown): value is ProductionStage {
  return typeof value === "string" && PRODUCTION_STAGES.includes(value as ProductionStage);
}

/**
 * Pure transition-table check for production jobs — mirrors
 * assertValidOrderTransition exactly. COMPLETED and CANCELLED are both
 * terminal; nothing can ever jump back to CONFIRMED once past it.
 */
export function assertValidProductionTransition(current: ProductionStage, next: ProductionStage): void {
  if (current === next) return;
  const allowed = PRODUCTION_STAGE_TRANSITIONS[current] ?? [];
  if (!allowed.includes(next)) {
    throw new CustomerValidationError(
      "invalid_production_transition",
      `Cannot move a production job from ${current} to ${next}.`,
    );
  }
}

const STAFF_USERNAME_PATTERN = /^[a-z0-9._-]{2,64}$/;

/** Same shape the auth allowlist itself requires (lib/auth/config.ts) — assignedStaffId is never validated against a live staff table, since none exists. */
export function validateAssignedStaffId(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || !STAFF_USERNAME_PATTERN.test(value.trim().toLowerCase())) {
    throw new CustomerValidationError("invalid_staff_id", "Please provide a valid staff username.");
  }
  return value.trim().toLowerCase();
}

const PRODUCTION_NOTE_BODY_MAX_LENGTH = 2000;

/** Trimmed, required, 1..2000 characters. Server-derived fields (id/createdAt/createdBy/productionJobId) are never accepted here. */
export function validateProductionNoteBody(value: unknown): string {
  if (!isNonEmptyString(value) || value.trim().length > PRODUCTION_NOTE_BODY_MAX_LENGTH) {
    throw new CustomerValidationError("invalid_note_body", "Please provide a valid production note.");
  }
  return value.trim();
}
