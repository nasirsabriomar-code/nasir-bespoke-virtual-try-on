import "server-only";

import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";
import type { GenerationAssetKey, GenerationAssetRefs } from "@/lib/generation-storage";
import type { OutfitSpecification } from "@/lib/bespoke/engine";

const HISTORY_KEY = "nasir-tryon:history:events:v1";
const HISTORY_TOTAL_KEY = "nasir-tryon:history:total:v1";
const DEFAULT_MAX_EVENTS = 1_000;

export type UsageStatus = "success" | "failed";
export type DeviceKind = "phone" | "tablet" | "desktop" | "unknown";

export type UsageDevice = {
  kind: DeviceKind;
  browser: string;
  operatingSystem: string;
};

export type UsageEvent = {
  id: string;
  occurredAt: string;
  username: string;
  status: UsageStatus;
  device: UsageDevice;
  durationMs: number;
  provider: string;
  model: string;
  quality: string;
  assets?: GenerationAssetRefs;
  generation?: {
    mode: "catalog" | "outfit" | "level1";
    categoryId?: string;
    categoryName?: string;
    curatedDesignId?: string;
    curatedDesignName?: string;
    curatedVariantId?: string;
    curatedVariantName?: string;
    curatedDesignVersion?: number;
    curatedAssetStatus?: "ready" | "awaiting-approved-reference";
    fabricRegion?: "upper" | "lower" | "both" | "custom" | "jacket";
    upperGarmentId?: string;
    upperGarmentName?: string;
    lowerGarmentId?: string;
    lowerGarmentName?: string;
    garmentSubtypeId?: string;
    garmentSubtypeName?: string;
    upperStyleId?: string;
    upperStyleName?: string;
    lowerStyleId?: string;
    lowerStyleName?: string;
    turbanStyleId?: string;
    turbanStyleName?: string;
    shoeStyleId?: string;
    shoeStyleName?: string;
    turbanId?: string;
    turbanName?: string;
    shoeId?: string;
    shoeName?: string;
    outfitSpecification?: OutfitSpecification;
  };
};

export type UsageHistory = {
  events: UsageEvent[];
  total: number;
  retained: number;
};

export type PublicGenerationAssetRefs = Partial<Record<GenerationAssetKey, {
  contentType: string;
}>>;

export type PublicUsageEvent = Omit<UsageEvent, "assets"> & {
  assets?: PublicGenerationAssetRefs;
};

export type PublicUsageHistory = Omit<UsageHistory, "events"> & {
  events: PublicUsageEvent[];
};

/**
 * The browser receives only an availability marker and content type per asset.
 * Private Blob pathnames stay server-side and are resolved by the authenticated
 * history-asset route.
 */
export function redactUsageHistoryForClient(history: UsageHistory): PublicUsageHistory {
  return {
    ...history,
    events: history.events.map(({ assets, ...event }) => ({
      ...event,
      ...(assets
        ? {
            assets: Object.fromEntries(
              Object.entries(assets).map(([asset, reference]) => [asset, { contentType: reference.contentType }]),
            ) as PublicGenerationAssetRefs,
          }
        : {}),
    })),
  };
}

class UsageHistoryConfigurationError extends Error {
  constructor() {
    super("Usage history storage is not configured.");
    this.name = "UsageHistoryConfigurationError";
  }
}

type MemoryHistory = { events: string[]; total: number };
const globalUsageHistory = globalThis as typeof globalThis & {
  __nasirUsageHistory?: MemoryHistory;
};
const memoryHistory = globalUsageHistory.__nasirUsageHistory ?? { events: [], total: 0 };
globalUsageHistory.__nasirUsageHistory = memoryHistory;

let redisCache: { key: string; redis: Redis } | null = null;

function parseAssetRefs(value: unknown): GenerationAssetRefs | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const result: GenerationAssetRefs = {};
  for (const asset of ["person", "outfit", "fabric", "lower-fabric", "result", "upper", "lower", "subtype", "turban", "shoes", "upper-style", "lower-style", "turban-style", "shoe-style", "bespoke-detail-1", "bespoke-detail-2", "curated-design", "curated-detail"] as const) {
    const item = record[asset];
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    if (typeof entry.pathname === "string" && entry.pathname.length > 0 && typeof entry.contentType === "string") {
      result[asset] = { pathname: entry.pathname, contentType: entry.contentType };
    }
  }
  return Object.keys(result).length ? result : undefined;
}

