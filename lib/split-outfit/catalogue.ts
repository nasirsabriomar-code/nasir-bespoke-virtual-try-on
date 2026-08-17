import type {
  SplitComponentOption,
  SplitOutfitFamily,
  SplitOutfitState,
} from "./types";

export const DEFAULT_SPLIT_OUTFIT_STATE: SplitOutfitState = {
  family: "suit",
  upperId: "SUIT_UPPER_CLASSIC",
  lowerId: "SUIT_LOWER_CLASSIC_STRAIGHT",
  shirtId: "SUIT_SHIRT_CLASSIC_FORMAL",
  waistcoatId: "SUIT_WAISTCOAT_NONE",
  footwearId: "SUIT_SHOE_OXFORD",
  accessoryIds: ["SUIT_ACC_POCKET_SQUARE"],
  materials: {
    "jacket-primary": "uploaded-fabric",
    "trouser-primary": "uploaded-fabric",
    "shirt-material": "atelier-standard",
    "pocket-square-material": "atelier-standard",
    "footwear-leather": "atelier-standard",
  },
};

// 01 — UPPER GARMENTS (SUIT)
export const SUIT_UPPER_OPTIONS: SplitComponentOption[] = [
  {
    id: "SUIT_UPPER_CLASSIC",
    categoryId: "upper",
    family: "suit",
    name: "Classic",
    subtitle: "Single-breasted 2-button",
    description: "Tailored notch lapel, structured natural shoulder, two-button front stance, and dual rear vents.",
    details: ["Notch Lapel (3.25 in)", "2-Button Single Breasted", "Double Back Vent", "Flap Pockets with Ticket Pocket"],
    imagePlaceholderLabel: "Classic Suit Jacket",
    materialRequirements: [
      {
        slotId: "jacket-primary",
        label: "Jacket Body & Sleeves",
        defaultFabricSource: "uploaded-fabric",
        description: "Primary tailored suit wool / blend from your uploaded fabric.",
      },
    ],
    compatibilityTags: ["formal", "business", "reception", "dinner"],
    defaultStatus: "ALLOWED",
  },
  {
    id: "SUIT_UPPER_DOUBLE_BREASTED",
    categoryId: "upper",
    family: "suit",
    name: "Double-Breasted",
    subtitle: "6x2 Peak lapel power jacket",
    description: "Bold peak lapels, 6x2 button fastening, firm roped shoulders, and sharp architectural waist suppression.",
    details: ["Wide Peak Lapel (4.0 in)", "6x2 Double Breasted", "Roped Pagoda Shoulders", "Jetted Pockets"],
    imagePlaceholderLabel: "Double-Breasted Jacket",
    materialRequirements: [
      {
        slotId: "jacket-primary",
        label: "Jacket Body & Sleeves",
        defaultFabricSource: "uploaded-fabric",
        description: "Primary tailored suit wool / blend from your uploaded fabric.",
      },
    ],
    compatibilityTags: ["formal", "evening", "statement"],
    defaultStatus: "ALLOWED",
  },
  {
    id: "SUIT_UPPER_TUXEDO",
    categoryId: "upper",
    family: "suit",
    name: "Tuxedo",
    subtitle: "Silk satin peak lapel dinner jacket",
    description: "Grosgrain or silk satin lapel facing, single covered silk button closure, jetted evening pockets, no back vent.",
    details: ["Silk Satin Peak Lapel", "Single Covered Button", "Unvented Evening Back", "Silk Jetted Pockets"],
    imagePlaceholderLabel: "Tuxedo Dinner Jacket",
    materialRequirements: [
      {
        slotId: "jacket-primary",
        label: "Jacket Body & Sleeves",
        defaultFabricSource: "uploaded-fabric",
        description: "Primary evening suiting fabric with silk satin contrast facings.",
      },
    ],
    compatibilityTags: ["black-tie", "gala", "red-carpet"],
    defaultStatus: "ALLOWED",
  },
  {
    id: "SUIT_UPPER_THREE_PIECE",
    categoryId: "upper",
    family: "suit",
    name: "Three-Piece",
    subtitle: "Waistcoat-compatible tailored jacket",
    description: "Slightly deeper front gorge designed specifically to frame a matching or contrast tailored waistcoat.",
    details: ["Slim Notch Lapel", "2-Button Stance", "Waistcoat Reveal Cut", "Side Adjuster Accommodation"],
    imagePlaceholderLabel: "Three-Piece Suit Jacket",
    materialRequirements: [
      {
        slotId: "jacket-primary",
        label: "Jacket Body & Sleeves",
        defaultFabricSource: "uploaded-fabric",
        description: "Primary tailored suit wool / blend from your uploaded fabric.",
      },
    ],
    compatibilityTags: ["ceremony", "wedding", "formal-business"],
    defaultStatus: "ALLOWED",
  },
  {
    id: "SUIT_UPPER_STATEMENT",
    categoryId: "upper",
    family: "suit",
    name: "Statement",
    subtitle: "Contemporary high-gorge peak jacket",
    description: "Exaggerated peak lapels, angled hacking pockets, one-button closure, and high side vents for sartorial flair.",
    details: ["Dramatic High Peak Lapel", "Single Button Stance", "Angled Hacking Pockets", "High Side Vents"],
    imagePlaceholderLabel: "Statement Peak Jacket",
    materialRequirements: [
      {
        slotId: "jacket-primary",
        label: "Jacket Body & Sleeves",
        defaultFabricSource: "uploaded-fabric",
        description: "Primary tailored suit wool / blend from your uploaded fabric.",
      },
    ],
    compatibilityTags: ["evening", "fashion-forward", "celebration"],
    defaultStatus: "ALLOWED",
  },
];

