import sharp from "sharp";
import type { TryOnImage } from "./types";
import type { DetailCrop } from "./fabric-guidance";
/** Crop coordinates refer to the upright preview, not raw EXIF pixel storage. */
export async function cropFabricDetail(image: TryOnImage, crop: DetailCrop): Promise<TryOnImage> {
  const upright = await sharp(Buffer.from(await image.file.arrayBuffer()), { failOn: "error", limitInputPixels: 40_000_000 }).rotate().png().toBuffer({ resolveWithObject: true });
  const left = Math.min(upright.info.width - 1, Math.floor(crop.x * upright.info.width));
  const top = Math.min(upright.info.height - 1, Math.floor(crop.y * upright.info.height));
  const width = Math.min(upright.info.width - left, Math.max(1, Math.round(crop.width * upright.info.width)));
  const height = Math.min(upright.info.height - top, Math.max(1, Math.round(crop.height * upright.info.height)));
  const { data, info } = await sharp(upright.data).extract({ left, top, width, height }).png().toBuffer({ resolveWithObject: true });
  return { file: new File([new Uint8Array(data)], "fabric-detail.png", { type: "image/png" }), mime: "image/png", width: info.width, height: info.height };
}
