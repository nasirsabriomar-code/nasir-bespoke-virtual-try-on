import { resetMemoryRateLimitsForTests } from "@/lib/rate-limit";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test, { beforeEach } from "node:test";
import { handleTryOnRequest } from "@/lib/try-on-handler";
import { GET as getSplitCatalogAsset } from "@/app/api/split-catalog-assets/[assetId]/route";
import { readSplitReference, resolveSplitOutfitRecipe, SplitOutfitError, type ResolvedSplitOutfit } from "@/lib/split-outfit/generation";
import { buildSplitOutfitPrompt } from "@/lib/split-outfit/prompt";
import { getSplitCatalogueView } from "@/lib/split-outfit/view";
import { DEFAULT_SPLIT_OUTFIT_STATE, SUIT_UPPER_OPTIONS } from "@/lib/split-outfit/catalogue";
import type { SplitOptionId, SplitOutfitState } from "@/lib/split-outfit/types";
import type { TryOnInput } from "@/lib/tryon/types";
import { recordUsageEvent, getUsageHistory, resetMemoryUsageHistoryForTests, type UsageEvent } from "@/lib/usage-history";

const TEST_USER = {
  username: "showroom",
  displayName: "Showroom Staff",
  passwordHash: bcrypt.hashSync("Correct-Horse-Battery-Staple", 4),
};

function headers() {
  return { origin: "http://localhost", host: "localhost", "sec-fetch-site": "same-origin" };
}

const PNG_1X1 = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

function tinyPng(name: string) {
  return new File([PNG_1X1], name, { type: "image/png" });
}

function splitForm(recipe: SplitOutfitState, extra: Array<[string, string | File]> = []) {
  const form = new FormData();
  form.set("selectionMode", "split");
  form.set("splitRecipe", JSON.stringify(recipe));
  form.set("person", tinyPng("customer.png"));
  form.set("fabric", tinyPng("fabric.png"));
  for (const [key, value] of extra) form.set(key, value);
  return form;
}

function fakeResolvedSplitOutfit(state: SplitOutfitState): ResolvedSplitOutfit {
  const option = (id: string) => ({
    id: id as SplitOptionId,
    categoryId: "upper" as const,
    family: state.family,
    customer: { name: id, imagePlaceholderLabel: id, description: id },
    generation: { constructionFragment: `${id} construction` },
  });
  return {
    state,
    upper: option(state.upperId ?? "upper"),
    lower: option(state.lowerId ?? "lower"),
    shirt: option(state.shirtId ?? "shirt"),
    waistcoat: state.waistcoatId && state.waistcoatId !== "SUIT_WAISTCOAT_NONE" ? option(state.waistcoatId) : null,
    footwear: option(state.footwearId ?? "footwear"),
    accessories: state.accessoryIds.map((id) => option(id)),
  };
}

beforeEach(() => {
  resetMemoryRateLimitsForTests();
  process.env.AUTH_SESSION_SECRET = "test-session-secret-that-is-at-least-thirty-two-bytes";
  process.env.AUTH_USERS_JSON = JSON.stringify([TEST_USER]);
  process.env.RATE_LIMIT_BACKEND = "memory";
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  resetMemoryUsageHistoryForTests();
});

test("a valid split recipe reaches generate() with the correct references, order, and selection", async () => {
  let generatedInput: TryOnInput | undefined;
  const response = await handleTryOnRequest(new Request("http://localhost/api/try-on", {
    method: "POST",
    headers: headers(),
    body: splitForm(DEFAULT_SPLIT_OUTFIT_STATE),
  }), {
    authenticate: async () => TEST_USER,
    rateLimit: async () => ({ allowed: true, limit: 5, remaining: 4, resetAt: Date.now() + 60_000 }),
    resolveSplitSelection: async () => fakeResolvedSplitOutfit(DEFAULT_SPLIT_OUTFIT_STATE),
    readSplitReference: async (option, role) => ({ role, image: { file: tinyPng(`${option.id}.png`), mime: "image/png" } }),
    generate: async (input) => {
      generatedInput = input;
      return { bytes: Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]), contentType: "image/jpeg", metadata: { provider: "test", model: "gpt-image-2.5-sunburst", quality: "medium", durationMs: 1 } };
    },
  });
  assert.equal(response.status, 200);
  assert.ok(generatedInput);
  assert.deepEqual(generatedInput.references.map((reference) => reference.role), ["split-upper", "split-lower", "split-shirt", "split-footwear"]);
  assert.equal(generatedInput.selection.mode, "split");
  assert.match(generatedInput.prompt, /Tailor every garment around the customer's actual body/i);
  assert.match(generatedInput.prompt, /SELECTED MODULAR OUTFIT/i);
  assert.match(generatedInput.prompt, /FINAL FABRIC APPLICATION OVERRIDE — JACKET/);
  assert.match(generatedInput.prompt, /HUE LOCK/);
  assert.ok(generatedInput.fabric);
  const upper = generatedInput.references.find((reference) => reference.role === "split-upper");
  const lower = generatedInput.references.find((reference) => reference.role === "split-lower");
  assert.equal(upper?.image.file.name, "construction-neutral.png");
  assert.notEqual(lower?.image.file.name, "construction-neutral.png");
});

