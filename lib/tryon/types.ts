import type { SupportedImageMime } from "@/lib/validation";
import type { CatalogSelection, TryOnSelection } from "@/lib/catalog/types";

export type TryOnImage = {
  file: File;
  mime: SupportedImageMime;
  width?: number;
  height?: number;
};

// Historical/internal request types may still carry an old quality value. The
// Sunburst provider ignores it and always uses medium in the Studio pipeline.
export type EffortQuality = "low" | "medium" | "high" | "max";

export type TryOnInput = {
  person: TryOnImage;
  outfit?: TryOnImage;
  fabric: TryOnImage;
  lowerFabric?: TryOnImage;
  references: Array<{
    role: "upper" | "lower" | "subtype" | "turban" | "shoes" | "upper-style" | "lower-style" | "turban-style" | "shoe-style" | "bespoke-detail-1" | "bespoke-detail-2" | "curated-design" | "curated-detail" | "split-upper" | "split-lower" | "split-shirt" | "split-waistcoat" | "split-footwear";
    image: TryOnImage;
  }>;
  selection: TryOnSelection;
  catalogSelection?: CatalogSelection;
  quality?: EffortQuality;
  prompt: string;
  requestId: string;
};

export type TryOnMetadata = {
  provider: string;
  model: string;
  quality: string;
  durationMs: number;
  // Independent, server-reported confirmation from the provider's own response —
  // not an echo of what we requested. Used to verify a quality override actually
  // changed what the provider did, not just what we asked for.
  reportedQuality?: string;
  requestedSize?: string;
  reportedSize?: string;
  outputWidth?: number;
  outputHeight?: number;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
};

export type TryOnOutput = {
  bytes: Uint8Array;
  contentType: SupportedImageMime;
  metadata: TryOnMetadata;
};

export interface TryOnProvider {
  generate(input: TryOnInput): Promise<TryOnOutput>;
}
