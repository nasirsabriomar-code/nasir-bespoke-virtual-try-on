import type { ShowroomOccasion, StylePersonality } from "@/lib/showroom/types";
import type { FinalOutfitSnapshot } from "@/lib/showroom/final-outfit";

/**
 * Nasir Bespoke customer memory domain (Phase 3B). Gives the atelier a
 * persistent record of a client's identity, measurements, showroom visits,
 * and outfit history — deliberately NOT a CRM/ERP: no orders, payments,
 * invoices, inventory, or production tracking live here.
 *
 * These are the safe, serializable, application-level shapes returned by
 * the API — distinct from the Prisma-generated row types (lib/generated/prisma),
 * which are never returned directly to a route handler's JSON response.
 */

// ============================================================
// STAFF AUTHORIZATION
// ============================================================

/**
 * Minimal role boundary — not a general RBAC platform. OWNER/MANAGER/STAFF
 * are the original showroom+admin roles; STYLE_CONSULTANT/MASTER_TAILOR/
 * QC_STAFF (Phase 4C) are narrow atelier-operations roles layered on top,
 * each scoped to a specific slice of the production workflow. See
 * lib/customer/permissions.ts for the full grant table and the
 * resource-level scoping (assigned-job-only, quality-stage-only) applied
 * on top of it in lib/production-handler.ts.
 */
export type StaffRole = "OWNER" | "MANAGER" | "STAFF" | "STYLE_CONSULTANT" | "MASTER_TAILOR" | "QC_STAFF";

// ============================================================
// CUSTOMER
// ============================================================

/** Closed set — a customer's own declared garment-fit preference, never inferred. */
export type CustomerPreferredFit = "CLASSIC" | "SLIM" | "STRUCTURED" | "RELAXED";
export const CUSTOMER_PREFERRED_FIT_VALUES: readonly CustomerPreferredFit[] = [
  "CLASSIC",
  "SLIM",
  "STRUCTURED",
  "RELAXED",
];

/**
 * Closed set — a customer's own declared colour preference labels. This is
 * NOT fabric/colour intelligence (explicitly out of scope, see
 * lib/showroom — Phase 3A also declined to build colour recommendation);
 * it only records what the customer says they like.
 */
export type CustomerPreferredColour =
  | "NAVY"
  | "CHARCOAL"
  | "BLACK"
  | "MIDNIGHT_BLUE"
  | "GREY"
  | "BURGUNDY"
  | "OLIVE"
  | "IVORY"
  | "WHITE"
  | "OTHER";
export const CUSTOMER_PREFERRED_COLOUR_VALUES: readonly CustomerPreferredColour[] = [
  "NAVY",
  "CHARCOAL",
  "BLACK",
  "MIDNIGHT_BLUE",
  "GREY",
  "BURGUNDY",
  "OLIVE",
  "IVORY",
  "WHITE",
  "OTHER",
];

/**
 * Structured, closed-vocabulary preferences — deliberately reuses the Phase
 * 3A showroom taxonomies (StylePersonality, ShowroomOccasion) rather than
 * inventing a second one. Never an uncontrolled JSON blob, and never an
 * inferred appearance/ethnicity/personality field — only what the customer
 * explicitly told the atelier.
 */
export type CustomerPreferences = {
  preferredStyles: StylePersonality[];
  preferredColours: CustomerPreferredColour[];
  preferredFit: CustomerPreferredFit | null;
  preferredOccasions: ShowroomOccasion[];
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  preferences: CustomerPreferences;
  createdAt: string;
  updatedAt: string;
};

// ============================================================
// MEASUREMENTS (append-only)
// ============================================================

/**
 * A single garment's measurement block — a plain, small, named-field map
 * (e.g. { chest: 42, shoulder: 18 }). Validated server-side against a
 * versioned allow-list per garment (see lib/customer/measurement-fields.ts)
 * so it is never "uncontrolled JSON" even though it is stored as a Postgres
 * Json column for extensibility (new field names can be allow-listed later
 * without a schema migration).
 */
export type MeasurementBlock = Record<string, number>;

export type MeasurementProfile = {
  id: string;
  customerId: string;
  /** 1-based, strictly increasing per customer. Immutable once written. */
  version: number;
  jacketMeasurements: MeasurementBlock;
  trouserMeasurements: MeasurementBlock;
  shirtMeasurements: MeasurementBlock;
  /** Staff username who recorded this version — server-derived. */
  recordedBy: string;
  createdAt: string;
};

// ============================================================
// SHOWROOM SESSION
// ============================================================

export type ShowroomSessionStatus = "OPEN" | "EXPLORING" | "OUTFIT_SELECTED" | "COMPLETED" | "CANCELLED";

