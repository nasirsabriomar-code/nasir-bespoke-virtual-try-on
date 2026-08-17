import { SPLIT_CATALOGUE_BY_FAMILY } from "./catalogue";
import type {
  CompatibilityStatus,
  MaterialSlotState,
  SplitComponentOption,
  SplitOutfitFamily,
  SplitOutfitState,
  SplitOutfitSummary,
} from "./types";

/**
 * Resolves a component option by its ID within a given family.
 */
export function findSplitOption(
  family: SplitOutfitFamily,
  optionId: string | null | undefined,
): SplitComponentOption | null {
  if (!optionId) return null;
  const catalogue = SPLIT_CATALOGUE_BY_FAMILY[family];
  if (!catalogue) return null;

  const all = [
    ...catalogue.uppers,
    ...catalogue.lowers,
    ...catalogue.shirts,
    ...catalogue.waistcoats,
    ...catalogue.footwear,
    ...catalogue.accessories,
  ];

  return all.find((item) => item.id === optionId) ?? null;
}

/**
 * Evaluates the compatibility status of an option given the current active split outfit state.
 * Returns: "REQUIRED" | "RECOMMENDED" | "ALLOWED" | "OPTIONAL" | "DISALLOWED" | "CONDITIONAL"
 */
export function evaluateOptionCompatibility(
  option: SplitComponentOption,
  state: SplitOutfitState,
): CompatibilityStatus {
  // If the option has a fixed status in definition, respect it as baseline
  const isTuxedoJacket = state.upperId === "SUIT_UPPER_TUXEDO";
  const isThreePieceJacket = state.upperId === "SUIT_UPPER_THREE_PIECE";
  const isDoubleBreasted = state.upperId === "SUIT_UPPER_DOUBLE_BREASTED";

  // 1. Lower Garment Rules
  if (option.categoryId === "lower") {
    if (isTuxedoJacket) {
      if (option.id === "SUIT_LOWER_TUXEDO_TROUSER") return "RECOMMENDED";
      if (option.id === "SUIT_LOWER_CLASSIC_STRAIGHT") return "ALLOWED";
      return "ALLOWED";
    }
  }

  // 2. Inner Shirt Rules
  if (option.categoryId === "inner-shirt") {
    if (isTuxedoJacket) {
      if (option.id === "SUIT_SHIRT_TUXEDO_PLEATED") return "RECOMMENDED";
      return "ALLOWED";
    }
  }

  // 3. Inner Waistcoat Rules
  if (option.categoryId === "inner-waistcoat") {
    if (isThreePieceJacket) {
      if (option.id === "SUIT_WAISTCOAT_NONE") return "DISALLOWED";
      if (option.id === "SUIT_WAISTCOAT_CLASSIC" || option.id === "SUIT_WAISTCOAT_FORMAL") {
        return "RECOMMENDED";
      }
    }
    if (isDoubleBreasted) {
      if (option.id !== "SUIT_WAISTCOAT_NONE") return "OPTIONAL";
    }
    if (isTuxedoJacket) {
      if (option.id === "SUIT_WAISTCOAT_TUXEDO") return "RECOMMENDED";
    }
  }

  // 4. Footwear Rules
  if (option.categoryId === "footwear") {
    if (isTuxedoJacket) {
      if (option.id === "SUIT_SHOE_PATENT_OXFORD") return "RECOMMENDED";
      if (option.id === "SUIT_SHOE_OXFORD") return "ALLOWED";
    }
  }

  // 5. Accessory Rules
  if (option.categoryId === "accessory") {
    if (isTuxedoJacket) {
      if (option.id === "SUIT_ACC_BOW_TIE") return "RECOMMENDED";
      if (option.id === "SUIT_ACC_TIE") return "ALLOWED";
    }
  }

  return option.defaultStatus ?? "ALLOWED";
}

/**
 * Derives the active material slots dynamically based on the customer's selected components.
 */
