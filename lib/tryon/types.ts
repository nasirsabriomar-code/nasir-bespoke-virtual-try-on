import type { SupportedImageMime } from "@/lib/validation";
import type { CatalogSelection, TryOnSelection } from "@/lib/catalog/types";

export type TryOnImage = {
  file: File;
  mime: SupportedImageMime;
};

export type TryOnInput = {
  person: TryOnImage;
  outfit?: TryOnImage;
  fabric: TryOnImage;
  references: Array<{
    role: "upper" | "lower" | "subtype" | "turban" | "shoes" | "upper-style" | "lower-style" | "turban-style" | "shoe-style" | "bespoke-detail-1" | "bespoke-detail-2";
    image: TryOnImage;
  }>;
  selection: TryOnSelection;
  catalogSelection?: CatalogSelection;
  prompt: string;
  requestId: string;
};

export type TryOnMetadata = {
  provider: string;
  model: string;
  quality: string;
  durationMs: number;
};

export type TryOnOutput = {
  bytes: Uint8Array;
  contentType: "image/jpeg";
  metadata: TryOnMetadata;
};

export interface TryOnProvider {
  generate(input: TryOnInput): Promise<TryOnOutput>;
}
