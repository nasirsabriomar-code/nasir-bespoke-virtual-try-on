import { UploadValidationError } from "@/lib/validation";
export const FABRIC_ROLES = ["fabric", "lowerFabric", "shirtFabric", "waistcoatFabric"] as const;
export type FabricRole = typeof FABRIC_ROLES[number];
export type DetailCrop = { x: number; y: number; width: number; height: number };
export const FABRIC_TREATMENTS = ["legacy-crop", "full-swatch", "full-detail"] as const;
export type FabricTreatment = typeof FABRIC_TREATMENTS[number];
export const FABRIC_PATTERNS = ["pinstripe", "chalk-stripe", "check"] as const;
export type FabricPattern = typeof FABRIC_PATTERNS[number];
export type FabricReferenceOptions = { mode: FabricTreatment | "studio-default"; pattern?: FabricPattern; crop?: DetailCrop; repeatWidthCm?: number; repeatHeightCm?: number };
export type FabricGuidance = Partial<Record<FabricRole, FabricReferenceOptions>>;
export const DEFAULT_DETAIL_CROP: DetailCrop = { x: .25, y: .25, width: .5, height: .5 };
export function parseFabricGuidance(raw: unknown): FabricGuidance {
  const invalid = () => { throw new UploadValidationError("The fabric reference settings are invalid.", "invalid_image"); };
  let value = raw;
  if (value === undefined || value === "") return {};
  if (typeof value === "string") { if (value.length > 4096) invalid(); try { value = JSON.parse(value); } catch { return invalid(); } }
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  const result: FabricGuidance = {};
  for (const [role, options] of Object.entries(value)) {
    if (!FABRIC_ROLES.includes(role as FabricRole) || !options || typeof options !== "object" || Array.isArray(options)) return invalid();
    const record = options as Record<string, unknown>;
    if (Object.keys(record).some(key => !["mode", "pattern", "crop", "repeatWidthCm", "repeatHeightCm"].includes(key)) || typeof record.mode !== "string" || (record.mode !== "studio-default" && !(FABRIC_TREATMENTS as readonly string[]).includes(record.mode))) return invalid();
    const parsed: FabricReferenceOptions = { mode: record.mode as FabricReferenceOptions["mode"] };
    if (record.pattern !== undefined) {
      if (typeof record.pattern !== "string" || !(FABRIC_PATTERNS as readonly string[]).includes(record.pattern)) return invalid();
      parsed.pattern = record.pattern as FabricPattern;
    }
    if (record.crop !== undefined) {
      if (!record.crop || typeof record.crop !== "object" || Array.isArray(record.crop)) return invalid();
      const crop = record.crop as Record<string, unknown>;
      if (Object.keys(crop).length !== 4 || ["x", "y", "width", "height"].some(key => typeof crop[key] !== "number" || !Number.isFinite(crop[key]))) return invalid();
      const { x, y, width, height } = crop as DetailCrop;
      if (x < 0 || y < 0 || width < .05 || height < .05 || x + width > 1.000001 || y + height > 1.000001) return invalid();
      parsed.crop = { x, y, width, height };
    }
    for (const key of ["repeatWidthCm", "repeatHeightCm"] as const) {
      const measurement = record[key];
      if (measurement !== undefined) {
        if (typeof measurement !== "number" || !Number.isFinite(measurement) || measurement < .1 || measurement > 100) return invalid();
        parsed[key] = measurement;
      }
    }
    result[role as FabricRole] = parsed;
  }
  return result;
}
