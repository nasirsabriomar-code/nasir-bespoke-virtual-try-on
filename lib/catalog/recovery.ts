import "server-only";
import { getLevel1Catalogue } from "@/lib/catalog/level1-store";
import { isTrustedLevel1AssetPath } from "@/lib/catalog/level1-paths";
import { SPLIT_CATALOGUE_BY_FAMILY, findActiveSplitReference } from "@/lib/split-outfit/catalogue";

export async function recoveryManifest() {
  const assets = new Map<string, { id: string; checksum: string; contentType: string; privatePath: string }>();
  const catalogue = await getLevel1Catalogue();
  for (const asset of catalogue.assets) {
    if (asset.status !== "active" || !asset.checksum || !isTrustedLevel1AssetPath(asset)) continue;
    if (asset.privatePath && asset.contentType) {
      assets.set(asset.id, {
        id: asset.id, checksum: asset.checksum, contentType: asset.contentType, privatePath: asset.privatePath,
      });
    }
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
