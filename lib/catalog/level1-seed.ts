import type { CuratedAsset, CuratedCategory, CuratedDesign, CuratedDesignId, Level1Catalogue } from "@/lib/catalog/level1-types";

const styling = "preserve-existing-accessories" as const;
const bodyFit = "adapt-garment-to-customer" as const;

// The five owner-approved Suit catalogue images are the trusted v1 card and
// construction references for Suits.
const APPROVED_SUIT_ASSETS: Record<string, { privatePath: string; checksum: string; provenance: string; contentType: "image/png" | "image/jpeg" }> = {
  SUIT_01_CLASSIC: {
    privatePath: "nasir-bespoke/catalogue/level1/v1/SUIT_01_CLASSIC/approved.png",
    checksum: "cf4e5dea515afa9dc94d7947c6edf2122bbb6d07f553a3dd5a2acd38e2f0fcbd",
    provenance: "Approved Nasir Bespoke Suit catalogue image supplied by project owner on 2026-08-16.",
    contentType: "image/png",
  },
  SUIT_02_TUXEDO: {
    privatePath: "nasir-bespoke/catalogue/level1/v1/SUIT_02_TUXEDO/approved.png",
    checksum: "10fd0e1334141b8fb2a3e690844356339b5b3623f8a7e11a7e561c4590591268",
    provenance: "Approved Nasir Bespoke Suit catalogue image supplied by project owner on 2026-08-16.",
    contentType: "image/png",
  },
  SUIT_03_STATEMENT: {
    privatePath: "nasir-bespoke/catalogue/level1/v1/SUIT_03_STATEMENT/approved.png",
    checksum: "73182b8de106a7002d899a946a1f75a821b1005295ed4e035354b5c8343bd351",
    provenance: "Approved Nasir Bespoke Suit catalogue image supplied by project owner on 2026-08-16.",
    contentType: "image/png",
  },
  SUIT_04_DOUBLE_BREASTED: {
    privatePath: "nasir-bespoke/catalogue/level1/v1/SUIT_04_DOUBLE_BREASTED/approved.png",
    checksum: "6f34662fb556da3a55f3a214955d5d21e0fd4020d5172433bad0e3ee9ddb958d",
    provenance: "Approved Nasir Bespoke Suit catalogue image supplied by project owner on 2026-08-16.",
    contentType: "image/png",
  },
  SUIT_05_THREE_PIECE: {
    privatePath: "nasir-bespoke/catalogue/level1/v1/SUIT_05_THREE_PIECE/approved.png",
    checksum: "9bc20a752be80c0095f9cdcbff7058f374564829c5c16c2c4d7b3937b2363142",
    provenance: "Approved Nasir Bespoke Suit catalogue image supplied by project owner on 2026-08-16.",
    contentType: "image/png",
  },
};

// The five owner-approved Sherwani catalogue images are the trusted v1 card and
// construction references for Sherwanis.
const APPROVED_SHERWANI_ASSETS: Record<string, { privatePath: string; checksum: string; provenance: string; contentType: "image/png" | "image/jpeg" }> = {
  SHERWANI_01_CLASSIC: {
    privatePath: "nasir-bespoke/catalogue/level1/v1/SHERWANI_01_CLASSIC/approved.jpg",
    checksum: "6367319e1185577bf90b186dfd163644287a62edf3fa24347b993a1d13b22eca",
    provenance: "Approved Nasir Bespoke Sherwani catalogue image supplied by project owner on 2026-08-17.",
    contentType: "image/jpeg",
  },
  SHERWANI_02_LAYERED: {
    privatePath: "nasir-bespoke/catalogue/level1/v1/SHERWANI_02_LAYERED/approved.jpg",
    checksum: "58570685adb0f7a7e1e7fab37e5a27f183a26c6680f541dfcaf93f024b66ea05",
    provenance: "Approved Nasir Bespoke Sherwani catalogue image supplied by project owner on 2026-08-17.",
    contentType: "image/jpeg",
  },
  SHERWANI_03_JODHPURI: {
    privatePath: "nasir-bespoke/catalogue/level1/v1/SHERWANI_03_JODHPURI/approved.jpg",
    checksum: "8558eec1d1b9dac70c7b13444913fbd410c47d4c4d4d140faf1abc387070d27f",
    provenance: "Approved Nasir Bespoke Sherwani catalogue image supplied by project owner on 2026-08-17.",
    contentType: "image/jpeg",
  },
  SHERWANI_04_ASYMMETRIC: {
    privatePath: "nasir-bespoke/catalogue/level1/v1/SHERWANI_04_ASYMMETRIC/approved.jpg",
    checksum: "d580ffc7984a95fac1391c5144eafad781391fc2cf03aaa5b5050a79f411ca42",
    provenance: "Approved Nasir Bespoke Sherwani catalogue image supplied by project owner on 2026-08-17.",
    contentType: "image/jpeg",
  },
  SHERWANI_05_ROYAL: {
    privatePath: "nasir-bespoke/catalogue/level1/v1/SHERWANI_05_ROYAL/approved.jpg",
    checksum: "830457bfb1bc04170579b8c7dc0cd4dedbb241d430416152f284e872d32a51f3",
    provenance: "Approved Nasir Bespoke Sherwani catalogue image supplied by project owner on 2026-08-17.",
    contentType: "image/jpeg",
  },
};

