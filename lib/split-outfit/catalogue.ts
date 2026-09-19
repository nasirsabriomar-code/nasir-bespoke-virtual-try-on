import type { OptionRule } from "@/lib/rules/types";
import type {
  SplitComponentOption,
  SplitOutfitFamily,
  SplitOutfitState,
} from "./types";

export const DEFAULT_SPLIT_OUTFIT_STATE: SplitOutfitState = {
  family: "suit",
  upperId: "SUIT_UPPER_CLASSIC",
  lowerId: "SUIT_LOWER_NON_PLEATED",
  shirtId: "SUIT_SHIRT_CLASSIC_FORMAL",
  waistcoatId: "SUIT_WAISTCOAT_NONE",
  footwearId: "SUIT_SHOE_OXFORD",
  accessoryIds: ["SUIT_ACC_POCKET_SQUARE"],
};

/**
 * Slot dependency order. Array order IS the evaluation order: each slot's
 * rules are checked against the selections accepted from every slot before
 * it. Do not reorder without re-checking every rule below.
 */
export const SPLIT_SLOTS = [
  { id: "upper", stateKey: "upperId", multi: false, required: true },
  { id: "lower", stateKey: "lowerId", multi: false, required: true },
  { id: "inner-shirt", stateKey: "shirtId", multi: false, required: true },
  { id: "inner-waistcoat", stateKey: "waistcoatId", multi: false, required: false },
  { id: "footwear", stateKey: "footwearId", multi: false, required: true },
  { id: "accessory", stateKey: "accessoryIds", multi: true, required: false },
] as const;

// Named rule-set constants, following the same idiom as
// lib/bespoke/suit-profile.ts's `threePieceOnly`. Adding a new three-piece
// jacket in the future means editing this constant, not every waistcoat.
const threePieceUpper: OptionRule[] = [{ groupId: "upper", optionIds: ["SUIT_UPPER_THREE_PIECE"] }];
const tuxedoUpper: OptionRule[] = [{ groupId: "upper", optionIds: ["SUIT_UPPER_TUXEDO"] }];
// A tuxedo waistcoat is traditionally worn under a dinner jacket directly,
// not only as part of a labeled "three-piece" jacket — so its requirement is
// broader than the classic/formal waistcoats below.
const threePieceOrTuxedoUpper: OptionRule[] = [{ groupId: "upper", optionIds: ["SUIT_UPPER_THREE_PIECE", "SUIT_UPPER_TUXEDO"] }];
// Classic Formal and the Tuxedo shirt both carry French double cuffs (see
// their `customer.details`); Spread Collar has rounded barrel cuffs instead.
const frenchCuffShirt: OptionRule[] = [{ groupId: "inner-shirt", optionIds: ["SUIT_SHIRT_CLASSIC_FORMAL", "SUIT_SHIRT_TUXEDO_PLEATED"] }];
const bowTieSelected: OptionRule[] = [{ groupId: "accessory", optionIds: ["SUIT_ACC_BOW_TIE"] }];
const tieSelected: OptionRule[] = [{ groupId: "accessory", optionIds: ["SUIT_ACC_TIE"] }];

// Approval ledger for jacket/trouser reference photographs — the only two
// categories that ever get one, per the hybrid-fidelity decision. Empty
// until real photography is approved; every option below resolves to
// "awaiting-upload" until its entry appears here, mirroring
// lib/catalog/level1-seed.ts's APPROVED_*_ASSETS pattern exactly.
const APPROVED_SPLIT_REFERENCES: Record<string, {
  privatePath: string;
  checksum: string;
  provenance: string;
  contentType: "image/png" | "image/jpeg" | "image/webp";
}> = {
  // e.g. SUIT_UPPER_CLASSIC: { privatePath: "nasir-bespoke/catalogue/split/v1/SUIT_UPPER_CLASSIC/approved.jpg", checksum: "...", provenance: "...", contentType: "image/jpeg" },
};

function referenceFor(optionId: string): NonNullable<SplitComponentOption["reference"]> {
  const approved = APPROVED_SPLIT_REFERENCES[optionId];
  const assetId = `${optionId}_REFERENCE_V1`;
  return approved
    ? { assetId, status: "active", ...approved }
    : { assetId, status: "awaiting-upload" };
}

