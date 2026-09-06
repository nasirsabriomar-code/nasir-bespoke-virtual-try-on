import "server-only";
import { createHash } from "node:crypto";
import { get } from "@vercel/blob";
import { requireRequestUser } from "@/lib/auth/session";
import { getLevel1Catalogue, replaceLevel1Catalogue } from "@/lib/catalog/level1-store";
import type { CuratedAsset, CuratedDesign } from "@/lib/catalog/level1-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// TEMPORARY one-off admin route to merge the NEHRU_06 design into the live
// Level 1 catalogue. Deployed only long enough to be invoked once by an
// authenticated staff session, then removed.
const PRIVATE_PATH = "nasir-bespoke/catalogue/level1/v1/NEHRU_06/approved.jpeg";
const EXPECTED_CHECKSUM = "d78e77f520f1ce6816c75f414fdedabf392fcb76a47f729f4829965a057bfb32";

export async function GET(request: Request) {
  const user = await requireRequestUser(request);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const catalogue = await getLevel1Catalogue();
  const existing = catalogue.designs.find((d) => d.id === "NEHRU_06");
  if (existing) {
    return Response.json({ alreadyExists: true, designs: catalogue.designs.length, assets: catalogue.assets.length });
  }

  const token = process.env.NASIR_BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) return Response.json({ error: "blob_token_missing" }, { status: 500 });

  const blob = await get(PRIVATE_PATH, { access: "private", token });
  if (!blob || blob.statusCode !== 200 || !blob.stream) {
    return Response.json({ error: "blob_not_found", privatePath: PRIVATE_PATH }, { status: 404 });
  }
  const chunks: Uint8Array[] = [];
  const reader = blob.stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  const bytes = Buffer.concat(chunks);
  const checksum = createHash("sha256").update(bytes).digest("hex");
  if (checksum !== EXPECTED_CHECKSUM) {
    return Response.json({ error: "checksum_mismatch", expected: EXPECTED_CHECKSUM, actual: checksum }, { status: 500 });
  }

  const provenance = "Approved Nasir Bespoke Nehru Jacket catalogue image supplied by project owner on 2026-09-06.";
  const contentType = "image/jpeg" as const;

  const newDesign: CuratedDesign = {
    id: "NEHRU_06",
    version: 1,
    categoryId: "nehru-jacket",
    status: "active",
    sortOrder: 6,
    customer: {
      name: "Nehru Jacket",
      description: "Textured navy tailored waistcoat",
      intent: "Business formal, festive gatherings, and versatile traditional-to-formal dressing.",
    },
    blueprint: {
      garmentFamily: "Traditional Nehru jacket / sleeveless bandhgala waistcoat",
      silhouette: ["waist-to-hip length", "sleeveless tailored jacket", "clean upright fall"],
      includedPieces: ["sleeveless Nehru jacket", "coordinated underlayer shirt", "tailored trousers"],
      construction: {
        jacketLength: "waist-to-hip length sleeveless Nehru jacket",
        collar: "high standing band collar",
        closure: "centered front button closure with four to five buttons",
        sleeves: "sleeveless",
        pockets: "besom hip pockets with a welt chest pocket",
        layering: "worn over a collared shirt with the shirt collar visible above the jacket collar",
      },
      stylingPolicy: "preserve-existing-accessories",
      bodyFitPolicy: "adapt-garment-to-customer",
    },
    assetIds: {
      card: "NEHRU_06_CARD_V1",
      primaryConstruction: "NEHRU_06_PRIMARY_V1",
      details: [],
    },
    generation: {
      promptFragments: [
        "traditional men's sleeveless Nehru jacket exactly as shown in the reference image",
        "waist-to-hip length",
        "high standing band collar",
        "centered front button closure",
        "besom hip pockets with a welt chest pocket",
        "layered over a collared shirt with the shirt collar visible above the jacket collar",
        "preserve the reference garment's construction, proportions, and detailing exactly",
      ],
      negativeConstraints: [
        "Never make long like a Sherwani or Achkan. Never add jacket sleeves. Do not turn into a Western blazer. Do not alter the garment's construction, cut, or detailing from the reference image.",
      ],
      maximumReferenceImages: 2,
    },
  };

  const cardAsset: CuratedAsset = { id: "NEHRU_06_CARD_V1", designId: "NEHRU_06", purpose: "card", status: "active", privatePath: PRIVATE_PATH, contentType, checksum, provenance, sortOrder: 1 };
  const primaryAsset: CuratedAsset = { id: "NEHRU_06_PRIMARY_V1", designId: "NEHRU_06", purpose: "primary-construction", status: "active", privatePath: PRIVATE_PATH, contentType, checksum, provenance, sortOrder: 2 };

  const updated = {
    ...catalogue,
    designs: [...catalogue.designs, newDesign],
    assets: [...catalogue.assets, cardAsset, primaryAsset],
  };
  await replaceLevel1Catalogue(updated);

  return Response.json({ ok: true, designs: updated.designs.length, assets: updated.assets.length, checksum });
}
