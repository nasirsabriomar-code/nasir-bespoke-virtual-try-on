import { parseBackgroundControl } from "./background-control";
import { parseFabricGuidance } from "./fabric-guidance";
import type { TryOnMetadata } from "./types";
/** History stores only bounded technical metadata, never arbitrary provider payloads or prompts. */
export function sanitizeGenerationMetadata(value: unknown): Partial<TryOnMetadata> {
  if (!value || typeof value !== "object") return {};
  const source = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const key of ["provider", "model", "quality", "reportedQuality", "requestedSize", "reportedSize"]) {
    if (typeof source[key] === "string") result[key] = source[key].slice(0, 160);
  }
  for (const key of ["durationMs", "outputWidth", "outputHeight"]) {
    if (typeof source[key] === "number" && Number.isFinite(source[key]) && source[key] >= 0) result[key] = source[key];
  }
  if (source.usage && typeof source.usage === "object") {
    const usage = source.usage as Record<string, unknown>;
    if (["inputTokens", "outputTokens", "totalTokens"].every(key => typeof usage[key] === "number" && Number.isFinite(usage[key]) && Number(usage[key]) >= 0)) result.usage = { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, totalTokens: usage.totalTokens };
  }
  if (source.provenance && typeof source.provenance === "object") {
    const p = source.provenance as Record<string, unknown>;
    const provenance: Record<string, unknown> = {};
    for (const key of ["promptVersion", "preprocessingVersion", "promptHash"]) if (typeof p[key] === "string") provenance[key] = p[key].slice(0, 160);
    for (const key of ["preprocessingMs", "providerMs", "providerAttempts"]) if (typeof p[key] === "number" && Number.isFinite(p[key]) && Number(p[key]) >= 0) provenance[key] = p[key];
    provenance.modelSnapshot = typeof p.modelSnapshot === "string" ? p.modelSnapshot.slice(0, 160) : null;
    provenance.fallbackReasons = Array.isArray(p.fallbackReasons) ? p.fallbackReasons.filter(x => x === "size" || x === "image-format").slice(0, 4) : [];
    if (p.fabricGuidance) { try { provenance.fabricGuidance = parseFabricGuidance(p.fabricGuidance); } catch { /* Ignore malformed historical settings. */ } }
    if (p.backgroundControl) { try { provenance.backgroundControl = parseBackgroundControl(p.backgroundControl); } catch { /* Ignore malformed historical regions. */ } }
    result.provenance = provenance;
  }
  return result as Partial<TryOnMetadata>;
}
