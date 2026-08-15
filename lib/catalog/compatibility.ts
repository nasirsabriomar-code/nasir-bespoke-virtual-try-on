import type { CatalogSelection } from "@/lib/catalog/types";

export class CatalogCompatibilityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogCompatibilityError";
  }
}

export function validateCatalogSelection(selection: CatalogSelection) {
  const upper = selection.upper;
  if (upper.pieceType === "lower") {
    throw new CatalogCompatibilityError("Please choose a men's upper garment or complete look.");
  }

  const subtypeProvidesCompleteLook = upper.category === "suit" && selection.subtype?.pieceType === "complete";
  const linkedCompleteLook = upper.pieceType === "complete";
  const requiresLower = upper.pieceType === "upper" && !subtypeProvidesCompleteLook && !linkedCompleteLook;
  if (requiresLower && !selection.lower) {
    throw new CatalogCompatibilityError("Please choose a lower garment for this look.");
  }

  if (selection.lower && selection.lower.category !== "no-change" && !upper.compatibleCategories.includes(selection.lower.category)) {
    throw new CatalogCompatibilityError("That lower garment is not compatible with the selected men's look.");
  }

  if (upper.category === "suit" && selection.subtype && selection.subtype.category !== "suit") {
    throw new CatalogCompatibilityError("Please choose a valid men's suit subtype.");
  }

  if (upper.id === "kurta-pajama" && selection.lower?.category !== "mens-pajama") {
    throw new CatalogCompatibilityError("Kurta Pajama requires Men's Pajama as its coordinated lower garment.");
  }
}
