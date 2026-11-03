export const REVIEW_REASONS = ["pattern-too-large", "pattern-too-small", "wrong-colour", "incorrect-construction", "changed-background", "other-quality"] as const;
export type ReviewReason = typeof REVIEW_REASONS[number];
export type GenerationReview = { decision: "unreviewed" | "accepted" | "rejected"; favourite: boolean; reasons: ReviewReason[]; updatedAt: string };
export function parseReview(value: unknown): Omit<GenerationReview, "updatedAt"> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some(key => !["decision", "favourite", "reasons", "updatedAt"].includes(key))) return null;
  if (typeof record.decision !== "string" || !["unreviewed", "accepted", "rejected"].includes(record.decision) || typeof record.favourite !== "boolean" || !Array.isArray(record.reasons) || record.reasons.length > REVIEW_REASONS.length || record.reasons.some(reason => !REVIEW_REASONS.includes(reason as ReviewReason))) return null;
  return { decision: record.decision as GenerationReview["decision"], favourite: record.favourite, reasons: [...new Set(record.reasons)] as ReviewReason[] };
}