// 01 — UPPER GARMENTS (SUIT)
export const SUIT_UPPER_OPTIONS: SplitComponentOption[] = [
  {
    id: "SUIT_UPPER_CLASSIC",
    categoryId: "upper",
    family: "suit",
    customer: {
      name: "Classic",
      subtitle: "Single-breasted 2-button",
      description: "Tailored notch lapel, structured natural shoulder, two-button front stance, and dual rear vents.",
      details: ["Notch Lapel (3.25 in)", "2-Button Single Breasted", "Double Back Vent", "Flap Pockets with Ticket Pocket"],
      imagePlaceholderLabel: "Classic Suit Jacket",
    },
    materialRequirements: [
      {
        slotId: "jacket-primary",
        label: "Jacket Body & Sleeves",
        defaultFabricSource: "uploaded-fabric",
        description: "Primary tailored suit wool / blend from your uploaded fabric.",
      },
    ],
    compatibilityTags: ["formal", "business", "reception", "dinner"],
    reference: referenceFor("SUIT_UPPER_CLASSIC"),
    generation: {
      constructionFragment: "Single-breasted two-button jacket with notch lapel, structured natural shoulder, and a double back vent.",
    },
  },
  {
    id: "SUIT_UPPER_DOUBLE_BREASTED",
    categoryId: "upper",
    family: "suit",
    customer: {
      name: "Double-Breasted",
      subtitle: "6x2 Peak lapel power jacket",
      description: "Bold peak lapels, 6x2 button fastening, firm roped shoulders, and sharp architectural waist suppression.",
      details: ["Wide Peak Lapel (4.0 in)", "6x2 Double Breasted", "Roped Pagoda Shoulders", "Jetted Pockets"],
      imagePlaceholderLabel: "Double-Breasted Jacket",
    },
    materialRequirements: [
      {
        slotId: "jacket-primary",
        label: "Jacket Body & Sleeves",
        defaultFabricSource: "uploaded-fabric",
        description: "Primary tailored suit wool / blend from your uploaded fabric.",
      },
    ],
    compatibilityTags: ["formal", "evening", "statement"],
    reference: referenceFor("SUIT_UPPER_DOUBLE_BREASTED"),
    generation: {
      constructionFragment: "Double-breasted jacket with wide peak lapels, 6x2 button fastening, roped shoulders, and jetted pockets.",
    },
  },
  {
    id: "SUIT_UPPER_TUXEDO",
    categoryId: "upper",
    family: "suit",
    customer: {
      name: "Tuxedo",
      subtitle: "Silk satin peak lapel dinner jacket",
      description: "Grosgrain or silk satin lapel facing, single covered silk button closure, jetted evening pockets, no back vent.",
      details: ["Silk Satin Peak Lapel", "Single Covered Button", "Unvented Evening Back", "Silk Jetted Pockets"],
      imagePlaceholderLabel: "Tuxedo Dinner Jacket",
    },
    materialRequirements: [
      {
        slotId: "jacket-primary",
        label: "Jacket Body & Sleeves",
        defaultFabricSource: "uploaded-fabric",
        description: "Primary evening suiting fabric with silk satin contrast facings.",
      },
    ],
    compatibilityTags: ["black-tie", "gala", "red-carpet"],
    reference: referenceFor("SUIT_UPPER_TUXEDO"),
    generation: {
      constructionFragment: "Dinner jacket with silk satin peak lapel facing, single covered silk button closure, and an unvented back.",
    },
  },
  {
    id: "SUIT_UPPER_THREE_PIECE",
    categoryId: "upper",
    family: "suit",
    customer: {
      name: "Three-Piece",
      subtitle: "Waistcoat-compatible tailored jacket",
      description: "Slightly deeper front gorge designed specifically to frame a matching or contrast tailored waistcoat.",
      details: ["Slim Notch Lapel", "2-Button Stance", "Waistcoat Reveal Cut", "Side Adjuster Accommodation"],
      imagePlaceholderLabel: "Three-Piece Suit Jacket",
    },
    materialRequirements: [
      {
        slotId: "jacket-primary",
        label: "Jacket Body & Sleeves",
        defaultFabricSource: "uploaded-fabric",
        description: "Primary tailored suit wool / blend from your uploaded fabric.",
      },
    ],
    compatibilityTags: ["ceremony", "wedding", "formal-business"],
    reference: referenceFor("SUIT_UPPER_THREE_PIECE"),
    generation: {
      constructionFragment: "Jacket cut with a deeper front gorge specifically to reveal a matching or contrast waistcoat beneath.",
    },
  },
  {
    id: "SUIT_UPPER_STATEMENT",
    categoryId: "upper",
    family: "suit",
    customer: {
      name: "Statement",
      subtitle: "Contemporary high-gorge peak jacket",
      description: "Exaggerated peak lapels, angled hacking pockets, one-button closure, and high side vents for sartorial flair.",
      details: ["Dramatic High Peak Lapel", "Single Button Stance", "Angled Hacking Pockets", "High Side Vents"],
      imagePlaceholderLabel: "Statement Peak Jacket",
    },
    materialRequirements: [
      {
        slotId: "jacket-primary",
        label: "Jacket Body & Sleeves",
        defaultFabricSource: "uploaded-fabric",
        description: "Primary tailored suit wool / blend from your uploaded fabric.",
      },
    ],
    compatibilityTags: ["evening", "fashion-forward", "celebration"],
    reference: referenceFor("SUIT_UPPER_STATEMENT"),
    generation: {
      constructionFragment: "Jacket with exaggerated high peak lapels, angled hacking pockets, one-button closure, and high side vents.",
    },
  },
];

