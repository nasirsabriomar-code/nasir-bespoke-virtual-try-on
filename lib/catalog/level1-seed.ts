import type { CuratedAsset, CuratedCategory, CuratedDesign, CuratedDesignId, Level1Catalogue } from "./level1-types";

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

// The five owner-approved Bandhgala catalogue images are the trusted v1 card and
// construction references for Bandhgalas.
const APPROVED_BANDHGALA_ASSETS: Record<string, { privatePath: string; checksum: string; provenance: string; contentType: "image/png" | "image/jpeg" }> = {
  BANDHGALA_01_CLASSIC: {
    privatePath: "nasir-bespoke/catalogue/level1/v1/BANDHGALA_01_CLASSIC/approved.jpg",
    checksum: "bf2064b0c1dd77be16a37d39a393577285b5ed21e63842fe1bce831b6652f8cc",
    provenance: "Approved Nasir Bespoke Bandhgala catalogue image supplied by project owner on 2026-08-17.",
    contentType: "image/jpeg",
  },
  BANDHGALA_02_DOUBLE_BREASTED: {
    privatePath: "nasir-bespoke/catalogue/level1/v1/BANDHGALA_02_DOUBLE_BREASTED/approved.jpg",
    checksum: "4c0579693f391caca2b7113526f852b417e1090f903d235712704d081c06caa5",
    provenance: "Approved Nasir Bespoke Bandhgala catalogue image supplied by project owner on 2026-08-17.",
    contentType: "image/jpeg",
  },
  BANDHGALA_03_VELVET: {
    privatePath: "nasir-bespoke/catalogue/level1/v1/BANDHGALA_03_VELVET/approved.jpg",
    checksum: "65545fc524f699bec426449cc270b5a7edd06d442710ae12070e306adf6f7df1",
    provenance: "Approved Nasir Bespoke Bandhgala catalogue image supplied by project owner on 2026-08-17.",
    contentType: "image/jpeg",
  },
  BANDHGALA_04_TEXTURED: {
    privatePath: "nasir-bespoke/catalogue/level1/v1/BANDHGALA_04_TEXTURED/approved.jpg",
    checksum: "13e0d229708780440fe416aabe4ab37a949c2307a4870d50bae5c5390c7f21a8",
    provenance: "Approved Nasir Bespoke Bandhgala catalogue image supplied by project owner on 2026-08-17.",
    contentType: "image/jpeg",
  },
  BANDHGALA_05_STATEMENT: {
    privatePath: "nasir-bespoke/catalogue/level1/v1/BANDHGALA_05_STATEMENT/approved.jpg",
    checksum: "58564ebb1a6f325cced789634264b8f314bc6ceb0181987977d69c7159db635a",
    provenance: "Approved Nasir Bespoke Bandhgala catalogue image supplied by project owner on 2026-08-17.",
    contentType: "image/jpeg",
  },
};

// The five owner-approved Nehru Jacket catalogue images are the trusted v1 card and
// construction references for Nehru Jackets.
const APPROVED_NEHRU_ASSETS: Record<string, { privatePath: string; checksum: string; provenance: string; contentType: "image/png" | "image/jpeg" }> = {
  NEHRU_01_CLASSIC: {
    privatePath: "nasir-bespoke/catalogue/level1/v1/NEHRU_01_CLASSIC/approved.jpg",
    checksum: "3152976c51e3f99c47a964daf7ea0bb5971ae694b4e07f008f977fce88dfc27c",
    provenance: "Approved Nasir Bespoke Nehru Jacket catalogue image supplied by project owner on 2026-08-17.",
    contentType: "image/jpeg",
  },
  NEHRU_02_FORMAL: {
    privatePath: "nasir-bespoke/catalogue/level1/v1/NEHRU_02_FORMAL/approved.jpg",
    checksum: "fdea7f61a352297fe18f1a8a8a533e3d73811d0742d33c9a303e97167045d50a",
    provenance: "Approved Nasir Bespoke Nehru Jacket catalogue image supplied by project owner on 2026-08-17.",
    contentType: "image/jpeg",
  },
  NEHRU_03_TEXTURED: {
    privatePath: "nasir-bespoke/catalogue/level1/v1/NEHRU_03_TEXTURED/approved.jpg",
    checksum: "c10df77de196b0323d9476ff82dded574ef755b1a41c6777768ffea9ec0e2ff2",
    provenance: "Approved Nasir Bespoke Nehru Jacket catalogue image supplied by project owner on 2026-08-17.",
    contentType: "image/jpeg",
  },
  NEHRU_04_CONTEMPORARY: {
    privatePath: "nasir-bespoke/catalogue/level1/v1/NEHRU_04_CONTEMPORARY/approved.jpg",
    checksum: "e78d8a6dc96e38243cc6f1326123d8ce1fccec1391f95b6f74bcb12ee4bb5ef6",
    provenance: "Approved Nasir Bespoke Nehru Jacket catalogue image supplied by project owner on 2026-08-17.",
    contentType: "image/jpeg",
  },
  NEHRU_05_STATEMENT: {
    privatePath: "nasir-bespoke/catalogue/level1/v1/NEHRU_05_STATEMENT/approved.jpg",
    checksum: "b5ef173371b6101499add85e15c3425afa5de9a7f3970f031987f699558f8f07",
    provenance: "Approved Nasir Bespoke Nehru Jacket catalogue image supplied by project owner on 2026-08-17.",
    contentType: "image/jpeg",
  },
};

// The five owner-approved Kurta Set catalogue images are the trusted v1 card and
// construction references for Kurta Sets.
const APPROVED_KURTA_ASSETS: Record<string, { privatePath: string; checksum: string; provenance: string; contentType: "image/png" | "image/jpeg" }> = {
  KURTA_01_CLASSIC: {
    privatePath: "nasir-bespoke/catalogue/level1/v1/KURTA_01_CLASSIC/approved.jpg",
    checksum: "121f7986b606c2b2cb0720dc8aed72423bd61734628af1b18ed51120b2c6ef6c",
    provenance: "Approved Nasir Bespoke Kurta Set catalogue image supplied by project owner on 2026-08-17.",
    contentType: "image/jpeg",
  },
  KURTA_02_PATHANI: {
    privatePath: "nasir-bespoke/catalogue/level1/v1/KURTA_02_PATHANI/approved.jpg",
    checksum: "f077900f61957baa72e7c29ec5edc5f2602791af2d7c4e57583463d641b4d4c5",
    provenance: "Approved Nasir Bespoke Kurta Set catalogue image supplied by project owner on 2026-08-17.",
    contentType: "image/jpeg",
  },
  KURTA_03_LAYERED: {
    privatePath: "nasir-bespoke/catalogue/level1/v1/KURTA_03_LAYERED/approved.jpg",
    checksum: "ac92b716ad15d8454f45e68d576dc1f5cec237887f2a9d16521c15ddb6d041db",
    provenance: "Approved Nasir Bespoke Kurta Set catalogue image supplied by project owner on 2026-08-17.",
    contentType: "image/jpeg",
  },
  KURTA_04_FESTIVE: {
    privatePath: "nasir-bespoke/catalogue/level1/v1/KURTA_04_FESTIVE/approved.jpg",
    checksum: "d7ee35981814d1fd109463e08fc63da2e73e5ed72627ba7cbcc86eb5dfb44d6b",
    provenance: "Approved Nasir Bespoke Kurta Set catalogue image supplied by project owner on 2026-08-17.",
    contentType: "image/jpeg",
  },
  KURTA_05_CONTEMPORARY: {
    privatePath: "nasir-bespoke/catalogue/level1/v1/KURTA_05_CONTEMPORARY/approved.jpg",
    checksum: "a36b6662e1f00ca833724e0ec7a33a07f3ff67b256f2c1d2e48e18ffa43e9f84",
    provenance: "Approved Nasir Bespoke Kurta Set catalogue image supplied by project owner on 2026-08-17.",
    contentType: "image/jpeg",
  },
};

