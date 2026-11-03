import { UploadValidationError } from "@/lib/validation";
import { parseFabricGuidance, type DetailCrop } from "./fabric-guidance";
export type BackgroundControl = { mode: "prompt-only" | "masked" | "composite"; region?: DetailCrop; featherPixels?: number };
export function parseBackgroundControl(raw: unknown): BackgroundControl {
  const invalid = () => { throw new UploadValidationError("The garment edit region is invalid.", "invalid_image"); };
  if (raw === undefined || raw === "") return { mode: "prompt-only" };
  let value = raw;
  if (typeof value === "string") { if (value.length > 1024) invalid(); try { value = JSON.parse(value); } catch { return invalid(); } }
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some(key => !["mode", "region", "featherPixels"].includes(key)) || typeof record.mode !== "string" || !["prompt-only", "masked", "composite"].includes(record.mode)) return invalid();
  if (record.mode === "prompt-only") return { mode: "prompt-only" };
  if (!record.region) return invalid();
  const region = parseFabricGuidance({ fabric: { mode: "full-detail", crop: record.region } }).fabric!.crop!;
  const featherPixels = record.featherPixels ?? 4;
  if (typeof featherPixels !== "number" || !Number.isInteger(featherPixels) || featherPixels < 0 || featherPixels > 32) return invalid();
  return { mode: record.mode as "masked" | "composite", region, featherPixels };
}
