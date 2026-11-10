import { prepareBackgroundEdit, compositeBackground } from "../background-preservation";
import { orderGenerationImages, renderInputManifest, promptImageIndicesAreValid } from "../image-layout";
import { CONSTRUCTION_PROPORTIONS, MATERIAL_POLICY, FABRIC_SCALE_POLICY } from "../pattern-geometry";
import { cropFabricDetail } from "./../fabric-reference";
import { DEFAULT_DETAIL_CROP, type FabricRole } from "./../fabric-guidance";
import { UploadValidationError } from "@/lib/validation";
import { createHash } from "node:crypto";
import sharp from "sharp";
import type { ImageEditParamsNonStreaming } from "openai/resources/images";
import { createOpenAIClient } from "@/lib/openai";
import type { TryOnInput, TryOnOutput, TryOnProvider } from "@/lib/tryon/types";
import { isModelGeneration26, resolveImageGenerationConfig, type ImageGenerationConfig } from "@/lib/tryon/model-config";
import { detectImageDimensions, type SupportedImageMime } from "@/lib/validation";

// Model, quality, canvas profile and complexity come from lib/tryon/model-config.ts.
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
  const heightLimit = Math.min(Math.sqrt(pixelLimit / ratio), PROVIDER_COMPATIBILITY_EDGE, PROVIDER_COMPATIBILITY_EDGE / ratio);
  const outputWidth = rounded(heightLimit * ratio);
  const outputHeight = rounded(heightLimit);
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

/** Primary canvas for a profile. The stable profile has no larger size to fall back from. */
export function resolveCanvasForProfile(profile: ImageGenerationConfig["canvasProfile"], width?: number, height?: number) {
  return profile === "stable" ? resolveFallbackCanvas(width, height) : resolveHighResolutionCanvas(width, height);
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
    const { data: output, info } = await sharp(source, { failOn: "error", limitInputPixels: 40_000_000 })
      .extract({ left, top, width: cropWidth, height: cropHeight })
      .rotate()
      .png({ compressionLevel: 9, palette: false })
      .toBuffer({ resolveWithObject: true });
    return {
      file: new File([output], image.file.name, { type: "image/png" }),
      mime: "image/png",
      width: info.width,
      height: info.height,
    };
  } catch {
    return image;
  }
}

/**
 * Phones often store portraits sideways with an EXIF rotation tag. Bake the
 * rotation in so the canvas and the pixels agree. Upright images keep their
 * original bytes.
 */