test("a split recipe can generate with only a person photo and no fabric", async () => {
  const form = new FormData();
  form.set("selectionMode", "split");
  form.set("splitRecipe", JSON.stringify(DEFAULT_SPLIT_OUTFIT_STATE));
  form.set("person", tinyPng("customer.png"));
  let generatedInput: TryOnInput | undefined;
  const response = await handleTryOnRequest(new Request("http://localhost/api/try-on", {
    method: "POST",
    headers: headers(),
    body: form,
  }), {
    authenticate: async () => TEST_USER,
    rateLimit: async () => ({ allowed: true, limit: 5, remaining: 4, resetAt: Date.now() + 60_000 }),
    resolveSplitSelection: async () => fakeResolvedSplitOutfit(DEFAULT_SPLIT_OUTFIT_STATE),
    readSplitReference: async (option, role) => ({ role, image: { file: tinyPng(`${option.id}.png`), mime: "image/png" } }),
    generate: async (input) => {
      generatedInput = input;
      return { bytes: Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]), contentType: "image/jpeg", metadata: { provider: "test", model: "gpt-image-2.5-sunburst", quality: "medium", durationMs: 1 } };
    },
  });
  assert.equal(response.status, 200);
  assert.ok(generatedInput);
  assert.equal(generatedInput.fabric, undefined);
  assert.doesNotMatch(generatedInput.prompt, /FINAL FABRIC APPLICATION OVERRIDE/);
});

test("a waistcoat fabric is rejected when the recipe has no waistcoat", async () => {
  const response = await handleTryOnRequest(new Request("http://localhost/api/try-on", {
    method: "POST",
    headers: headers(),
    body: splitForm(DEFAULT_SPLIT_OUTFIT_STATE, [["waistcoatFabric", tinyPng("waistcoat-cloth.png")]]),
  }), {
    authenticate: async () => TEST_USER,
    rateLimit: async () => ({ allowed: true, limit: 5, remaining: 4, resetAt: Date.now() + 60_000 }),
    resolveSplitSelection: async () => fakeResolvedSplitOutfit(DEFAULT_SPLIT_OUTFIT_STATE),
    readSplitReference: async (option, role) => ({ role, image: { file: tinyPng(`${option.id}.png`), mime: "image/png" } }),
    generate: async () => { throw new Error("must not run"); },
  });
  assert.equal(response.status, 400);
});

test("split prompt with no per-piece fabrics uses construction photos for cloth, including a white shirt default", async () => {
  const resolved = await resolveSplitOutfitRecipe(JSON.stringify(DEFAULT_SPLIT_OUTFIT_STATE));
  const prompt = buildSplitOutfitPrompt(resolved);
  assert.match(prompt, /Image 2 — NASIR BESPOKE approved jacket construction AND cloth appearance/);
  assert.match(prompt, /Image 4 — NASIR BESPOKE approved shirt construction AND cloth appearance, including a white shirt/);
  assert.match(prompt, /Image 5 — NASIR BESPOKE approved footwear construction AND cloth appearance/);
  assert.doesNotMatch(prompt, /physical showroom fabric for the jacket/);
  assert.doesNotMatch(prompt, /every selected garment piece/);
});