const trouserFabric = {
  slotId: "trouser-primary" as const,
  label: "Trousers",
  defaultFabricSource: "uploaded-fabric" as const,
  description: "Matching or coordinated trousers from your uploaded fabric.",
};

// 02 — LOWER GARMENTS (TROUSERS)
export const SUIT_LOWER_OPTIONS: SplitComponentOption[] = [
  {
    id: "SUIT_LOWER_NON_PLEATED",
    categoryId: "lower",
    family: "suit",
    customer: {
      name: "Non-pleated",
      subtitle: "Flat-front tailored trousers",
      description: "Clean flat front with no pleats, mid rise, straight leg through the thigh and calf, and a slight break over the shoe.",
      details: ["Flat Front", "No Pleats", "Mid Rise", "Straight Leg", "Slight Break"],
      imagePlaceholderLabel: "Non-pleated Trouser",
    },
    materialRequirements: [trouserFabric],
    compatibilityTags: ["classic", "business", "formal"],
    reference: referenceFor("SUIT_LOWER_NON_PLEATED"),
    generation: {
      constructionFragment: "Mid-rise flat-front trousers with no pleats, a straight leg, and a slight break over the shoe.",
    },
  },
  {
    id: "SUIT_LOWER_ONE_PLEAT",
    categoryId: "lower",
    family: "suit",
    customer: {
      name: "One-pleated",
      subtitle: "Single forward pleat",
      description: "One forward pleat on each side for ease through the hip, mid-to-high rise, and a straight leg with a modest break.",
      details: ["Single Forward Pleat", "Mid-to-High Rise", "Straight Leg", "Modest Break"],
      imagePlaceholderLabel: "One-pleated Trouser",
    },
    materialRequirements: [trouserFabric],
    compatibilityTags: ["classic", "formal"],
    reference: referenceFor("SUIT_LOWER_ONE_PLEAT"),
    generation: {
      constructionFragment: "Mid-to-high rise trousers with a single forward pleat on each side and a straight leg.",
    },
  },
  {
    id: "SUIT_LOWER_TWO_PLEAT",
    categoryId: "lower",
    family: "suit",
    customer: {
      name: "Two-pleated",
      subtitle: "Double forward pleats",
      description: "Two forward pleats on each side, higher rise, fuller drape through the thigh, and a classic break.",
      details: ["Double Forward Pleats", "High Rise", "Fuller Thigh Drape", "Classic Break"],
      imagePlaceholderLabel: "Two-pleated Trouser",
    },
    materialRequirements: [trouserFabric],
    compatibilityTags: ["sartorial", "heritage", "formal"],
    reference: referenceFor("SUIT_LOWER_TWO_PLEAT"),
    generation: {
      constructionFragment: "High-rise trousers with two forward pleats on each side, fuller thigh drape, and a classic break.",
    },
  },
  {
    id: "SUIT_LOWER_THREE_PLEAT",
    categoryId: "lower",
    family: "suit",
    customer: {
      name: "Three-pleated",
      subtitle: "Triple forward pleats",
      description: "Three forward pleats on each side, high rise, generous volume through the hip and thigh, and a full break.",
      details: ["Triple Forward Pleats", "High Rise", "Generous Volume", "Full Break"],
      imagePlaceholderLabel: "Three-pleated Trouser",
    },
    materialRequirements: [trouserFabric],
    compatibilityTags: ["heritage", "volume"],
    reference: referenceFor("SUIT_LOWER_THREE_PLEAT"),
    generation: {
      constructionFragment: "High-rise trousers with three forward pleats on each side, generous hip and thigh volume, and a full break.",
    },
  },
  {
    id: "SUIT_LOWER_CASUAL",
    categoryId: "lower",
    family: "suit",
    customer: {
      name: "Casual",
      subtitle: "Unstructured relaxed trousers",
      description: "Softer unstructured trousers without a sharp crease, easy rise, relaxed thigh, and a natural hem with little or no break.",
      details: ["No Sharp Crease", "Relaxed Thigh", "Easy Rise", "Natural Hem"],
      imagePlaceholderLabel: "Casual Trouser",
    },
    materialRequirements: [trouserFabric],
    compatibilityTags: ["casual", "unstructured"],
    reference: referenceFor("SUIT_LOWER_CASUAL"),
    generation: {
      constructionFragment: "Unstructured casual trousers with no sharp front crease, a relaxed thigh, and a natural hem.",
    },
  },
  {
    id: "SUIT_LOWER_DENIM",
    categoryId: "lower",
    family: "suit",
    customer: {
      name: "Denim",
      subtitle: "Five-pocket jean construction",
      description: "Jean-cut trousers with a yoke, five-pocket layout, coin pocket, and a straight to slightly tapered leg. Cloth still comes from the uploaded fabric.",
      details: ["Five-Pocket Layout", "Yoke Back", "Coin Pocket", "Straight to Slight Taper"],
      imagePlaceholderLabel: "Denim Trouser",
    },
    materialRequirements: [trouserFabric],
    compatibilityTags: ["casual", "jean-cut"],
    reference: referenceFor("SUIT_LOWER_DENIM"),
    generation: {
      constructionFragment: "Five-pocket trousers with a jean yoke, riveted coin pocket, and a straight to slightly tapered leg.",
    },
  },
  {
    id: "SUIT_LOWER_GORKHA",
    categoryId: "lower",
    family: "suit",
    customer: {
      name: "Gorkha",
      subtitle: "Buckle-tab Gurkha waist",
      description: "High-rise Gurkha trousers with a double buckle-tab waist, no belt loops, deep front overlap, and a taper through the calf.",
      details: ["Double Buckle-Tab Waist", "No Belt Loops", "High Rise", "Tapered Calf"],
      imagePlaceholderLabel: "Gorkha Trouser",
    },
    materialRequirements: [trouserFabric],
    compatibilityTags: ["gurkha", "formal", "statement"],
    reference: referenceFor("SUIT_LOWER_GORKHA"),
    generation: {
      constructionFragment: "High-rise Gurkha trousers with a double buckle-tab waist closure, no belt loops, and a tapered calf.",
    },
  },
  {
    id: "SUIT_LOWER_PARALLEL",
    categoryId: "lower",
    family: "suit",
    customer: {
      name: "Parallel",
      subtitle: "Even-width straight leg",
      description: "Straight parallel trousers that hold the same width from thigh to hem, mid rise, flat or lightly creased front, and a clean even fall.",
      details: ["Even Width Hip to Hem", "Mid Rise", "Straight Parallel Leg", "Clean Fall"],
      imagePlaceholderLabel: "Parallel Trouser",
    },
    materialRequirements: [trouserFabric],
    compatibilityTags: ["classic", "straight", "formal"],
    reference: referenceFor("SUIT_LOWER_PARALLEL"),
    generation: {
      constructionFragment: "Mid-rise parallel trousers with an even-width straight leg from thigh to hem and a clean even fall.",
    },
  },
  {
    id: "SUIT_LOWER_BAGGY",
    categoryId: "lower",
    family: "suit",
    customer: {
      name: "Baggy",
      subtitle: "Full seat and wide leg",
      description: "Extra volume through the seat and thigh, a wide straight leg, and a stacked or generous break at the shoe.",
      details: ["Full Seat", "Wide Leg", "Generous Volume", "Stacked or Generous Break"],
      imagePlaceholderLabel: "Baggy Trouser",
    },
    materialRequirements: [trouserFabric],
    compatibilityTags: ["volume", "relaxed"],
    reference: referenceFor("SUIT_LOWER_BAGGY"),
    generation: {
      constructionFragment: "Baggy trousers with extra volume through the seat and thigh, a wide straight leg, and a generous break.",
    },
  },
  {
    id: "SUIT_LOWER_TRENDY",
    categoryId: "lower",
    family: "suit",
    customer: {
      name: "Trendy",
      subtitle: "Contemporary cropped wide line",
      description: "Modern cropped wide-leg trousers sitting at the ankle, clean waist, no traditional crease, and a fashion-forward fall.",
      details: ["Cropped Ankle Length", "Wide Contemporary Leg", "Clean Waist", "No Traditional Crease"],
      imagePlaceholderLabel: "Trendy Trouser",
    },
    materialRequirements: [trouserFabric],
    compatibilityTags: ["fashion-forward", "contemporary"],
    reference: referenceFor("SUIT_LOWER_TRENDY"),
    generation: {
      constructionFragment: "Contemporary cropped wide-leg trousers sitting at the ankle, with a clean waist and no traditional crease.",
    },
  },
];