// The five owner-approved Indo-Western catalogue images are the trusted v1 card and
// construction references for Indo-Western.
const APPROVED_INDO_WESTERN_ASSETS: Record<string, { privatePath: string; checksum: string; provenance: string; contentType: "image/png" | "image/jpeg" }> = {
  INDO_01_CLASSIC: {
    privatePath: "nasir-bespoke/catalogue/level1/v1/INDO_01_CLASSIC/approved.jpg",
    checksum: "80d01ff2629bad975d73dc36c3325212434aa4f9f431a91e36df5235594404b7",
    provenance: "Approved Nasir Bespoke Indo-Western catalogue image supplied by project owner on 2026-08-17.",
    contentType: "image/jpeg",
  },
  INDO_02_ASYMMETRIC: {
    privatePath: "nasir-bespoke/catalogue/level1/v1/INDO_02_ASYMMETRIC/approved.jpg",
    checksum: "a37834450653445bd3297e9dbefd1874ae42d85887c3708021ec7ebe749644da",
    provenance: "Approved Nasir Bespoke Indo-Western catalogue image supplied by project owner on 2026-08-17.",
    contentType: "image/jpeg",
  },
  INDO_03_LAYERED: {
    privatePath: "nasir-bespoke/catalogue/level1/v1/INDO_03_LAYERED/approved.jpg",
    checksum: "ff540bae7a575342a0e0b9793f8fbaa39e1ec25407fe71b6f2beba4c86f2948d",
    provenance: "Approved Nasir Bespoke Indo-Western catalogue image supplied by project owner on 2026-08-17.",
    contentType: "image/jpeg",
  },
  INDO_04_DRAPED: {
    privatePath: "nasir-bespoke/catalogue/level1/v1/INDO_04_DRAPED/approved.jpg",
    checksum: "20e795e538a32e0fe6caa4ec5317da6c51b135a18be239ff709256c8d259023b",
    provenance: "Approved Nasir Bespoke Indo-Western catalogue image supplied by project owner on 2026-08-17.",
    contentType: "image/jpeg",
  },
  INDO_05_STATEMENT: {
    privatePath: "nasir-bespoke/catalogue/level1/v1/INDO_05_STATEMENT/approved.jpg",
    checksum: "7d4247f557d8d54b3b5689befbd99b2542eed7d4f400fc29aa3ce8f6d4763b5e",
    provenance: "Approved Nasir Bespoke Indo-Western catalogue image supplied by project owner on 2026-08-17.",
    contentType: "image/jpeg",
  },
};

// The five owner-approved Achkan catalogue images are the trusted v1 card and
// construction references for Achkans.
const APPROVED_ACHKAN_ASSETS: Record<string, { privatePath: string; checksum: string; provenance: string; contentType: "image/png" | "image/jpeg" }> = {
  ACHKAN_01_CLASSIC: {
    privatePath: "nasir-bespoke/catalogue/level1/v1/ACHKAN_01_CLASSIC/approved.jpg",
    checksum: "1612ea8836a1cef3096271f4b8b6e451d343f2edaffa475797d4e2fbd02650d1",
    provenance: "Approved Nasir Bespoke Achkan catalogue image supplied by project owner on 2026-08-17.",
    contentType: "image/jpeg",
  },
  ACHKAN_02_JODHPURI: {
    privatePath: "nasir-bespoke/catalogue/level1/v1/ACHKAN_02_JODHPURI/approved.jpg",
    checksum: "aaa5c6470613edd7c01e31f9b238da6937a4ce3d06eba52553bf910df273f88b",
    provenance: "Approved Nasir Bespoke Achkan catalogue image supplied by project owner on 2026-08-17.",
    contentType: "image/jpeg",
  },
  ACHKAN_03_ASYMMETRIC: {
    privatePath: "nasir-bespoke/catalogue/level1/v1/ACHKAN_03_ASYMMETRIC/approved.jpg",
    checksum: "17b9322ef4887fbe3b29b44baf051a76f2a55f570407922ac8909620cba1673a",
    provenance: "Approved Nasir Bespoke Achkan catalogue image supplied by project owner on 2026-08-17.",
    contentType: "image/jpeg",
  },
  ACHKAN_04_EMBROIDERED: {
    privatePath: "nasir-bespoke/catalogue/level1/v1/ACHKAN_04_EMBROIDERED/approved.jpg",
    checksum: "5712a5fd0eba7b9391c97472dad976a4983230bfc1fd50b46c28ba417aaa2ffd",
    provenance: "Approved Nasir Bespoke Achkan catalogue image supplied by project owner on 2026-08-17.",
    contentType: "image/jpeg",
  },
  ACHKAN_05_ROYAL: {
    privatePath: "nasir-bespoke/catalogue/level1/v1/ACHKAN_05_ROYAL/approved.jpg",
    checksum: "1b8acde57768b600ae6b697d51aaf52c135364e5ec4fa5751161a345235a3f2d",
    provenance: "Approved Nasir Bespoke Achkan catalogue image supplied by project owner on 2026-08-17.",
    contentType: "image/jpeg",
  },
};

const APPROVED_ASSETS: Record<string, { privatePath: string; checksum: string; provenance: string; contentType: "image/png" | "image/jpeg" }> = {
  ...APPROVED_SUIT_ASSETS,
  ...APPROVED_SHERWANI_ASSETS,
  ...APPROVED_BANDHGALA_ASSETS,
  ...APPROVED_NEHRU_ASSETS,
  ...APPROVED_KURTA_ASSETS,
  ...APPROVED_INDO_WESTERN_ASSETS,
  ...APPROVED_ACHKAN_ASSETS,
};