test("an invalid split recipe is rejected server-side by the real resolver, even though the UI would never produce it", async () => {
  // Three-piece jacket with no waistcoat is exactly what reconcile()/the UI
  // would never let a user submit — this exercises the real
  // resolveSplitOutfitRecipe (not an injected fake) to prove the server
  // re-validates rather than trusting the client.
  const invalidRecipe: SplitOutfitState = {
    ...DEFAULT_SPLIT_OUTFIT_STATE,
    upperId: "SUIT_UPPER_THREE_PIECE",
    waistcoatId: "SUIT_WAISTCOAT_NONE",
  };
  let generationCalls = 0;
  const response = await handleTryOnRequest(new Request("http://localhost/api/try-on", {
    method: "POST",
    headers: headers(),
    body: splitForm(invalidRecipe),
  }), {
    authenticate: async () => TEST_USER,
    rateLimit: async () => ({ allowed: true, limit: 5, remaining: 4, resetAt: Date.now() + 60_000 }),
    // resolveSplitSelection deliberately NOT overridden — the real resolver runs.
    generate: async () => {
      generationCalls += 1;
      throw new Error("must not run");
    },
  });
  assert.equal(response.status, 400);
  assert.equal(generationCalls, 0);
});

test("resolveSplitOutfitRecipe rejects a malformed recipe and an unresolvable family", async () => {
  await assert.rejects(() => resolveSplitOutfitRecipe("not json"), SplitOutfitError);
  await assert.rejects(() => resolveSplitOutfitRecipe(JSON.stringify({ family: "not-a-real-family" })), SplitOutfitError);
});

test("an unexpected field on a split request is rejected before resolution", async () => {
  let resolveCalls = 0;
  const response = await handleTryOnRequest(new Request("http://localhost/api/try-on", {
    method: "POST",
    headers: headers(),
    body: splitForm(DEFAULT_SPLIT_OUTFIT_STATE, [["upperGarmentId", "suit-base"]]),
  }), {
    authenticate: async () => TEST_USER,
    rateLimit: async () => ({ allowed: true, limit: 5, remaining: 4, resetAt: Date.now() + 60_000 }),
    resolveSplitSelection: async () => {
      resolveCalls += 1;
      return fakeResolvedSplitOutfit(DEFAULT_SPLIT_OUTFIT_STATE);
    },
    generate: async () => { throw new Error("must not run"); },
  });
  assert.equal(response.status, 400);
  assert.equal(resolveCalls, 0);
});

test("a split recipe with no reference photography yet fails closed with asset_pending, not a fabricated image", async () => {
  const response = await handleTryOnRequest(new Request("http://localhost/api/try-on", {
    method: "POST",
    headers: headers(),
    body: splitForm(DEFAULT_SPLIT_OUTFIT_STATE),
  }), {
    authenticate: async () => TEST_USER,
    rateLimit: async () => ({ allowed: true, limit: 5, remaining: 4, resetAt: Date.now() + 60_000 }),
    resolveSplitSelection: async () => fakeResolvedSplitOutfit(DEFAULT_SPLIT_OUTFIT_STATE),
    // readSplitReference deliberately NOT overridden — the real (always-throwing,
    // pending-photography) implementation runs.
    generate: async () => { throw new Error("must not run"); },
  });
  assert.equal(response.status, 503);
});

test("a completed split generation's usage history survives read-back as mode split, not catalog", async () => {
  const event: UsageEvent = {
    id: crypto.randomUUID(),
    occurredAt: new Date().toISOString(),
    username: TEST_USER.username,
    status: "success",
    device: { kind: "desktop", browser: "Chrome", operatingSystem: "macOS" },
    durationMs: 1200,
    provider: "openai",
    model: "gpt-image-2.5-sunburst",
    quality: "medium",
    generation: {
      mode: "split",
      splitFamily: "suit",
      splitUpperId: "SUIT_UPPER_THREE_PIECE",
      splitUpperName: "Three-Piece",
      splitLowerId: "SUIT_LOWER_NON_PLEATED",
      splitLowerName: "Non-pleated",
      splitShirtId: "SUIT_SHIRT_CLASSIC_FORMAL",
      splitShirtName: "Classic Formal",
      splitWaistcoatId: "SUIT_WAISTCOAT_CLASSIC",
      splitWaistcoatName: "Classic",
      splitFootwearId: "SUIT_SHOE_OXFORD",
      splitFootwearName: "Oxford",
      splitAccessoryIds: ["SUIT_ACC_POCKET_SQUARE"],
      splitAccessoryNames: ["Pocket Square"],
      fabricRegion: "both",
    },
  };
  await recordUsageEvent(event);
  const history = await getUsageHistory(10);
  const stored = history.events.find((item) => item.id === event.id);
  assert.ok(stored);
  assert.equal(stored.generation?.mode, "split");
  assert.equal(stored.generation?.splitUpperName, "Three-Piece");
  assert.equal(stored.generation?.splitFamily, "suit");
  assert.deepEqual(stored.generation?.splitAccessoryNames, ["Pocket Square"]);
});

