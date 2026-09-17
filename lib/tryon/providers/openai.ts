import { toFile } from "openai";
import { createOpenAIClient } from "@/lib/openai";
import type { TryOnInput, TryOnOutput, TryOnProvider } from "@/lib/tryon/types";
import { detectImageDimensions } from "@/lib/validation";

// Precision-first variant of OpenAI's Images 2.5 generation, released 2026-09-08.
// Rollback pin if the unpinned alias ever regresses: "gpt-image-2.5-sunburst-2026-09-08"
const MODEL = "gpt-image-2.5-sunburst";
const DEFAULT_QUALITY = "medium" as const;
const EXPERIMENTAL_MAX_PIXELS = 3840 * 2160;
const STABLE_MAX_PIXELS = 2560 * 1440;

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

export class OpenAITryOnProvider implements TryOnProvider {
  constructor(
    private readonly clientFactory: typeof createOpenAIClient = createOpenAIClient,
  ) {}

  async generate(input: TryOnInput): Promise<TryOnOutput> {
    const startedAt = Date.now();
    const quality = DEFAULT_QUALITY;
    const client = this.clientFactory();

    const [personUpload, fabricUpload, ...referenceUploads] = await Promise.all([
      toFile(await input.person.file.arrayBuffer(), "person-reference", { type: input.person.mime }),
      toFile(await input.fabric.file.arrayBuffer(), "fabric-reference", { type: input.fabric.mime }),
      ...input.references.map(async ({ role, image }) => toFile(await image.file.arrayBuffer(), `${role}-blueprint`, {
        type: image.mime,
      })),
    ]);
    const outfitUpload = input.outfit
      ? await toFile(await input.outfit.file.arrayBuffer(), "outfit-style-reference", { type: input.outfit.mime })
      : null;
    const lowerFabricUpload = input.lowerFabric
      ? await toFile(await input.lowerFabric.file.arrayBuffer(), "lower-fabric-reference", { type: input.lowerFabric.mime })
      : null;
    const imageInputs = outfitUpload
      ? [personUpload, outfitUpload, fabricUpload, ...referenceUploads]
      : lowerFabricUpload
        ? [personUpload, fabricUpload, lowerFabricUpload, ...referenceUploads]
        : [personUpload, fabricUpload, ...referenceUploads];

    const requestedSize = resolveHighResolutionCanvas(input.person.width, input.person.height);
    const edit = (size: string) => client.images.edit({
      model: MODEL,
      image: imageInputs,
      prompt: input.prompt,
      quality,
      size,
      output_format: "png",
      background: "auto",
      n: 1,
    });
    let response;
    let resolvedSize = requestedSize;
    try {
      response = await edit(requestedSize);
    } catch (error) {
      if (!isSizeRejection(error)) throw error;
      resolvedSize = resolveFallbackCanvas(input.person.width, input.person.height);
      response = await edit(resolvedSize);
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
