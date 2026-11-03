// Reads are denied after expiry even when a cleanup run is delayed.
export function generationRetentionDays() {
  const value = Number(process.env.GENERATION_RETENTION_DAYS ?? "30");
  return Number.isInteger(value) && value >= 1 && value <= 365 ? value : 30;
}
export function generationCutoff(now = Date.now()) {
  return new Date(now - generationRetentionDays() * 86_400_000).toISOString();
}
export function generationExpired(occurredAt: string, now = Date.now()) {
  const time = Date.parse(occurredAt);
  return !Number.isFinite(time) || time <= Date.parse(generationCutoff(now));
}
