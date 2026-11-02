import { createHash } from "node:crypto";

type AssetReference = { pathname: string; contentType: string; checksum?: string };

type MigrationStore = {
  exists: (pathname: string) => Promise<boolean>;
  readSource: (pathname: string) => Promise<Uint8Array | null>;
  write: (pathname: string, bytes: Uint8Array, contentType: string) => Promise<void>;
};

export type MigrationOutcome = "present" | "copied" | "missing" | "corrupt";

/** Copies one history image into R2. Never overwrites an object that is already there. */
export async function migrateGenerationAsset(reference: AssetReference, store: MigrationStore): Promise<MigrationOutcome> {
  if (await store.exists(reference.pathname)) return "present";
  const bytes = await store.readSource(reference.pathname);
  if (!bytes) return "missing";
  if (reference.checksum && createHash("sha256").update(bytes).digest("hex") !== reference.checksum) return "corrupt";
  await store.write(reference.pathname, bytes, reference.contentType);
  return "copied";
}
