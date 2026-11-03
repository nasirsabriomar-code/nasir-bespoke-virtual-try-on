import type { SplitOutfitState } from "./types";

export type BuilderStepId = "customer" | "jacket" | "trousers" | "inner" | "shoes" | "extras" | "review";

export const BUILDER_STEPS: readonly { id: BuilderStepId; label: string }[] = [
  { id: "customer", label: "Customer photo" },
  { id: "jacket", label: "Jacket" },
  { id: "trousers", label: "Trousers" },
  { id: "inner", label: "Shirt & waistcoat" },
  { id: "shoes", label: "Shoes" },
  { id: "extras", label: "Extras" },
  { id: "review", label: "Review & generate" },
];

export type RowSwatch = { kind: "image"; url: string } | { kind: "linked"; url: string } | { kind: "reference" } | null;

type ClothPiece = "jacket" | "trousers" | "shirt" | "waistcoat";

export type BuilderRowInput = {
  state: SplitOutfitState;
  names: Partial<Record<"upper" | "lower" | "shirt" | "waistcoat" | "footwear", string>>;
  accessoryNames: string[];
  personPreview: string | null;
  fabricPreviews: Record<ClothPiece, string | null>;
  trousersLinked: boolean;
  visited: ReadonlySet<BuilderStepId>;
  current: BuilderStepId;
};

export type BuilderRow = {
  id: BuilderStepId;
  label: string;
  number: number;
  complete: boolean;
  current: boolean;
  detail: string | null;
  swatch: RowSwatch;
};

function hasRealWaistcoat(state: SplitOutfitState) {
  return Boolean(state.waistcoatId && state.waistcoatId !== "SUIT_WAISTCOAT_NONE");
}

/** Uploaded cloth wins; a chosen piece without cloth uses its reference photograph. */
function clothSwatch(chosen: boolean, preview: string | null): RowSwatch {
  if (preview) return { kind: "image", url: preview };
  return chosen ? { kind: "reference" } : null;
}

export function buildBuilderRows(input: BuilderRowInput): BuilderRow[] {
  const { state, names, fabricPreviews } = input;
  const realWaistcoat = hasRealWaistcoat(state);
  const rows: Record<BuilderStepId, Pick<BuilderRow, "complete" | "detail" | "swatch">> = {
    customer: { complete: Boolean(input.personPreview), detail: null, swatch: input.personPreview ? { kind: "image", url: input.personPreview } : null },
    jacket: { complete: Boolean(state.upperId), detail: names.upper ?? null, swatch: clothSwatch(Boolean(state.upperId), fabricPreviews.jacket) },
    trousers: {
      complete: Boolean(state.lowerId),
      detail: names.lower ?? null,
      swatch: input.trousersLinked && fabricPreviews.jacket ? { kind: "linked", url: fabricPreviews.jacket } : clothSwatch(Boolean(state.lowerId), fabricPreviews.trousers),
    },
    inner: {
      complete: Boolean(state.shirtId),
      detail: names.shirt ? (realWaistcoat && names.waistcoat ? `${names.shirt} + ${names.waistcoat} waistcoat` : names.shirt) : null,
      swatch: clothSwatch(Boolean(state.shirtId), fabricPreviews.shirt),
    },
    shoes: { complete: Boolean(state.footwearId), detail: names.footwear ?? null, swatch: state.footwearId ? { kind: "reference" } : null },
    extras: { complete: input.visited.has("extras") || state.accessoryIds.length > 0, detail: input.accessoryNames.length ? input.accessoryNames.join(", ") : null, swatch: null },
    review: { complete: false, detail: null, swatch: null },
  };
  return BUILDER_STEPS.map((step, index) => ({ id: step.id, label: step.label, number: index + 1, current: step.id === input.current, ...rows[step.id] }));
}

export function missingSteps(state: SplitOutfitState, hasPerson: boolean): BuilderStepId[] {
  const required: [BuilderStepId, boolean][] = [
    ["customer", hasPerson],
    ["jacket", Boolean(state.upperId)],
    ["trousers", Boolean(state.lowerId)],
    ["inner", Boolean(state.shirtId)],
    ["shoes", Boolean(state.footwearId)],
  ];
  return required.filter(([, done]) => !done).map(([id]) => id);
}

export function adjacentStep(current: BuilderStepId, direction: 1 | -1): BuilderStepId | null {
  const index = BUILDER_STEPS.findIndex((step) => step.id === current);
  return BUILDER_STEPS[index + direction]?.id ?? null;
}
