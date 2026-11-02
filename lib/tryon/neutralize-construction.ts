import sharp from "sharp";
import type { TryOnImage } from "@/lib/tryon/types";

/** Greyscale a construction photo before it is sent to the model. Catalogue files are untouched. */
export async function grayscaleConstruction(image: TryOnImage): Promise<TryOnImage> {
  const source = Buffer.from(await image.file.arrayBuffer());
  // rotate() applies EXIF orientation, which would otherwise be lost with the metadata.
  const { data, info } = await sharp(source, { failOn: "error", limitInputPixels: 40_000_000 })
    .rotate()
    .grayscale()
    .png()
    .toBuffer({ resolveWithObject: true });
  const file = new File([new Uint8Array(data)], "construction-neutral.png", { type: "image/png" });
  return { file, mime: "image/png", width: info.width, height: info.height };
}
