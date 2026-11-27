import { deletedGenerationIds } from "@/lib/highres/ledger";
import { generationExpired } from "@/lib/history/retention-policy";
import type { GenerationReview } from "@/lib/history/review-types";
import { sanitizeGenerationMetadata } from "@/lib/tryon/metadata";
import type { TryOnMetadata } from "@/lib/tryon/types";
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
  review?: GenerationReview;
  metadata?: Partial<TryOnMetadata>;
  assets?: GenerationAssetRefs;
  generation?: {
    mode: "catalog" | "outfit" | "level1" | "split";
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
    splitFamily?: string;
    splitUpperId?: string;
    splitUpperName?: string;
    splitLowerId?: string;
    splitLowerName?: string;
    splitShirtId?: string;
    splitShirtName?: string;
    splitWaistcoatId?: string;
    splitWaistcoatName?: string;
    splitFootwearId?: string;
    splitFootwearName?: string;
    splitAccessoryIds?: string[];
    splitAccessoryNames?: string[];
    splitFabricSlots?: {
      jacket: boolean;
      trousers: boolean;
      shirt: boolean;
      waistcoat: boolean;
    };
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
  for (const asset of ["person", "outfit", "fabric", "lower-fabric", "shirt-fabric", "waistcoat-fabric", "result", "result-thumb", "upper", "lower", "subtype", "turban", "shoes", "upper-style", "lower-style", "turban-style", "shoe-style", "bespoke-detail-1", "bespoke-detail-2", "curated-design", "curated-detail", "split-upper", "split-lower", "split-shirt", "split-waistcoat", "split-footwear"] as const) {
    const item = record[asset];
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    if (typeof entry.pathname === "string" && entry.pathname.length > 0 && typeof entry.contentType === "string") {
      result[asset] = {
        pathname: entry.pathname,
        contentType: entry.contentType,
        ...(typeof entry.bytes === "number" ? { bytes: entry.bytes } : {}),
        ...(typeof entry.checksum === "string" ? { checksum: entry.checksum } : {}),
        ...(typeof entry.width === "number" ? { width: entry.width } : {}),
        ...(typeof entry.height === "number" ? { height: entry.height } : {}),
      };
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
  const isSplitMode = record.mode === "split";
  if (!isOutfitMode && !isLevel1Mode && !isSplitMode && (
    typeof record.upperGarmentId !== "string" ||
    typeof record.upperGarmentName !== "string" ||
    typeof record.turbanId !== "string" ||
    typeof record.turbanName !== "string" ||
    typeof record.shoeId !== "string" ||
    typeof record.shoeName !== "string"
  )) return undefined;
  const optionalString = (key: string) => typeof record[key] === "string" ? record[key] as string : undefined;
  const optionalStringArray = (key: string) => {
    const raw = record[key];
    return Array.isArray(raw) && raw.every((item) => typeof item === "string") ? raw as string[] : undefined;
  };
  const pickStrings = <K extends string>(keys: readonly K[]) => {
    const picked: Partial<Record<K, string>> = {};
    for (const key of keys) {
      const val = optionalString(key);
      if (val) picked[key] = val;
    }
    return picked;
  };
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
  const categoryId = optionalString("categoryId");
  const curatedDesignId = optionalString("curatedDesignId");
  const curatedDesignName = optionalString("curatedDesignName");
  if (isLevel1Mode && (!categoryId || !curatedDesignId || !curatedDesignName || !curatedDesignVersion || !curatedAssetStatus)) return undefined;
  const splitAccessoryIds = isSplitMode ? optionalStringArray("splitAccessoryIds") : undefined;
  const splitAccessoryNames = isSplitMode ? optionalStringArray("splitAccessoryNames") : undefined;
  return {
    mode: isOutfitMode ? "outfit" : isLevel1Mode ? "level1" : isSplitMode ? "split" : "catalog",
    ...(isLevel1Mode ? pickStrings(["categoryId", "categoryName", "curatedDesignId", "curatedDesignName", "curatedVariantId", "curatedVariantName"] as const) : {}),
    ...(isLevel1Mode && curatedDesignVersion ? { curatedDesignVersion } : {}),
    ...(isLevel1Mode && curatedAssetStatus ? { curatedAssetStatus } : {}),
    ...(isLevel1Mode && fabricRegion ? { fabricRegion } : {}),
    ...pickStrings([
      "upperGarmentId", "upperGarmentName", "lowerGarmentId", "lowerGarmentName",
      "garmentSubtypeId", "garmentSubtypeName", "upperStyleId", "upperStyleName",
      "lowerStyleId", "lowerStyleName", "turbanStyleId", "turbanStyleName",
      "shoeStyleId", "shoeStyleName", "turbanId", "turbanName", "shoeId", "shoeName",
    ] as const),
    ...(outfitSpecification ? { outfitSpecification } : {}),
    ...(isSplitMode && record.splitFabricSlots && typeof record.splitFabricSlots === "object" && !Array.isArray(record.splitFabricSlots)
      && ["jacket", "trousers", "shirt", "waistcoat"].every(key => typeof (record.splitFabricSlots as Record<string, unknown>)[key] === "boolean")
      ? { splitFabricSlots: Object.fromEntries(["jacket", "trousers", "shirt", "waistcoat"].map(key => [key, (record.splitFabricSlots as Record<string, boolean>)[key]])) as NonNullable<NonNullable<UsageEvent["generation"]>["splitFabricSlots"]> } : {}),
    ...(isSplitMode ? pickStrings([
      "splitFamily", "splitUpperId", "splitUpperName", "splitLowerId", "splitLowerName",
      "splitShirtId", "splitShirtName", "splitWaistcoatId", "splitWaistcoatName",
      "splitFootwearId", "splitFootwearName",
    ] as const) : {}),
    ...(splitAccessoryIds ? { splitAccessoryIds } : {}),
    ...(splitAccessoryNames ? { splitAccessoryNames } : {}),
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
    redisCache = { key, redis: new Redis({ url, token, retry: false, signal: () => AbortSignal.timeout(3000) }) };
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

  const generation = parseGenerationMetadata(record.generation);
  const assets = parseAssetRefs(record.assets);
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
    ...(record.metadata ? { metadata: sanitizeGenerationMetadata(record.metadata) } : {}),
    ...(generation ? { generation } : {}),
    ...(assets ? { assets } : {}),
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

export async function getUsageHistory(limit = 100, offset = 0, username?: string): Promise<UsageHistory> {
  const safeLimit = Math.min(Math.max(Math.floor(limit) || 100, 1), 100);
  const safeOffset = Math.max(0, Math.floor(offset) || 0);
  // Filter before paging: never expose other staff's events or counts. The
  // fallback is bounded by maxEvents, including records beyond the first 100.
  const history = await getAllUsageHistoryForMigration();
  const deleted = await deletedGenerationIds(history.events.map(event => event.id));
  const events = history.events.filter(event => (!username || event.username === username) && !generationExpired(event.occurredAt) && !deleted.has(event.id));
  return { events: events.slice(safeOffset, safeOffset + safeLimit), total: events.length, retained: events.length };
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
  const history = await getAllUsageHistoryForMigration();
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

export async function removeUsageEvent(id: string) {
  const store = getRedis();
  if (store) {
    const events = await store.lrange<string>(HISTORY_KEY, 0, maxEvents() - 1);
    for (const raw of events) if (parseEvent(raw)?.id === id) await store.lrem(HISTORY_KEY, 0, typeof raw === "string" ? raw : JSON.stringify(raw));
  } else {
    memoryHistory.events = memoryHistory.events.filter(raw => parseEvent(raw)?.id !== id);
  }
}