// 03 — INNER GARMENTS: SHIRTS
export const SUIT_SHIRT_OPTIONS: SplitComponentOption[] = [
  {
    id: "SUIT_SHIRT_CLASSIC_FORMAL",
    categoryId: "inner-shirt",
    family: "suit",
    customer: {
      name: "Classic Formal",
      subtitle: "Semi-spread collar & French cuffs",
      description: "Crisp two-ply poplin shirt with semi-spread collar, French double cuffs for cufflinks, and plain placket.",
      details: ["Semi-Spread Collar (3.0 in)", "French Double Cuffs", "Plain Front Placket", "100% Egyptian Cotton"],
      imagePlaceholderLabel: "Classic Dress Shirt",
    },
    materialRequirements: [
      {
        slotId: "shirt-material",
        label: "Dress Shirt Fabric",
        defaultFabricSource: "atelier-standard",
        description: "Crisp white or light-blue 2-ply Egyptian cotton poplin.",
      },
    ],
    compatibilityTags: ["formal", "business", "versatile", "french-cuffs"],
    generation: {
      constructionFragment: "Two-ply poplin dress shirt with a semi-spread collar and French double cuffs.",
    },
  },
  {
    id: "SUIT_SHIRT_SPREAD_COLLAR",
    categoryId: "inner-shirt",
    family: "suit",
    customer: {
      name: "Spread Collar",
      subtitle: "Cutaway spread collar & barrel cuffs",
      description: "Wide cutaway collar framing neckwear knots prominently, convertible 2-button rounded barrel cuffs.",
      details: ["Cutaway Spread Collar", "Rounded Barrel Cuffs", "Removable Collar Stays", "Fine Twill Weave"],
      imagePlaceholderLabel: "Spread Collar Shirt",
    },
    materialRequirements: [
      {
        slotId: "shirt-material",
        label: "Dress Shirt Fabric",
        defaultFabricSource: "atelier-standard",
        description: "Fine luxury twill or royal oxford cotton.",
      },
    ],
    compatibilityTags: ["modern", "statement-tie"],
    generation: {
      constructionFragment: "Twill dress shirt with a wide cutaway spread collar and convertible rounded barrel cuffs.",
    },
  },
  {
    id: "SUIT_SHIRT_TUXEDO_PLEATED",
    categoryId: "inner-shirt",
    family: "suit",
    customer: {
      name: "Tuxedo Shirt",
      subtitle: "Pleated bib front & French cuffs",
      description: "Classic black-tie dress shirt with pleated Marcella bib, stud front fastening, and stiff turn-down collar.",
      details: ["Pleated Marcella Bib Front", "Stud Hole Closures", "Evening Turn-Down Collar", "French Cuffs"],
      imagePlaceholderLabel: "Tuxedo Pleated Shirt",
    },
    materialRequirements: [
      {
        slotId: "shirt-material",
        label: "Tuxedo Shirt Fabric",
        defaultFabricSource: "atelier-standard",
        description: "White Marcella pique or pleated fine poplin evening cotton.",
      },
    ],
    compatibilityTags: ["black-tie", "evening", "french-cuffs"],
    rules: {
      recommendedWhen: tuxedoUpper,
      reasons: { recommendedWhen: "Recommended with a tuxedo." },
    },
    generation: {
      constructionFragment: "Evening dress shirt with a pleated Marcella bib front, stud closures, and French cuffs.",
    },
  },
];

