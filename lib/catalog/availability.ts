import "server-only";
import type { Level1Catalogue, Level1CatalogueView } from "./level1-types";
import { presignR2Url } from "@/lib/r2-storage";

/** Read-only, request-scoped checks; never expose private paths to the client. */
export async function applyCatalogueAvailability(catalogue: Level1Catalogue, view: Level1CatalogueView, probe = async (path: string) => {
  const response = await fetch(presignR2Url(path, "HEAD"), {
    method: "HEAD", cache: "no-store", signal: AbortSignal.timeout(5000),
  });
  if (response.status === 404) return false;
  if (!response.ok) throw new Error("Catalogue storage check failed.");
  return true;
}): Promise<Level1CatalogueView> {
  const assets = new Map(catalogue.assets.map(asset => [asset.id, asset]));
  const paths = [...new Set(catalogue.assets.filter(asset => asset.status === "active" && asset.privatePath && !asset.privatePath.includes("..")
    && (asset.privatePath.startsWith(`nasir-bespoke/catalogue/level1/v1/${asset.designId}/`)
      || asset.privatePath.startsWith(`nasir-bespoke/catalogue/level1/v1/${asset.id}/`))).map(asset => asset.privatePath!))];
  const available = new Set<string>();
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(8, paths.length) }, async () => {
    while (next < paths.length) {
      const path = paths[next++];
      try { if (await probe(path)) available.add(path); } catch { /* fail closed for this reference */ }
    }
  }));
  const exists = (id: string) => {
    const asset = assets.get(id);
    return Boolean(asset?.status === "active" && asset.privatePath && available.has(asset.privatePath));
  };
  return { ...view, designs: view.designs.map(design => {
    const source = catalogue.designs.find(item => item.id === design.id);
    if (!source) return design;
    const mark = <T extends { cardImage: Level1CatalogueView["designs"][number]["cardImage"]; generation: Level1CatalogueView["designs"][number]["generation"] }>(item: T, ids: { card: string; primaryConstruction: string }): T => ({
      ...item,
      cardImage: exists(ids.card) ? item.cardImage : { state: "awaiting-approval" },
      generation: exists(ids.primaryConstruction) ? item.generation : { state: "awaiting-approved-reference" },
    });
    return { ...mark(design, source.assetIds), ...(design.variants ? { variants: design.variants.map(variant => {
      const original = source.variants?.find(item => item.id === variant.id);
      return original ? mark(variant, original.assetIds) : variant;
    }) } : {}) };
  }) };
}
