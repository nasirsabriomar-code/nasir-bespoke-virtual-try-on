import { OpenAITryOnProvider } from "@/lib/tryon/providers/openai";
import type { TryOnInput, TryOnOutput, TryOnProvider } from "@/lib/tryon/types";

function getProvider(): TryOnProvider {
  const provider = process.env.TRY_ON_PROVIDER?.toLowerCase() || "openai";

  switch (provider) {
    case "openai":
      return new OpenAITryOnProvider();
    default:
      throw new Error(`Unsupported try-on provider: ${provider}`);
  }
}

export async function generateTryOn(input: TryOnInput): Promise<TryOnOutput> {
  return getProvider().generate(input);
}
