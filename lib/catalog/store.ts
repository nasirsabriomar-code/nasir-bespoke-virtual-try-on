import "server-only";

import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";
import { CATALOG_SEED } from "@/lib/catalog/seed";
import type { Accessory, Catalog, ConfigurationProfile, GarmentBlueprint, StyleOption } from "@/lib/catalog/types";

// Bump the catalog seed version whenever controlled reference assets change. This
// causes production Redis to initialize the new garment-focused AI references while
// leaving existing generation records untouched.
const BLUEPRINTS_KEY = "nasir-tryon:catalog:blueprints:v5";
const ACCESSORIES_KEY = "nasir-tryon:catalog:accessories:v6";
const CONFIGURATION_PROFILES_KEY = "nasir-tryon:catalog:configuration-profiles:v1";
const DEFAULT_CATALOG: Catalog = {
  blueprints: CATALOG_SEED.blueprints,
  accessories: CATALOG_SEED.accessories,
  configurationProfiles: CATALOG_SEED.configurationProfiles,
};

class CatalogConfigurationError extends Error {
  constructor() {
    super("Catalog storage is not configured.");
    this.name = "CatalogConfigurationError";
  }
}

let redisCache: { key: string; redis: Redis } | null = null;
let memoryCatalog: Catalog | null = null;

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    if (process.env.NODE_ENV !== "production") return null;
    throw new CatalogConfigurationError();
  }

  const key = createHash("sha256").update(`${url}:${token}`).digest("hex");
  if (!redisCache || redisCache.key !== key) {
    redisCache = { key, redis: new Redis({ url, token }) };
  }
  return redisCache.redis;
}

function sanitizeCatalog(blueprints: unknown, accessories: unknown, configurationProfiles: unknown): Catalog {
  const validBlueprints = Array.isArray(blueprints)
    ? blueprints.filter((item): item is GarmentBlueprint => Boolean(item && typeof item === "object" && (item as GarmentBlueprint).gender === "menswear" && (item as GarmentBlueprint).active))
    : [];
  const validAccessories = Array.isArray(accessories)
    ? accessories.filter((item): item is Accessory => Boolean(item && typeof item === "object" && (item as Accessory).gender === "menswear" && (item as Accessory).active))
    : [];
  const validProfiles = Array.isArray(configurationProfiles)
    ? configurationProfiles.filter((item): item is ConfigurationProfile => Boolean(item && typeof item === "object" && typeof (item as ConfigurationProfile).id === "string" && Array.isArray((item as ConfigurationProfile).groups)))
    : [];
  return {
    blueprints: validBlueprints.length ? validBlueprints : DEFAULT_CATALOG.blueprints,
    accessories: validAccessories.length ? validAccessories : DEFAULT_CATALOG.accessories,
    configurationProfiles: validProfiles.length ? validProfiles : DEFAULT_CATALOG.configurationProfiles,
  };
}

export async function getCatalog(): Promise<Catalog> {
  const redis = getRedis();
  if (!redis) {
    memoryCatalog ??= DEFAULT_CATALOG;
    return memoryCatalog;
  }

  const [blueprints, accessories, configurationProfiles] = await Promise.all([
    redis.get<GarmentBlueprint[]>(BLUEPRINTS_KEY),
    redis.get<Accessory[]>(ACCESSORIES_KEY),
    redis.get<ConfigurationProfile[]>(CONFIGURATION_PROFILES_KEY),
  ]);
  if (!blueprints || !accessories || !configurationProfiles) {
    await Promise.all([
      redis.set(BLUEPRINTS_KEY, DEFAULT_CATALOG.blueprints),
      redis.set(ACCESSORIES_KEY, DEFAULT_CATALOG.accessories),
      redis.set(CONFIGURATION_PROFILES_KEY, DEFAULT_CATALOG.configurationProfiles ?? []),
    ]);
    return DEFAULT_CATALOG;
  }
  return sanitizeCatalog(blueprints, accessories, configurationProfiles);
}

export async function findCatalogSelection(selection: {
  upperGarmentId: string;
  lowerGarmentId?: string;
  garmentSubtypeId?: string;
  upperStyleId?: string;
  lowerStyleId?: string;
  turbanStyleId?: string;
  shoeStyleId?: string;
  turbanId: string;
  shoeId: string;
}) {
  const catalog = await getCatalog();
  const upper = catalog.blueprints.find((item) => item.id === selection.upperGarmentId && item.pieceType !== "lower");
  if (!upper) return null;
  let lower = selection.lowerGarmentId
    ? catalog.blueprints.find((item) => item.id === selection.lowerGarmentId && item.pieceType === "lower")
    : undefined;
  if (selection.lowerGarmentId && !lower) return null;
  const subtype = selection.garmentSubtypeId
    ? catalog.blueprints.find((item) => item.id === selection.garmentSubtypeId && item.category === "suit")
    : undefined;
  if (selection.garmentSubtypeId && !subtype) return null;
  const turban = catalog.accessories.find((item) => item.id === selection.turbanId && item.category === "turban");
  const shoes = catalog.accessories.find((item) => item.id === selection.shoeId && item.category === "shoes");
  const linkedSource = subtype ?? upper;
  if (!lower && linkedSource.linkedBlueprintIds.length) {
    lower = catalog.blueprints.find((item) => linkedSource.linkedBlueprintIds.includes(item.id) && item.pieceType === "lower");
  }
  if (!turban || !shoes) return null;

  const findStyle = (parent: { styleOptions?: StyleOption[] }, styleId?: string) =>
    styleId ? parent.styleOptions?.find((item) => item.id === styleId && item.active) : undefined;
  const upperStyle = findStyle(upper, selection.upperStyleId);
  const lowerStyle = lower ? findStyle(lower, selection.lowerStyleId) : undefined;
  const turbanStyle = findStyle(turban, selection.turbanStyleId);
  const shoeStyle = findStyle(shoes, selection.shoeStyleId);

  if (
    (selection.upperStyleId && !upperStyle) ||
    (selection.lowerStyleId && !lowerStyle) ||
    (selection.turbanStyleId && !turbanStyle) ||
    (selection.shoeStyleId && !shoeStyle)
  ) return null;

  return { catalog, upper, lower, subtype, upperStyle, lowerStyle, turban, turbanStyle, shoes, shoeStyle };
}

export function resetCatalogForTests() {
  if (process.env.NODE_ENV === "test") memoryCatalog = null;
}
