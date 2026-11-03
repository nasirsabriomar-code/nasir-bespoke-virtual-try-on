import sharp from "sharp";
import { UploadValidationError } from "@/lib/validation";
import type { TryOnImage } from "./types";
import type { BackgroundControl } from "./background-control";
export async function prepareBackgroundEdit(person: TryOnImage, size: string, control: BackgroundControl) {
  const [width, height] = size.split("x").map(Number);
  const upright = await sharp(Buffer.from(await person.file.arrayBuffer()), { failOn: "error", limitInputPixels: 40_000_000 }).rotate().png().toBuffer({ resolveWithObject: true });
  if (Math.abs((upright.info.width / upright.info.height) / (width / height) - 1) > .01) throw new UploadValidationError("Use a customer photo with an aspect ratio between 1:3 and 3:1 for background preservation.", "invalid_image");
  const base = await sharp(upright.data).resize(width, height, { fit: "fill" }).png().toBuffer();
  const mask = Buffer.alloc(width * height * 4, 255);
  const region = control.region!;
  const left = Math.floor(region.x * width), top = Math.floor(region.y * height);
  const right = Math.min(width, Math.ceil((region.x + region.width) * width));
  const bottom = Math.min(height, Math.ceil((region.y + region.height) * height));
  const feather = control.featherPixels ?? 4;
  for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
    const distance = Math.min(x - left, right - 1 - x, y - top, bottom - 1 - y);
    const opacity = feather ? Math.min(1, distance / feather) : 1;
    mask[(y * width + x) * 4 + 3] = Math.round(255 * (1 - opacity));
  }
  const maskPng = await sharp(mask, { raw: { width, height, channels: 4 } }).png().toBuffer();
  return { base, mask: maskPng, image: { file: new File([new Uint8Array(base)], "customer-base.png", { type: "image/png" }), mime: "image/png" as const, width, height } };
}
/** Preserve the normalized original exactly outside the approved region, including its feather band. */
export async function compositeBackground(base: Uint8Array, generated: Uint8Array, mask: Uint8Array) {
  const metadata = await sharp(Buffer.from(generated), { failOn: "error", limitInputPixels: 40_000_000 }).metadata();
  if (!metadata.width || !metadata.height) throw new Error("Generated dimensions are unavailable.");
  const { width, height } = metadata;
  const originalMetadata = await sharp(Buffer.from(base)).metadata();
  if (!originalMetadata.width || !originalMetadata.height || Math.abs((originalMetadata.width / originalMetadata.height) / (width / height) - 1) > .01) {
    throw new Error("The generated image cannot be aligned safely with the original background.");
  }
  const original = await sharp(Buffer.from(base)).resize(width, height, { fit: "fill" }).png().toBuffer();
  const alphaMask = await sharp(Buffer.from(mask)).resize(width, height, { kernel: sharp.kernel.nearest }).toColourspace("srgb").ensureAlpha().raw().toBuffer();
  const pixels = await sharp(Buffer.from(generated)).toColourspace("srgb").ensureAlpha().raw().toBuffer();
  for (let offset = 3; offset < pixels.length; offset += 4) pixels[offset] = 255 - alphaMask[offset];
  return new Uint8Array(await sharp(original).composite([{ input: pixels, raw: { width, height, channels: 4 } }]).png().toBuffer());
}
