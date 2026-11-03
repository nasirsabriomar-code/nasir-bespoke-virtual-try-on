import type { ResultSummary } from "@/lib/result-summary";

export type SwatchPiece = "jacket" | "trousers" | "shirt" | "waistcoat";

/** A result generated in this page session, kept for side-by-side showing to the customer. */
export type SessionResult = {
  id: string;
  resultUrl: string;
  originalUrl: string;
  summary: ResultSummary;
  swatches: Partial<Record<SwatchPiece, string>>;
  /** Object URLs this entry created and must release. */
  ownedUrls: string[];
  recovered: boolean;
};

export const SESSION_RESULT_LIMIT = 6;

const HISTORY_ASSET: Record<SwatchPiece, string> = {
  jacket: "fabric",
  trousers: "lower-fabric",
  shirt: "shirt-fabric",
  waistcoat: "waistcoat-fabric",
};

export function addSessionResult(list: SessionResult[], item: SessionResult, revoke: (url: string) => void, limit = SESSION_RESULT_LIMIT): SessionResult[] {
  const next = [...list, item];
  const dropped = next.splice(0, Math.max(0, next.length - limit));
  dropped.forEach((entry) => entry.ownedUrls.forEach(revoke));
  return next;
}

export function releaseSessionResults(list: SessionResult[], revoke: (url: string) => void): SessionResult[] {
  list.forEach((entry) => entry.ownedUrls.forEach(revoke));
  return [];
}

/**
 * Swatches for the cloth submitted with one generation. Stored History assets are
 * preferred; otherwise the result owns copies, so later fabric edits cannot change them.
 */
export function submissionSwatches(input: {
  historyId?: string;
  files: Partial<Record<SwatchPiece, File | null>>;
  trousersLinked: boolean;
  createUrl: (file: File) => string;
}): { swatches: Partial<Record<SwatchPiece, string>>; ownedUrls: string[] } {
  const swatches: Partial<Record<SwatchPiece, string>> = {};
  const ownedUrls: string[] = [];
  for (const piece of Object.keys(HISTORY_ASSET) as SwatchPiece[]) {
    if (piece === "trousers" && input.trousersLinked) continue;
    const file = input.files[piece];
    if (!file) continue;
    if (input.historyId) {
      swatches[piece] = `/api/history/${input.historyId}/asset/${HISTORY_ASSET[piece]}`;
    } else {
      const url = input.createUrl(file);
      ownedUrls.push(url);
      swatches[piece] = url;
    }
  }
  if (input.trousersLinked && swatches.jacket) swatches.trousers = swatches.jacket;
  return { swatches, ownedUrls };
}