export async function uprightImage(image: TryOnInput["person"]): Promise<TryOnInput["person"]> {
  try {
    const source = Buffer.from(await image.file.arrayBuffer());
    const metadata = await sharp(source, { failOn: "error", limitInputPixels: 40_000_000 }).metadata();
    if (!metadata.orientation || metadata.orientation === 1) return image;
    const rotated = sharp(source, { failOn: "error", limitInputPixels: 40_000_000 }).rotate();
    const mime: SupportedImageMime = metadata.hasAlpha ? "image/png" : "image/jpeg";
    const { data, info } = await (mime === "image/png"
      ? rotated.png({ compressionLevel: 9, palette: false })
      : rotated.jpeg({ quality: 100, chromaSubsampling: "4:4:4", mozjpeg: true })
    ).toBuffer({ resolveWithObject: true });
    return {
      file: new File([new Uint8Array(data)], `upright.${extensionFor(mime)}`, { type: mime }),
      mime,
      width: info.width,
      height: info.height,
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
  return orderGenerationImages(input.selection.mode, parts[0], parts[1], fabrics, references);
}

const STEM_TO_FABRIC: Record<string, FabricRole> = { "fabric-reference": "fabric", "lower-fabric-reference": "lowerFabric", "shirt-fabric-reference": "shirtFabric", "waistcoat-fabric-reference": "waistcoatFabric" };
export async function prepareProviderReferences(input: TryOnInput): Promise<{ parts: ImagePart[]; guidance: string }> {
  const details: { part: ImagePart; fullIndex: number; role: FabricRole }[] = [];
  const parts: ImagePart[] = [];
  for (const [index, part] of inputParts(input).entries()) {
    const role = STEM_TO_FABRIC[part.stem];
    const options = role ? input.fabricGuidance?.[role] : undefined;
    if (!isFabricStem(part.stem)) { parts.push(part); continue; }
    if (options?.mode !== "full-detail") { parts.push({ ...part, image: await centerFabricRepeat(part.image) }); continue; }
    parts.push({ ...part, image: await uprightImage(part.image) });
    details.push({ part: { stem: `${part.stem}-detail`, image: await cropFabricDetail(part.image, options.crop ?? DEFAULT_DETAIL_CROP) }, fullIndex: index + 1, role });
  }
  const lines: string[] = [];
  for (const detail of details) {
    const options = input.fabricGuidance![detail.role]!;
    const number = parts.length + 1;
    parts.push(detail.part);
    lines.push(`Image ${detail.fullIndex} is the complete ${detail.role} swatch: it controls repeat scale, pattern density and colour. Image ${number} is a cropped detail from that same swatch: use it only to inspect weave and motif edges, never to enlarge the repeat or infer a new physical scale. Ignore rulers, calibration marks and the swatch background.`);
    if (options.repeatWidthCm || options.repeatHeightCm) lines.push(`Measured physical repeat for Image ${detail.fullIndex}: ${options.repeatWidthCm ? `width ${options.repeatWidthCm} cm` : "width unspecified"}; ${options.repeatHeightCm ? `height ${options.repeatHeightCm} cm` : "height unspecified"}. Use this as garment pattern-scale guidance, not a garment sizing measurement.`);
  }
  if (parts.length > 16) throw new UploadValidationError("Too many visual references. Reduce the number of fabric detail references.", "invalid_image");
  return { parts, guidance: lines.length ? "FABRIC SCALE AND DETAIL AUTHORITY:\n" + lines.join("\n") : "" };
}

async function providerSafeUpload({ image, stem }: ImagePart, forcePng = false) {
  const source = Buffer.from(await image.file.arrayBuffer());
  const sourceMetadata = await sharp(source, { failOn: "error", limitInputPixels: 40_000_000 }).metadata();
  const outputMime: SupportedImageMime = forcePng || sourceMetadata.hasAlpha ? "image/png" : "image/jpeg";
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

/** Shared offline/production compiler. Does not contact a provider or storage. */
export async function prepareProviderPacket(input: TryOnInput, config: ImageGenerationConfig = resolveImageGenerationConfig()) {
  const person = await uprightImage(input.person);
  const requestedSize = resolveCanvasForProfile(config.canvasProfile, person.width, person.height);
  const background = input.backgroundControl && input.backgroundControl.mode !== "prompt-only" ? await prepareBackgroundEdit(person, requestedSize, input.backgroundControl) : null;
  const { parts, guidance } = await prepareProviderReferences({ ...input, person: background?.image ?? person });
  const regionInstruction = background
    ? `EDIT REGION (${input.backgroundControl!.mode}): Only the transparent garment region permits clothing, necessary revealed-background reconstruction and contact-shadow changes. Preserve all other regions. ${input.backgroundControl!.mode === "composite" ? "The normalized original outside this region will be retained by compositing; keep silhouette and lighting aligned at its boundary." : "The mask guides the edit; keep unaffected surroundings fixed."} Do not draw a rectangle or border.`
    : "EDIT REGION (prompt-only): Restrict changes to selected clothing/accessories and their necessary local silhouette, revealed-background and contact-shadow effects. Keep all unaffected surroundings fixed.";
  const providerPrompt = [input.prompt, renderInputManifest(parts), CONSTRUCTION_PROPORTIONS, MATERIAL_POLICY, FABRIC_SCALE_POLICY, guidance, regionInstruction].filter(Boolean).join("\n\n");
  if (!promptImageIndicesAreValid(providerPrompt, parts.length)) throw new UploadValidationError("The reference image mapping is invalid.", "invalid_image");
  if (providerPrompt.length > 32000) throw new UploadValidationError("The selected look has too many instructions.", "invalid_image");
  const imageInputs = parts.map(({ image, stem }) => namedUpload(image, stem));

  return { person, requestedSize, background, parts, guidance, providerPrompt, imageInputs };
}

export class OpenAITryOnProvider implements TryOnProvider {
  private readonly config: ImageGenerationConfig;

  constructor(
    private readonly clientFactory: typeof createOpenAIClient = createOpenAIClient,
    config?: ImageGenerationConfig,
  ) {
    this.config = config ?? resolveImageGenerationConfig();
  }

  async generate(input: TryOnInput): Promise<TryOnOutput> {
    const startedAt = Date.now();
    const { model, quality, complexity } = this.config;
    const client = this.clientFactory();

    const { person, requestedSize, background, parts, guidance, providerPrompt, imageInputs } = await prepareProviderPacket(input, this.config);

    const preprocessingMs = Date.now() - startedAt;
    let providerAttempts = 0;
    const fallbackReasons: string[] = [];
    const providerStart = Date.now();
    console.info("try_on_provider_inputs", {
      requestId: input.requestId,
      model,
      images: imageInputs.map((image) => ({ name: image.name, type: image.type, bytes: image.size })),
    });
    const edit = async (size: string, images: File[]) => {
      const maskFile = background ? await (async () => {
        const metadata = await sharp(Buffer.from(await images[0].arrayBuffer())).metadata();
        const mask = await sharp(background.mask).resize(metadata.width!, metadata.height!, { kernel: sharp.kernel.nearest }).png().toBuffer();
        return new File([new Uint8Array(mask)], "garment-mask.png", { type: "image/png" });
      })() : undefined;
      providerAttempts++;
      // SDK 7.4.0 predates the 2.6 `complexity` field; it is sent only when configured for a 2.6 model.
      const params: ImageEditParamsNonStreaming & { complexity?: ImageGenerationConfig["complexity"] } = {
        model,
        image: images,
        ...(maskFile ? { mask: maskFile } : {}),
        prompt: providerPrompt,
        quality,
        size,
        output_format: "png",
        background: "opaque",
        n: 1,
        ...(complexity && isModelGeneration26(model) ? { complexity } : {}),
      };
      return client.images.edit(params);
    };
    const editWithSizeFallback = async (images: File[]) => {
      try {
        return { response: await edit(requestedSize, images), resolvedSize: requestedSize };
      } catch (error) {
        if (!isSizeRejection(error) || this.config.canvasProfile === "stable") throw error;
        fallbackReasons.push("size");
        const fallbackSize = resolveFallbackCanvas(person.width, person.height);
        return { response: await edit(fallbackSize, images), resolvedSize: fallbackSize };
      }
    };

    let response;
    let resolvedSize = requestedSize;
    try {
      ({ response, resolvedSize } = await editWithSizeFallback(imageInputs));
    } catch (error) {
      if (!isInvalidImageFile(error)) throw error;
      fallbackReasons.push("image-format");
      const compatibilityInputs = await Promise.all(parts.map((part, index) => providerSafeUpload(part, Boolean(background && index === 0))));
      console.warn("try_on_provider_image_fallback", {
        requestId: input.requestId,
        model,
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

    let bytes = Uint8Array.from(Buffer.from(encodedImage, "base64"));
    if (background && input.backgroundControl?.mode === "composite") bytes = new Uint8Array(await compositeBackground(background.base, bytes, background.mask));
    const decodedDimensions = detectImageDimensions(bytes, "image/png");
    if (!decodedDimensions) throw new Error("The image provider returned an invalid PNG result.");

    return {
      bytes,
      contentType: "image/png",
      metadata: {
        provider: "openai",
        model,
        quality,
        durationMs: Date.now() - startedAt,
        // response.quality/usage are OpenAI's own server-reported values, distinct
        // from the `quality` we requested above — see TryOnMetadata for why this matters.
        provenance: { promptVersion: "atelier-v4-scoped-authority", backgroundControl: input.backgroundControl, preprocessingVersion: guidance ? "full-detail-v1" : "crop-v2-orientation", fabricGuidance: input.fabricGuidance, promptHash: createHash("sha256").update(providerPrompt).digest("hex"), modelSnapshot: null, preprocessingMs, providerMs: Date.now() - providerStart, providerAttempts, fallbackReasons },
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
