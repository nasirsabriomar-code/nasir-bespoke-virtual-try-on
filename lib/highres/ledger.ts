import { generationCutoff } from "@/lib/history/retention-policy";
import "server-only";
import { HighResolutionUploadError } from "./upload-error";

import { neon } from "@neondatabase/serverless";
import type { SupportedImageMime } from "@/lib/validation";
import type { GenerationAssetRefs } from "@/lib/generation-storage";
import type { UsageEvent, UsageHistory } from "@/lib/usage-history";

export type UploadRole = "person" | "fabric" | "lowerFabric" | "shirtFabric" | "waistcoatFabric" | "outfit";
export type UploadSlot = {
  id: string;
  username: string;
  role: UploadRole;
  pathname: string;
  filename: string;
  contentType: SupportedImageMime;
  bytes: number;
  status: "authorized" | "uploaded" | "consumed";
  expiresAt: string;
  checksum?: string;
  width?: number;
  height?: number;
};

const memory = globalThis as typeof globalThis & {
  __nasirHighResUploads?: Map<string, UploadSlot>;
  __nasirHighResGenerations?: Map<string, UsageEvent>;
};
const memoryUploads = memory.__nasirHighResUploads ?? new Map<string, UploadSlot>();
const memoryGenerations = memory.__nasirHighResGenerations ?? new Map<string, UsageEvent>();
memory.__nasirHighResUploads = memoryUploads;
memory.__nasirHighResGenerations = memoryGenerations;

let schemaReady: Promise<void> | null = null;
const deletionRetries = new Map<string, { attempts: number; next: number }>();
const deletionState = globalThis as typeof globalThis & { __nasirDeletions?: Map<string, UsageEvent | null> };
const memoryDeletions = deletionState.__nasirDeletions ??= new Map();

export class GenerationLedgerConfigurationError extends Error {
  constructor() {
    super("Permanent generation history is not configured. Connect the project's Neon database.");
    this.name = "GenerationLedgerConfigurationError";
  }
}

function getSql() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    if (process.env.NODE_ENV !== "production") return null;
    throw new GenerationLedgerConfigurationError();
  }
  // neon() creates a lightweight HTTP query function, not a connection. Give
  // each operation a fresh deadline rather than caching an expiring signal.
  return neon(url, { fetchOptions: { signal: AbortSignal.timeout(15_000) } });
}

export function isPermanentHistoryConfigured() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

async function ensureSchema() {
  const sql = getSql();
  if (!sql) return;
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS nasir_tryon_uploads (
        id UUID PRIMARY KEY, username TEXT NOT NULL, role TEXT NOT NULL,
        pathname TEXT NOT NULL UNIQUE, filename TEXT NOT NULL, content_type TEXT NOT NULL,
        bytes BIGINT NOT NULL, status TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL,
        checksum TEXT, width INTEGER, height INTEGER, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS nasir_tryon_generations (
        id UUID PRIMARY KEY, username TEXT NOT NULL, occurred_at TIMESTAMPTZ NOT NULL,
        payload JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS nasir_tryon_deletions (
        id UUID PRIMARY KEY, payload JSONB, requested_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await sql`ALTER TABLE nasir_tryon_deletions ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0`;
      await sql`ALTER TABLE nasir_tryon_deletions ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now()`;
      await sql`CREATE INDEX IF NOT EXISTS nasir_tryon_generations_occurred_idx ON nasir_tryon_generations (occurred_at DESC)`;
    })().catch((error) => { schemaReady = null; throw error; });
  }
  await schemaReady;
}

function cleanFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120) || "upload";
}

function extensionFor(mime: SupportedImageMime) {
  return mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
}

