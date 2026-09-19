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
  assert.deepEqual(generatedInput.references.map((reference) => reference.role), ["split-upper", "split-lower", "split-shirt", "split-footwear"]);
  assert.equal(generatedInput.selection.mode, "split");
  assert.match(generatedInput.prompt, /Tailor every garment around the customer's actual body/i);
  assert.match(generatedInput.prompt, /SELECTED MODULAR OUTFIT/i);
  assert.match(generatedInput.prompt, /FINAL FABRIC APPLICATION OVERRIDE/i);
});

test("split prompt fabric override matches Level 1's closing authority and does not recolour text-composed pieces", async () => {
  const resolved = await resolveSplitOutfitRecipe(JSON.stringify(DEFAULT_SPLIT_OUTFIT_STATE));
  const both = buildSplitOutfitPrompt(resolved, "both");
  const upper = buildSplitOutfitPrompt(resolved, "upper");
  const lower = buildSplitOutfitPrompt(resolved, "lower");

  assert.match(both, /Image 2 is the sole cloth authority for the jacket and the trousers only/);
  assert.match(both, /shirt, footwear, accessories are not coloured from Image 2/);
  assert.match(both, /Image 5 — NASIR BESPOKE approved shirt construction AND cloth appearance/);
  assert.match(both, /Image 6 — NASIR BESPOKE approved footwear construction AND cloth appearance/);
  assert.doesNotMatch(both, /Image 6 — NASIR BESPOKE approved waistcoat/);
  assert.doesNotMatch(both, /every selected garment piece/);

  assert.match(upper, /Image 2 is the sole cloth authority for the jacket only/);
  assert.match(upper, /The trousers must be rendered as the selected lower garment in Image 4/);
  assert.match(lower, /Image 2 is the sole cloth authority for the trousers only/);
  assert.match(lower, /The jacket must keep the cloth, colour, and material shown in Image 3/);
});

test("denim trousers keep Image 4 jean cloth and are not recoloured by the uploaded suiting fabric", async () => {
  const denimState: SplitOutfitState = { ...DEFAULT_SPLIT_OUTFIT_STATE, lowerId: "SUIT_LOWER_DENIM" };
  const resolved = await resolveSplitOutfitRecipe(JSON.stringify(denimState));
  const both = buildSplitOutfitPrompt(resolved, "both");
  const lowerOnly = buildSplitOutfitPrompt(resolved, "lower");

  assert.match(both, /Denim jeans — not tailored suit trousers/);
  assert.match(both, /Trousers \[Image 4 = cut and cloth; do not apply Image 2\]/);
  assert.match(both, /Image 2 is the sole cloth authority for the jacket only/);
  assert.match(both, /If Image 4 shows jeans, the customer wears those jeans/);
  assert.doesNotMatch(both, /the jacket and the trousers only/);
  assert.match(lowerOnly, /Image 2 is not applied to any garment/);
  assert.match(lowerOnly, /do not apply Image 2/);
});

test("classic waistcoat takes uploaded fabric; tuxedo waistcoat keeps its reference cloth", async () => {
  const classic = await resolveSplitOutfitRecipe(JSON.stringify({
    ...DEFAULT_SPLIT_OUTFIT_STATE,
    upperId: "SUIT_UPPER_THREE_PIECE",
    waistcoatId: "SUIT_WAISTCOAT_CLASSIC",
  }));
  const tuxedo = await resolveSplitOutfitRecipe(JSON.stringify({
    ...DEFAULT_SPLIT_OUTFIT_STATE,
    upperId: "SUIT_UPPER_TUXEDO",
    waistcoatId: "SUIT_WAISTCOAT_TUXEDO",
    shirtId: "SUIT_SHIRT_TUXEDO_PLEATED",
  }));
  const classicPrompt = buildSplitOutfitPrompt(classic, "both");
  const tuxedoPrompt = buildSplitOutfitPrompt(tuxedo, "both");

  assert.match(classicPrompt, /Waistcoat \[Image 6 = cut; Image 2 = cloth\]/);
  assert.match(classicPrompt, /the jacket and the trousers and the waistcoat/);
  assert.match(tuxedoPrompt, /Waistcoat \[Image 6 = cut and cloth\]/);
  assert.doesNotMatch(tuxedoPrompt, /black satin/);
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
  const bytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1]);
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
  const bytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1]);
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
