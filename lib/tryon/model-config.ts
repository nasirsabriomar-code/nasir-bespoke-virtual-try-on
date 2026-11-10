import { FABRIC_TREATMENTS, type FabricTreatment } from "./fabric-guidance";

export const IMAGE_MODELS = ["gpt-image-2.5-sunburst", "gpt-image-2.6-sunburst", "gpt-image-2.6-flare"] as const;
export type ImageModelId = typeof IMAGE_MODELS[number];
export const IMAGE_QUALITIES = ["medium", "high"] as const;
export const CANVAS_PROFILES = ["experimental", "stable"] as const;
export const IMAGE_COMPLEXITIES = ["low", "medium", "high"] as const;

export type ImageGenerationConfig = {
  model: ImageModelId;
  quality: typeof IMAGE_QUALITIES[number];
  canvasProfile: typeof CANVAS_PROFILES[number];
  /** 2.6 models only. Omitted means the provider default (high). */
  complexity?: typeof IMAGE_COMPLEXITIES[number];
  fabricTreatmentDefault: FabricTreatment;
};

// Rollback: set IMAGE_MODEL=gpt-image-2.5-sunburst (snapshot pin: gpt-image-2.5-sunburst-2026-09-08).
export const DEFAULT_IMAGE_MODEL: ImageModelId = "gpt-image-2.6-sunburst";

function pick<T extends string>(name: string, raw: string | undefined, allowed: readonly T[], fallback: T | undefined): T | undefined {
  const value = raw?.trim();
  if (!value) return fallback;
  if (!allowed.includes(value as T)) throw new Error(`Unsupported ${name}: ${value}. Allowed: ${allowed.join(", ")}.`);
  return value as T;
}

export function isModelGeneration26(model: ImageModelId) {
  return model.startsWith("gpt-image-2.6-");
}

/** Reads and validates the image-generation settings. Throws on any unknown value. */
type ImageEnv = Record<string, string | undefined>;

export function resolveImageGenerationConfig(env: ImageEnv = process.env): ImageGenerationConfig {
  const model = pick("IMAGE_MODEL", env.IMAGE_MODEL, IMAGE_MODELS, DEFAULT_IMAGE_MODEL)!;
  const quality = pick("IMAGE_QUALITY", env.IMAGE_QUALITY, IMAGE_QUALITIES, "medium")!;
  const canvasProfile = pick("IMAGE_CANVAS_PROFILE", env.IMAGE_CANVAS_PROFILE, CANVAS_PROFILES, "experimental")!;
  const complexity = pick("IMAGE_COMPLEXITY", env.IMAGE_COMPLEXITY, IMAGE_COMPLEXITIES, undefined);
  const fabricTreatmentDefault = pick("FABRIC_TREATMENT_DEFAULT", env.FABRIC_TREATMENT_DEFAULT, FABRIC_TREATMENTS, "legacy-crop")!;
  if (complexity && !isModelGeneration26(model)) throw new Error(`IMAGE_COMPLEXITY: complexity requires a 2.6 model (current: ${model}).`);
  return { model, quality, canvasProfile, ...(complexity ? { complexity } : {}), fabricTreatmentDefault };
}
