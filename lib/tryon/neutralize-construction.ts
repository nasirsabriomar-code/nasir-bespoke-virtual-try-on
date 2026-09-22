import sharp from "sharp";
import type { TryOnImage } from "@/lib/tryon/types";

/** Greyscale a construction photo before it is sent to the model. Catalogue files are untouched. */
export async function grayscaleConstruction(image: TryOnImage): Promise<TryOnImage> {
  const source = Buffer.from(await image.file.arrayBuffer());
  const output = await sharp(source, { failOn: "error", limitInputPixels: 40_000_000 }).grayscale().png().toBuffer();
  const file = new File([output], "construction-neutral.png", { type: "image/png" });
  return { file, mime: "image/png", width: image.width, height: image.height };
}