const APPROVED_ASSETS: Record<string, { privatePath: string; checksum: string; provenance: string; contentType: "image/png" | "image/jpeg" }> = {
  ...APPROVED_SUIT_ASSETS,
  ...APPROVED_SHERWANI_ASSETS,
};

export const LEVEL1_CATEGORIES: CuratedCategory[] = [
  { id: "suit", name: "Suits", description: "Tailored formal looks for business, evening, and celebration.", status: "active", sortOrder: 1 },
  { id: "sherwani", name: "Sherwanis", description: "Curated ceremonial silhouettes.", status: "active", sortOrder: 2 },
  { id: "bandhgala", name: "Bandhgalas", description: "Structured Indian formal tailoring.", status: "draft", sortOrder: 3 },
  { id: "nehru-jacket", name: "Nehru Jackets", description: "Refined high-collar layering.", status: "draft", sortOrder: 4 },
  { id: "kurta-set", name: "Kurta Sets", description: "Coordinated traditional looks.", status: "draft", sortOrder: 5 },
  { id: "indo-western", name: "Indo-Western", description: "Contemporary ceremonial tailoring.", status: "draft", sortOrder: 6 },
  { id: "achkan", name: "Achkans", description: "Long ceremonial tailoring.", status: "draft", sortOrder: 7 },
];

function assetsFor(designId: CuratedDesignId): CuratedAsset[] {
  const approved = APPROVED_ASSETS[designId];
  const approvedFields = approved
    ? { status: "active" as const, privatePath: approved.privatePath, contentType: approved.contentType, checksum: approved.checksum, provenance: approved.provenance }
    : { status: "awaiting-upload" as const };
  return [
    { id: `${designId}_CARD_V1`, designId, purpose: "card", ...approvedFields, sortOrder: 1 },
    { id: `${designId}_PRIMARY_V1`, designId, purpose: "primary-construction", ...approvedFields, sortOrder: 2 },
  ];
}