export const LEVEL1_CATEGORIES: CuratedCategory[] = [
  { id: "suit", name: "Suits", description: "Tailored formal looks for business, evening, and celebration.", status: "active", sortOrder: 1 },
  { id: "sherwani", name: "Sherwanis", description: "Curated ceremonial silhouettes.", status: "active", sortOrder: 2 },
  { id: "bandhgala", name: "Bandhgalas", description: "Structured Indian formal tailoring.", status: "active", sortOrder: 3 },
  { id: "nehru-jacket", name: "Nehru Jackets", description: "Refined high-collar layering.", status: "active", sortOrder: 4 },
  { id: "kurta-set", name: "Kurta Sets", description: "Coordinated traditional looks.", status: "active", sortOrder: 5 },
  { id: "indo-western", name: "Indo-Western", description: "Contemporary ceremonial tailoring.", status: "active", sortOrder: 6 },
  { id: "achkan", name: "Achkans", description: "Long ceremonial tailoring.", status: "active", sortOrder: 7 },
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

export const LEVEL1_BANDHGALA_DESIGNS: CuratedDesign[] = [
  {
    id: "BANDHGALA_01_CLASSIC",
    version: 1,
    categoryId: "bandhgala",
    status: "active",
    sortOrder: 1,
    customer: {
      name: "Classic",
      description: "Sharp traditional formalwear",
      intent: "Formal dinners, receptions, cultural occasions, and sophisticated evening dressing.",
    },
    blueprint: {
      garmentFamily: "Formal Bandhgala jacket",
      silhouette: ["short-to-mid hip length", "tailored shoulders", "structured chest", "fitted waist"],
      includedPieces: ["single-breasted Bandhgala jacket", "matching formal trousers"],
      construction: {
        jacketLength: "short-to-mid hip formal Bandhgala jacket (not knee-length, not a sherwani or achkan)",
        collar: "high standing band collar / mandarin collar",
        closure: "single-breasted centered button closure",
        shoulders: "tailored structured shoulders",
        chestAndWaist: "structured chest with a clean fitted waistline",
        trousers: "formal matching tailored trousers",
      },
      stylingPolicy: styling,
      bodyFitPolicy: bodyFit,
    },
    assetIds: {
      card: "BANDHGALA_01_CLASSIC_CARD_V1",
      primaryConstruction: "BANDHGALA_01_CLASSIC_PRIMARY_V1",
      details: [],
    },
    generation: {
      promptFragments: [
        "sharp traditional men's formal Bandhgala jacket",
        "short-to-mid hip formal jacket length",
        "high standing band collar",
        "single-breasted centered front button closure",
        "structured tailored shoulders and fitted waist",
        "paired with matching formal tailored trousers",
      ],
      negativeConstraints: [
        "Do not make this knee-length. Explicitly not a Sherwani or Achkan. Do not add western notch or peak lapels.",
      ],
      maximumReferenceImages: 2,
    },
  },
  {
    id: "BANDHGALA_02_DOUBLE_BREASTED",
    version: 1,
    categoryId: "bandhgala",
    status: "active",
    sortOrder: 2,
    customer: {
      name: "Double-Breasted",
      description: "Strong structured presence",
      intent: "Executive occasions, premium receptions, weddings, and commanding formal dressing.",
    },
    blueprint: {
      garmentFamily: "Structured double-breasted Bandhgala jacket",
      silhouette: ["short formal length", "double-breasted overlap", "strong structured shoulder", "authoritative tailored fit"],
      includedPieces: ["double-breasted Bandhgala jacket", "matching tailored trousers"],
      construction: {
        jacketLength: "short formal Bandhgala jacket",
        frontClosure: "double-breasted overlapping front closure with dual button stance",
        collar: "high standing band collar",
        shoulders: "strong structured shoulders",
        trousers: "matching formal tailored trousers",
      },
      stylingPolicy: styling,
      bodyFitPolicy: bodyFit,
    },
    assetIds: {
      card: "BANDHGALA_02_DOUBLE_BREASTED_CARD_V1",
      primaryConstruction: "BANDHGALA_02_DOUBLE_BREASTED_PRIMARY_V1",
      details: [],
    },
    generation: {
      promptFragments: [
        "structured double-breasted men's Bandhgala jacket",
        "short formal jacket length",
        "clearly visible double-breasted overlapping front with twin button rows",
        "high standing band collar",
        "strong structured shoulders",
        "matching tailored trousers",
      ],
      negativeConstraints: [
        "Do not convert the jacket into single-breasted. Must remain distinctly different from Classic Bandhgala. Do not make knee-length.",
      ],
      maximumReferenceImages: 2,
    },
  },
  {
    id: "BANDHGALA_03_VELVET",
    version: 1,
    categoryId: "bandhgala",
    status: "active",
    sortOrder: 3,
    customer: {
      name: "Velvet",
      description: "Rich evening sophistication",
      intent: "Evening receptions, winter weddings, luxury dinners, and formal celebrations.",
    },
    blueprint: {
      garmentFamily: "Luxury evening Bandhgala jacket",
      silhouette: ["short luxury formal", "clean evening tailoring", "fitted structured silhouette"],
      includedPieces: ["luxury formal Bandhgala jacket", "matching formal trousers"],
      construction: {
        jacketLength: "short luxury formal Bandhgala jacket",
        collar: "high standing band collar",
        closure: "centered front closure with refined formal buttons",
        constructionFocus: "evening-focused formal construction emphasizing shape and tailored silhouette (customer fabric authority overrides material)",
        trousers: "matching formal tailored trousers",
      },
      stylingPolicy: styling,
      bodyFitPolicy: bodyFit,
    },
    assetIds: {
      card: "BANDHGALA_03_VELVET_CARD_V1",
      primaryConstruction: "BANDHGALA_03_VELVET_PRIMARY_V1",
      details: [],
    },
    generation: {
      promptFragments: [
        "short luxury evening men's Bandhgala jacket",
        "high standing band collar",
        "centered formal button closure",
        "refined evening formal tailoring with structured shape",
        "matching formal tailored trousers",
      ],
      negativeConstraints: [
        "Do not force velvet material if the customer fabric differs. Customer fabric photo is authoritative for fabric texture and material. Do not make knee-length.",
      ],
      maximumReferenceImages: 2,
    },
  },
  {
    id: "BANDHGALA_04_TEXTURED",
    version: 1,
    categoryId: "bandhgala",
    status: "active",
    sortOrder: 4,
    customer: {
      name: "Textured",
      description: "Refined surface character",
      intent: "Weddings, festive events, cultural occasions, and elegant statement dressing.",
    },
    blueprint: {
      garmentFamily: "Refined structured Bandhgala jacket",
      silhouette: ["short structured silhouette", "clean single-breasted tailoring", "refined proportions"],
      includedPieces: ["structured Bandhgala jacket", "matching tailored trousers"],
      construction: {
        jacketLength: "short Bandhgala jacket",
        collar: "high standing collar",
        closure: "clean single-breasted tailoring",
        constructionFocus: "refined structured silhouette readable independently of catalogue texture",
        trousers: "matching tailored trousers",
      },
      stylingPolicy: styling,
      bodyFitPolicy: bodyFit,
    },
    assetIds: {
      card: "BANDHGALA_04_TEXTURED_CARD_V1",
      primaryConstruction: "BANDHGALA_04_TEXTURED_PRIMARY_V1",
      details: [],
    },
    generation: {
      promptFragments: [
        "refined men's single-breasted Bandhgala jacket",
        "short tailored jacket silhouette",
        "high standing band collar",
        "clean structured tailoring",
        "matching tailored trousers",
      ],
      negativeConstraints: [
        "Customer fabric photo is authoritative for color, weave, and surface texture. Do not copy reference fabric texture if customer fabric differs. Do not make knee-length.",
      ],
      maximumReferenceImages: 2,
    },
  },
  {
    id: "BANDHGALA_05_STATEMENT",
    version: 1,
    categoryId: "bandhgala",
    status: "active",
    sortOrder: 5,
    customer: {
      name: "Statement",
      description: "Bold contemporary formality",
      intent: "Receptions, luxury celebrations, fashion-forward weddings, and standout formal occasions.",
    },
    blueprint: {
      garmentFamily: "Contemporary statement Bandhgala jacket",
      silhouette: ["formal short Bandhgala silhouette", "contemporary stronger proportions", "event-oriented presence"],
      includedPieces: ["statement Bandhgala jacket", "matching tailored trousers"],
      construction: {
        jacketLength: "formal short Bandhgala silhouette",
        architecture: "distinctive but wearable front, pocket, and button architecture",
        collar: "high standing band collar",
        styling: "event-oriented visual presence without becoming theatrical costume",
        trousers: "matching tailored trousers",
      },
      stylingPolicy: styling,
      bodyFitPolicy: bodyFit,
    },
    assetIds: {
      card: "BANDHGALA_05_STATEMENT_CARD_V1",
      primaryConstruction: "BANDHGALA_05_STATEMENT_PRIMARY_V1",
      details: [],
    },
    generation: {
      promptFragments: [
        "contemporary statement men's Bandhgala jacket",
        "formal short jacket proportions",
        "distinctive tailored front, pocket, and button architecture",
        "high standing band collar",
        "matching formal tailored trousers",
      ],
      negativeConstraints: [
        "Do not turn into experimental costume or theatrical wear. Must remain unmistakably a tailored Bandhgala jacket. Do not make knee-length.",
      ],
      maximumReferenceImages: 2,
    },
  },
];

export const LEVEL1_NEHRU_DESIGNS: CuratedDesign[] = [
  {
    id: "NEHRU_01_CLASSIC",
    version: 1,
    categoryId: "nehru-jacket",
    status: "active",
    sortOrder: 1,
    customer: {
      name: "Classic",
      description: "Effortless Indian formalwear",
      intent: "Festive gatherings, family functions, semi-formal events, and versatile traditional dressing.",
    },
    blueprint: {
      garmentFamily: "Traditional Nehru jacket / sleeveless bandhgala waistcoat",
      silhouette: ["waist-to-hip length", "sleeveless tailored jacket", "clean upright fall"],
      includedPieces: ["sleeveless Nehru jacket", "coordinated underlayer kurta or shirt", "tailored trousers or churidar"],
      construction: {
        jacketLength: "waist-to-hip length sleeveless Nehru jacket",
        collar: "high standing band collar",
        closure: "centered front button closure",
        sleeves: "sleeveless (unless future approved design specifies otherwise)",
        layering: "worn over coordinated kurta or shirt",
      },
      stylingPolicy: styling,
      bodyFitPolicy: bodyFit,
    },
    assetIds: {
      card: "NEHRU_01_CLASSIC_CARD_V1",
      primaryConstruction: "NEHRU_01_CLASSIC_PRIMARY_V1",
      details: [],
    },
    generation: {
      promptFragments: [
        "traditional men's sleeveless Nehru jacket",
        "waist-to-hip length",
        "high standing band collar",
        "centered front button closure",
        "layered over coordinated kurta and tailored trousers",
      ],
      negativeConstraints: [
        "Never make long like a Sherwani or Achkan. Never add full-length jacket sleeves unless explicitly required. Do not turn into a Western blazer.",
      ],
      maximumReferenceImages: 2,
    },
  },
  {
    id: "NEHRU_02_FORMAL",
    version: 1,
    categoryId: "nehru-jacket",
    status: "active",
    sortOrder: 2,
    customer: {
      name: "Formal",
      description: "Polished tailored elegance",
      intent: "Receptions, formal dinners, premium events, and refined traditional occasions.",
    },
    blueprint: {
      garmentFamily: "Sharply tailored formal Nehru jacket",
      silhouette: ["waist-to-hip formal length", "strong chest and shoulder definition", "polished formal proportions"],
      includedPieces: ["tailored formal Nehru jacket", "coordinated underlayer", "matching tailored trousers"],
      construction: {
        jacketLength: "sharply tailored waist-to-hip Nehru jacket",
        definition: "stronger chest and shoulder definition",
        collar: "clean high standing band collar",
        closure: "refined formal button closure",
        trousers: "coordinated underlayer with formal tailored trousers or churidar",
      },
      stylingPolicy: styling,
      bodyFitPolicy: bodyFit,
    },
    assetIds: {
      card: "NEHRU_02_FORMAL_CARD_V1",
      primaryConstruction: "NEHRU_02_FORMAL_PRIMARY_V1",
      details: [],
    },
    generation: {
      promptFragments: [
        "sharply tailored formal men's Nehru jacket",
        "polished formal waist-to-hip proportions",
        "strong chest and shoulder definition",
        "clean high band collar",
        "refined formal button closure",
        "coordinated formal trousers",
      ],
      negativeConstraints: [
        "Do not make long like a Sherwani. Must remain noticeably sharper and more formal than Classic Nehru jacket.",
      ],
      maximumReferenceImages: 2,
    },
  },
  {
    id: "NEHRU_03_TEXTURED",
    version: 1,
    categoryId: "nehru-jacket",
    status: "active",
    sortOrder: 3,
    customer: {
      name: "Textured",
      description: "Fabric-led sophistication",
      intent: "Weddings, festive occasions, celebrations, and refined day-to-evening dressing.",
    },
    blueprint: {
      garmentFamily: "Refined Nehru jacket ensemble",
      silhouette: ["waist-to-hip length", "clean structured sleeveless fall", "balanced tailored cut"],
      includedPieces: ["Nehru jacket", "coordinated underlayer", "tailored trousers"],
      construction: {
        garmentFamily: "clearly recognizable Nehru jacket garment family",
        constructionFocus: "valid architectural silhouette independent of reference color or texture (customer fabric authoritative)",
        collar: "high band collar",
        closure: "centered button closure",
      },
      stylingPolicy: styling,
      bodyFitPolicy: bodyFit,
    },
    assetIds: {
      card: "NEHRU_03_TEXTURED_CARD_V1",
      primaryConstruction: "NEHRU_03_TEXTURED_PRIMARY_V1",
      details: [],
    },
    generation: {
      promptFragments: [
        "refined men's Nehru jacket",
        "waist-to-hip tailored cut",
        "high standing band collar",
        "centered button front",
        "layered over coordinated underlayer with clean trousers",
      ],
      negativeConstraints: [
        "No hard-coded reference color or material override. Customer fabric photo is authoritative for fabric texture and color. Do not make long like a Sherwani.",
      ],
      maximumReferenceImages: 2,
    },
  },
  {
    id: "NEHRU_04_CONTEMPORARY",
    version: 1,
    categoryId: "nehru-jacket",
    status: "active",
    sortOrder: 4,
    customer: {
      name: "Contemporary",
      description: "Clean modern tradition",
      intent: "Modern celebrations, cocktail events, destination weddings, and stylish social occasions.",
    },
    blueprint: {
      garmentFamily: "Modern contemporary Nehru jacket",
      silhouette: ["clean modern cut", "minimal architecture", "sharp waist-to-hip length"],
      includedPieces: ["contemporary Nehru jacket", "modern underlayer", "tailored trousers"],
      construction: {
        architecture: "modern cleaner cut with minimal lines and contemporary button/pocket treatment",
        collar: "high standing collar",
        identity: "recognizably Indian Nehru jacket without turning into a Western waistcoat or blazer",
        trousers: "clean modern tailored trousers",
      },
      stylingPolicy: styling,
      bodyFitPolicy: bodyFit,
    },
    assetIds: {
      card: "NEHRU_04_CONTEMPORARY_CARD_V1",
      primaryConstruction: "NEHRU_04_CONTEMPORARY_PRIMARY_V1",
      details: [],
    },
    generation: {
      promptFragments: [
        "contemporary modern men's Nehru jacket",
        "minimalist tailored architecture",
        "modern button and pocket detailing",
        "high standing band collar",
        "paired with modern underlayer and clean tailored trousers",
      ],
      negativeConstraints: [
        "Avoid turning into a Western waistcoat, vest, or blazer. Must remain recognizably an Indian Nehru jacket. Do not make long.",
      ],
      maximumReferenceImages: 2,
    },
  },
  {
    id: "NEHRU_05_STATEMENT",
    version: 1,
    categoryId: "nehru-jacket",
    status: "active",
    sortOrder: 5,
    customer: {
      name: "Statement",
      description: "Distinctive celebratory style",
      intent: "Weddings, receptions, festive events, and bold contemporary traditional dressing.",
    },
    blueprint: {
      garmentFamily: "Celebratory statement Nehru jacket",
      silhouette: ["short Nehru jacket proportion", "strong visual presence", "distinctive cut and detailing"],
      includedPieces: ["statement Nehru jacket", "coordinated underlayer", "tailored trousers"],
      construction: {
        detailing: "stronger celebratory details with distinctive cut, buttons, pockets, piping, or contrast construction",
        proportions: "short waist-to-hip Nehru jacket proportions",
        wearable: "wearable bespoke garment, not costume",
        collar: "high standing band collar",
      },
      stylingPolicy: styling,
      bodyFitPolicy: bodyFit,
    },
    assetIds: {
      card: "NEHRU_05_STATEMENT_CARD_V1",
      primaryConstruction: "NEHRU_05_STATEMENT_PRIMARY_V1",
      details: [],
    },
    generation: {
      promptFragments: [
        "distinctive celebratory men's Nehru jacket",
        "short waist-to-hip tailored proportion",
        "distinctive pocket, button, and piping craftsmanship",
        "high standing band collar",
        "layered over coordinated underlayer with formal trousers",
      ],
      negativeConstraints: [
        "Do not turn into costume. Do not make long like a Sherwani. Visually stronger than Contemporary while remaining wearable.",
      ],
      maximumReferenceImages: 2,
    },
  },
];

export const LEVEL1_KURTA_DESIGNS: CuratedDesign[] = [
  {
    id: "KURTA_01_CLASSIC",
    version: 1,
    categoryId: "kurta-set",
    status: "active",
    sortOrder: 1,
    customer: {
      name: "Classic",
      description: "Clean everyday tradition",
      intent: "Family functions, festive gatherings, religious occasions, and versatile traditional wear.",
    },
    blueprint: {
      garmentFamily: "Traditional Kurta Set",
      silhouette: ["straight clean tunic silhouette", "knee-length fall", "relaxed traditional fit"],
      includedPieces: ["classic long kurta", "coordinated pajama / churidar"],
      construction: {
        garmentType: "traditional long shirt-like tunic kurta (not a structured coat or sherwani)",
        collarAndPlacket: "appropriate traditional kurta collar and front placket",
        silhouette: "straight clean silhouette",
        lowerGarment: "coordinated traditional pajama or churidar",
      },
      stylingPolicy: styling,
      bodyFitPolicy: bodyFit,
    },
    assetIds: {
      card: "KURTA_01_CLASSIC_CARD_V1",
      primaryConstruction: "KURTA_01_CLASSIC_PRIMARY_V1",
      details: [],
    },
    generation: {
      promptFragments: [
        "traditional men's long kurta set",
        "straight clean tunic silhouette falling to the knee",
        "traditional kurta mandarin collar and front placket",
        "long tunic construction",
        "coordinated pajama trousers",
      ],
      negativeConstraints: [
        "Not a Sherwani, Achkan, or structured heavy coat. Must remain a soft tunic kurta construction.",
      ],
      maximumReferenceImages: 2,
    },
  },
  {
    id: "KURTA_02_PATHANI",
    version: 1,
    categoryId: "kurta-set",
    status: "active",
    sortOrder: 4,
    customer: {
      name: "Pathani",
      description: "Relaxed masculine character",
      intent: "Cultural events, festive gatherings, casual celebrations, and confident traditional dressing.",
    },
    blueprint: {
      garmentFamily: "Masculine Pathani Kurta Set",
      silhouette: ["fuller controlled silhouette", "relaxed masculine drape", "mid-knee length"],
      includedPieces: ["Pathani kurta with shirt collar and chest pockets", "matching salwar or loose pajama"],
      construction: {
        collar: "Pathani shirt collar and front placket",
        pockets: "characteristic chest pockets with flaps and epaulette detailing where appropriate",
        lowerGarment: "matching traditional Pathani salwar or loose pajama",
        distinction: "visibly distinct from Classic straight kurta",
      },
      stylingPolicy: styling,
      bodyFitPolicy: bodyFit,
    },
    assetIds: {
      card: "KURTA_02_PATHANI_CARD_V1",
      primaryConstruction: "KURTA_02_PATHANI_PRIMARY_V1",
      details: [],
    },
    generation: {
      promptFragments: [
        "masculine men's Pathani kurta set",
        "characteristic Pathani shirt-style collar and placket",
        "chest flap pockets",
        "relaxed fuller tailored cut",
        "paired with matching Pathani salwar or loose pajama",
      ],
      negativeConstraints: [
        "Must be visibly distinct from Classic straight kurta. Do not convert to a formal structured coat.",
      ],
      maximumReferenceImages: 2,
    },
  },
  {
    id: "KURTA_03_LAYERED",
    version: 1,
    categoryId: "kurta-set",
    status: "active",
    sortOrder: 3,
    customer: {
      name: "Layered",
      description: "Refined dimensional styling",
      intent: "Weddings, festive evenings, celebrations, and elevated traditional occasions.",
    },
    blueprint: {
      garmentFamily: "Layered Kurta Set ensemble",
      silhouette: ["dimensional layered silhouette", "coordinated dual-layer construction"],
      includedPieces: ["inner long kurta", "coordinated visible outer layer / jacket / angrakha wrap", "matching churidar or trousers"],
      construction: {
        layering: "kurta plus clearly visible coordinated additional layer (outer jacket/draped wrap)",
        dimensionality: "layering must remain obvious and visually distinct in try-on",
        lowerGarment: "coordinated churidar or pajama",
      },
      stylingPolicy: styling,
      bodyFitPolicy: bodyFit,
    },
    assetIds: {
      card: "KURTA_03_LAYERED_CARD_V1",
      primaryConstruction: "KURTA_03_LAYERED_PRIMARY_V1",
      details: [],
    },
    generation: {
      promptFragments: [
        "layered men's kurta set ensemble",
        "long base kurta with clearly visible coordinated outer layer or structured wrap",
        "dimensional multi-layered traditional styling",
        "coordinated churidar",
      ],
      negativeConstraints: [
        "Do not collapse into a single plain kurta. The layering must remain distinctly visible.",
      ],
      maximumReferenceImages: 2,
    },
  },
  {
    id: "KURTA_04_FESTIVE",
    version: 1,
    categoryId: "kurta-set",
    status: "active",
    sortOrder: 5,
    customer: {
      name: "Festive",
      description: "Elevated celebration dressing",
      intent: "Festivals, weddings, family celebrations, and formal cultural occasions.",
    },
    blueprint: {
      garmentFamily: "Elevated festive Kurta Set",
      silhouette: ["celebration-focused tailored kurta", "knee-length traditional cut"],
      includedPieces: ["festive embroidered kurta", "matching churidar or silk pajama"],
      construction: {
        detailing: "rich celebration-focused ornamentation, placket embroidery, or fine piping",
        base: "traditional kurta base architecture (not a structured coat)",
        lowerGarment: "matching silk pajama or churidar",
      },
      stylingPolicy: styling,
      bodyFitPolicy: bodyFit,
    },
    assetIds: {
      card: "KURTA_04_FESTIVE_CARD_V1",
      primaryConstruction: "KURTA_04_FESTIVE_PRIMARY_V1",
      details: [],
    },
    generation: {
      promptFragments: [
        "festive celebration men's kurta set",
        "richly detailed kurta with embroidered placket and collar accents",
        "knee-length festive traditional cut",
        "silk pajama or churidar",
      ],
      negativeConstraints: [
        "Do not convert into a Sherwani-like heavy structured coat. Customer fabric remains authoritative for material and color.",
      ],
      maximumReferenceImages: 2,
    },
  },
  {
    id: "KURTA_05_CONTEMPORARY",
    version: 1,
    categoryId: "kurta-set",
    status: "active",
    sortOrder: 2,
    customer: {
      name: "Contemporary",
      description: "Modern clean silhouette",
      intent: "Destination events, modern celebrations, social occasions, and updated traditional dressing.",
    },
    blueprint: {
      garmentFamily: "Contemporary modern Kurta Set",
      silhouette: ["modernized kurta proportion", "cleaner tailored silhouette", "contemporary hemline"],
      includedPieces: ["contemporary tailored kurta", "slim tailored trousers or churidar"],
      construction: {
        proportion: "modernized kurta proportion with cleaner tailored lines",
        detailing: "contemporary placket and hemline detailing",
        identity: "remain recognizably a Kurta Set",
        lowerGarment: "slim tailored trousers or pajama",
      },
      stylingPolicy: styling,
      bodyFitPolicy: bodyFit,
    },
    assetIds: {
      card: "KURTA_05_CONTEMPORARY_CARD_V1",
      primaryConstruction: "KURTA_05_CONTEMPORARY_PRIMARY_V1",
      details: [],
    },
    generation: {
      promptFragments: [
        "contemporary modern men's kurta set",
        "clean modern tailored silhouette",
        "contemporary streamlined placket and hem",
        "modern tailored trousers",
      ],
      negativeConstraints: [
        "Must remain recognizably a Kurta Set. Do not turn into a Western dress shirt or tuxedo.",
      ],
      maximumReferenceImages: 2,
    },
  },
];

export const LEVEL1_INDO_WESTERN_DESIGNS: CuratedDesign[] = [
  {
    id: "INDO_01_CLASSIC",
    version: 1,
    categoryId: "indo-western",
    status: "active",
    sortOrder: 1,
    customer: {
      name: "Classic",
      description: "Refined fusion tailoring",
      intent: "Contemporary celebrations, receptions, formal dinners, and sophisticated cultural occasions.",
    },
    blueprint: {
      garmentFamily: "Deliberate Indian-Western hybrid suit",
      silhouette: ["balanced hybrid silhouette", "structured tailored upper body", "contemporary formal fall"],
      includedPieces: ["hybrid Indo-Western formal jacket", "matching tailored trousers"],
      construction: {
        hybridConcept: "deliberate Indian + Western hybrid with tailored formal upper construction and Indian collar/length influence",
        balance: "balanced wearable silhouette",
        distinction: "must not collapse into a normal Western suit; must not become a plain Sherwani",
        trousers: "formal matching tailored trousers",
      },
      stylingPolicy: styling,
      bodyFitPolicy: bodyFit,
    },
    assetIds: {
      card: "INDO_01_CLASSIC_CARD_V1",
      primaryConstruction: "INDO_01_CLASSIC_PRIMARY_V1",
      details: [],
    },
    generation: {
      promptFragments: [
        "deliberate Indo-Western hybrid formal jacket ensemble",
        "tailored formal upper body construction with standing Indian collar and modern length",
        "balanced contemporary bespoke silhouette",
        "formal matching tailored trousers",
      ],
      negativeConstraints: [
        "Must not collapse into a plain Western suit. Must not become a standard long Sherwani.",
      ],
      maximumReferenceImages: 2,
    },
  },
  {
    id: "INDO_02_ASYMMETRIC",
    version: 1,
    categoryId: "indo-western",
    status: "active",
    sortOrder: 2,
    customer: {
      name: "Asymmetric",
      description: "Modern architectural form",
      intent: "Evening events, fashion-forward celebrations, receptions, and contemporary formal occasions.",
    },
    blueprint: {
      garmentFamily: "Contemporary asymmetric Indo-Western jacket",
      silhouette: ["sculpted asymmetric front", "offset diagonal closure", "fashion-forward tailored lines"],
      includedPieces: ["asymmetric Indo-Western jacket", "clean tailored trousers"],
      construction: {
        frontClosure: "unmistakable asymmetric construction with offset diagonal closure or architectural front",
        style: "fashion-forward hybrid styling distinct from Sherwani Asymmetric",
        asymmetryMandatory: "must preserve front panel asymmetry during generation",
        trousers: "clean modern tailored trousers",
      },
      stylingPolicy: styling,
      bodyFitPolicy: bodyFit,
    },
    assetIds: {
      card: "INDO_02_ASYMMETRIC_CARD_V1",
      primaryConstruction: "INDO_02_ASYMMETRIC_PRIMARY_V1",
      details: [],
    },
    generation: {
      promptFragments: [
        "contemporary asymmetric men's Indo-Western jacket",
        "sculpted diagonal offset front closure",
        "architectural contemporary hybrid cut",
        "clean tailored formal trousers",
      ],
      negativeConstraints: [
        "Front asymmetry is mandatory; do not normalize into a centered closure. Keep hybrid modern styling distinct from long Sherwani.",
      ],
      maximumReferenceImages: 2,
    },
  },
  {
    id: "INDO_03_LAYERED",
    version: 1,
    categoryId: "indo-western",
    status: "active",
    sortOrder: 3,
    customer: {
      name: "Layered",
      description: "Sophisticated dimensional styling",
      intent: "Festive evenings, receptions, cultural celebrations, and elevated social occasions.",
    },
    blueprint: {
      garmentFamily: "Layered Indo-Western ensemble",
      silhouette: ["dimensional multi-layered silhouette", "structured outer with coordinated inner composition"],
      includedPieces: ["structured outer hybrid jacket", "coordinated inner layer", "tailored trousers"],
      construction: {
        layers: "visibly distinct multiple garment layers with structured outer and coordinated inner composition",
        identity: "hybrid contemporary formalwear, not simply a Layered Sherwani",
        trousers: "matching tailored trousers",
      },
      stylingPolicy: styling,
      bodyFitPolicy: bodyFit,
    },
    assetIds: {
      card: "INDO_03_LAYERED_CARD_V1",
      primaryConstruction: "INDO_03_LAYERED_PRIMARY_V1",
      details: [],
    },
    generation: {
      promptFragments: [
        "layered luxury men's Indo-Western ensemble",
        "structured outer hybrid jacket with visibly distinct coordinated inner layer",
        "rich dimensional contemporary styling",
        "tailored trousers",
      ],
      negativeConstraints: [
        "All layers must remain distinctly visible. Do not collapse into a plain single-layer coat or traditional Sherwani.",
      ],
      maximumReferenceImages: 2,
    },
  },
  {
    id: "INDO_04_DRAPED",
    version: 1,
    categoryId: "indo-western",
    status: "active",
    sortOrder: 4,
    customer: {
      name: "Draped",
      description: "Contemporary Indian expression",
      intent: "Weddings, designer celebrations, receptions, and statement evening occasions.",
    },
    blueprint: {
      garmentFamily: "Draped Indo-Western formal jacket",
      silhouette: ["fluid architectural drape", "tailored luxury structure", "controlled ceremonial movement"],
      includedPieces: ["draped Indo-Western jacket with integrated fluid panel", "tailored straight trousers"],
      construction: {
        drape: "visible fluid panel/drape construction as the defining feature",
        physics: "drape must be physically believable and tailored enough for luxury menswear",
        distinction: "do not normalize it into a plain coat",
        trousers: "tailored straight trousers",
      },
      stylingPolicy: styling,
      bodyFitPolicy: bodyFit,
    },
    assetIds: {
      card: "INDO_04_DRAPED_CARD_V1",
      primaryConstruction: "INDO_04_DRAPED_PRIMARY_V1",
      details: [],
    },
    generation: {
      promptFragments: [
        "draped contemporary men's Indo-Western jacket",
        "integrated fluid draped panel across the tailored silhouette",
        "physically realistic luxury bespoke drape",
        "tailored straight trousers",
      ],
      negativeConstraints: [
        "The defining draped panel must remain visible; do not normalize into a flat plain coat. Must remain tailored and masculine.",
      ],
      maximumReferenceImages: 2,
    },
  },
  {
    id: "INDO_05_STATEMENT",
    version: 1,
    categoryId: "indo-western",
    status: "active",
    sortOrder: 5,
    customer: {
      name: "Statement",
      description: "Bold ceremonial sophistication",
      intent: "Wedding receptions, luxury celebrations, formal festivities, and standout special occasions.",
    },
    blueprint: {
      garmentFamily: "Bold architectural statement Indo-Western ensemble",
      silhouette: ["high fashion-forward presence", "bold architectural lines", "bespoke luxury proportions"],
      includedPieces: ["statement Indo-Western jacket", "matching tailored trousers"],
      construction: {
        presence: "boldest Indo-Western option with strong architectural and event-focused details",
        wearable: "wearable bespoke luxury garment, not theatrical costume",
        distinction: "visually distinct from Classic, Asymmetric, Layered, and Draped designs",
        trousers: "matching formal tailored trousers",
      },
      stylingPolicy: styling,
      bodyFitPolicy: bodyFit,
    },
    assetIds: {
      card: "INDO_05_STATEMENT_CARD_V1",
      primaryConstruction: "INDO_05_STATEMENT_PRIMARY_V1",
      details: [],
    },
    generation: {
      promptFragments: [
        "bold statement men's Indo-Western jacket",
        "high-impact architectural tailored construction",
        "fashion-forward bespoke presence",
        "matching formal tailored trousers",
      ],
      negativeConstraints: [
        "Must remain a wearable luxury bespoke garment, not theatrical costume. Visually distinct from all other Indo-Western options.",
      ],
      maximumReferenceImages: 2,
    },
  },
];

export const LEVEL1_ACHKAN_DESIGNS: CuratedDesign[] = [
  {
    id: "ACHKAN_01_CLASSIC",
    version: 1,
    categoryId: "achkan",
    status: "active",
    sortOrder: 1,
    customer: {
      name: "Classic",
      description: "Refined royal tradition",
      intent: "Weddings, formal ceremonies, cultural occasions, and sophisticated traditional dressing.",
    },
    blueprint: {
      garmentFamily: "Traditional long Achkan coat",
      silhouette: ["long-line ceremonial silhouette", "refined high collar", "straight symmetrical fall"],
      includedPieces: ["classic long Achkan coat", "churidar"],
      construction: {
        length: "traditional long-line Achkan coat (clearly distinguished from short Bandhgala)",
        collar: "refined high standing bandhgala collar",
        closure: "centered front button placket",
        lowerGarment: "matching fitted churidar",
      },
      stylingPolicy: styling,
      bodyFitPolicy: bodyFit,
    },
    assetIds: {
      card: "ACHKAN_01_CLASSIC_CARD_V1",
      primaryConstruction: "ACHKAN_01_CLASSIC_PRIMARY_V1",
      details: [],
    },
    generation: {
      promptFragments: [
        "traditional men's long Achkan coat",
        "refined long-line ceremonial tailoring",
        "high standing band collar",
        "centered front button placket",
        "paired with fitted churidar",
      ],
      negativeConstraints: [
        "Do not shorten into a waist-length Bandhgala. Must maintain full long-line Achkan length.",
      ],
      maximumReferenceImages: 2,
    },
  },
  {
    id: "ACHKAN_02_JODHPURI",
    version: 1,
    categoryId: "achkan",
    status: "active",
    sortOrder: 2,
    customer: {
      name: "Jodhpuri",
      description: "Structured heritage elegance",
      intent: "Heritage weddings, formal dinners, receptions, and distinguished cultural occasions.",
    },
    blueprint: {
      garmentFamily: "Structured heritage Jodhpuri Achkan",
      silhouette: ["long-line ceremonial proportion", "sharper shoulder and chest construction", "structured waist"],
      includedPieces: ["structured long Jodhpuri Achkan", "churidar"],
      construction: {
        length: "long-line Achkan proportion (never collapse into short Bandhgala)",
        shouldersAndChest: "sharper architectural shoulder, chest, and waist construction",
        collar: "strong high standing band collar with heritage tailored detailing",
        lowerGarment: "fitted churidar",
      },
      stylingPolicy: styling,
      bodyFitPolicy: bodyFit,
    },
    assetIds: {
      card: "ACHKAN_02_JODHPURI_CARD_V1",
      primaryConstruction: "ACHKAN_02_JODHPURI_PRIMARY_V1",
      details: [],
    },
    generation: {
      promptFragments: [
        "structured heritage men's Jodhpuri Achkan",
        "long-line ceremonial coat with sharp architectural shoulder and chest tailoring",
        "strong high standing band collar",
        "heritage tailored detailing",
        "fitted churidar",
      ],
      negativeConstraints: [
        "Never collapse into a short waist-length Bandhgala jacket. Must remain a long-line structured Achkan.",
      ],
      maximumReferenceImages: 2,
    },
  },
  {
    id: "ACHKAN_03_ASYMMETRIC",
    version: 1,
    categoryId: "achkan",
    status: "active",
    sortOrder: 3,
    customer: {
      name: "Asymmetric",
      description: "Modern ceremonial tailoring",
      intent: "Contemporary weddings, receptions, luxury events, and stylish ceremonial occasions.",
    },
    blueprint: {
      garmentFamily: "Asymmetric long Achkan coat",
      silhouette: ["long Achkan architecture", "diagonal asymmetric closure", "modern ceremonial silhouette"],
      includedPieces: ["asymmetric long Achkan", "tailored straight trousers or churidar"],
      construction: {
        length: "long Achkan architecture",
        frontClosure: "clearly asymmetric front or diagonal closure",
        style: "modern ceremonial tailoring distinct from generic Indo-Western",
        lowerGarment: "clean tailored trousers or churidar",
      },
      stylingPolicy: styling,
      bodyFitPolicy: bodyFit,
    },
    assetIds: {
      card: "ACHKAN_03_ASYMMETRIC_CARD_V1",
      primaryConstruction: "ACHKAN_03_ASYMMETRIC_PRIMARY_V1",
      details: [],
    },
    generation: {
      promptFragments: [
        "modern asymmetric men's long Achkan coat",
        "long ceremonial architecture with striking diagonal asymmetric front closure",
        "high standing overlap collar",
        "clean tailored trousers or churidar",
      ],
      negativeConstraints: [
        "Front panel asymmetry is mandatory; do not normalize into a centered button placket. Keep long Achkan proportion distinct from short jackets.",
      ],
      maximumReferenceImages: 2,
    },
  },
  {
    id: "ACHKAN_04_EMBROIDERED",
    version: 1,
    categoryId: "achkan",
    status: "active",
    sortOrder: 4,
    customer: {
      name: "Embroidered",
      description: "Rich occasion craftsmanship",
      intent: "Weddings, festive ceremonies, family celebrations, and premium traditional occasions.",
    },
    blueprint: {
      garmentFamily: "Embroidered ceremonial Achkan",
      silhouette: ["traditional long Achkan silhouette", "embroidery-embellished borders and placket"],
      includedPieces: ["embroidered long Achkan coat", "silk churidar"],
      construction: {
        detailing: "clear embroidery and craftsmanship detailing along collar, placket, and cuffs without overriding garment structure",
        authority: "customer fabric authority still applies during try-on; reference ornamentation is styling guidance, not automatic color/material override",
        lowerGarment: "silk churidar",
      },
      stylingPolicy: styling,
      bodyFitPolicy: bodyFit,
    },
    assetIds: {
      card: "ACHKAN_04_EMBROIDERED_CARD_V1",
      primaryConstruction: "ACHKAN_04_EMBROIDERED_PRIMARY_V1",
      details: [],
    },
    generation: {
      promptFragments: [
        "richly embroidered men's ceremonial Achkan",
        "long-line traditional coat with refined embroidery along high band collar, placket, and cuffs",
        "silk churidar",
      ],
      negativeConstraints: [
        "Embroidery should not override garment structure. Customer fabric photo remains authoritative for color, weave, and base texture.",
      ],
      maximumReferenceImages: 2,
    },
  },
  {
    id: "ACHKAN_05_ROYAL",
    version: 1,
    categoryId: "achkan",
    status: "active",
    sortOrder: 5,
    customer: {
      name: "Royal",
      description: "Grand wedding presence",
      intent: "Groom wear, major ceremonies, royal-themed weddings, and prestigious formal occasions.",
    },
    blueprint: {
      garmentFamily: "Grand royal ceremonial Achkan",
      silhouette: ["grandest royal presence", "premium long-line silhouette", "ornate regal refinement"],
      includedPieces: ["royal ornate long Achkan", "silk churidar"],
      construction: {
        length: "premium grand long-line silhouette",
        styling: "strongest formal ceremonial presence with rich but tasteful craftsmanship",
        wearability: "wearable bespoke luxury, not theatrical costume",
        lowerGarment: "silk churidar",
      },
      stylingPolicy: styling,
      bodyFitPolicy: bodyFit,
    },
    assetIds: {
      card: "ACHKAN_05_ROYAL_CARD_V1",
      primaryConstruction: "ACHKAN_05_ROYAL_PRIMARY_V1",
      details: [],
    },
    generation: {
      promptFragments: [
        "grand royal ceremonial men's Achkan",
        "prestigious long-line regal silhouette with ornate craftsmanship and embellishments",
        "regal high band collar",
        "luxurious silk churidar",
      ],
      negativeConstraints: [
        "Do not create theatrical costume. Maintain tasteful luxury bespoke construction and long-line Achkan proportions.",
      ],
      maximumReferenceImages: 2,
    },
  },
];

export const ALL_LEVEL1_DESIGNS: CuratedDesign[] = [
  ...LEVEL1_SUIT_DESIGNS,
  ...LEVEL1_SHERWANI_DESIGNS,
  ...LEVEL1_BANDHGALA_DESIGNS,
  ...LEVEL1_NEHRU_DESIGNS,
  ...LEVEL1_KURTA_DESIGNS,
  ...LEVEL1_INDO_WESTERN_DESIGNS,
  ...LEVEL1_ACHKAN_DESIGNS,
];

export const LEVEL1_ASSETS: CuratedAsset[] = ALL_LEVEL1_DESIGNS.flatMap((design) => assetsFor(design.id));

export const DEFAULT_LEVEL1_CATALOGUE: Level1Catalogue = {
  version: 1,
  categories: LEVEL1_CATEGORIES,
  designs: ALL_LEVEL1_DESIGNS,
  assets: LEVEL1_ASSETS,
};
