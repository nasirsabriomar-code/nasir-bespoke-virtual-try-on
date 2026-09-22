import sharp from "sharp";
import { createOpenAIClient } from "@/lib/openai";
import type { TryOnInput, TryOnOutput, TryOnProvider } from "@/lib/tryon/types";
import { detectImageDimensions, type SupportedImageMime } from "@/lib/validation";

// Precision-first variant of OpenAI's Images 2.5 generation, released 2026-09-08.
// Rollback pin if the unpinned alias ever regresses: "gpt-image-2.5-sunburst-2026-09-08"
const MODEL = "gpt-image-2.5-sunburst";
const DEFAULT_QUALITY = "medium" as const;
const EXPERIMENTAL_MAX_PIXELS = 3840 * 2160;
const STABLE_MAX_PIXELS = 2560 * 1440;
const PROVIDER_COMPATIBILITY_EDGE = 3840;

type ImagePart = {
  image: TryOnInput["person"];
  stem: string;
};

function rounded(value: number) {
  return Math.max(16, Math.floor(value / 16) * 16);
}

function canvasFor(width: number, height: number, pixelLimit: number) {
  const ratio = Math.min(3, Math.max(1 / 3, width / height));
  const outputWidth = rounded(Math.sqrt(pixelLimit * ratio));
  const outputHeight = rounded(Math.sqrt(pixelLimit / ratio));
  return `${outputWidth}x${outputHeight}`;
}

export function resolveHighResolutionCanvas(width?: number, height?: number) {
  // A full-body customer photo is normally portrait. Preserve its aspect ratio
  // and maximise the documented 4K-class pixel budget rather than crop it to
  // a fixed landscape frame.
  return canvasFor(width && height ? width : 9, width && height ? height : 16, EXPERIMENTAL_MAX_PIXELS);
}

export function resolveFallbackCanvas(width?: number, height?: number) {
  return canvasFor(width && height ? width : 9, width && height ? height : 16, STABLE_MAX_PIXELS);
}

function isSizeRejection(error: unknown) {
  const record = error && typeof error === "object" ? error as Record<string, unknown> : {};
  if (record.status !== 400 && record.status !== 422) return false;
  const message = `${record.message ?? ""} ${record.code ?? ""}`.toLowerCase();
  return /size|dimension|pixel|resolution|width|height/.test(message);
}

function isInvalidImageFile(error: unknown) {
  const record = error && typeof error === "object" ? error as Record<string, unknown> : {};
  if (record.status !== 400 && record.status !== 422) return false;
  const message = `${record.message ?? ""} ${record.code ?? ""}`.toLowerCase();
  return /invalid.?image.?file|unsupported.?image|image.?format/.test(message);
}

function extensionFor(mime: SupportedImageMime) {
  return mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
}

function isFabricStem(stem: string) {
  return stem === "fabric-reference" || stem.endsWith("-fabric-reference");
}

/** The showroom photo of a cloth is often draped. Send a flat center crop so folds are not copied as the stripe. */
export async function centerFabricRepeat(image: TryOnInput["person"]): Promise<TryOnInput["person"]> {
  try {
    const source = Buffer.from(await image.file.arrayBuffer());
    const metadata = await sharp(source, { failOn: "error", limitInputPixels: 40_000_000 }).metadata();
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    if (width < 400 || height < 400) return image;
    const cropWidth = Math.max(16, Math.round(width * 0.5));
    const cropHeight = Math.max(16, Math.round(height * 0.5));
    const left = Math.round((width - cropWidth) / 2);
    const top = Math.round((height - cropHeight) / 2);
    const output = await sharp(source, { failOn: "error", limitInputPixels: 40_000_000 })
      .extract({ left, top, width: cropWidth, height: cropHeight })
      .rotate()
      .png({ compressionLevel: 9, palette: false })
      .toBuffer();
    return {
      file: new File([output], image.file.name, { type: "image/png" }),
      mime: "image/png",
      width: cropWidth,
      height: cropHeight,
    };
  } catch {
    return image;
  }
}

function namedUpload(image: { file: File; mime: SupportedImageMime }, stem: string) {
  // Keep the original bytes exactly as supplied. The wrapper only gives the
  // multipart part a format-identifying filename and content type.
  return new File([image.file], `${stem}.${extensionFor(image.mime)}`, {
    type: image.mime,
    lastModified: image.file.lastModified,
  });
}

function inputParts(input: TryOnInput): ImagePart[] {
  const parts: ImagePart[] = [{ image: input.person, stem: "person-reference" }];
  if (input.outfit) parts.push({ image: input.outfit, stem: "outfit-style-reference" });
  const fabrics: ImagePart[] = [];
  if (input.fabric) fabrics.push({ image: input.fabric, stem: "fabric-reference" });
  if (input.lowerFabric) fabrics.push({ image: input.lowerFabric, stem: "lower-fabric-reference" });
  if (input.shirtFabric) fabrics.push({ image: input.shirtFabric, stem: "shirt-fabric-reference" });
  if (input.waistcoatFabric) fabrics.push({ image: input.waistcoatFabric, stem: "waistcoat-fabric-reference" });
  const references = input.references.map(({ role, image }) => ({ image, stem: `${role}-blueprint` }));
  // Split and Full Outfit: construction first, fabric last, so colour is the later signal.
  if (input.selection.mode === "split" || input.selection.mode === "level1") {
    parts.push(...references, ...fabrics);
  } else {
    parts.push(...fabrics, ...references);
  }
  return parts;
}

