import type { SignatureLook } from "./types";

/**
 * The Suit v1 Signature Look library — five foundation looks, one per
 * currently implemented Suit upper identity. This is HUMAN-CURATED product
 * data, hand-authored against the real Split catalogue
 * (lib/split-outfit/catalogue.ts) and the real compatibility rules
 * (lib/split-outfit/compatibility.ts) — every component ID below exists in
 * the live catalogue today; none is invented. See
 * tests/showroom-look-library.test.ts, which independently re-validates
 * every active look through the SAME compatibility engine the rest of the
 * app uses (no second, duplicated rule table).
 *
 * Only Suit looks are populated in this milestone. The schema
 * (lib/showroom/types.ts) is already generic across every SplitOutfitFamily
 * so a future 50+-look, multi-family library needs no redesign here — only
 * more entries in this array (or, per the architectural-extensibility
 * requirement, a future server/Redis-backed registry exposing the same
 * SignatureLook shape).
 */
export const SIGNATURE_LOOK_LIBRARY: SignatureLook[] = [
  {
    id: "LOOK_SUIT_CLASSIC_GENTLEMAN",
    name: "The Classic Gentleman",
    shortDescription: "A timeless single-breasted suit for business and formal daytime occasions.",
    family: "suit",
    status: "active",
    occasions: ["business", "reception"],
    stylePersonality: "classic",
    formality: 3,
    components: {
      upperId: "SUIT_UPPER_CLASSIC",
      lowerId: "SUIT_LOWER_CLASSIC_STRAIGHT",
      shirtId: "SUIT_SHIRT_CLASSIC_FORMAL",
      waistcoatId: "SUIT_WAISTCOAT_NONE",
      footwearId: "SUIT_SHOE_OXFORD",
      accessoryIds: ["SUIT_ACC_TIE", "SUIT_ACC_POCKET_SQUARE"],
    },
    styleNote: "The atelier's most versatile foundation — a clean two-piece silhouette that reads correctly in almost any formal daytime setting.",
    rankPriority: 1,
  },
  {
    id: "LOOK_SUIT_BOARDROOM_AUTHORITY",
    name: "The Boardroom Authority",
    shortDescription: "A structured double-breasted power suit for executive presence.",
    family: "suit",
    status: "active",
    occasions: ["business"],
    stylePersonality: "executive",
    formality: 4,
    components: {
      upperId: "SUIT_UPPER_DOUBLE_BREASTED",
      lowerId: "SUIT_LOWER_TAILORED_TAPERED",
      shirtId: "SUIT_SHIRT_SPREAD_COLLAR",
      waistcoatId: "SUIT_WAISTCOAT_NONE",
      footwearId: "SUIT_SHOE_OXFORD",
      accessoryIds: ["SUIT_ACC_TIE", "SUIT_ACC_CUFFLINKS"],
    },
    styleNote: "Roped shoulders and a 6x2 stance for a commanding, deliberate silhouette in the boardroom.",
    rankPriority: 2,
  },
  {
    id: "LOOK_SUIT_BLACK_TIE",
    name: "The Black Tie",
    shortDescription: "A traditional silk-lapel dinner jacket for black-tie evening events.",
    family: "suit",
    status: "active",
    occasions: ["black-tie", "formal-evening"],
    stylePersonality: "black-tie",
    formality: 5,
    components: {
      upperId: "SUIT_UPPER_TUXEDO",
      lowerId: "SUIT_LOWER_TUXEDO_TROUSER",
      shirtId: "SUIT_SHIRT_TUXEDO_PLEATED",
      waistcoatId: "SUIT_WAISTCOAT_TUXEDO",
      footwearId: "SUIT_SHOE_PATENT_OXFORD",
      accessoryIds: ["SUIT_ACC_BOW_TIE", "SUIT_ACC_POCKET_SQUARE"],
    },
    styleNote: "The full traditional evening dress code — satin peak lapel, pleated bib, and a deep-cut evening waistcoat.",
    rankPriority: 3,
  },
  {
    id: "LOOK_SUIT_THREE_PIECE_GENTLEMAN",
    name: "The Three-Piece Gentleman",
    shortDescription: "A waistcoated three-piece suit for weddings and formal ceremonies.",
    family: "suit",
    status: "active",
    occasions: ["wedding", "reception"],
    stylePersonality: "classic",
    formality: 4,
    components: {
      upperId: "SUIT_UPPER_THREE_PIECE",
      lowerId: "SUIT_LOWER_CLASSIC_STRAIGHT",
      shirtId: "SUIT_SHIRT_CLASSIC_FORMAL",
      waistcoatId: "SUIT_WAISTCOAT_CLASSIC",
      footwearId: "SUIT_SHOE_OXFORD",
      accessoryIds: ["SUIT_ACC_TIE", "SUIT_ACC_POCKET_SQUARE"],
    },
    styleNote: "A five-button waistcoat completes a classic wedding-day silhouette with quiet ceremonial formality.",
    rankPriority: 4,
  },
  {
    id: "LOOK_SUIT_STATEMENT_EVENING",
    name: "The Statement Evening",
    shortDescription: "A contemporary high-peak jacket for celebrations and modern-luxury evenings.",
    family: "suit",
    status: "active",
    occasions: ["celebration", "formal-evening"],
    stylePersonality: "modern-statement",
    formality: 4,
    components: {
      upperId: "SUIT_UPPER_STATEMENT",
      lowerId: "SUIT_LOWER_CONTEMPORARY",
      shirtId: "SUIT_SHIRT_SPREAD_COLLAR",
      waistcoatId: "SUIT_WAISTCOAT_NONE",
      footwearId: "SUIT_SHOE_PATENT_OXFORD",
      accessoryIds: ["SUIT_ACC_POCKET_SQUARE", "SUIT_ACC_CUFFLINKS"],
    },
    styleNote: "Dramatic peak lapels and a cropped contemporary trouser line for a fashion-forward celebration entrance.",
    rankPriority: 5,
  },
];