// 02 — LOWER GARMENTS (TROUSERS)
export const SUIT_LOWER_OPTIONS: SplitComponentOption[] = [
  {
    id: "SUIT_LOWER_CLASSIC_STRAIGHT",
    categoryId: "lower",
    family: "suit",
    name: "Classic Straight",
    subtitle: "Mid-rise flat-front trousers",
    description: "Medium rise, clean flat front, straight leg through thigh and calf, slight break over footwear.",
    details: ["Flat Front", "Mid Rise", "Straight Leg (8.5 in hem)", "Slight Break"],
    imagePlaceholderLabel: "Classic Straight Trouser",
    materialRequirements: [
      {
        slotId: "trouser-primary",
        label: "Trousers",
        defaultFabricSource: "uploaded-fabric",
        description: "Matching or coordinated trousers from your uploaded fabric.",
      },
    ],
    compatibilityTags: ["classic", "business", "formal"],
    defaultStatus: "ALLOWED",
  },
  {
    id: "SUIT_LOWER_TAILORED_TAPERED",
    categoryId: "lower",
    family: "suit",
    name: "Tailored Tapered",
    subtitle: "Modern slim-tapered silhouette",
    description: "Slim through the seat and thigh with a gradual taper to a 7.25-inch hem, no-break to minimal break.",
    details: ["Flat Front", "Slim Tapered (7.25 in hem)", "Minimal Ankle Break", "Side Tab Adjusters"],
    imagePlaceholderLabel: "Tailored Tapered Trouser",
    materialRequirements: [
      {
        slotId: "trouser-primary",
        label: "Trousers",
        defaultFabricSource: "uploaded-fabric",
        description: "Matching or coordinated trousers from your uploaded fabric.",
      },
    ],
    compatibilityTags: ["contemporary", "modern", "sharp"],
    defaultStatus: "ALLOWED",
  },
  {
    id: "SUIT_LOWER_PLEATED_FORMAL",
    categoryId: "lower",
    family: "suit",
    name: "Pleated Formal",
    subtitle: "High-rise double forward pleats",
    description: "Extended waistband, double forward pleats for generous drape and mobility, classic turn-up cuffs.",
    details: ["Double Forward Pleats", "High Rise with Extended Tab", "1.75-inch Turn-Up Cuffs", "Full Drape"],
    imagePlaceholderLabel: "Pleated Formal Trouser",
    materialRequirements: [
      {
        slotId: "trouser-primary",
        label: "Trousers",
        defaultFabricSource: "uploaded-fabric",
        description: "Matching or coordinated trousers from your uploaded fabric.",
      },
    ],
    compatibilityTags: ["sartorial", "heritage", "formal"],
    defaultStatus: "ALLOWED",
  },
  {
    id: "SUIT_LOWER_TUXEDO_TROUSER",
    categoryId: "lower",
    family: "suit",
    name: "Tuxedo Trouser",
    subtitle: "Black-tie trouser with silk side braid",
    description: "Silk grosgrain or satin side stripe braid down outer seam, flat front, no belt loops (side adjusters only).",
    details: ["Silk Satin Outer Braid", "Flat Front No Belt Loops", "Side Adjuster Tabs", "Plain Hem Clean Break"],
    imagePlaceholderLabel: "Tuxedo Silk Braid Trouser",
    materialRequirements: [
      {
        slotId: "trouser-primary",
        label: "Tuxedo Trousers",
        defaultFabricSource: "uploaded-fabric",
        description: "Evening black/midnight wool with matching silk satin side stripe braid.",
      },
    ],
    compatibilityTags: ["black-tie", "formal-evening"],
    defaultStatus: "ALLOWED",
  },
  {
    id: "SUIT_LOWER_CONTEMPORARY",
    categoryId: "lower",
    family: "suit",
    name: "Contemporary",
    subtitle: "Cropped architectural line",
    description: "Clean seamless waistband, tailored slim crop sitting cleanly at ankle bone, razor-sharp front crease.",
    details: ["Clean Waistband Construction", "Cropped Ankle Length", "No Break", "Jetted Back Pockets"],
    imagePlaceholderLabel: "Contemporary Trouser",
    materialRequirements: [
      {
        slotId: "trouser-primary",
        label: "Trousers",
        defaultFabricSource: "uploaded-fabric",
        description: "Matching or coordinated trousers from your uploaded fabric.",
      },
    ],
    compatibilityTags: ["fashion-forward", "reception"],
    defaultStatus: "ALLOWED",
  },
];

