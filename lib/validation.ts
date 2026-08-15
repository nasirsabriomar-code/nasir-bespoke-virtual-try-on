// Vercel Functions cap both request and response payloads at 4.5 MB. The client
// optimizes the person, outfit, and fabric images to keep three sources plus
// multipart overhead safely below that platform limit.
export const MAX_IMAGE_BYTES = 1_250_000;
export const MAX_REQUEST_BYTES = 4_200_000;

export type SupportedImageMime = "image/jpeg" | "image/png" | "image/webp";

export class UploadValidationError extends Error {
  constructor(
    message: string,
    public readonly code: "missing_file" | "unsupported_type" | "file_too_large" | "invalid_image",
  ) {
    super(message);
    this.name = "UploadValidationError";
  }
}

function hasBytes(bytes: Uint8Array, offset: number, expected: number[]) {
  return expected.every((value, index) => bytes[offset + index] === value);
}

function ascii(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

export function detectImageMime(bytes: Uint8Array): SupportedImageMime | "image/heic" | null {
  if (bytes.length < 12) return null;

  if (hasBytes(bytes, 0, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (hasBytes(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
    return "image/webp";
  }

  if (ascii(bytes, 4, 4) === "ftyp") {
    const brand = ascii(bytes, 8, 4).toLowerCase();
    if (["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1"].includes(brand)) {
      return "image/heic";
    }
  }

  return null;
}

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

  const header = new Uint8Array(await file.slice(0, 32).arrayBuffer());
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

  const declaredMime = file.type.toLowerCase();
  if (declaredMime && declaredMime !== detectedMime) {
    throw new UploadValidationError(
      "The selected file does not appear to be a valid image.",
      "invalid_image",
    );
  }

  return {
    file,
    mime: detectedMime,
  };
}
