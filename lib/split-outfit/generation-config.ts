import "server-only";

/**
 * Server-side capability flag: does this deployment allow the Split Outfit
 * generation route to actually reach the provider? This is deliberately a
 * SEPARATE control from NEXT_PUBLIC_ENABLE_SPLIT_OUTFIT (lib/split-outfit/config.ts),
 * which only controls whether the browser renders the Split workspace UI at
 * all. UI visibility and paid-generation capability must never be the same
 * switch — a staff member previewing the Split workspace must never be able
 * to trigger real spend just because the UI happened to be visible.
 *
 * Defaults to false everywhere. Must be explicitly set to the literal string
 * "true" to enable. There is no NEXT_PUBLIC_ variant of this flag and it must
 * never be read from client code.
 */
export function isSplitGenerationEnabled(): boolean {
  return process.env.SPLIT_GENERATION_ENABLED === "true";
}