// 03 — INNER GARMENTS: SHIRTS
export const SUIT_SHIRT_OPTIONS: SplitComponentOption[] = [
  {
    id: "SUIT_SHIRT_CLASSIC_FORMAL",
    categoryId: "inner-shirt",
    family: "suit",
    name: "Classic Formal",
    subtitle: "Semi-spread collar & French cuffs",
    description: "Crisp two-ply poplin shirt with semi-spread collar, French double cuffs for cufflinks, and plain placket.",
    details: ["Semi-Spread Collar (3.0 in)", "French Double Cuffs", "Plain Front Placket", "100% Egyptian Cotton"],
    imagePlaceholderLabel: "Classic Dress Shirt",
    materialRequirements: [
      {
        slotId: "shirt-material",
        label: "Dress Shirt Fabric",
        defaultFabricSource: "atelier-standard",
        description: "Crisp white or light-blue 2-ply Egyptian cotton poplin.",
      },
    ],
    compatibilityTags: ["formal", "business", "versatile"],
    defaultStatus: "ALLOWED",
  },
  {
    id: "SUIT_SHIRT_SPREAD_COLLAR",
    categoryId: "inner-shirt",
    family: "suit",
    name: "Spread Collar",
    subtitle: "Cutaway spread collar & barrel cuffs",
    description: "Wide cutaway collar framing neckwear knots prominently, convertible 2-button rounded barrel cuffs.",
    details: ["Cutaway Spread Collar", "Rounded Barrel Cuffs", "Removable Collar Stays", "Fine Twill Weave"],
    imagePlaceholderLabel: "Spread Collar Shirt",
    materialRequirements: [
      {
        slotId: "shirt-material",
        label: "Dress Shirt Fabric",
        defaultFabricSource: "atelier-standard",
        description: "Fine luxury twill or royal oxford cotton.",
      },
    ],
    compatibilityTags: ["modern", "statement-tie"],
    defaultStatus: "ALLOWED",
  },
  {
    id: "SUIT_SHIRT_TUXEDO_PLEATED",
    categoryId: "inner-shirt",
    family: "suit",
    name: "Tuxedo Shirt",
    subtitle: "Pleated bib front & French cuffs",
    description: "Classic black-tie dress shirt with pleated Marcella bib, stud front fastening, and stiff turn-down collar.",
    details: ["Pleated Marcella Bib Front", "Stud Hole Closures", "Evening Turn-Down Collar", "French Cuffs"],
    imagePlaceholderLabel: "Tuxedo Pleated Shirt",
    materialRequirements: [
      {
        slotId: "shirt-material",
        label: "Tuxedo Shirt Fabric",
        defaultFabricSource: "atelier-standard",
        description: "White Marcella pique or pleated fine poplin evening cotton.",
      },
    ],
    compatibilityTags: ["black-tie", "evening"],
    defaultStatus: "ALLOWED",
  },
];

