import "server-only";

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
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

let sqlCache: { url: string; sql: NeonQueryFunction<false, false> } | null = null;
let schemaReady: Promise<void> | null = null;

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
  if (!sqlCache || sqlCache.url !== url) sqlCache = { url, sql: neon(url) };
  return sqlCache.sql;
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
    memoryUploads.set(id, slot);
    return slot;
  }
  await ensureSchema();
  await sql`INSERT INTO nasir_tryon_uploads (id, username, role, pathname, filename, content_type, bytes, status, expires_at)
    VALUES (${id}, ${slot.username}, ${slot.role}, ${slot.pathname}, ${slot.filename}, ${slot.contentType}, ${slot.bytes}, ${slot.status}, ${slot.expiresAt})`;
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

export async function markUploadComplete(id: string, metadata: Pick<UploadSlot, "checksum" | "width" | "height">) {
  const sql = getSql();
  if (!sql) {
    const slot = memoryUploads.get(id);
    if (!slot) return null;
    const next = { ...slot, ...metadata, status: "uploaded" as const };
    memoryUploads.set(id, next);
    return next;
  }
  await ensureSchema();
  const rows = await sql`UPDATE nasir_tryon_uploads SET status = 'uploaded', checksum = ${metadata.checksum ?? null}, width = ${metadata.width ?? null}, height = ${metadata.height ?? null}
    WHERE id = ${id} RETURNING *`;
  return rows[0] ? rowToSlot(rows[0] as Record<string, unknown>) : null;
}

export async function consumeUploadSlots(username: string, ids: string[]) {
  const unique = [...new Set(ids)];
  const slots = await Promise.all(unique.map(getUploadSlot));
  if (slots.some((slot) => !slot || slot.username !== username || slot.status !== "uploaded" || new Date(slot.expiresAt).getTime() < Date.now())) return null;
  const sql = getSql();
  if (!sql) {
    unique.forEach((id) => {
      const slot = memoryUploads.get(id)!;
      memoryUploads.set(id, { ...slot, status: "consumed" });
    });
  } else {
    await ensureSchema();
    // One UPDATE covers every slot. This makes one-time use atomic: a racing
    // request receives no complete set once another request consumes it.
    const consumed = await sql`UPDATE nasir_tryon_uploads
      SET status = 'consumed'
      WHERE id = ANY(${unique}::uuid[]) AND username = ${username}
        AND status = 'uploaded' AND expires_at >= now()
      RETURNING id`;
    if (consumed.length !== unique.length) return null;
  }
  return slots as UploadSlot[];
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

export async function getPermanentHistory(limit: number, offset = 0): Promise<UsageHistory> {
  const safeLimit = Math.min(Math.max(Math.floor(limit) || 100, 1), 100);
  const sql = getSql();
  if (!sql) {
    const events = [...memoryGenerations.values()].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    return { events: events.slice(offset, offset + safeLimit), total: events.length, retained: events.length };
  }
  await ensureSchema();
  const [rows, totalRows] = await Promise.all([
    sql`SELECT payload FROM nasir_tryon_generations ORDER BY occurred_at DESC LIMIT ${safeLimit} OFFSET ${Math.max(0, offset)}`,
    sql`SELECT count(*)::int AS total FROM nasir_tryon_generations`,
  ]);
  const total = Number((totalRows[0] as { total?: number } | undefined)?.total ?? 0);
  return { events: rows.map((row) => parseGenerationPayload(row.payload)).filter((event): event is UsageEvent => Boolean(event)), total, retained: total };
}

export async function getPermanentGenerationAssets(id: string): Promise<GenerationAssetRefs | null> {
  const event = await getPermanentGeneration(id);
  return event?.assets ?? null;
}