function parseOutfitSpecification(value: unknown): OutfitSpecification | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const garment = record.garment as Record<string, unknown> | undefined;
  const configuration = record.configuration as Record<string, unknown> | undefined;
  if (record.version !== 1 || typeof record.targetView !== "string" || !garment || !configuration || typeof garment.id !== "string" || typeof garment.name !== "string" || typeof configuration.profileId !== "string" || !configuration.selections || typeof configuration.selections !== "object" || !Array.isArray(configuration.selectedOptions)) return undefined;
  const selectedOptions = configuration.selectedOptions.filter((item): item is OutfitSpecification["configuration"]["selectedOptions"][number] => {
    if (!item || typeof item !== "object") return false;
    const option = item as Record<string, unknown>;
    return typeof option.groupId === "string" && typeof option.groupName === "string" && typeof option.section === "string" && typeof option.optionId === "string" && typeof option.optionName === "string" && typeof option.priority === "string" && Array.isArray(option.visibleIn);
  });
  if (selectedOptions.length !== configuration.selectedOptions.length) return undefined;
  return value as OutfitSpecification;
}

function parseGenerationMetadata(value: unknown): UsageEvent["generation"] | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const isOutfitMode = record.mode === "outfit";
  const isLevel1Mode = record.mode === "level1";
  if (!isOutfitMode && !isLevel1Mode && (
    typeof record.upperGarmentId !== "string" ||
    typeof record.upperGarmentName !== "string" ||
    typeof record.turbanId !== "string" ||
    typeof record.turbanName !== "string" ||
    typeof record.shoeId !== "string" ||
    typeof record.shoeName !== "string"
  )) return undefined;
  const optionalString = (key: string) => typeof record[key] === "string" ? record[key] as string : undefined;
  const outfitSpecification = parseOutfitSpecification(record.outfitSpecification);
  const curatedDesignVersion = typeof record.curatedDesignVersion === "number" && Number.isSafeInteger(record.curatedDesignVersion)
    ? record.curatedDesignVersion
    : undefined;
  const curatedAssetStatus = record.curatedAssetStatus === "ready" || record.curatedAssetStatus === "awaiting-approved-reference"
    ? record.curatedAssetStatus
    : undefined;
  const fabricRegion = record.fabricRegion === "upper" || record.fabricRegion === "lower" || record.fabricRegion === "both" || record.fabricRegion === "custom" || record.fabricRegion === "jacket"
    ? record.fabricRegion
    : undefined;
  if (isLevel1Mode && (!optionalString("categoryId") || !optionalString("curatedDesignId") || !optionalString("curatedDesignName") || !curatedDesignVersion || !curatedAssetStatus)) return undefined;
  return {
    mode: isOutfitMode ? "outfit" : isLevel1Mode ? "level1" : "catalog",
    ...(isLevel1Mode && optionalString("categoryId") ? { categoryId: optionalString("categoryId") } : {}),
    ...(isLevel1Mode && optionalString("categoryName") ? { categoryName: optionalString("categoryName") } : {}),
    ...(isLevel1Mode && optionalString("curatedDesignId") ? { curatedDesignId: optionalString("curatedDesignId") } : {}),
    ...(isLevel1Mode && optionalString("curatedDesignName") ? { curatedDesignName: optionalString("curatedDesignName") } : {}),
    ...(isLevel1Mode && optionalString("curatedVariantId") ? { curatedVariantId: optionalString("curatedVariantId") } : {}),
    ...(isLevel1Mode && optionalString("curatedVariantName") ? { curatedVariantName: optionalString("curatedVariantName") } : {}),
    ...(isLevel1Mode && curatedDesignVersion ? { curatedDesignVersion } : {}),
    ...(isLevel1Mode && curatedAssetStatus ? { curatedAssetStatus } : {}),
    ...(isLevel1Mode && fabricRegion ? { fabricRegion } : {}),
    ...(optionalString("upperGarmentId") ? { upperGarmentId: optionalString("upperGarmentId") } : {}),
    ...(optionalString("upperGarmentName") ? { upperGarmentName: optionalString("upperGarmentName") } : {}),
    ...(optionalString("lowerGarmentId") ? { lowerGarmentId: optionalString("lowerGarmentId") } : {}),
    ...(optionalString("lowerGarmentName") ? { lowerGarmentName: optionalString("lowerGarmentName") } : {}),
    ...(optionalString("garmentSubtypeId") ? { garmentSubtypeId: optionalString("garmentSubtypeId") } : {}),
    ...(optionalString("garmentSubtypeName") ? { garmentSubtypeName: optionalString("garmentSubtypeName") } : {}),
    ...(optionalString("upperStyleId") ? { upperStyleId: optionalString("upperStyleId") } : {}),
    ...(optionalString("upperStyleName") ? { upperStyleName: optionalString("upperStyleName") } : {}),
    ...(optionalString("lowerStyleId") ? { lowerStyleId: optionalString("lowerStyleId") } : {}),
    ...(optionalString("lowerStyleName") ? { lowerStyleName: optionalString("lowerStyleName") } : {}),
    ...(optionalString("turbanStyleId") ? { turbanStyleId: optionalString("turbanStyleId") } : {}),
    ...(optionalString("turbanStyleName") ? { turbanStyleName: optionalString("turbanStyleName") } : {}),
    ...(optionalString("shoeStyleId") ? { shoeStyleId: optionalString("shoeStyleId") } : {}),
    ...(optionalString("shoeStyleName") ? { shoeStyleName: optionalString("shoeStyleName") } : {}),
    ...(optionalString("turbanId") ? { turbanId: optionalString("turbanId") } : {}),
    ...(optionalString("turbanName") ? { turbanName: optionalString("turbanName") } : {}),
    ...(optionalString("shoeId") ? { shoeId: optionalString("shoeId") } : {}),
    ...(optionalString("shoeName") ? { shoeName: optionalString("shoeName") } : {}),
    ...(outfitSpecification ? { outfitSpecification } : {}),
  };
}

