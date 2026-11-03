import { SPLIT_CATALOGUE_BY_FAMILY } from "@/lib/split-outfit/catalogue";
import type { SplitComponentOption, SplitOutfitState } from "@/lib/split-outfit/types";

export type PieceCloth = "uploaded" | "linked-to-jacket" | "reference";

export type ResultSummary = {
  pieces?: { label: string; design: string; source: string; cloth?: PieceCloth; customerLabel?: string }[];
  accessories?: string[];
  garment: string;
  lower?: string;
  fabric: string;
  turban?: string;
  shoes: string;
};

type SummaryInput =
  | { mode: "full"; designName: string; variantName?: string }
  | { mode: "split"; splitOutfit: SplitOutfitState; hasUploadedFabric: boolean; fabrics?: Partial<Record<"jacket" | "trousers" | "shirt" | "waistcoat", boolean>>; trousersLinked?: boolean };

function optionName(options: SplitComponentOption[], id: string | null) {
  return options.find((option) => option.id === id)?.customer.name;
}

export function buildResultSummary(input: SummaryInput): ResultSummary {
  if (input.mode === "full") {
    return {
      garment: input.variantName ? `${input.designName} — ${input.variantName}` : input.designName,
      fabric: "Uploaded fabric",
      shoes: "Keep existing",
    };
  }
  const { splitOutfit } = input;
  const catalogue = SPLIT_CATALOGUE_BY_FAMILY[splitOutfit.family];
  const piece = (label: string, design: string | undefined, cloth: PieceCloth, source: string) => {
    const name = design ?? "Not selected";
    const suffix = cloth === "uploaded" ? " · your cloth" : cloth === "linked-to-jacket" ? " · same cloth as jacket" : "";
    return { label, design: name, source, cloth, customerLabel: `${name} ${label === "Shoes" ? "shoes" : label.toLowerCase()}${suffix}` };
  };
  const cloth = (uploaded: boolean | undefined): PieceCloth => (uploaded ? "uploaded" : "reference");
  const trouserCloth: PieceCloth = input.fabrics?.trousers ? (input.trousersLinked ? "linked-to-jacket" : "uploaded") : "reference";
  const pieces = [
    piece("Jacket", optionName(catalogue.uppers, splitOutfit.upperId), cloth(input.fabrics?.jacket), input.fabrics?.jacket ? "Uploaded cloth" : "Reference cloth"),
    piece("Trousers", optionName(catalogue.lowers, splitOutfit.lowerId), trouserCloth, input.fabrics?.trousers ? (input.trousersLinked ? "Linked jacket cloth" : "Uploaded cloth") : "Reference cloth"),
    piece("Shirt", optionName(catalogue.shirts, splitOutfit.shirtId), cloth(input.fabrics?.shirt), input.fabrics?.shirt ? "Uploaded cloth" : "Reference cloth"),
    ...(splitOutfit.waistcoatId && splitOutfit.waistcoatId !== "SUIT_WAISTCOAT_NONE" ? [piece("Waistcoat", optionName(catalogue.waistcoats, splitOutfit.waistcoatId), cloth(input.fabrics?.waistcoat), input.fabrics?.waistcoat ? "Uploaded cloth" : "Reference cloth")] : []),
    piece("Shoes", optionName(catalogue.footwear, splitOutfit.footwearId), "reference", "Reference material"),
  ];
  const accessories = splitOutfit.accessoryIds.map((id) => optionName(catalogue.accessories, id)).filter((name): name is string => Boolean(name));
  return {
    ...(input.fabrics ? { pieces } : {}),
    ...(accessories.length ? { accessories } : {}),
    garment: optionName(catalogue.uppers, splitOutfit.upperId) ?? "Modular outfit",
    lower: optionName(catalogue.lowers, splitOutfit.lowerId),
    fabric: input.hasUploadedFabric ? "Uploaded fabric" : "Approved reference cloth",
    shoes: optionName(catalogue.footwear, splitOutfit.footwearId) ?? "Keep existing",
  };
}

/** True when the draft would no longer be described by the submitted summary. */
export function summaryDiffers(submitted: ResultSummary, draft: ResultSummary) {
  const key = (summary: ResultSummary) => JSON.stringify({
    pieces: (summary.pieces ?? []).map(({ label, design, cloth }) => [label, design, cloth ?? null]),
    accessories: summary.accessories ?? [],
  });
  return key(submitted) !== key(draft);
}
