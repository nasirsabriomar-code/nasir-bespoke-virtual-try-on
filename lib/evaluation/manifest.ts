import type { SplitOutfitState } from "@/lib/split-outfit/types";

export type ComparisonManifest = {
  version: 1;
  experiment: "fabric-treatment" | "quality";
  repetitions: number;
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
  if (value.version !== 1 || !["fabric-treatment", "quality"].includes(value.experiment) || !Number.isInteger(value.repetitions) || value.repetitions < 1 || value.repetitions > 5 || !Array.isArray(value.cases) || !value.cases.length || value.cases.length > 50) throw new Error("Invalid experiment, case count, or repetitions.");
  const ids = new Set<string>();
  for (const item of value.cases) {
    if (!item || typeof item.id !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(item.id) || ids.has(item.id) || typeof item.person !== "string" || !item.person.length || item.person.length > 512 || !item.recipe || typeof item.recipe !== "object" || !paths(item.fabrics, fabrics) || !paths(item.references, references)) throw new Error("Invalid or duplicate comparison case.");
    ids.add(item.id);
  }
  return value;
}
export function comparisonConditions(experiment: ComparisonManifest["experiment"]) {
  return experiment === "fabric-treatment"
    ? [{ id: "A", treatment: "legacy-crop" as const, quality: "medium" as const }, { id: "B", treatment: "full-detail" as const, quality: "medium" as const }]
    : [{ id: "A", treatment: "full-detail" as const, quality: "medium" as const }, { id: "B", treatment: "full-detail" as const, quality: "high" as const }];
}