function maxEvents() {
  const parsed = Number.parseInt(process.env.TRYON_HISTORY_MAX_EVENTS ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 100 && parsed <= 10_000
    ? parsed
    : DEFAULT_MAX_EVENTS;
}

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    if (process.env.NODE_ENV !== "production") return null;
    throw new UsageHistoryConfigurationError();
  }

  const key = createHash("sha256").update(`${url}:${token}`).digest("hex");
  if (!redisCache || redisCache.key !== key) {
    redisCache = { key, redis: new Redis({ url, token }) };
  }
  return redisCache.redis;
}

function parseEvent(value: unknown): UsageEvent | null {
  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== "object") return null;
  const record = parsed as Record<string, unknown>;
  const device = record.device && typeof record.device === "object"
    ? record.device as Record<string, unknown>
    : null;
  if (
    typeof record.id !== "string" ||
    typeof record.occurredAt !== "string" ||
    typeof record.username !== "string" ||
    (record.status !== "success" && record.status !== "failed") ||
    !device ||
    typeof device.kind !== "string" ||
    typeof device.browser !== "string" ||
    typeof device.operatingSystem !== "string" ||
    typeof record.durationMs !== "number" ||
    typeof record.provider !== "string" ||
    typeof record.model !== "string" ||
    typeof record.quality !== "string"
  ) return null;

  return {
    id: record.id,
    occurredAt: record.occurredAt,
    username: record.username,
    status: record.status,
    device: {
      kind: device.kind as DeviceKind,
      browser: device.browser,
      operatingSystem: device.operatingSystem,
    },
    durationMs: record.durationMs,
    provider: record.provider,
    model: record.model,
    quality: record.quality,
    ...(parseGenerationMetadata(record.generation) ? { generation: parseGenerationMetadata(record.generation) } : {}),
    ...(parseAssetRefs(record.assets) ? { assets: parseAssetRefs(record.assets) } : {}),
  };
}

export async function recordUsageEvent(event: UsageEvent) {
  const serialized = JSON.stringify(event);
  const limit = maxEvents();
  const redis = getRedis();
  if (redis) {
    const pipeline = redis.pipeline();
    pipeline.lpush(HISTORY_KEY, serialized);
    pipeline.ltrim(HISTORY_KEY, 0, limit - 1);
    pipeline.incr(HISTORY_TOTAL_KEY);
    await pipeline.exec();
    return;
  }

  memoryHistory.events.unshift(serialized);
  memoryHistory.events.length = Math.min(memoryHistory.events.length, limit);
  memoryHistory.total += 1;
}