// 03 — INNER GARMENTS: WAISTCOATS (EXTRA)
export const SUIT_WAISTCOAT_OPTIONS: SplitComponentOption[] = [
  {
    id: "SUIT_WAISTCOAT_NONE",
    categoryId: "inner-waistcoat",
    family: "suit",
    customer: {
      name: "None",
      subtitle: "Two-piece suit (no waistcoat)",
      description: "Standard two-piece suit configuration without a waistcoat layer.",
      details: ["No Vest Layer", "Clean 2-Piece Profile"],
      imagePlaceholderLabel: "No Waistcoat",
    },
    rules: {
      conflictsWith: threePieceUpper,
      reasons: { conflictsWith: "A three-piece suit includes a waistcoat." },
    },
    generation: {
      constructionFragment: "No waistcoat layer.",
    },
  },
  {
    id: "SUIT_WAISTCOAT_CLASSIC",
    categoryId: "inner-waistcoat",
    family: "suit",
    customer: {
      name: "Classic",
      subtitle: "Single-breasted 5-button waistcoat",
      description: "V-neck silhouette, five horn buttons, welt watch pockets, back cinch adjuster with silk lining.",
      details: ["5-Button Single Breasted", "Notched Hemline", "Dual Welt Pockets", "Rear Cinch Adjuster"],
      imagePlaceholderLabel: "Classic 5-Button Waistcoat",
    },
    materialRequirements: [
      {
        slotId: "waistcoat-material",
        label: "Waistcoat Fabric",
        defaultFabricSource: "uploaded-fabric",
        description: "Matching suit fabric or complementary bespoke waistcoat fabric.",
      },
    ],
    compatibilityTags: ["three-piece", "formal", "wedding"],
    rules: {
      requires: threePieceUpper,
      reasons: { requires: "Requires a three-piece jacket." },
    },
    generation: {
      constructionFragment: "Single-breasted five-button waistcoat with a notched hemline and dual welt pockets.",
    },
  },
  {
    id: "SUIT_WAISTCOAT_FORMAL",
    categoryId: "inner-waistcoat",
    family: "suit",
    customer: {
      name: "Formal",
      subtitle: "Double-breasted shawl collar waistcoat",
      description: "Low-cut horseshoe opening with neat shawl collar, 6x3 button layout, square straight-cut hem.",
      details: ["6x3 Double Breasted", "Shawl Lapel", "Straight Cut Hem", "Formal Horseshoe Opening"],
      imagePlaceholderLabel: "Double-Breasted Waistcoat",
    },
    materialRequirements: [
      {
        slotId: "waistcoat-material",
        label: "Waistcoat Fabric",
        defaultFabricSource: "uploaded-fabric",
        description: "Matching or contrasting bespoke waistcoat fabric.",
      },
    ],
    compatibilityTags: ["ceremony", "regal", "formal"],
    rules: {
      requires: threePieceUpper,
      reasons: { requires: "Requires a three-piece jacket." },
    },
    generation: {
      constructionFragment: "Double-breasted shawl-collar waistcoat with a horseshoe opening and a straight-cut hem.",
    },
  },
  {
    id: "SUIT_WAISTCOAT_TUXEDO",
    categoryId: "inner-waistcoat",
    family: "suit",
    customer: {
      name: "Tuxedo",
      subtitle: "Deep-cut black-tie evening vest",
      description: "Deep evening U-cut in matching black satin facing, designed to remain concealed under buttoned dinner jacket.",
      details: ["Deep U-Cut Black-Tie Profile", "3 Covered Silk Buttons", "Backless / Light Strap", "Satin Trim"],
      imagePlaceholderLabel: "Evening Tuxedo Waistcoat",
    },
    materialRequirements: [
      {
        slotId: "waistcoat-material",
        label: "Tuxedo Waistcoat Fabric",
        defaultFabricSource: "atelier-standard",
        description: "Black silk satin or Marcella evening fabric.",
      },
    ],
    compatibilityTags: ["black-tie", "evening"],
    rules: {
      // A tuxedo waistcoat pairs with the tuxedo jacket directly, not only
      // with the separately-labeled "three-piece" jacket.
      requires: threePieceOrTuxedoUpper,
      recommendedWhen: tuxedoUpper,
      reasons: {
        requires: "Requires a three-piece jacket or a tuxedo.",
        recommendedWhen: "Recommended with a tuxedo.",
      },
    },
    generation: {
      constructionFragment: "Deep U-cut evening waistcoat in black satin, designed to stay concealed under a buttoned dinner jacket.",
    },
  },
];