async function providerSafeUpload({ image, stem }: ImagePart) {
  const source = Buffer.from(await image.file.arrayBuffer());
  const sourceMetadata = await sharp(source, { failOn: "error", limitInputPixels: 40_000_000 }).metadata();
  const outputMime: SupportedImageMime = sourceMetadata.hasAlpha ? "image/png" : "image/jpeg";
  const normalized = sharp(source, { failOn: "error", limitInputPixels: 40_000_000 })
    // Applies EXIF orientation and removes metadata that the image endpoint does not need.
    .rotate()
    .resize({
      width: PROVIDER_COMPATIBILITY_EDGE,
      height: PROVIDER_COMPATIBILITY_EDGE,
      fit: "inside",
      withoutEnlargement: true,
      kernel: sharp.kernel.lanczos3,
    });
  const bytes = outputMime === "image/png"
    ? await normalized.png({ compressionLevel: 9, adaptiveFiltering: true, palette: false }).toBuffer()
    : await normalized.jpeg({ quality: 100, chromaSubsampling: "4:4:4", mozjpeg: true }).toBuffer();
  return new File([bytes], `${stem}.${extensionFor(outputMime)}`, { type: outputMime });
}

export class OpenAITryOnProvider implements TryOnProvider {
  constructor(
    private readonly clientFactory: typeof createOpenAIClient = createOpenAIClient,
  ) {}

  async generate(input: TryOnInput): Promise<TryOnOutput> {
    const startedAt = Date.now();
    const quality = DEFAULT_QUALITY;
    const client = this.clientFactory();

    const parts = await Promise.all(inputParts(input).map(async (part) => (
      isFabricStem(part.stem) ? { ...part, image: await centerFabricRepeat(part.image) } : part
    )));
    const imageInputs = parts.map(({ image, stem }) => namedUpload(image, stem));

    const requestedSize = resolveHighResolutionCanvas(input.person.width, input.person.height);
    console.info("try_on_provider_inputs", {
      requestId: input.requestId,
      model: MODEL,
      images: imageInputs.map((image) => ({ name: image.name, type: image.type, bytes: image.size })),
    });
    const edit = (size: string, images: File[]) => client.images.edit({
      model: MODEL,
      image: images,
      prompt: input.prompt,
      quality,
      size,
      output_format: "png",
      background: "opaque",
      n: 1,
    });
    const editWithSizeFallback = async (images: File[]) => {
      try {
        return { response: await edit(requestedSize, images), resolvedSize: requestedSize };
      } catch (error) {
        if (!isSizeRejection(error)) throw error;
        const fallbackSize = resolveFallbackCanvas(input.person.width, input.person.height);
        return { response: await edit(fallbackSize, images), resolvedSize: fallbackSize };
      }
    };

    let response;
    let resolvedSize = requestedSize;
    try {
      ({ response, resolvedSize } = await editWithSizeFallback(imageInputs));
    } catch (error) {
      if (!isInvalidImageFile(error)) throw error;
      const compatibilityInputs = await Promise.all(parts.map(providerSafeUpload));
      console.warn("try_on_provider_image_fallback", {
        requestId: input.requestId,
        model: MODEL,
        maxEdge: PROVIDER_COMPATIBILITY_EDGE,
        images: compatibilityInputs.map((image, index) => ({
          name: image.name,
          type: image.type,
          bytes: image.size,
          sourceBytes: imageInputs[index]?.size,
        })),
      });
      ({ response, resolvedSize } = await editWithSizeFallback(compatibilityInputs));
    }

    const encodedImage = response.data?.[0]?.b64_json;
    if (!encodedImage) {
      throw new Error("The image provider returned no result.");
    }

    const bytes = Uint8Array.from(Buffer.from(encodedImage, "base64"));
    const decodedDimensions = detectImageDimensions(bytes, "image/png");
    if (!decodedDimensions) throw new Error("The image provider returned an invalid PNG result.");

    return {
      bytes,
      contentType: "image/png",
      metadata: {
        provider: "openai",
        model: MODEL,
        quality,
        durationMs: Date.now() - startedAt,
        // response.quality/usage are OpenAI's own server-reported values, distinct
        // from the `quality` we requested above — see TryOnMetadata for why this matters.
        reportedQuality: response.quality,
        requestedSize,
        reportedSize: response.size ?? resolvedSize,
        outputWidth: decodedDimensions.width,
        outputHeight: decodedDimensions.height,
        ...(response.usage ? {
          usage: {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
            totalTokens: response.usage.total_tokens,
          },
        } : {}),
      },
    };
  }
}