export async function createUploadSlot(input: Omit<UploadSlot, "id" | "pathname" | "status" | "expiresAt">) {
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
  const pathname = `nasir-bespoke/uploads/${id}/${input.role}.${extensionFor(input.contentType)}`;
  const slot: UploadSlot = { ...input, id, pathname, filename: cleanFilename(input.filename), status: "authorized", expiresAt };
  const sql = getSql();
  if (!sql) {
    const active = [...memoryUploads.values()].filter(item => item.status !== "consumed" && Date.parse(item.expiresAt) > Date.now());
    const own = active.filter(item => item.username === slot.username);
    if (own.length >= 12 || own.reduce((sum, item) => sum + item.bytes, slot.bytes) > 200 * 1024 * 1024
      || active.reduce((sum, item) => sum + item.bytes, slot.bytes) > 2 * 1024 * 1024 * 1024) {
      throw new HighResolutionUploadError("Upload capacity reached. Finish existing uploads or wait for them to expire.", 429);
    }
    memoryUploads.set(id, slot);
    return slot;
  }
  await ensureSchema();
  // The transaction lock precedes the INSERT's snapshot, serializing admissions
  // across instances. A CTE lock inside one statement would use a stale snapshot.
  const results = await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(7612390042)`,
    sql`INSERT INTO nasir_tryon_uploads (id, username, role, pathname, filename, content_type, bytes, status, expires_at)
      SELECT ${id}, ${slot.username}, ${slot.role}, ${slot.pathname}, ${slot.filename}, ${slot.contentType}, ${slot.bytes}, ${slot.status}, ${slot.expiresAt}
      WHERE (SELECT count(*) FROM nasir_tryon_uploads WHERE username = ${slot.username} AND status <> 'consumed' AND expires_at > now()) < 12
        AND (SELECT COALESCE(sum(bytes), 0) FROM nasir_tryon_uploads WHERE username = ${slot.username} AND status <> 'consumed' AND expires_at > now()) + ${slot.bytes} <= 209715200
        AND (SELECT COALESCE(sum(bytes), 0) FROM nasir_tryon_uploads WHERE status <> 'consumed' AND expires_at > now()) + ${slot.bytes} <= 2147483648
      RETURNING id`,
  ]);
  if (!results[1].length) throw new HighResolutionUploadError("Upload capacity reached. Finish existing uploads or wait for them to expire.", 429);
  return slot;
}

function rowToSlot(row: Record<string, unknown>): UploadSlot {
  return {
    id: String(row.id), username: String(row.username), role: row.role as UploadRole,
    pathname: String(row.pathname), filename: String(row.filename), contentType: row.content_type as SupportedImageMime,
    bytes: Number(row.bytes), status: row.status as UploadSlot["status"], expiresAt: new Date(String(row.expires_at)).toISOString(),
    ...(typeof row.checksum === "string" ? { checksum: row.checksum } : {}),
    ...(typeof row.width === "number" ? { width: row.width } : {}),
    ...(typeof row.height === "number" ? { height: row.height } : {}),
  };
}

export async function getUploadSlot(id: string) {
  const sql = getSql();
  if (!sql) return memoryUploads.get(id) ?? null;
  await ensureSchema();
  const rows = await sql`SELECT * FROM nasir_tryon_uploads WHERE id = ${id}`;
  return rows[0] ? rowToSlot(rows[0] as Record<string, unknown>) : null;
}

export async function getUploadSlots(ids: string[]): Promise<(UploadSlot | null)[]> {
  if (!ids.length) return [];
  const sql = getSql();
  if (!sql) return ids.map((id) => memoryUploads.get(id) ?? null);
  await ensureSchema();
  const rows = await sql`SELECT * FROM nasir_tryon_uploads WHERE id = ANY(${ids}::uuid[])`;
  const byId = new Map(rows.map((row) => {
    const slot = rowToSlot(row as Record<string, unknown>);
    return [slot.id, slot];
  }));
  return ids.map((id) => byId.get(id) ?? null);
}

export async function markUploadComplete(id: string, metadata: Pick<UploadSlot, "checksum" | "width" | "height">) {
  const sql = getSql();
  if (!sql) {
    const slot = memoryUploads.get(id);
    if (!slot || slot.status === "consumed") return null;
    if (slot.status === "uploaded") return slot;
    const next = { ...slot, ...metadata, status: "uploaded" as const };
    memoryUploads.set(id, next);
    return next;
  }
  await ensureSchema();
  const rows = await sql`UPDATE nasir_tryon_uploads SET status = 'uploaded', checksum = ${metadata.checksum ?? null}, width = ${metadata.width ?? null}, height = ${metadata.height ?? null}
    WHERE id = ${id} AND status = 'authorized' RETURNING *`;
  if (rows[0]) return rowToSlot(rows[0] as Record<string, unknown>);
  const existing = await getUploadSlot(id);
  return existing?.status === "uploaded" ? existing : null;
}

function isUsableSlot(slot: UploadSlot | null, username: string): slot is UploadSlot {
  return Boolean(slot && slot.username === username && slot.status === "uploaded" && new Date(slot.expiresAt).getTime() >= Date.now());
}

/** Read-only eligibility check. Consumption still happens atomically in consumeUploadSlots. */
export async function findUsableUploadSlots(username: string, ids: string[]) {
  const slots = await getUploadSlots([...new Set(ids)]);
  return slots.every((slot) => isUsableSlot(slot, username)) ? slots as UploadSlot[] : null;
}

export async function consumeUploadSlots(username: string, ids: string[]) {
  const unique = [...new Set(ids)];
  const slots = await getUploadSlots(unique);
  if (!slots.every((slot) => isUsableSlot(slot, username))) return null;
  const sql = getSql();
  if (!sql) {
    if (unique.some(id => memoryUploads.get(id)?.status !== "uploaded")) return null;
    unique.forEach((id) => {
      const slot = memoryUploads.get(id)!;
      memoryUploads.set(id, { ...slot, status: "consumed" });
    });
  } else {
    await ensureSchema();
    // Lock the complete eligible set in a stable order before consuming any.
    // A request overlapping another set must not consume its non-overlapping
    // uploads if even one requested slot has already been used.
    const consumed = await sql`WITH eligible AS MATERIALIZED (
      SELECT id FROM nasir_tryon_uploads
      WHERE id = ANY(${unique}::uuid[]) AND username = ${username}
        AND status = 'uploaded' AND expires_at >= now()
      ORDER BY id FOR UPDATE
    ) UPDATE nasir_tryon_uploads
      SET status = 'consumed'
      WHERE id IN (SELECT id FROM eligible)
        AND (SELECT count(*) FROM eligible) = ${unique.length}
      RETURNING id`;
    if (consumed.length !== unique.length) return null;
  }
  return slots as UploadSlot[];
}

export async function listExpiredUploadSlots(expiredBefore: Date, limit: number) {
  const sql = getSql();
  if (!sql) return [...memoryUploads.values()].filter((slot) => new Date(slot.expiresAt) < expiredBefore).slice(0, limit);
  await ensureSchema();
  const rows = await sql`SELECT * FROM nasir_tryon_uploads WHERE expires_at < ${expiredBefore.toISOString()} ORDER BY expires_at LIMIT ${limit}`;
  return rows.map((row) => rowToSlot(row as Record<string, unknown>));
}

export async function deleteUploadSlot(id: string) {
  const sql = getSql();
  if (!sql) { memoryUploads.delete(id); return; }
  await ensureSchema();
  await sql`DELETE FROM nasir_tryon_uploads WHERE id = ${id}`;
}

export async function persistPermanentGeneration(event: UsageEvent) {
  const sql = getSql();
  if (!sql) { memoryGenerations.set(event.id, event); return; }
  await ensureSchema();
  await sql`INSERT INTO nasir_tryon_generations (id, username, occurred_at, payload)
    VALUES (${event.id}, ${event.username}, ${event.occurredAt}, ${JSON.stringify(event)}::jsonb)
    ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload`;
}

function parseGenerationPayload(value: unknown): UsageEvent | null {
  if (typeof value === "string") {
    try { return JSON.parse(value) as UsageEvent; } catch { return null; }
  }
  return value && typeof value === "object" ? value as UsageEvent : null;
}

export async function getPermanentGeneration(id: string) {
  const sql = getSql();
  if (!sql) return memoryGenerations.get(id) ?? null;
  await ensureSchema();
  const rows = await sql`SELECT payload FROM nasir_tryon_generations WHERE id = ${id}`;
  return parseGenerationPayload(rows[0]?.payload);
}

export async function getPermanentHistory(limit: number, offset = 0, username?: string): Promise<UsageHistory> {
  const safeLimit = Math.min(Math.max(Math.floor(limit) || 100, 1), 100);
  const sql = getSql();
  if (!sql) {
    const events = [...memoryGenerations.values()].filter(event => (!username || event.username === username) && event.occurredAt > generationCutoff() && !memoryDeletions.has(event.id)).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    return { events: events.slice(offset, offset + safeLimit), total: events.length, retained: events.length };
  }
  await ensureSchema();
  const [rows, totalRows] = await Promise.all([
    sql`SELECT payload FROM nasir_tryon_generations WHERE (${username ?? null}::text IS NULL OR username = ${username ?? null}) AND occurred_at > ${generationCutoff()} AND NOT EXISTS (SELECT 1 FROM nasir_tryon_deletions d WHERE d.id = nasir_tryon_generations.id) ORDER BY occurred_at DESC, id DESC LIMIT ${safeLimit} OFFSET ${Math.max(0, offset)}`,
    sql`SELECT count(*)::int AS total FROM nasir_tryon_generations WHERE (${username ?? null}::text IS NULL OR username = ${username ?? null}) AND occurred_at > ${generationCutoff()} AND NOT EXISTS (SELECT 1 FROM nasir_tryon_deletions d WHERE d.id = nasir_tryon_generations.id)`,
  ]);
  const total = Number((totalRows[0] as { total?: number } | undefined)?.total ?? 0);
  return { events: rows.map((row) => parseGenerationPayload(row.payload)).filter((event): event is UsageEvent => Boolean(event)), total, retained: total };
}

export async function getPermanentGenerationAssets(id: string): Promise<GenerationAssetRefs | null> {
  const event = await getPermanentGeneration(id);
  return event?.assets ?? null;
}

// A tombstone hides a generation immediately and retains its deletion work until
// every store succeeds. Finished tombstones contain only a UUID, not images/users.
export async function queueGenerationDeletion(event: UsageEvent) {
  const sql = getSql();
  if (!sql) { if (!memoryDeletions.has(event.id)) memoryDeletions.set(event.id, event); return; }
  await ensureSchema();
  await sql`INSERT INTO nasir_tryon_deletions (id, payload) VALUES (${event.id}, ${JSON.stringify(event)}::jsonb) ON CONFLICT (id) DO NOTHING`;
}
export async function deletedGenerationIds(ids: string[]) {
  if (!ids.length) return new Set<string>();
  const sql = getSql();
  if (!sql) return new Set(ids.filter(id => memoryDeletions.has(id)));
  await ensureSchema();
  const rows = await sql`SELECT id FROM nasir_tryon_deletions WHERE id = ANY(${ids}::uuid[])`;
  return new Set(rows.map(row => String(row.id)));
}
export async function pendingGenerationDeletions(limit = 25): Promise<UsageEvent[]> {
  const sql = getSql();
  if (!sql) return [...memoryDeletions.values()].filter((event): event is UsageEvent => Boolean(event) && (deletionRetries.get(event!.id)?.next ?? 0) <= Date.now()).slice(0, limit);
  await ensureSchema();
  const rows = await sql`SELECT payload FROM nasir_tryon_deletions WHERE payload IS NOT NULL AND next_attempt_at <= now() ORDER BY next_attempt_at, requested_at LIMIT ${limit}`;
  return rows.map(row => parseGenerationPayload(row.payload)).filter((event): event is UsageEvent => Boolean(event));
}
export async function finishGenerationDeletion(id: string) {
  const sql = getSql();
  if (!sql) { memoryGenerations.delete(id); memoryDeletions.set(id, null); return; }
  await ensureSchema();
  await sql.transaction([
    sql`DELETE FROM nasir_tryon_generations WHERE id = ${id}`,
    sql`UPDATE nasir_tryon_deletions SET payload = NULL WHERE id = ${id}`,
  ]);
}
export async function expiredGenerations(limit = 100): Promise<UsageEvent[]> {
  const sql = getSql();
  if (!sql) return [...memoryGenerations.values()].filter(event => event.occurredAt <= generationCutoff() && !memoryDeletions.has(event.id)).slice(0, limit);
  await ensureSchema();
  const rows = await sql`SELECT payload FROM nasir_tryon_generations g WHERE occurred_at <= ${generationCutoff()}
    AND NOT EXISTS (SELECT 1 FROM nasir_tryon_deletions d WHERE d.id = g.id) ORDER BY occurred_at LIMIT ${limit}`;
  return rows.map(row => parseGenerationPayload(row.payload)).filter((event): event is UsageEvent => Boolean(event));
}

export function resetMemoryUploadLedgerForTests() {
  if (process.env.NODE_ENV === "test") memoryUploads.clear();
}

export async function deferGenerationDeletion(id: string) {
  const sql = getSql();
  if (!sql) {
    const attempts = (deletionRetries.get(id)?.attempts ?? 0) + 1;
    deletionRetries.set(id, { attempts, next: Date.now() + Math.min(3600, 2 ** Math.min(attempts - 1, 10) * 60) * 1000 });
    return;
  }
  await ensureSchema();
  await sql`UPDATE nasir_tryon_deletions SET next_attempt_at = now() + LEAST(3600, power(2, LEAST(attempts, 10)) * 60) * interval '1 second', attempts = attempts + 1 WHERE id = ${id} AND payload IS NOT NULL`;
}

export async function generationDeletionBacklog() {
  const sql = getSql();
  if (!sql) {
    const pending = [...memoryDeletions.values()].filter((event): event is UsageEvent => Boolean(event));
    return { pending: pending.length };
  }
  await ensureSchema();
  const rows = await sql`SELECT count(*)::int AS pending, min(requested_at) AS oldest FROM nasir_tryon_deletions WHERE payload IS NOT NULL`;
  return { pending: Number(rows[0]?.pending ?? 0), oldest: rows[0]?.oldest ?? null };
}
