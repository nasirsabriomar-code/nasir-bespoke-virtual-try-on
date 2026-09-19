import "server-only";

import { optionsForSlot } from "./compatibility";
import { SPLIT_SLOTS } from "./catalogue";
import type {
  SplitCatalogueView,
  SplitComponentOption,
  SplitComponentOptionView,
  SplitOutfitFamily,
} from "./types";

function toOptionView(option: SplitComponentOption): SplitComponentOptionView {
  return {
    id: option.id,
    categoryId: option.categoryId,
    customer: option.customer,
    rules: option.rules,
    compatibilityTags: option.compatibilityTags,
    materialRequirements: option.materialRequirements,
    // privatePath/checksum/provenance are deliberately dropped here — only
    // the status ever reaches the client, same rule as everything else in
    // this projection.
    ...(option.reference
      ? {
          reference: {
            status: option.reference.status,
            ...(option.reference.status === "active"
              ? { url: `/api/split-catalog-assets/${encodeURIComponent(option.reference.assetId)}` }
              : {}),
          },
        }
      : {}),
  };
}

/**
 * The client-safe catalogue projection for a family: every option's
 * presentation copy and rule data, with the server-only generation layer
 * (construction/prompt text) stripped entirely. This is what
 * /api/split-catalog serves.
 */
export function getSplitCatalogueView(family: SplitOutfitFamily): SplitCatalogueView {
  return {
    family,
    slots: SPLIT_SLOTS.map((slot) => ({
      id: slot.id,
      multi: slot.multi,
      required: slot.required,
      options: optionsForSlot(family, slot.id).map(toOptionView),
    })),
  };
}
