import "./helpers/hermetic-image-env";
import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { OpenAITryOnProvider, PROVIDER_ATTEMPT_TIMEOUT_MS, PROVIDER_TIME_BUDGET_MS } from "@/lib/tryon/providers/openai";
import { maxDuration } from "@/app/api/try-on/route";

async function png(width: number, height: number) {
  const bytes = await sharp({ create: { width, height, channels: 3, background: "#334455" } }).png().toBuffer();
  return { file: new File([new Uint8Array(bytes)], "image.png", { type: "image/png" }), mime: "image/png" as const, width, height };
}

async function input() {
  return {
    person: await png(64, 96),
    fabric: await png(64, 64),
    references: [],
    selection: { mode: "level1" as const, categoryId: "suit", designId: "x" },
    prompt: "prompt",
    requestId: "time-budget-test",
  };
}

const invalidImage = Object.assign(new Error("Invalid image file"), { status: 400 });
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test("the provider's total time budget leaves the route room to store the result", () => {
  assert.ok(PROVIDER_TIME_BUDGET_MS <= (maxDuration - 45) * 1000);
  assert.ok(PROVIDER_ATTEMPT_TIMEOUT_MS <= PROVIDER_TIME_BUDGET_MS);
});

test("a paid retry is not started when too little time is left to finish it", async () => {
  let calls = 0;
  const client = { images: { edit: async () => { calls++; await sleep(20); throw invalidImage; } } };
  const provider = new OpenAITryOnProvider(() => client as never, undefined, { budgetMs: 1_000, minRetryWindowMs: 990 });
  await assert.rejects(provider.generate(await input()), /Invalid image file/);
  assert.equal(calls, 1);
});

test("a retry that fits runs, and every attempt's timeout stays inside the budget", async () => {
  const timeouts: number[] = [];
  const result = Buffer.from(await sharp({ create: { width: 64, height: 96, channels: 3, background: "#000" } }).png().toBuffer()).toString("base64");
  const client = { images: { edit: async (_params: unknown, options?: { timeout?: number }) => {
    timeouts.push(options?.timeout ?? Infinity);
    if (timeouts.length === 1) throw invalidImage;
    return { data: [{ b64_json: result }] };
  } } };
  const provider = new OpenAITryOnProvider(() => client as never, undefined, { budgetMs: 200_000, attemptTimeoutMs: 150_000, minRetryWindowMs: 1_000 });
  const output = await provider.generate(await input());
  assert.equal(timeouts.length, 2);
  assert.ok(timeouts.every((value) => value <= 150_000));
  assert.deepEqual(output.metadata.provenance?.fallbackReasons, ["image-format"]);
});