// 04 — FOOTWEAR
export const SUIT_FOOTWEAR_OPTIONS: SplitComponentOption[] = [
  {
    id: "SUIT_SHOE_OXFORD",
    categoryId: "footwear",
    family: "suit",
    customer: {
      name: "Oxford",
      subtitle: "Cap-toe closed-lacing dress shoe",
      description: "Full-grain calfskin leather, Goodyear-welted closed lacing system, stitched cap toe, leather sole.",
      details: ["Closed Lacing", "Stitched Cap Toe", "Burnished Calf Leather", "Leather Sole"],
      imagePlaceholderLabel: "Cap-Toe Oxford Shoe",
    },
    materialRequirements: [
      {
        slotId: "footwear-leather",
        label: "Footwear Leather",
        defaultFabricSource: "atelier-standard",
        description: "Black or dark brown burnished full-grain calfskin leather.",
      },
    ],
    compatibilityTags: ["formal", "business", "classic"],
    generation: {
      constructionFragment: "Cap-toe Oxford shoes in burnished calfskin with closed lacing and a leather sole.",
    },
  },
  {
    id: "SUIT_SHOE_DERBY",
    categoryId: "footwear",
    family: "suit",
    customer: {
      name: "Derby",
      subtitle: "Plain-toe open-lacing dress shoe",
      description: "Versatile open lacing construction offering comfortable instep flexibility and a sleek tailored profile.",
      details: ["Open Lacing", "Plain Toe Silhouette", "Hand-Finished Leather", "Bevellled Waist Sole"],
      imagePlaceholderLabel: "Plain Derby Shoe",
    },
    materialRequirements: [
      {
        slotId: "footwear-leather",
        label: "Footwear Leather",
        defaultFabricSource: "atelier-standard",
        description: "Rich dark espresso or oxblood calfskin leather.",
      },
    ],
    compatibilityTags: ["smart", "contemporary"],
    rules: {
      discouragedWhen: tuxedoUpper,
      reasons: { discouragedWhen: "Unconventional with a tuxedo — patent Oxfords are traditional." },
    },
    generation: {
      constructionFragment: "Plain-toe Derby shoes with open lacing and a hand-finished leather upper.",
    },
  },
  {
    id: "SUIT_SHOE_LOAFER",
    categoryId: "footwear",
    family: "suit",
    customer: {
      name: "Loafer",
      subtitle: "Penny / Belgian slip-on shoe",
      description: "Slip-on construction with hand-sewn apron, low stacked heel, refined contemporary lounge profile.",
      details: ["Slip-On Apron Toe", "Penny Saddle Strap", "Supple Calf / Suede", "Lounge Profile"],
      imagePlaceholderLabel: "Dress Loafer Shoe",
    },
    materialRequirements: [
      {
        slotId: "footwear-leather",
        label: "Footwear Leather",
        defaultFabricSource: "atelier-standard",
        description: "Supple polished calfskin or velvet-soft suede.",
      },
    ],
    compatibilityTags: ["reception", "summer-formal", "contemporary"],
    rules: {
      discouragedWhen: tuxedoUpper,
      reasons: { discouragedWhen: "Unconventional with a tuxedo — patent Oxfords are traditional." },
    },
    generation: {
      constructionFragment: "Slip-on penny loafers with a hand-sewn apron toe in supple leather.",
    },
  },
  {
    id: "SUIT_SHOE_PATENT_OXFORD",
    categoryId: "footwear",
    family: "suit",
    customer: {
      name: "Patent Oxford",
      subtitle: "Mirror-finish black-tie evening shoe",
      description: "High-gloss mirror patent leather, seamless wholecut or plain toe, grosgrain laces for black-tie dress codes.",
      details: ["Mirror Patent Finish", "Plain Toe Wholecut", "Grosgrain Ribbon Laces", "Formal Black Sole"],
      imagePlaceholderLabel: "Patent Leather Evening Oxford",
    },
    materialRequirements: [
      {
        slotId: "footwear-leather",
        label: "Patent Leather",
        defaultFabricSource: "atelier-standard",
        description: "High-gloss black patent mirror leather.",
      },
    ],
    compatibilityTags: ["black-tie", "evening-exclusive"],
    rules: {
      recommendedWhen: tuxedoUpper,
      reasons: { recommendedWhen: "Recommended with a tuxedo." },
    },
    generation: {
      constructionFragment: "Mirror-finish patent leather Oxford shoes with grosgrain ribbon laces.",
    },
  },
];