// 03 — INNER GARMENTS: WAISTCOATS (EXTRA)
export const SUIT_WAISTCOAT_OPTIONS: SplitComponentOption[] = [
  {
    id: "SUIT_WAISTCOAT_NONE",
    categoryId: "inner-waistcoat",
    family: "suit",
    name: "None",
    subtitle: "Two-piece suit (no waistcoat)",
    description: "Standard two-piece suit configuration without a waistcoat layer.",
    details: ["No Vest Layer", "Clean 2-Piece Profile"],
    imagePlaceholderLabel: "No Waistcoat",
    defaultStatus: "OPTIONAL",
  },
  {
    id: "SUIT_WAISTCOAT_CLASSIC",
    categoryId: "inner-waistcoat",
    family: "suit",
    name: "Classic",
    subtitle: "Single-breasted 5-button waistcoat",
    description: "V-neck silhouette, five horn buttons, welt watch pockets, back cinch adjuster with silk lining.",
    details: ["5-Button Single Breasted", "Notched Hemline", "Dual Welt Pockets", "Rear Cinch Adjuster"],
    imagePlaceholderLabel: "Classic 5-Button Waistcoat",
    materialRequirements: [
      {
        slotId: "waistcoat-material",
        label: "Waistcoat Fabric",
        defaultFabricSource: "uploaded-fabric",
        description: "Matching suit fabric or complementary bespoke waistcoat fabric.",
      },
    ],
    compatibilityTags: ["three-piece", "formal", "wedding"],
    defaultStatus: "ALLOWED",
  },
  {
    id: "SUIT_WAISTCOAT_FORMAL",
    categoryId: "inner-waistcoat",
    family: "suit",
    name: "Formal",
    subtitle: "Double-breasted shawl collar waistcoat",
    description: "Low-cut horseshoe opening with neat shawl collar, 6x3 button layout, square straight-cut hem.",
    details: ["6x3 Double Breasted", "Shawl Lapel", "Straight Cut Hem", "Formal Horseshoe Opening"],
    imagePlaceholderLabel: "Double-Breasted Waistcoat",
    materialRequirements: [
      {
        slotId: "waistcoat-material",
        label: "Waistcoat Fabric",
        defaultFabricSource: "uploaded-fabric",
        description: "Matching or contrasting bespoke waistcoat fabric.",
      },
    ],
    compatibilityTags: ["ceremony", "regal", "formal"],
    defaultStatus: "ALLOWED",
  },
  {
    id: "SUIT_WAISTCOAT_TUXEDO",
    categoryId: "inner-waistcoat",
    family: "suit",
    name: "Tuxedo",
    subtitle: "Deep-cut black-tie evening vest",
    description: "Deep evening U-cut in matching black satin facing, designed to remain concealed under buttoned dinner jacket.",
    details: ["Deep U-Cut Black-Tie Profile", "3 Covered Silk Buttons", "Backless / Light Strap", "Satin Trim"],
    imagePlaceholderLabel: "Evening Tuxedo Waistcoat",
    materialRequirements: [
      {
        slotId: "waistcoat-material",
        label: "Tuxedo Waistcoat Fabric",
        defaultFabricSource: "atelier-standard",
        description: "Black silk satin or Marcella evening fabric.",
      },
    ],
    compatibilityTags: ["black-tie", "evening"],
    defaultStatus: "ALLOWED",
  },
];

