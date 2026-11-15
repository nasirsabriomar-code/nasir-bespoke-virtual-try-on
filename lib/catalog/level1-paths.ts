import type { CuratedAsset } from "./level1-types";

export function isTrustedLevel1AssetPath(asset: Pick<CuratedAsset, "id" | "designId" | "privatePath">): boolean {
  if (!asset.privatePath || asset.privatePath.includes("..")) return false;
  const trustedDesignPrefix = `nasir-bespoke/catalogue/level1/v1/${asset.designId}/`;
  const trustedAssetPrefix = `nasir-bespoke/catalogue/level1/v1/${asset.id}/`;
  return asset.privatePath.startsWith(trustedDesignPrefix) || asset.privatePath.startsWith(trustedAssetPrefix);
}
