import "server-only";
import { getLevel1Catalogue } from "@/lib/catalog/level1-store";
import { SPLIT_CATALOGUE_BY_FAMILY, findActiveSplitReference } from "@/lib/split-outfit/catalogue";

export async function recoveryManifest() {
  const assets = new Map<string, { id: string; checksum: string; contentType: string; privatePath: string }>();
  const catalogue = await getLevel1Catalogue();
  for (const candidate of catalogue.assets) {
    if (candidate.status !== "active" || !candidate.checksum) continue;
    const asset = candidate;
    if (!asset.privatePath || asset.privatePath.includes("..")
      || (!asset.privatePath.startsWith("nasir-bespoke/catalogue/level1/v1/" + asset.designId + "/")
        && !asset.privatePath.startsWith("nasir-bespoke/catalogue/level1/v1/" + asset.id + "/"))) continue;
    if (asset?.checksum && asset.privatePath && asset.contentType) assets.set(asset.id, {
      id: asset.id, checksum: asset.checksum, contentType: asset.contentType, privatePath: asset.privatePath,
    });
  }
  for (const family of Object.values(SPLIT_CATALOGUE_BY_FAMILY)) {
    for (const options of Object.values(family)) {
      for (const option of options) {
        if (!option.reference) continue;
        const ref = findActiveSplitReference(option.reference.assetId);
        if (ref?.checksum && ref.privatePath && ref.contentType) assets.set(ref.assetId, {
          id: ref.assetId, checksum: ref.checksum, contentType: ref.contentType, privatePath: ref.privatePath,
        });
      }
    }
  }
  return [...assets.values()];
}