// 05 — ACCESSORIES (MULTI-SELECT)
export const SUIT_ACCESSORY_OPTIONS: SplitComponentOption[] = [
  {
    id: "SUIT_ACC_TIE",
    categoryId: "accessory",
    family: "suit",
    customer: {
      name: "Tie",
      subtitle: "Mulberry silk necktie",
      description: "Hand-rolled 8cm mulberry silk necktie tied in a clean four-in-hand knot with dimple.",
      details: ["8cm Blade Width", "100% Woven Mulberry Silk", "Hand-Rolled Edges"],
      imagePlaceholderLabel: "Silk Necktie",
    },
    materialRequirements: [
      {
        slotId: "neckwear-material",
        label: "Necktie Silk",
        defaultFabricSource: "atelier-standard",
        description: "Solid or micro-patterned woven mulberry silk.",
      },
    ],
    compatibilityTags: ["business", "formal", "daytime"],
    rules: {
      conflictsWith: bowTieSelected,
      reasons: { conflictsWith: "A tie and a bow tie cannot be worn together." },
    },
    generation: {
      constructionFragment: "A hand-rolled mulberry silk necktie tied in a four-in-hand knot.",
    },
  },
  {
    id: "SUIT_ACC_BOW_TIE",
    categoryId: "accessory",
    family: "suit",
    customer: {
      name: "Bow Tie",
      subtitle: "Self-tie silk bow tie",
      description: "Self-tie butterfly or diamond-point bow tie in matching satin or grosgrain silk.",
      details: ["Self-Tie Butterfly Shape", "Silk Satin / Grosgrain", "Adjustable Collar Sizing"],
      imagePlaceholderLabel: "Silk Bow Tie",
    },
    materialRequirements: [
      {
        slotId: "neckwear-material",
        label: "Bow Tie Silk",
        defaultFabricSource: "atelier-standard",
        description: "Black or midnight blue woven silk satin/grosgrain.",
      },
    ],
    compatibilityTags: ["black-tie", "evening"],
    rules: {
      conflictsWith: tieSelected,
      recommendedWhen: tuxedoUpper,
      reasons: {
        conflictsWith: "A tie and a bow tie cannot be worn together.",
        recommendedWhen: "Recommended with a tuxedo.",
      },
    },
    generation: {
      constructionFragment: "A self-tie silk satin bow tie in a butterfly shape.",
    },
  },
  {
    id: "SUIT_ACC_POCKET_SQUARE",
    categoryId: "accessory",
    family: "suit",
    customer: {
      name: "Pocket Square",
      subtitle: "Linen / silk breast pocket square",
      description: "Hand-stitched pocket square worn in a crisp presidential straight fold or relaxed puff.",
      details: ["33x33 cm Square", "Hand-Rolled Hem", "Pure Irish Linen / Silk"],
      imagePlaceholderLabel: "Pocket Square",
    },
    materialRequirements: [
      {
        slotId: "pocket-square-material",
        label: "Pocket Square Fabric",
        defaultFabricSource: "atelier-standard",
        description: "Crisp white linen or printed silk twill.",
      },
    ],
    compatibilityTags: ["universal", "accent"],
    generation: {
      constructionFragment: "A hand-rolled linen or silk pocket square in a crisp presidential fold.",
    },
  },
  {
    id: "SUIT_ACC_CUFFLINKS",
    categoryId: "accessory",
    family: "suit",
    customer: {
      name: "Cufflinks",
      subtitle: "Atelier engraved metal cufflinks",
      description: "Pair of polished gold or silver-tone metal cufflinks for French double cuffs.",
      details: ["Solid Brass / Sterling Silver Tone", "Whale Back Closure", "Engraved Atelier Monogram"],
      imagePlaceholderLabel: "Metal Cufflinks",
    },
    materialRequirements: [
      {
        slotId: "cufflinks-finish",
        label: "Cufflinks Finish",
        defaultFabricSource: "atelier-standard",
        description: "Polished yellow gold, rose gold, or rhodium silver finish.",
      },
    ],
    compatibilityTags: ["french-cuffs", "formal"],
    rules: {
      requires: frenchCuffShirt,
      reasons: { requires: "Requires a shirt with French cuffs." },
    },
    generation: {
      constructionFragment: "A pair of polished metal cufflinks worn with French double cuffs.",
    },
  },
  {
    id: "SUIT_ACC_BUTTONS",
    categoryId: "accessory",
    family: "suit",
    customer: {
      name: "Buttons",
      subtitle: "Horn / Mother-of-pearl suit buttons",
      description: "Genuine carved natural horn or iridescent mother-of-pearl buttons for front and cuffs.",
      details: ["Natural Horn / Mother-of-Pearl", "4-Hole Tailored Anchor", "Cross-Stitched"],
      imagePlaceholderLabel: "Custom Suit Buttons",
    },
    materialRequirements: [
      {
        slotId: "buttons-finish",
        label: "Button Material",
        defaultFabricSource: "atelier-standard",
        description: "Matte smoked horn, dark brown horn, or mother-of-pearl.",
      },
    ],
    compatibilityTags: ["tailoring-detail", "bespoke"],
    generation: {
      constructionFragment: "Natural horn or mother-of-pearl buttons on the jacket front and cuffs.",
    },
  },
];

