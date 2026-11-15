const HISTORY_ASSET_ID_RE = /\/api\/history\/([0-9a-f-]{36})\//i;

export function extractHistoryId(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(HISTORY_ASSET_ID_RE);
  return match ? match[1] : null;
}
