/**
 * Versioned, per-garment allow-lists for MeasurementBlock field names.
 * These are the "clean extension points" the measurement domain needs —
 * add a new field name here (a purely additive change) when the atelier
 * needs to capture something new; no schema migration required, since
 * jacket/trouser/shirtMeasurements are Json columns. A field name NOT in
 * the relevant list is always rejected — this is what keeps the Json
 * columns "controlled" rather than uncontrolled blobs.
 */

export const JACKET_MEASUREMENT_FIELDS = [
  "chest",
  "shoulder",
  "sleeveLength",
  "jacketLength",
  "waist",
] as const;

export const TROUSER_MEASUREMENT_FIELDS = [
  "waist",
  "hip",
  "inseam",
  "outseam",
  "thigh",
] as const;

export const SHIRT_MEASUREMENT_FIELDS = [
  "neck",
  "chest",
  "sleeveLength",
  "shirtLength",
] as const;

export type JacketMeasurementField = (typeof JACKET_MEASUREMENT_FIELDS)[number];
export type TrouserMeasurementField = (typeof TROUSER_MEASUREMENT_FIELDS)[number];
export type ShirtMeasurementField = (typeof SHIRT_MEASUREMENT_FIELDS)[number];
