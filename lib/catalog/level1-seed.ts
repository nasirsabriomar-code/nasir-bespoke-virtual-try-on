import type { CuratedAsset, CuratedCategory, CuratedDesign, Level1Catalogue } from "@/lib/catalog/level1-types";

const styling = "preserve-existing-accessories" as const;
const bodyFit = "adapt-garment-to-customer" as const;

// The five owner-approved catalogue images are now the trusted v1 card and
// construction references.  Keeping this metadata in the seed means a local
// checkout without Redis still resolves the private Blob assets correctly;
// production Redis remains the durable runtime catalogue when configured.
const APPROVED_SUIT_ASSETS: Record<CuratedDesign["id"], { privatePath: string; checksum: string; provenance: string }> = {
  SUIT_01_CLASSIC: {
    privatePath: "nasir-bespoke/catalogue/level1/v1/SUIT_01_CLASSIC/approved.png",
    checksum: "cf4e5dea515afa9dc94d7947c6edf2122bbb6d07f553a3dd5a2acd38e2f0fcbd",
    provenance: "Approved Nasir Bespoke Suit catalogue image supplied by project owner on 2026-08-16.",
  },
  SUIT_02_TUXEDO: {
    privatePath: "nasir-bespoke/catalogue/level1/v1/SUIT_02_TUXEDO/approved.png",
    checksum: "10fd0e1334141b8fb2a3e690844356339b5b3623f8a7e11a7e561c4590591268",
    provenance: "Approved Nasir Bespoke Suit catalogue image supplied by project owner on 2026-08-16.",
  },
  SUIT_03_STATEMENT: {
    privatePath: "nasir-bespoke/catalogue/level1/v1/SUIT_03_STATEMENT/approved.png",
    checksum: "73182b8de106a7002d899a946a1f75a821b1005295ed4e035354b5c8343bd351",
    provenance: "Approved Nasir Bespoke Suit catalogue image supplied by project owner on 2026-08-16.",
  },
  SUIT_04_DOUBLE_BREASTED: {
    privatePath: "nasir-bespoke/catalogue/level1/v1/SUIT_04_DOUBLE_BREASTED/approved.png",
    checksum: "6f34662fb556da3a55f3a214955d5d21e0fd4020d5172433bad0e3ee9ddb958d",
    provenance: "Approved Nasir Bespoke Suit catalogue image supplied by project owner on 2026-08-16.",
  },
  SUIT_05_THREE_PIECE: {
    privatePath: "nasir-bespoke/catalogue/level1/v1/SUIT_05_THREE_PIECE/approved.png",
    checksum: "9bc20a752be80c0095f9cdcbff7058f374564829c5c16c2c4d7b3937b2363142",
    provenance: "Approved Nasir Bespoke Suit catalogue image supplied by project owner on 2026-08-16.",
  },
};

export const LEVEL1_CATEGORIES: CuratedCategory[] = [
  { id: "suit", name: "Suits", description: "Tailored formal looks for business, evening, and celebration.", status: "active", sortOrder: 1 },
  { id: "sherwani", name: "Sherwanis", description: "Curated ceremonial silhouettes.", status: "draft", sortOrder: 2 },
  { id: "bandhgala", name: "Bandhgalas", description: "Structured Indian formal tailoring.", status: "draft", sortOrder: 3 },
  { id: "nehru-jacket", name: "Nehru Jackets", description: "Refined high-collar layering.", status: "draft", sortOrder: 4 },
  { id: "kurta-set", name: "Kurta Sets", description: "Coordinated traditional looks.", status: "draft", sortOrder: 5 },
  { id: "indo-western", name: "Indo-Western", description: "Contemporary ceremonial tailoring.", status: "draft", sortOrder: 6 },
  { id: "achkan", name: "Achkans", description: "Long ceremonial tailoring.", status: "draft", sortOrder: 7 },
];

function assetsFor(designId: CuratedDesign["id"]): CuratedAsset[] {
  const approved = APPROVED_SUIT_ASSETS[designId];
  const approvedFields = approved
    ? { status: "active" as const, privatePath: approved.privatePath, contentType: "image/png" as const, checksum: approved.checksum, provenance: approved.provenance }
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

export const LEVEL1_ASSETS: CuratedAsset[] = LEVEL1_SUIT_DESIGNS.flatMap((design) => assetsFor(design.id));

export const DEFAULT_LEVEL1_CATALOGUE: Level1Catalogue = {
  version: 1,
  categories: LEVEL1_CATEGORIES,
  designs: LEVEL1_SUIT_DESIGNS,
  assets: LEVEL1_ASSETS,
};
