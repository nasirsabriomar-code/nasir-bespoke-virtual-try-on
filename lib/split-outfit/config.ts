/**
 * Feature flag for Split Outfit Mode Phase 1.
 * Returns true if Split Outfit is enabled via:
 * 1. Environment variable NEXT_PUBLIC_ENABLE_SPLIT_OUTFIT === "true"
 * 2. Local development environment (process.env.NODE_ENV === "development")
 * 3. Client URL query parameter ?split=1 or session override (when in browser)
 */
export function isSplitOutfitEnabled(): boolean {
  // 1. Explicit env flag
  if (process.env.NEXT_PUBLIC_ENABLE_SPLIT_OUTFIT === "true") {
    return true;
  }

  // 2. Development environment default
  if (process.env.NODE_ENV === "development") {
    return true;
  }

  // 3. Client-side query param / session override
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    if (params.get("split") === "1" || params.get("mode") === "split") {
      return true;
    }
  }

  return false;
}
