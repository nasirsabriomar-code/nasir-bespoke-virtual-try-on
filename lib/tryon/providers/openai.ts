import { toFile } from "openai";
import { createOpenAIClient } from "@/lib/openai";
import type { TryOnInput, TryOnOutput, TryOnProvider } from "@/lib/tryon/types";

const MODEL = "gpt-image-2";
// Let GPT Image 2 choose the closest supported canvas for the customer's source
// photo instead of forcing every input into a 2:3 portrait crop.
const OUTPUT_SIZE = "auto";
const DEFAULT_QUALITY = "medium" as const;
const VALID_QUALITIES = new Set(["low", "medium", "high"] as const);

type ImageQuality = "low" | "medium" | "high";

function getQuality(): ImageQuality {
  const configured = process.env.TRY_ON_QUALITY?.toLowerCase() as ImageQuality | undefined;
  return configured && VALID_QUALITIES.has(configured) ? configured : DEFAULT_QUALITY;
}

export class OpenAITryOnProvider implements TryOnProvider {
  constructor(
    private readonly clientFactory: typeof createOpenAIClient = createOpenAIClient,
  ) {}

  async generate(input: TryOnInput): Promise<TryOnOutput> {
    const startedAt = Date.now();
    const quality = getQuality();
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
    const imageInputs = outfitUpload
      ? [personUpload, outfitUpload, fabricUpload, ...referenceUploads]
      : [personUpload, fabricUpload, ...referenceUploads];

    const response = await client.images.edit({
      model: MODEL,
      image: imageInputs,
      prompt: input.prompt,
      quality,
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
      },
    };
  }
}
