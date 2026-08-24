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
    role:
      | "upper"
      | "lower"
      | "subtype"
      | "turban"
      | "shoes"
      | "upper-style"
      | "lower-style"
      | "turban-style"
      | "shoe-style"
      | "bespoke-detail-1"
      | "bespoke-detail-2"
      | "curated-design"
      | "curated-detail"
      // Split Outfit (Phase 2a foundation): construction-reference and
      // material-swatch roles. Never invoked against the real provider in
      // this milestone — SPLIT_GENERATION_ENABLED defaults to false.
      | "split-upper-construction"
      | "split-waistcoat-construction"
      | "split-material";
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
