import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import test, { beforeEach } from "node:test";
import { handleTryOnRequest } from "@/lib/try-on-handler";
import { resolveSplitOutfitRecipe, SplitOutfitError, type ResolvedSplitOutfit } from "@/lib/split-outfit/generation";
import { DEFAULT_SPLIT_OUTFIT_STATE } from "@/lib/split-outfit/catalogue";
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

function tinyPng(name: string) {
  return new File(
    [Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1])],
    name,
    { type: "image/png" },
  );
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
  assert.deepEqual(generatedInput.references.map((reference) => reference.role), ["split-upper", "split-lower"]);
  assert.equal(generatedInput.selection.mode, "split");
  assert.match(generatedInput.prompt, /Tailor every garment around the customer's actual body/i);
  assert.match(generatedInput.prompt, /SELECTED MODULAR OUTFIT/i);
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
      splitLowerId: "SUIT_LOWER_CLASSIC_STRAIGHT",
      splitLowerName: "Classic Straight",
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
