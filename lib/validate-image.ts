import "server-only";
import sharp from "sharp";
import { MAX_IMAGE_BYTES, MAX_IMAGE_EDGE, MAX_IMAGE_PIXELS, UploadValidationError, detectImageMime, detectImageDimensions } from "./validation";

export async function validateImageFile(file: File | null, label: string) {
  if (!file || file.size === 0) {
    throw new UploadValidationError(
      `Please upload ${label}.`,
      "missing_file",
    );
  }

  if (file.size > MAX_IMAGE_BYTES) {
    throw new UploadValidationError(
      "This image is too large. Please choose a smaller image.",
      "file_too_large",
    );
  }

  const header = new Uint8Array(await file.slice(0, 512 * 1024).arrayBuffer());
  const detectedMime = detectImageMime(header);

  if (detectedMime === "image/heic") {
    throw new UploadValidationError(
      "This HEIC image could not be converted. Please upload a JPG, PNG, or WebP image.",
      "unsupported_type",
    );
  }

  if (!detectedMime) {
    throw new UploadValidationError(
      "Please upload a valid JPG, PNG, or WebP image.",
      "invalid_image",
    );
  }

  const dimensions = detectImageDimensions(header, detectedMime);
  if (!dimensions || dimensions.width < 1 || dimensions.height < 1) {
    throw new UploadValidationError(
      "The selected file does not appear to be a valid image.",
      "invalid_image",
    );
  }

  const declaredMime = file.type.toLowerCase();
  if (declaredMime && declaredMime !== detectedMime) {
    throw new UploadValidationError(
      "The selected file does not appear to be a valid image.",
      "invalid_image",
    );
  }

  if (dimensions.width > MAX_IMAGE_EDGE || dimensions.height > MAX_IMAGE_EDGE || dimensions.width * dimensions.height > MAX_IMAGE_PIXELS) {
    throw new UploadValidationError("Choose an image with at most 40 megapixels and 16,384 pixels per edge.", "invalid_image");
  }
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const image = sharp(bytes, { failOn: "warning", limitInputPixels: MAX_IMAGE_PIXELS, animated: true });
    const metadata = await image.metadata();
    if ((metadata.pages ?? 1) !== 1 || metadata.width !== dimensions.width || metadata.height !== dimensions.height
      || metadata.format !== ({ "image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp" } as const)[detectedMime]) {
      throw new Error("Invalid image format, dimensions or frame count");
    }
    // Force a complete decode. Metadata alone accepts truncated containers.
    // Keep the original bytes; statistics force pixel decoding without retaining a full raw output.
    await image.stats();
  } catch {
    throw new UploadValidationError("The selected image is damaged or unsupported. Choose a valid, single-frame JPG, PNG, or WebP image.", "invalid_image");
  }

  return {
    file,
    mime: detectedMime,
    width: dimensions.width,
    height: dimensions.height,
  };
}
