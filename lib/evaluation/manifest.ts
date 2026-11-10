import type { SplitOutfitState } from "@/lib/split-outfit/types";
import { DEFAULT_IMAGE_MODEL, resolveImageGenerationConfig, type ImageGenerationConfig } from "@/lib/tryon/model-config";

export type ComparisonManifest = {
  version: 1;
  experiment: "fabric-treatment" | "quality" | "matrix";
  repetitions: number;
  /** Matrix experiments only: 2 to 8 named generation configs compared on every case. */
  conditions?: { id: string; config: Partial<ImageGenerationConfig> }[];
  cases: { id: string; recipe: SplitOutfitState; person: string; fabrics: Partial<Record<"fabric" | "lowerFabric" | "shirtFabric" | "waistcoatFabric", string>>; references: Partial<Record<"split-upper" | "split-lower" | "split-shirt" | "split-waistcoat" | "split-footwear", string>> }[];
};
const fabrics = new Set(["fabric", "lowerFabric", "shirtFabric", "waistcoatFabric"]);
const references = new Set(["split-upper", "split-lower", "split-shirt", "split-waistcoat", "split-footwear"]);
function paths(value: unknown, allowed: Set<string>) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.entries(value).every(([key, file]) => allowed.has(key) && typeof file === "string" && file.length > 0 && file.length <= 512));
}
export function parseComparisonManifest(raw: unknown): ComparisonManifest {
  if (!raw || typeof raw !== "object") throw new Error("Invalid comparison manifest.");
  const value = raw as ComparisonManifest;
  if (value.version !== 1 || !["fabric-treatment", "quality", "matrix"].includes(value.experiment) || !Number.isInteger(value.repetitions) || value.repetitions < 1 || value.repetitions > 5 || !Array.isArray(value.cases) || !value.cases.length || value.cases.length > 50) throw new Error("Invalid experiment, case count, or repetitions.");
  const ids = new Set<string>();
  for (const item of value.cases) {
    if (!item || typeof item.id !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(item.id) || ids.has(item.id) || typeof item.person !== "string" || !item.person.length || item.person.length > 512 || !item.recipe || typeof item.recipe !== "object" || !paths(item.fabrics, fabrics) || !paths(item.references, references)) throw new Error("Invalid or duplicate comparison case.");
    ids.add(item.id);
  }
  if (value.experiment !== "matrix" && value.conditions !== undefined) throw new Error("Manifest conditions are allowed only for matrix experiments.");
  if (value.experiment === "matrix") {
    if (!Array.isArray(value.conditions) || value.conditions.length < 2 || value.conditions.length > 8) throw new Error("A matrix experiment needs 2 to 8 conditions.");
    const conditionIds = new Set<string>();
    for (const condition of value.conditions) {
      if (!condition || typeof condition.id !== "string" || !/^[a-zA-Z0-9_-]{1,20}$/.test(condition.id) || conditionIds.has(condition.id) || !condition.config || typeof condition.config !== "object" || Array.isArray(condition.config) || Object.keys(condition.config).some(key => !(key in CONFIG_ENV))) throw new Error("Invalid or duplicate matrix condition.");
      conditionIds.add(condition.id);
      configFromOverrides(condition.config);
    }
  }
  return value;
}

const CONFIG_ENV: Record<keyof ImageGenerationConfig, string> = { model: "IMAGE_MODEL", quality: "IMAGE_QUALITY", canvasProfile: "IMAGE_CANVAS_PROFILE", complexity: "IMAGE_COMPLEXITY", fabricTreatmentDefault: "FABRIC_TREATMENT_DEFAULT" };

/** Applies overrides on top of the code defaults (not the live environment), validating every value. */
function configFromOverrides(overrides: Partial<ImageGenerationConfig>): ImageGenerationConfig {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(overrides)) env[CONFIG_ENV[key as keyof ImageGenerationConfig]] = String(value);
  return resolveImageGenerationConfig(env);
}

/** Every experiment expressed as named full generation configs. */
export function resolveRunConditions(manifest: ComparisonManifest): { id: string; config: ImageGenerationConfig }[] {
  if (manifest.experiment === "matrix") return manifest.conditions!.map(condition => ({ id: condition.id, config: configFromOverrides(condition.config) }));
  return comparisonConditions(manifest.experiment).map(condition => ({ id: condition.id, config: configFromOverrides({ model: DEFAULT_IMAGE_MODEL, quality: condition.quality === "high" ? "high" : "medium", fabricTreatmentDefault: condition.treatment }) }));
}
export function comparisonConditions(experiment: Exclude<ComparisonManifest["experiment"], "matrix">) {
  return experiment === "fabric-treatment"
    ? [{ id: "A", treatment: "legacy-crop" as const, quality: "medium" as const }, { id: "B", treatment: "full-detail" as const, quality: "medium" as const }]
    : [{ id: "A", treatment: "full-detail" as const, quality: "medium" as const }, { id: "B", treatment: "full-detail" as const, quality: "high" as const }];
}
