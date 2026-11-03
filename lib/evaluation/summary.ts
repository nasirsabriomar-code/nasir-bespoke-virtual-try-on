export type EvaluationResult = {
  caseId: string; condition: string; accepted: boolean; durationMs: number;
  costUsd: number | null; failed?: boolean;
  scores: { scale: number; colour: number; construction: number; background: number; identity: number } | null;
};
const SCORE_KEYS = ["scale", "colour", "construction", "background", "identity"] as const;
function validRow(row: EvaluationResult) {
  if (!row || typeof row !== "object" || typeof row.caseId !== "string" || !row.caseId.trim() || typeof row.condition !== "string" || !row.condition.trim() || typeof row.accepted !== "boolean" || (row.failed !== undefined && typeof row.failed !== "boolean") || !Number.isFinite(row.durationMs) || row.durationMs < 0 || (row.costUsd !== null && (!Number.isFinite(row.costUsd) || row.costUsd < 0))) return false;
  if (row.failed) return row.accepted === false && row.scores === null;
  const scores = row.scores;
  if (!scores || typeof scores !== "object") return false;
  return Object.keys(scores).length === SCORE_KEYS.length && SCORE_KEYS.every(key => Number.isInteger(scores[key]) && scores[key] >= 1 && scores[key] <= 5);
}
export function summarizeEvaluations(results: EvaluationResult[]) {
  if (!Array.isArray(results) || results.some(row => !validRow(row))) throw new Error("Invalid evaluation result.");
  return [...new Set(results.map(row => row.condition))].map(condition => {
    const rows = results.filter(row => row.condition === condition);
    const sorted = rows.map(row => row.durationMs).sort((a, b) => a - b);
    const accepted = rows.filter(row => row.accepted).length;
    const scored = rows.filter((row): row is EvaluationResult & { scores: NonNullable<EvaluationResult["scores"]> } => row.scores !== null);
    const costsComplete = rows.every(row => row.costUsd !== null);
    const totalCostUsd = costsComplete ? rows.reduce((sum, row) => sum + row.costUsd!, 0) : null;
    return {
      condition, sampleSize: rows.length, scored: scored.length, failed: rows.filter(row => row.failed).length, accepted, acceptanceRate: accepted / rows.length,
      medianDurationMs: sorted.length % 2 ? sorted[Math.floor(sorted.length / 2)] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2,
      p95DurationMs: sorted[Math.ceil(sorted.length * .95) - 1],
      meanScores: scored.length ? Object.fromEntries(SCORE_KEYS.map(key => [key, scored.reduce((sum, row) => sum + row.scores[key], 0) / scored.length])) : null,
      costsComplete, totalCostUsd, costPerAcceptedUsd: totalCostUsd !== null && accepted ? totalCostUsd / accepted : null,
    };
  });
}