export const SPLIT_CATALOGUE_BY_FAMILY: Record<
  SplitOutfitFamily,
  {
    uppers: SplitComponentOption[];
    lowers: SplitComponentOption[];
    shirts: SplitComponentOption[];
    waistcoats: SplitComponentOption[];
    footwear: SplitComponentOption[];
    accessories: SplitComponentOption[];
  }
> = {
  suit: {
    uppers: SUIT_UPPER_OPTIONS,
    lowers: SUIT_LOWER_OPTIONS,
    shirts: SUIT_SHIRT_OPTIONS,
    waistcoats: SUIT_WAISTCOAT_OPTIONS,
    footwear: SUIT_FOOTWEAR_OPTIONS,
    accessories: SUIT_ACCESSORY_OPTIONS,
  },
  sherwani: {
    uppers: [],
    lowers: [],
    shirts: [],
    waistcoats: [],
    footwear: [],
    accessories: [],
  },
  bandhgala: {
    uppers: [],
    lowers: [],
    shirts: [],
    waistcoats: [],
    footwear: [],
    accessories: [],
  },
  "nehru-jacket": {
    uppers: [],
    lowers: [],
    shirts: [],
    waistcoats: [],
    footwear: [],
    accessories: [],
  },
  "kurta-set": {
    uppers: [],
    lowers: [],
    shirts: [],
    waistcoats: [],
    footwear: [],
    accessories: [],
  },
  "indo-western": {
    uppers: [],
    lowers: [],
    shirts: [],
    waistcoats: [],
    footwear: [],
    accessories: [],
  },
  achkan: {
    uppers: [],
    lowers: [],
    shirts: [],
    waistcoats: [],
    footwear: [],
    accessories: [],
  },
};
