import "server-only";
import { requireRequestUser } from "@/lib/auth/session";
import { getLevel1Catalogue, replaceLevel1Catalogue } from "@/lib/catalog/level1-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// TEMPORARY one-off admin route to fix the NEHRU_06 design's generation
// prompt so customer fabric color is not overridden by the reference
// image. Deployed only long enough to be invoked once by an
// authenticated staff session, then removed.
const NEW_GENERATION = {
  promptFragments: [
    "traditional men's sleeveless Nehru jacket",
    "waist-to-hip length",
    "high standing band collar",
    "centered front button closure with four to five buttons",
    "besom hip pockets with a welt chest pocket",
    "layered over a collared shirt with the shirt collar visible above the jacket collar",
    "preserve the reference garment's construction, silhouette, and architecture exactly as shown",
  ],
  negativeConstraints: [
    "Never make long like a Sherwani or Achkan. Never add jacket sleeves. Do not turn into a Western blazer. Do not alter the garment's construction, silhouette, or architecture from the reference image. Customer fabric photo is authoritative for colour, texture, pattern, and material — never copy the reference image's colour or fabric.",
  ],
  maximumReferenceImages: 2 as const,
};

export async function GET(request: Request) {
  const user = await requireRequestUser(request);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const catalogue = await getLevel1Catalogue();
  const design = catalogue.designs.find((d) => d.id === "NEHRU_06");
  if (!design) return Response.json({ error: "design_not_found" }, { status: 404 });

  const alreadyApplied = JSON.stringify(design.generation) === JSON.stringify(NEW_GENERATION);
  if (alreadyApplied) {
    return Response.json({ alreadyApplied: true });
  }

  const updated = {
    ...catalogue,
    designs: catalogue.designs.map((d) => (d.id === "NEHRU_06" ? { ...d, generation: NEW_GENERATION } : d)),
  };
  await replaceLevel1Catalogue(updated);

  return Response.json({ ok: true, generation: updated.designs.find((d) => d.id === "NEHRU_06")?.generation });
}