export type ShowroomSession = {
  id: string;
  customerId: string;
  status: ShowroomSessionStatus;
  occasion: string | null;
  selectedLookId: string | null;
  /** Set once an outfit is saved for this session — points to a SavedOutfit.id. */
  finalOutfitSnapshotId: string | null;
  /** Staff username who opened this session — server-derived. */
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

// ============================================================
// SAVED OUTFIT
// ============================================================

export type SavedOutfitSourceType = "manual" | "signature-look";

export type SavedOutfit = {
  id: string;
  customerId: string;
  sessionId: string | null;
  sourceType: SavedOutfitSourceType;
  sourceLookId: string | null;
  /** The full validated Phase 3A snapshot — preserves what was actually selected, even if the catalogue later changes. */
  outfitSnapshot: FinalOutfitSnapshot;
  /** Always null in this milestone — no generation occurs. */
  tryOnResultUrl: string | null;
  /** Staff username who saved this outfit — server-derived. */
  createdBy: string;
  createdAt: string;
};

// ============================================================
// ORDER (Phase 4A)
// ============================================================

export type OrderStatus =
  | "DRAFT"
  | "CONFIRMED"
  | "TAILORING"
  | "TRIAL"
  | "ALTERATION"
  | "QUALITY_CHECK"
  | "READY"
  | "DELIVERED"
  | "CANCELLED";

/**
 * A full copy of one MeasurementProfile, taken at order-creation time — not
 * a foreign key. An order must remain readable exactly as it was placed
 * even after the customer's measurements are updated with a later version.
 */
export type OrderMeasurementSnapshot = {
  measurementProfileId: string;
  version: number;
  jacketMeasurements: MeasurementBlock;
  trouserMeasurements: MeasurementBlock;
  shirtMeasurements: MeasurementBlock;
  recordedBy: string;
  recordedAt: string;
};

export type Order = {
  id: string;
  customerId: string;
  savedOutfitId: string;
  /** Copied from the SavedOutfit at order-creation time — never re-derived later. */
  outfitSnapshot: FinalOutfitSnapshot;
  measurementSnapshot: OrderMeasurementSnapshot;
  status: OrderStatus;
  /** Staff username who created this order — server-derived. */
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

// ============================================================
// FABRIC (Phase 4B)
// ============================================================

/**
 * Curated fabric catalogue — business data entered directly by staff, never
 * AI-generated or inferred. This is NOT inventory: no stock counts,
 * warehouse locations, or reorder thresholds live here.
 */
export type FabricStatus = "ACTIVE" | "INACTIVE";

export type Fabric = {
  id: string;
  name: string;
  composition: string;
  weight: string;
  season: string;
  colour: string;
  supplier: string | null;
  status: FabricStatus;
  createdAt: string;
};

/**
 * A fabric may have variants — the same cloth in a different colourway, or
 * currently unavailable. Deliberately minimal: colour + availability only.
 */
export type FabricVariant = {
  id: string;
  fabricId: string;
  colour: string;
  isAvailable: boolean;
  createdAt: string;
};

/** Closed set — the only material roles an order can carry a selection for (see the Order Detail "Materials" UI). */
export type MaterialRole = "SUIT_FABRIC" | "SHIRT_FABRIC";
export const MATERIAL_ROLE_VALUES: readonly MaterialRole[] = ["SUIT_FABRIC", "SHIRT_FABRIC"];

/**
 * The order's material truth for one role — a full copy of the fabric (and
 * optional variant) facts at the moment of selection, not a live reference.
 * Mirrors OrderMeasurementSnapshot: an order must remain readable exactly
 * as it was selected even if the fabric catalogue later changes or the
 * fabric/variant is retired.
 */
export type OrderMaterialSnapshot = {
  id: string;
  orderId: string;
  role: MaterialRole;
  fabricId: string;
  fabricVariantId: string | null;
  fabricName: string;
  composition: string;
  weight: string;
  season: string;
  colour: string;
  supplier: string | null;
  variantColour: string | null;
  /** Staff username who made this selection — server-derived. */
  selectedBy: string;
  selectedAt: string;
};

// ============================================================
// PRODUCTION JOB (Phase 4C)
// ============================================================

export type ProductionStage =
  | "CONFIRMED"
  | "FABRIC_READY"
  | "CUTTING"
  | "STITCHING"
  | "FIRST_TRIAL"
  | "ALTERATION"
  | "FINAL_QC"
  | "READY_FOR_DELIVERY"
  | "COMPLETED"
  | "CANCELLED";

/**
 * One production job per Order (1:1). `currentStage` is the live pointer —
 * ProductionStageHistoryEntry (below) is the source of truth for how the
 * job got there, never overwritten or deleted.
 */
export type ProductionJob = {
  id: string;
  orderId: string;
  currentStage: ProductionStage;
  /** Staff username of the assigned tailor — plain string, no staff table exists in this app. */
  assignedStaffId: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Append-only. `fromStage` is null only for the very first entry (job creation). */
export type ProductionStageHistoryEntry = {
  id: string;
  productionJobId: string;
  fromStage: ProductionStage | null;
  toStage: ProductionStage;
  /** Staff username who made this change — server-derived. */
  changedBy: string;
  createdAt: string;
};