// 04 — FOOTWEAR
export const SUIT_FOOTWEAR_OPTIONS: SplitComponentOption[] = [
  {
    id: "SUIT_SHOE_OXFORD",
    categoryId: "footwear",
    family: "suit",
    name: "Oxford",
    subtitle: "Cap-toe closed-lacing dress shoe",
    description: "Full-grain calfskin leather, Goodyear-welted closed lacing system, stitched cap toe, leather sole.",
    details: ["Closed Lacing", "Stitched Cap Toe", "Burnished Calf Leather", "Leather Sole"],
    imagePlaceholderLabel: "Cap-Toe Oxford Shoe",
    materialRequirements: [
      {
        slotId: "footwear-leather",
        label: "Footwear Leather",
        defaultFabricSource: "atelier-standard",
        description: "Black or dark brown burnished full-grain calfskin leather.",
      },
    ],
    compatibilityTags: ["formal", "business", "classic"],
    defaultStatus: "ALLOWED",
  },
  {
    id: "SUIT_SHOE_DERBY",
    categoryId: "footwear",
    family: "suit",
    name: "Derby",
    subtitle: "Plain-toe open-lacing dress shoe",
    description: "Versatile open lacing construction offering comfortable instep flexibility and a sleek tailored profile.",
    details: ["Open Lacing", "Plain Toe Silhouette", "Hand-Finished Leather", "Bevellled Waist Sole"],
    imagePlaceholderLabel: "Plain Derby Shoe",
    materialRequirements: [
      {
        slotId: "footwear-leather",
        label: "Footwear Leather",
        defaultFabricSource: "atelier-standard",
        description: "Rich dark espresso or oxblood calfskin leather.",
      },
    ],
    compatibilityTags: ["smart", "contemporary"],
    defaultStatus: "ALLOWED",
  },
  {
    id: "SUIT_SHOE_LOAFER",
    categoryId: "footwear",
    family: "suit",
    name: "Loafer",
    subtitle: "Penny / Belgian slip-on shoe",
    description: "Slip-on construction with hand-sewn apron, low stacked heel, refined contemporary lounge profile.",
    details: ["Slip-On Apron Toe", "Penny Saddle Strap", "Supple Calf / Suede", "Lounge Profile"],
    imagePlaceholderLabel: "Dress Loafer Shoe",
    materialRequirements: [
      {
        slotId: "footwear-leather",
        label: "Footwear Leather",
        defaultFabricSource: "atelier-standard",
        description: "Supple polished calfskin or velvet-soft suede.",
      },
    ],
    compatibilityTags: ["reception", "summer-formal", "contemporary"],
    defaultStatus: "ALLOWED",
  },
  {
    id: "SUIT_SHOE_PATENT_OXFORD",
    categoryId: "footwear",
    family: "suit",
    name: "Patent Oxford",
    subtitle: "Mirror-finish black-tie evening shoe",
    description: "High-gloss mirror patent leather, seamless wholecut or plain toe, grosgrain laces for black-tie dress codes.",
    details: ["Mirror Patent Finish", "Plain Toe Wholecut", "Grosgrain Ribbon Laces", "Formal Black Sole"],
    imagePlaceholderLabel: "Patent Leather Evening Oxford",
    materialRequirements: [
      {
        slotId: "footwear-leather",
        label: "Patent Leather",
        defaultFabricSource: "atelier-standard",
        description: "High-gloss black patent mirror leather.",
      },
    ],
    compatibilityTags: ["black-tie", "evening-exclusive"],
    defaultStatus: "ALLOWED",
  },
];