export const LEVEL1_SUIT_DESIGNS: CuratedDesign[] = [
  {
    id: "SUIT_01_CLASSIC", version: 1, categoryId: "suit", status: "active", sortOrder: 1,
    customer: { name: "Classic", description: "Timeless everyday elegance", intent: "Business meetings, professional occasions, and versatile formal wear." },
    blueprint: {
      garmentFamily: "Modern tailored suit", silhouette: ["balanced", "premium tailored"], includedPieces: ["single-breasted jacket", "matching tailored trousers"],
      construction: { jacketClosure: "single-breasted", buttonClosure: "two-button", lapel: "notch", shoulder: "natural structured", hipPockets: "flap", vent: "double vent preferred", trousers: "matching tailored trousers" },
      stylingPolicy: styling, bodyFitPolicy: bodyFit,
    },
    assetIds: { card: "SUIT_01_CLASSIC_CARD_V1", primaryConstruction: "SUIT_01_CLASSIC_PRIMARY_V1", details: [] },
    generation: { promptFragments: ["modern single-breasted tailored suit", "two-button closure", "notch lapel", "natural structured shoulder", "flap pockets", "matching tailored trousers"], negativeConstraints: ["Do not make this ceremonial or exaggerated fashion styling."], maximumReferenceImages: 2 },
  },
  {
    id: "SUIT_02_TUXEDO", version: 1, categoryId: "suit", status: "active", sortOrder: 2,
    customer: { name: "Tuxedo", description: "Refined evening formality", intent: "Black-tie events, luxury evenings, weddings, and formal celebrations." },
    blueprint: {
      garmentFamily: "Formal evening suit", silhouette: ["refined", "formal evening"], includedPieces: ["dinner jacket", "matching formal trousers"],
      construction: { jacketClosure: "single-breasted", buttonClosure: "one-button", lapel: "satin peak lapel", lapelFacing: "satin", hipPockets: "jetted", trousers: "matching formal trousers with satin stripe" },
      stylingPolicy: styling, bodyFitPolicy: bodyFit,
    },
    assetIds: { card: "SUIT_02_TUXEDO_CARD_V1", primaryConstruction: "SUIT_02_TUXEDO_PRIMARY_V1", details: [] },
    generation: { promptFragments: ["formal dinner suit", "one-button dinner jacket", "satin peak lapel", "satin facing", "jetted pockets", "matching formal trousers with a satin stripe"], negativeConstraints: ["Do not turn this into a normal business suit."], maximumReferenceImages: 2 },
  },
  {
    id: "SUIT_03_STATEMENT", version: 1, categoryId: "suit", status: "active", sortOrder: 3,
    customer: { name: "Statement", description: "Bold celebratory tailoring", intent: "Weddings, receptions, and luxury occasions." },
    blueprint: {
      garmentFamily: "Fashion-forward formal suit", silhouette: ["strong", "expressive", "tailored"], includedPieces: ["formal jacket", "matching trousers"],
      construction: { lapel: "peak lapel preferred", silhouette: "stronger elevated formal proportions", trousers: "matching tailored trousers" },
      stylingPolicy: styling, bodyFitPolicy: bodyFit,
    },
    assetIds: { card: "SUIT_03_STATEMENT_CARD_V1", primaryConstruction: "SUIT_03_STATEMENT_PRIMARY_V1", details: [] },
    generation: { promptFragments: ["fashion-forward formal suit", "confident expressive tailoring", "stronger premium silhouette", "peak lapel preferred", "matching trousers"], negativeConstraints: ["Do not make this look like a costume or create unrealistic fashion shapes."], maximumReferenceImages: 2 },
  },
  {
    id: "SUIT_04_DOUBLE_BREASTED", version: 1, categoryId: "suit", status: "active", sortOrder: 4,
    customer: { name: "Double-Breasted", description: "Strong and commanding", intent: "Executive dressing and luxury formalwear." },
    blueprint: {
      garmentFamily: "Structured double-breasted suit", silhouette: ["structured", "authoritative", "classic luxury"], includedPieces: ["double-breasted jacket", "matching trousers"],
      construction: { jacketClosure: "double-breasted", buttonConfiguration: "six-button", lapel: "peak", shoulder: "structured", front: "overlapping panels", hipPockets: "flap", trousers: "matching tailored trousers" },
      stylingPolicy: styling, bodyFitPolicy: bodyFit,
    },
    assetIds: { card: "SUIT_04_DOUBLE_BREASTED_CARD_V1", primaryConstruction: "SUIT_04_DOUBLE_BREASTED_PRIMARY_V1", details: [] },
    generation: { promptFragments: ["structured double-breasted suit", "six-button configuration", "peak lapels", "structured shoulder", "overlapping front panels", "flap pockets", "matching trousers"], negativeConstraints: ["Do not convert the jacket to single-breasted."], maximumReferenceImages: 2 },
  },
  {
    id: "SUIT_05_THREE_PIECE", version: 1, categoryId: "suit", status: "active", sortOrder: 5,
    customer: { name: "Three-Piece", description: "Complete formal look", intent: "Weddings, premium celebrations, and important occasions." },
    blueprint: {
      garmentFamily: "Three-piece tailored suit", silhouette: ["sophisticated", "complete", "formal"], includedPieces: ["single-breasted jacket", "matching waistcoat", "matching tailored trousers"],
      construction: { jacketClosure: "single-breasted", jacketButtons: "two-button", lapel: "notch", waistcoat: "matching fabric, five-button front, visible under jacket", trousers: "matching tailored trousers" },
      stylingPolicy: styling, bodyFitPolicy: bodyFit,
    },
    assetIds: { card: "SUIT_05_THREE_PIECE_CARD_V1", primaryConstruction: "SUIT_05_THREE_PIECE_PRIMARY_V1", details: [] },
    generation: { promptFragments: ["three-piece tailored suit", "single-breasted two-button jacket", "notch lapel", "matching five-button waistcoat visibly layered below the jacket", "matching tailored trousers"], negativeConstraints: ["Do not omit the waistcoat or change it to a two-piece suit."], maximumReferenceImages: 2 },
  },
];

