import { SPLIT_CATALOGUE_BY_FAMILY } from "@/lib/split-outfit/catalogue";
import type { SplitComponentOption, SplitOutfitState } from "@/lib/split-outfit/types";

export type ResultSummary = {
  pieces?: { label: string; design: string; source: string }[];
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
  const pieces = [
    { label: "Jacket", design: optionName(catalogue.uppers, splitOutfit.upperId) ?? "Not selected", source: input.fabrics?.jacket ? "Uploaded cloth" : "Reference cloth" },
    { label: "Trousers", design: optionName(catalogue.lowers, splitOutfit.lowerId) ?? "Not selected", source: input.fabrics?.trousers ? (input.trousersLinked ? "Linked jacket cloth" : "Uploaded cloth") : "Reference cloth" },
    { label: "Shirt", design: optionName(catalogue.shirts, splitOutfit.shirtId) ?? "Not selected", source: input.fabrics?.shirt ? "Uploaded cloth" : "Reference cloth" },
    ...(splitOutfit.waistcoatId && splitOutfit.waistcoatId !== "SUIT_WAISTCOAT_NONE" ? [{ label: "Waistcoat", design: optionName(catalogue.waistcoats, splitOutfit.waistcoatId) ?? "Not selected", source: input.fabrics?.waistcoat ? "Uploaded cloth" : "Reference cloth" }] : []),
    { label: "Shoes", design: optionName(catalogue.footwear, splitOutfit.footwearId) ?? "Not selected", source: "Reference material" },
  ];
  return {
    ...(input.fabrics ? { pieces } : {}),
    garment: optionName(catalogue.uppers, splitOutfit.upperId) ?? "Modular outfit",
    lower: optionName(catalogue.lowers, splitOutfit.lowerId),
    fabric: input.hasUploadedFabric ? "Uploaded fabric" : "Approved reference cloth",
    shoes: optionName(catalogue.footwear, splitOutfit.footwearId) ?? "Keep existing",
  };
}
