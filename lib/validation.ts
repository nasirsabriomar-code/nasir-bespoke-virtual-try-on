// Originals are uploaded in chunks to private R2 storage. This limit protects
// the server-to-model handoff; it never causes browser-side resizing or
// recompression.
export const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
// Legacy multipart requests remain bounded while the application transitions
// to direct uploads. New high-resolution requests contain JSON asset IDs.
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

export type ImageDimensions = { width: number; height: number };

function readUint16(bytes: Uint8Array, offset: number) {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readUint32(bytes: Uint8Array, offset: number) {
  return ((bytes[offset] * 2 ** 24) + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3]) >>> 0;
}

export function detectImageDimensions(bytes: Uint8Array, mime: SupportedImageMime): ImageDimensions | null {
  if (mime === "image/png" && bytes.length >= 24) {
    return { width: readUint32(bytes, 16), height: readUint32(bytes, 20) };
  }
  if (mime === "image/jpeg") {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) { offset += 1; continue; }
      const marker = bytes[offset + 1];
      offset += 2;
      if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > bytes.length) return null;
      const length = readUint16(bytes, offset);
      if (length < 2 || offset + length > bytes.length) return null;
      if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
        return { height: readUint16(bytes, offset + 3), width: readUint16(bytes, offset + 5) };
      }
      offset += length;
    }
  }
  if (mime === "image/webp" && bytes.length >= 30) {
    const kind = ascii(bytes, 12, 4);
    if (kind === "VP8X" && bytes.length >= 30) {
      const width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
      const height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
      return { width, height };
    }
    if (kind === "VP8 " && bytes.length >= 30 && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
      return { width: (bytes[26] | (bytes[27] << 8)) & 0x3fff, height: (bytes[28] | (bytes[29] << 8)) & 0x3fff };
    }
    if (kind === "VP8L" && bytes.length >= 25 && bytes[20] === 0x2f) {
      const bits = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
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

  return {
    file,
    mime: detectedMime,
    width: dimensions.width,
    height: dimensions.height,
  };
}