export function deriveActiveMaterialSlots(state: SplitOutfitState): MaterialSlotState[] {
  const slots: MaterialSlotState[] = [];
  const family = state.family;

  // 1. Upper Garment Slot (always active if upper selected)
  const upper = findSplitOption(family, state.upperId);
  if (upper) {
    slots.push({
      slotId: "jacket-primary",
      label: "Jacket Body & Facing",
      componentName: upper.name,
      fabricSource: "uploaded-fabric",
      description: "Primary tailored suit wool / blend assigned from your uploaded fabric reference.",
    });
  }

  // 2. Lower Garment Slot (always active if lower selected)
  const lower = findSplitOption(family, state.lowerId);
  if (lower) {
    slots.push({
      slotId: "trouser-primary",
      label: "Trouser Fabric",
      componentName: lower.name,
      fabricSource: "uploaded-fabric",
      description: "Matching or coordinated trousers tailored from your uploaded fabric.",
    });
  }

  // 3. Shirt Slot (active if shirt selected)
  const shirt = findSplitOption(family, state.shirtId);
  if (shirt) {
    slots.push({
      slotId: "shirt-material",
      label: "Shirt Weave",
      componentName: shirt.name,
      fabricSource: "atelier-standard",
      description: "Crisp white Egyptian cotton poplin or pleated Marcella weave.",
    });
  }

  // 4. Waistcoat Slot (active ONLY if a waistcoat is selected and not 'None')
  const waistcoat = findSplitOption(family, state.waistcoatId);
  if (waistcoat && waistcoat.id !== "SUIT_WAISTCOAT_NONE") {
    slots.push({
      slotId: "waistcoat-material",
      label: "Waistcoat Fabric",
      componentName: waistcoat.name,
      fabricSource: "uploaded-fabric",
      description: "Matching or bespoke contrasting waistcoat fabric.",
    });
  }

  // 5. Neckwear Slot (active if Tie or Bow Tie selected)
  if (state.accessoryIds.includes("SUIT_ACC_TIE")) {
    slots.push({
      slotId: "neckwear-material",
      label: "Necktie Silk",
      componentName: "Silk Necktie",
      fabricSource: "atelier-standard",
      description: "Hand-rolled woven mulberry silk in classic finish.",
    });
  } else if (state.accessoryIds.includes("SUIT_ACC_BOW_TIE")) {
    slots.push({
      slotId: "neckwear-material",
      label: "Bow Tie Silk",
      componentName: "Silk Bow Tie",
      fabricSource: "atelier-standard",
      description: "Black or midnight blue woven silk satin/grosgrain.",
    });
  }

  // 6. Pocket Square Slot (active if selected)
  if (state.accessoryIds.includes("SUIT_ACC_POCKET_SQUARE")) {
    slots.push({
      slotId: "pocket-square-material",
      label: "Pocket Square Fabric",
      componentName: "Pocket Square",
      fabricSource: "atelier-standard",
      description: "Hand-rolled pure Irish linen or printed silk twill.",
    });
  }

  // 7. Cufflinks Slot (active if selected)
  if (state.accessoryIds.includes("SUIT_ACC_CUFFLINKS")) {
    slots.push({
      slotId: "cufflinks-finish",
      label: "Cufflinks Metal Finish",
      componentName: "Bespoke Cufflinks",
      fabricSource: "atelier-standard",
      description: "Polished gold or rhodium-plated sterling silver tone.",
    });
  }

  // 8. Buttons Slot (active if selected)
  if (state.accessoryIds.includes("SUIT_ACC_BUTTONS")) {
    slots.push({
      slotId: "buttons-finish",
      label: "Suit Button Finish",
      componentName: "Custom Buttons",
      fabricSource: "atelier-standard",
      description: "Genuine carved natural horn or mother-of-pearl.",
    });
  }

  // 9. Footwear Slot (active if footwear selected)
  const footwear = findSplitOption(family, state.footwearId);
  if (footwear) {
    slots.push({
      slotId: "footwear-leather",
      label: "Footwear Leather",
      componentName: footwear.name,
      fabricSource: "atelier-standard",
      description: "Full-grain burnished calfskin or patent mirror leather.",
    });
  }

  return slots;
}

/**
 * Builds the complete Split Outfit summary view for reactive review.
 */
export function buildSplitOutfitSummary(state: SplitOutfitState): SplitOutfitSummary {
  const family = state.family;
  const upper = findSplitOption(family, state.upperId);
  const lower = findSplitOption(family, state.lowerId);
  const shirt = findSplitOption(family, state.shirtId);
  const waistcoat = findSplitOption(family, state.waistcoatId);
  const footwear = findSplitOption(family, state.footwearId);
  const accessories = state.accessoryIds
    .map((id) => findSplitOption(family, id))
    .filter((acc): acc is SplitComponentOption => acc !== null);

  const activeMaterialSlots = deriveActiveMaterialSlots(state);

  // An outfit is considered complete if upper, lower, shirt, and footwear are selected
  const isComplete = Boolean(upper && lower && shirt && footwear);

  return {
    family,
    upper,
    lower,
    shirt,
    waistcoat,
    footwear,
    accessories,
    activeMaterialSlots,
    isComplete,
  };
}
