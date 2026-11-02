import { SPLIT_CATALOGUE_BY_FAMILY } from "@/lib/split-outfit/catalogue";
import type { SplitComponentOption, SplitOutfitState } from "@/lib/split-outfit/types";

export type ResultSummary = {
  garment: string;
  lower?: string;
  fabric: string;
  turban?: string;
  shoes: string;
};

type SummaryInput =
  | { mode: "full"; designName: string; variantName?: string }
  | { mode: "split"; splitOutfit: SplitOutfitState; hasUploadedFabric: boolean };

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
  return {
    garment: optionName(catalogue.uppers, splitOutfit.upperId) ?? "Modular outfit",
    lower: optionName(catalogue.lowers, splitOutfit.lowerId),
    fabric: input.hasUploadedFabric ? "Uploaded fabric" : "Approved reference cloth",
    shoes: optionName(catalogue.footwear, splitOutfit.footwearId) ?? "Keep existing",
  };
}
