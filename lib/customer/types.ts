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

/** Minimal 3-role boundary — not a general RBAC platform. See lib/customer/permissions.ts. */
export type StaffRole = "OWNER" | "MANAGER" | "STAFF";

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