// 05 — ACCESSORIES (MULTI-SELECT)
export const SUIT_ACCESSORY_OPTIONS: SplitComponentOption[] = [
  {
    id: "SUIT_ACC_TIE",
    categoryId: "accessory",
    family: "suit",
    name: "Tie",
    subtitle: "Mulberry silk necktie",
    description: "Hand-rolled 8cm mulberry silk necktie tied in a clean four-in-hand knot with dimple.",
    details: ["8cm Blade Width", "100% Woven Mulberry Silk", "Hand-Rolled Edges"],
    imagePlaceholderLabel: "Silk Necktie",
    materialRequirements: [
      {
        slotId: "neckwear-material",
        label: "Necktie Silk",
        defaultFabricSource: "atelier-standard",
        description: "Solid or micro-patterned woven mulberry silk.",
      },
    ],
    compatibilityTags: ["business", "formal", "daytime"],
    defaultStatus: "ALLOWED",
  },
  {
    id: "SUIT_ACC_BOW_TIE",
    categoryId: "accessory",
    family: "suit",
    name: "Bow Tie",
    subtitle: "Self-tie silk bow tie",
    description: "Self-tie butterfly or diamond-point bow tie in matching satin or grosgrain silk.",
    details: ["Self-Tie Butterfly Shape", "Silk Satin / Grosgrain", "Adjustable Collar Sizing"],
    imagePlaceholderLabel: "Silk Bow Tie",
    materialRequirements: [
      {
        slotId: "neckwear-material",
        label: "Bow Tie Silk",
        defaultFabricSource: "atelier-standard",
        description: "Black or midnight blue woven silk satin/grosgrain.",
      },
    ],
    compatibilityTags: ["black-tie", "evening"],
    defaultStatus: "ALLOWED",
  },
  {
    id: "SUIT_ACC_POCKET_SQUARE",
    categoryId: "accessory",
    family: "suit",
    name: "Pocket Square",
    subtitle: "Linen / silk breast pocket square",
    description: "Hand-stitched pocket square worn in a crisp presidential straight fold or relaxed puff.",
    details: ["33x33 cm Square", "Hand-Rolled Hem", "Pure Irish Linen / Silk"],
    imagePlaceholderLabel: "Pocket Square",
    materialRequirements: [
      {
        slotId: "pocket-square-material",
        label: "Pocket Square Fabric",
        defaultFabricSource: "atelier-standard",
        description: "Crisp white linen or printed silk twill.",
      },
    ],
    compatibilityTags: ["universal", "accent"],
    defaultStatus: "ALLOWED",
  },
  {
    id: "SUIT_ACC_CUFFLINKS",
    categoryId: "accessory",
    family: "suit",
    name: "Cufflinks",
    subtitle: "Atelier engraved metal cufflinks",
    description: "Pair of polished gold or silver-tone metal cufflinks for French double cuffs.",
    details: ["Solid Brass / Sterling Silver Tone", "Whale Back Closure", "Engraved Atelier Monogram"],
    imagePlaceholderLabel: "Metal Cufflinks",
    materialRequirements: [
      {
        slotId: "cufflinks-finish",
        label: "Cufflinks Finish",
        defaultFabricSource: "atelier-standard",
        description: "Polished yellow gold, rose gold, or rhodium silver finish.",
      },
    ],
    compatibilityTags: ["french-cuffs", "formal"],
    defaultStatus: "ALLOWED",
  },
  {
    id: "SUIT_ACC_BUTTONS",
    categoryId: "accessory",
    family: "suit",
    name: "Buttons",
    subtitle: "Horn / Mother-of-pearl suit buttons",
    description: "Genuine carved natural horn or iridescent mother-of-pearl buttons for front and cuffs.",
    details: ["Natural Horn / Mother-of-Pearl", "4-Hole Tailored Anchor", "Cross-Stitched"],
    imagePlaceholderLabel: "Custom Suit Buttons",
    materialRequirements: [
      {
        slotId: "buttons-finish",
        label: "Button Material",
        defaultFabricSource: "atelier-standard",
        description: "Matte smoked horn, dark brown horn, or mother-of-pearl.",
      },
    ],
    compatibilityTags: ["tailoring-detail", "bespoke"],
    defaultStatus: "ALLOWED",
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