export const LEVEL1_SHERWANI_DESIGNS: CuratedDesign[] = [
  {
    id: "SHERWANI_01_CLASSIC",
    version: 1,
    categoryId: "sherwani",
    status: "active",
    sortOrder: 1,
    customer: {
      name: "Classic",
      description: "Clean traditional ceremonial silhouette",
      intent: "Weddings, receptions, and traditional celebrations.",
    },
    blueprint: {
      garmentFamily: "Traditional ceremonial Sherwani",
      silhouette: ["traditional", "symmetrical", "straight tailored fall"],
      includedPieces: ["classic long sherwani", "matching churidar"],
      construction: {
        closure: "centered button placket with loop buttons",
        collar: "embroidered bandhgala / mandarin collar",
        cuffs: "embroidered sleeve cuffs",
        length: "knee-length structured sherwani",
        front: "straight symmetrical front with lower center slit",
        lowerGarment: "fitted cream churidar",
      },
      stylingPolicy: styling,
      bodyFitPolicy: bodyFit,
    },
    assetIds: {
      card: "SHERWANI_01_CLASSIC_CARD_V1",
      primaryConstruction: "SHERWANI_01_CLASSIC_PRIMARY_V1",
      details: [],
    },
    generation: {
      promptFragments: [
        "traditional men's ceremonial sherwani",
        "symmetrical centered front button placket with loop buttons",
        "structured bandhgala mandarin collar with intricate tone-on-tone embroidery",
        "embroidered sleeve cuffs",
        "straight knee-length tailored silhouette with clean center front slit",
        "paired with fitted churidar",
      ],
      negativeConstraints: [
        "Do not make the front asymmetric. Do not add heavy western lapels or shorten into a bandhgala jacket.",
      ],
      maximumReferenceImages: 2,
    },
  },
  {
    id: "SHERWANI_02_LAYERED",
    version: 1,
    categoryId: "sherwani",
    status: "active",
    sortOrder: 2,
    customer: {
      name: "Layered",
      description: "Open-front sherwani over an ornate inner panel",
      intent: "Luxury weddings, sangeet, and grand formal receptions.",
    },
    blueprint: {
      garmentFamily: "Layered ceremonial Sherwani",
      silhouette: ["layered", "open-front coat", "structured"],
      includedPieces: [
        "open-front long sherwani coat",
        "inner embroidered angrakha/kurta layer",
        "matching churidar",
      ],
      construction: {
        outerLayer: "open-front structured long sherwani coat with vertical border detailing",
        innerLayer: "visible ornate inner kurta/angrakha panel with center buttons",
        collar: "structured bandhgala collar",
        chestPocket: "chest pocket with coordinated pocket square",
        lowerGarment: "fitted churidar",
      },
      stylingPolicy: styling,
      bodyFitPolicy: bodyFit,
    },
    assetIds: {
      card: "SHERWANI_02_LAYERED_CARD_V1",
      primaryConstruction: "SHERWANI_02_LAYERED_PRIMARY_V1",
      details: [],
    },
    generation: {
      promptFragments: [
        "layered ceremonial men's sherwani ensemble",
        "outer long open-front sherwani coat with tailored drape and fine border detailing",
        "clearly visible inner embroidered angrakha layer beneath the outer coat",
        "structured high bandhgala collar",
        "chest pocket with pocket square",
        "fitted churidar",
      ],
      negativeConstraints: [
        "Do not collapse into a single-layer closed sherwani. The inner layered garment must remain distinctly visible.",
      ],
      maximumReferenceImages: 2,
    },
  },
  {
    id: "SHERWANI_03_JODHPURI",
    version: 1,
    categoryId: "sherwani",
    status: "active",
    sortOrder: 3,
    customer: {
      name: "Jodhpuri",
      description: "Structured heritage tailoring with flap pockets",
      intent: "Royal heritage weddings, formal dinners, and cultural occasions.",
    },
    blueprint: {
      garmentFamily: "Structured heritage Jodhpuri Sherwani",
      silhouette: ["structured", "heritage tailored", "long formal"],
      includedPieces: ["structured long Jodhpuri sherwani", "churidar"],
      construction: {
        length: "knee-length heritage sherwani coat (not a short jacket)",
        collar: "bandhgala collar with subtle fine embroidery",
        closure: "centered button front",
        pockets: "structured flap hip pockets and chest pocket with pocket square",
        shoulders: "clean structured architectural shoulder line",
        lowerGarment: "churidar",
      },
      stylingPolicy: styling,
      bodyFitPolicy: bodyFit,
    },
    assetIds: {
      card: "SHERWANI_03_JODHPURI_CARD_V1",
      primaryConstruction: "SHERWANI_03_JODHPURI_PRIMARY_V1",
      details: [],
    },
    generation: {
      promptFragments: [
        "structured long Jodhpuri heritage sherwani",
        "knee-length tailored formal sherwani silhouette",
        "distinctive tailored flap hip pockets",
        "chest pocket with pocket square",
        "centered metallic or fabric-covered button closure",
        "tailored heritage bandhgala collar",
        "fitted churidar",
      ],
      negativeConstraints: [
        "Do not shorten into a waist-length bandhgala jacket. This is a long knee-length sherwani with flap pockets.",
      ],
      maximumReferenceImages: 2,
    },
  },
  {
    id: "SHERWANI_04_ASYMMETRIC",
    version: 1,
    categoryId: "sherwani",
    status: "active",
    sortOrder: 4,
    customer: {
      name: "Asymmetric",
      description: "Modern diagonal front overlap styling",
      intent: "Contemporary weddings, cocktail events, and modern celebratory dressing.",
    },
    blueprint: {
      garmentFamily: "Contemporary asymmetric overlap Sherwani",
      silhouette: ["contemporary", "diagonal overlap", "sleek tailored"],
      includedPieces: ["asymmetric overlap long sherwani", "tailored straight trousers"],
      construction: {
        frontClosure: "diagonal cross-over front overlap fastening with angled button stance",
        neckline: "high standing overlap bandhgala collar",
        hemline: "curved diagonal lower hem overlap",
        lowerGarment: "clean tailored straight trousers",
      },
      stylingPolicy: styling,
      bodyFitPolicy: bodyFit,
    },
    assetIds: {
      card: "SHERWANI_04_ASYMMETRIC_CARD_V1",
      primaryConstruction: "SHERWANI_04_ASYMMETRIC_PRIMARY_V1",
      details: [],
    },
    generation: {
      promptFragments: [
        "contemporary asymmetric overlap men's sherwani",
        "unmistakable diagonal front panel closure fastening across the chest with angled buttons",
        "high standing overlap collar",
        "curved sweeping front hemline",
        "matching clean tailored trousers",
      ],
      negativeConstraints: [
        "Do not normalize the front into a centered vertical button closure. The diagonal asymmetric overlap is mandatory.",
      ],
      maximumReferenceImages: 2,
    },
  },
  {
    id: "SHERWANI_05_ROYAL",
    version: 1,
    categoryId: "sherwani",
    status: "active",
    sortOrder: 5,
    customer: {
      name: "Royal",
      description: "All-over ornate ceremonial brocade and zari craftsmanship",
      intent: "Grooms, royal wedding ceremonies, and grand celebratory occasions.",
    },
    blueprint: {
      garmentFamily: "Ornate royal ceremonial Sherwani",
      silhouette: ["majestic", "ornate", "regal bespoke"],
      includedPieces: ["all-over embroidered royal sherwani", "churidar", "coordinated juttis"],
      construction: {
        embroidery: "all-over intricate jacquard/zari motif embroidery with rich decorative border along front placket, collar, hem, and cuffs",
        collar: "richly embroidered high bandhgala collar",
        closure: "centered ornate button closure",
        length: "knee-length regal sherwani",
        lowerGarment: "silk churidar",
      },
      stylingPolicy: styling,
      bodyFitPolicy: bodyFit,
    },
    assetIds: {
      card: "SHERWANI_05_ROYAL_CARD_V1",
      primaryConstruction: "SHERWANI_05_ROYAL_PRIMARY_V1",
      details: [],
    },
    generation: {
      promptFragments: [
        "grand royal ceremonial men's sherwani",
        "all-over intricate luxury brocade and zari embroidery across entire body",
        "richly embellished border along front placket, collar, hem, and cuffs",
        "centered ornate button closure",
        "knee-length majestic ceremonial cut",
        "fine silk churidar",
      ],
      negativeConstraints: [
        "Do not simplify the ornate embroidery into a plain or minimal garment. Preserve the rich royal craftsmanship.",
      ],
      maximumReferenceImages: 2,
    },
  },
];

export const ALL_LEVEL1_DESIGNS: CuratedDesign[] = [
  ...LEVEL1_SUIT_DESIGNS,
  ...LEVEL1_SHERWANI_DESIGNS,
];

export const LEVEL1_ASSETS: CuratedAsset[] = ALL_LEVEL1_DESIGNS.flatMap((design) => assetsFor(design.id));

export const DEFAULT_LEVEL1_CATALOGUE: Level1Catalogue = {
  version: 1,
  categories: LEVEL1_CATEGORIES,
  designs: ALL_LEVEL1_DESIGNS,
  assets: LEVEL1_ASSETS,
};