test("photographed split options are active in the client view; accessories and waistcoat None are not", () => {
  const view = getSplitCatalogueView("suit");
  for (const slotId of ["upper", "lower", "inner-shirt", "footwear"] as const) {
    const slot = view.slots.find((item) => item.id === slotId);
    assert.ok(slot);
    for (const option of slot.options) {
      assert.equal(option.reference?.status, "active", `${option.id} should be active after photography approval`);
      assert.equal(option.reference?.url, `/api/split-catalog-assets/${option.id}_REFERENCE_V1`);
    }
  }
  const waistcoat = view.slots.find((item) => item.id === "inner-waistcoat");
  assert.ok(waistcoat);
  for (const option of waistcoat.options) {
    if (option.id === "SUIT_WAISTCOAT_NONE") {
      assert.equal(option.reference, undefined, "waistcoat None has no photograph");
    } else {
      assert.equal(option.reference?.status, "active", `${option.id} should be active`);
      assert.equal(option.reference?.url, `/api/split-catalog-assets/${option.id}_REFERENCE_V1`);
    }
  }
  const accessories = view.slots.find((item) => item.id === "accessory");
  assert.ok(accessories);
  for (const option of accessories.options) {
    assert.equal(option.reference, undefined, `${option.id} stays text-only`);
  }
});

test("split catalogue photos cannot be read without an authenticated session", async () => {
  const response = await getSplitCatalogAsset(new Request("http://localhost/api/split-catalog-assets/SUIT_UPPER_CLASSIC_REFERENCE_V1"), {
    params: Promise.resolve({ assetId: "SUIT_UPPER_CLASSIC_REFERENCE_V1" }),
  });
  assert.equal(response.status, 404);
});

test("the split catalogue view never leaks a reference's private path or checksum", () => {
  const view = getSplitCatalogueView("suit");
  const serialized = JSON.stringify(view);
  assert.doesNotMatch(serialized, /privatePath|checksum|provenance/i);
  assert.match(serialized, /\/api\/split-catalog-assets\/SUIT_UPPER_CLASSIC_REFERENCE_V1/);
});

test("readSplitReference serves a real active reference through the same read path a real photo would use", async () => {
  const bytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVQImWNgYGgAAACEAIGcaMMkAAAAAElFTkSuQmCC", "base64");
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const cacheDir = path.join(process.cwd(), ".cache/catalog-assets");
  const cachePath = path.join(cacheDir, "TEST_SPLIT_UPPER_REFERENCE_V1.png");
  await mkdir(cacheDir, { recursive: true });
  await writeFile(cachePath, bytes);
  try {
    const fakeOption = {
      ...SUIT_UPPER_OPTIONS[0],
      reference: {
        assetId: "TEST_SPLIT_UPPER_REFERENCE_V1",
        status: "active" as const,
        privatePath: "nasir-bespoke/catalogue/split/v1/TEST_SPLIT_UPPER_REFERENCE_V1/approved.png",
        checksum,
        contentType: "image/png" as const,
      },
    };
    const reference = await readSplitReference(fakeOption, "split-upper");
    assert.equal(reference.role, "split-upper");
    assert.equal(reference.image.mime, "image/png");
  } finally {
    await rm(cachePath, { force: true });
  }
});

test("readSplitReference rejects an active reference whose bytes don't match its recorded checksum", async () => {
  const bytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVQImWNgYGgAAACEAIGcaMMkAAAAAElFTkSuQmCC", "base64");
  const cacheDir = path.join(process.cwd(), ".cache/catalog-assets");
  const cachePath = path.join(cacheDir, "TEST_SPLIT_UPPER_TAMPERED_V1.png");
  await mkdir(cacheDir, { recursive: true });
  await writeFile(cachePath, bytes);
  try {
    const fakeOption = {
      ...SUIT_UPPER_OPTIONS[0],
      reference: {
        assetId: "TEST_SPLIT_UPPER_TAMPERED_V1",
        status: "active" as const,
        privatePath: "nasir-bespoke/catalogue/split/v1/TEST_SPLIT_UPPER_TAMPERED_V1/approved.png",
        checksum: "0".repeat(64),
        contentType: "image/png" as const,
      },
    };
    await assert.rejects(() => readSplitReference(fakeOption, "split-upper"), SplitOutfitError);
  } finally {
    await rm(cachePath, { force: true });
  }
});