export async function getUsageHistory(limit = 100): Promise<UsageHistory> {
  const safeLimit = Math.min(Math.max(Math.floor(limit) || 100, 1), 100);
  const retained = maxEvents();
  const redis = getRedis();
  if (redis) {
    const [rawEvents, total] = await Promise.all([
      redis.lrange<string>(HISTORY_KEY, 0, safeLimit - 1),
      redis.get<number>(HISTORY_TOTAL_KEY),
    ]);
    return {
      events: rawEvents.map(parseEvent).filter((event): event is UsageEvent => Boolean(event)),
      total: typeof total === "number" ? total : 0,
      retained,
    };
  }

  return {
    events: memoryHistory.events
      .slice(0, safeLimit)
      .map(parseEvent)
      .filter((event): event is UsageEvent => Boolean(event)),
    total: memoryHistory.total,
    retained,
  };
}

// Administrative migration helper. The staff API intentionally pages at 100,
// while a one-time permanent-history migration must see every retained Redis
// record.
export async function getAllUsageHistoryForMigration(): Promise<UsageHistory> {
  const retained = maxEvents();
  const redis = getRedis();
  if (redis) {
    const [rawEvents, total] = await Promise.all([
      redis.lrange<string>(HISTORY_KEY, 0, retained - 1),
      redis.get<number>(HISTORY_TOTAL_KEY),
    ]);
    return {
      events: rawEvents.map(parseEvent).filter((event): event is UsageEvent => Boolean(event)),
      total: typeof total === "number" ? total : 0,
      retained,
    };
  }
  return {
    events: memoryHistory.events.map(parseEvent).filter((event): event is UsageEvent => Boolean(event)),
    total: memoryHistory.total,
    retained,
  };
}

export async function getUsageEvent(id: string) {
  const history = await getUsageHistory(maxEvents());
  return history.events.find((event) => event.id === id) ?? null;
}

function parseBrowser(userAgent: string) {
  if (/Edg\//i.test(userAgent)) return "Edge";
  if (/OPR\//i.test(userAgent)) return "Opera";
  if (/FxiOS\//i.test(userAgent) || /Firefox\//i.test(userAgent)) return "Firefox";
  if (/CriOS\//i.test(userAgent) || /Chrome\//i.test(userAgent)) return "Chrome";
  if (/SamsungBrowser\//i.test(userAgent)) return "Samsung Internet";
  if (/Safari\//i.test(userAgent)) return "Safari";
  return "Other";
}

function parseOperatingSystem(userAgent: string, platformHint: string) {
  if (/iPhone|iPad|iPod/i.test(userAgent) || /iOS/i.test(platformHint)) return "iOS/iPadOS";
  if (/Android/i.test(userAgent) || /Android/i.test(platformHint)) return "Android";
  if (/Windows/i.test(userAgent) || /Windows/i.test(platformHint)) return "Windows";
  if (/Mac OS X|Macintosh/i.test(userAgent) || /macOS/i.test(platformHint)) return "macOS";
  if (/Linux/i.test(userAgent) || /Linux/i.test(platformHint)) return "Linux";
  return "Other";
}

function parseDeviceKind(userAgent: string, clientHint: string) {
  if (clientHint === "phone" || clientHint === "tablet" || clientHint === "desktop") {
    return clientHint;
  }
  if (/iPad|Tablet|Android(?!.*Mobile)/i.test(userAgent)) return "tablet";
  if (/Mobile|iPhone|iPod|Android/i.test(userAgent)) return "phone";
  if (userAgent) return "desktop";
  return "unknown";
}

export function getRequestDevice(request: Request): UsageDevice {
  const userAgent = request.headers.get("user-agent") ?? "";
  const clientHint = request.headers.get("x-nasir-device") ?? "";
  const platformHint = request.headers.get("sec-ch-ua-platform") ?? "";
  return {
    kind: parseDeviceKind(userAgent, clientHint),
    browser: parseBrowser(userAgent),
    operatingSystem: parseOperatingSystem(userAgent, platformHint),
  };
}

export function resetMemoryUsageHistoryForTests() {
  if (process.env.NODE_ENV === "test") {
    memoryHistory.events.length = 0;
    memoryHistory.total = 0;
  }
}
