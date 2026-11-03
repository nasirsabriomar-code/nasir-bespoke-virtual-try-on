import type { PieceCloth, ResultSummary } from "@/lib/result-summary";
const CLOTH_VALUES: readonly string[] = ["uploaded", "linked-to-jacket", "reference"];
const PREFIX = "nasir-pending-generation-v1:";
const TTL_MS = 15 * 60_000;
/** personToken identifies the customer photo on screen when the job started (a page-local blob URL). */
export type PendingGeneration = { key: string; createdAt: number; summary: ResultSummary; personToken?: string };
export function pendingStorageKey(account: string) { return PREFIX + encodeURIComponent(account); }
export function parsePendingGeneration(raw: string | null, now = Date.now()): PendingGeneration | null {
  try {
    const value = JSON.parse(raw ?? "null");
    if (!value || typeof value.key !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.key) || !Number.isFinite(value.createdAt) || value.createdAt > now || now - value.createdAt >= TTL_MS || !value.summary || typeof value.summary !== "object" || Array.isArray(value.summary)) return null;
    const summary: Record<string, string> = {};
    for (const field of ["garment", "lower", "fabric", "turban", "shoes"]) {
      const text = value.summary[field];
      if (text !== undefined && (typeof text !== "string" || text.length > 240)) return null;
      if (typeof text === "string") summary[field] = text;
    }
    if (!summary.garment || !summary.fabric || !summary.shoes) return null;
    const result: ResultSummary = { garment: summary.garment, fabric: summary.fabric, shoes: summary.shoes, ...(summary.lower ? { lower: summary.lower } : {}), ...(summary.turban ? { turban: summary.turban } : {}) };
    if (value.summary.pieces !== undefined) {
      if (!Array.isArray(value.summary.pieces) || value.summary.pieces.length > 5 || value.summary.pieces.some((piece: Record<string, unknown>) => !piece || typeof piece !== "object" || ["label", "design", "source"].some(key => typeof piece[key] !== "string" || (piece[key] as string).length > 240))) return null;
      if (value.summary.pieces.some((piece: Record<string, unknown>) => (piece.cloth !== undefined && !CLOTH_VALUES.includes(piece.cloth as string)) || (piece.customerLabel !== undefined && (typeof piece.customerLabel !== "string" || piece.customerLabel.length > 240)))) return null;
      result.pieces = value.summary.pieces.map((piece: { label: string; design: string; source: string; cloth?: PieceCloth; customerLabel?: string }) => ({ label: piece.label, design: piece.design, source: piece.source, ...(piece.cloth ? { cloth: piece.cloth } : {}), ...(piece.customerLabel !== undefined ? { customerLabel: piece.customerLabel } : {}) }));
    }
    if (value.summary.accessories !== undefined) {
      if (!Array.isArray(value.summary.accessories) || value.summary.accessories.length > 5 || value.summary.accessories.some((name: unknown) => typeof name !== "string" || name.length > 240)) return null;
      result.accessories = [...value.summary.accessories];
    }
    if (value.personToken !== undefined && (typeof value.personToken !== "string" || value.personToken.length > 240)) return null;
    return { key: value.key, createdAt: value.createdAt, summary: result, ...(value.personToken ? { personToken: value.personToken } : {}) };
  } catch { return null; }
}
export function clearPendingGenerations(storage: Pick<Storage, "length" | "key" | "removeItem">) {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index++) { const key = storage.key(index); if (key?.startsWith(PREFIX)) keys.push(key); }
  keys.forEach(key => storage.removeItem(key));
}
