import { toFile } from "openai";
import { createOpenAIClient } from "@/lib/openai";
import type { TryOnInput, TryOnOutput, TryOnProvider } from "@/lib/tryon/types";

// Precision-first variant of OpenAI's Images 2.5 generation, released 2026-09-08.
// Rollback pin if the unpinned alias ever regresses: "gpt-image-2.5-sunburst-2026-09-08"
const MODEL = "gpt-image-2.5-sunburst";
// Let GPT Image 2.5 choose the closest supported canvas for the customer's source
// photo instead of forcing every input into a 2:3 portrait crop.
const OUTPUT_SIZE = "auto";
const DEFAULT_QUALITY = "medium" as const;
const VALID_QUALITIES = new Set(["low", "medium", "high", "xhigh", "max", "auto"] as const);

type ImageQuality = "low" | "medium" | "high" | "xhigh" | "max" | "auto";

function getQuality(override?: string): ImageQuality {
  const normalizedOverride = override?.toLowerCase() as ImageQuality | undefined;
  if (normalizedOverride && VALID_QUALITIES.has(normalizedOverride)) return normalizedOverride;
  const configured = process.env.TRY_ON_QUALITY?.toLowerCase() as ImageQuality | undefined;
  return configured && VALID_QUALITIES.has(configured) ? configured : DEFAULT_QUALITY;
}

export class OpenAITryOnProvider implements TryOnProvider {
  constructor(
    private readonly clientFactory: typeof createOpenAIClient = createOpenAIClient,
  ) {}

  async generate(input: TryOnInput): Promise<TryOnOutput> {
    const startedAt = Date.now();
    const quality = getQuality(input.quality);
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

    const response = await client.images.edit({
      model: MODEL,
      image: imageInputs,
      prompt: input.prompt,
      // The installed openai SDK's types predate GPT Image 2.5's expanded quality
      // tiers (xhigh/max) — the REST API itself accepts them for this model.
      quality: quality as "low" | "medium" | "high" | "auto",
      size: OUTPUT_SIZE,
      output_format: "jpeg",
      output_compression: 90,
      background: "auto",
      n: 1,
    });

    const encodedImage = response.data?.[0]?.b64_json;
    if (!encodedImage) {
      throw new Error("The image provider returned no result.");
    }

    return {
      bytes: Uint8Array.from(Buffer.from(encodedImage, "base64")),
      contentType: "image/jpeg",
      metadata: {
        provider: "openai",
        model: MODEL,
        quality,
        durationMs: Date.now() - startedAt,
        // response.quality/usage are OpenAI's own server-reported values, distinct
        // from the `quality` we requested above — see TryOnMetadata for why this matters.
        reportedQuality: response.quality,
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
