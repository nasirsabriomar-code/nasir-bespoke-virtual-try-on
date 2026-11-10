import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { parseComparisonManifest, resolveRunConditions } from "@/lib/evaluation/manifest";
import { planCells, runComparison, type RunCell } from "@/lib/evaluation/runner";
import { summarizeEvaluations } from "@/lib/evaluation/summary";
import { REVIEW_REASONS } from "@/lib/history/review-types";
import { DEFAULT_SPLIT_OUTFIT_STATE } from "@/lib/split-outfit/catalogue";
import type { TryOnInput, TryOnOutput } from "@/lib/tryon/types";
import type { ImageGenerationConfig } from "@/lib/tryon/model-config";

const baseCase = { id: "one", recipe: DEFAULT_SPLIT_OUTFIT_STATE, person: "p.png", fabrics: { fabric: "f.png" }, references: { "split-upper": "u.png", "split-lower": "l.png", "split-shirt": "s.png", "split-footwear": "w.png" } };
const matrix = (conditions: unknown) => ({ version: 1, experiment: "matrix", repetitions: 1, cases: [baseCase], conditions });

test("matrix manifest validates conditions", () => {
  const parsed = parseComparisonManifest(matrix([{ id: "A", config: { model: "gpt-image-2.5-sunburst" } }, { id: "B", config: { model: "gpt-image-2.6-flare", quality: "high", fabricTreatmentDefault: "full-swatch" } }]));
  const conditions = resolveRunConditions(parsed);
  assert.equal(conditions.length, 2);
  assert.equal(conditions[0].config.model, "gpt-image-2.5-sunburst");
  assert.equal(conditions[1].config.quality, "high");
  assert.equal(conditions[1].config.fabricTreatmentDefault, "full-swatch");
  assert.throws(() => parseComparisonManifest(matrix([{ id: "A", config: { model: "gpt-image-9" } }, { id: "B", config: {} }])), /Unsupported IMAGE_MODEL/);
  assert.throws(() => parseComparisonManifest(matrix([{ id: "A", config: {} }])), /2 to 8 conditions/);
  assert.throws(() => parseComparisonManifest(matrix(Array.from({ length: 9 }, (_, index) => ({ id: `C${index}`, config: {} })))), /2 to 8 conditions/);
  assert.throws(() => parseComparisonManifest(matrix([{ id: "A", config: {} }, { id: "A", config: {} }])), /condition/);
  assert.throws(() => parseComparisonManifest(matrix([{ id: "A", config: { prompt: "x" } }, { id: "B", config: {} }])), /condition/);
  assert.throws(() => parseComparisonManifest({ ...matrix(undefined), experiment: "fabric-treatment", conditions: [{ id: "A", config: {} }, { id: "B", config: {} }] }), /only for matrix/);
  const legacy = resolveRunConditions(parseComparisonManifest({ ...matrix(undefined), experiment: "quality" }));
  assert.deepEqual(legacy.map(row => row.config.quality), ["medium", "high"]);
});

async function cells(count: number): Promise<RunCell[]> {
  const bytes = await sharp({ create: { width: 8, height: 8, channels: 3, background: "navy" } }).png().toBuffer();
  const image = { file: new File([new Uint8Array(bytes)], "x.png", { type: "image/png" }), mime: "image/png" as const };
  const input = { person: image, references: [], selection: { mode: "split" }, prompt: "p", requestId: "r" } as unknown as TryOnInput;
  const config: ImageGenerationConfig = { model: "gpt-image-2.6-sunburst", quality: "medium", canvasProfile: "stable", fabricTreatmentDefault: "full-swatch" };
  return planCells([{ id: "one", input }], Array.from({ length: count }, (_, index) => ({ id: `C${index}`, config })), 1);
}

function fakeProvider(onCall: () => void, fail = false) {
  return () => ({ generate: async (): Promise<TryOnOutput> => {
    onCall();
    if (fail) throw new Error("provider down");
    const bytes = await sharp({ create: { width: 4, height: 4, channels: 3, background: "red" } }).png().toBuffer();
    return { bytes: new Uint8Array(bytes), contentType: "image/png", metadata: { provider: "openai", model: "gpt-image-2.6-sunburst", quality: "medium", durationMs: 42, usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } } };
  } });
}

test("runner refuses without --confirm-paid", async () => {
  const output = await mkdtemp(path.join(tmpdir(), "runner-"));
  let factory = 0;
  await assert.rejects(runComparison({ cells: await cells(3), outputDir: output, confirmPaid: false, providerFor: () => { factory++; return fakeProvider(() => {})(); } }), /3 paid image calls/);
  assert.equal(factory, 0);
  await rm(output, { recursive: true, force: true });
});

test("runner skips cells whose output already exists", async () => {
  const output = await mkdtemp(path.join(tmpdir(), "runner-"));
  let calls = 0;
  const first = await runComparison({ cells: await cells(2), outputDir: output, confirmPaid: true, providerFor: () => fakeProvider(() => calls++)() });
  assert.deepEqual({ ...first, calls }, { called: 2, skipped: 0, failed: 0, calls: 2 });
  const second = await runComparison({ cells: await cells(2), outputDir: output, confirmPaid: true, providerFor: () => fakeProvider(() => calls++)() });
  assert.deepEqual({ ...second, calls }, { called: 0, skipped: 2, failed: 0, calls: 2 });
  const meta = JSON.parse(await readFile(path.join(output, "one", "C0", "1.json"), "utf8"));
  assert.equal(meta.usage.outputTokens, 20); assert.equal(meta.config.model, "gpt-image-2.6-sunburst");
  const template = JSON.parse(await readFile(path.join(output, "score-template.json"), "utf8"));
  assert.equal(template.length, 2); assert.equal(template[0].durationMs, 42); assert.equal(template[0].accepted, null);
  await rm(output, { recursive: true, force: true });
});

test("runner records a failed cell once and does not retry it", async () => {
  const output = await mkdtemp(path.join(tmpdir(), "runner-"));
  let calls = 0;
  const first = await runComparison({ cells: await cells(1), outputDir: output, confirmPaid: true, providerFor: () => fakeProvider(() => calls++, true)() });
  assert.equal(first.failed, 1);
  assert.deepEqual(await readdir(path.join(output, "one", "C0")), ["1.error.json"]);
  const second = await runComparison({ cells: await cells(1), outputDir: output, confirmPaid: true, providerFor: () => fakeProvider(() => calls++, true)() });
  assert.equal(second.skipped, 1); assert.equal(calls, 1);
  await rm(output, { recursive: true, force: true });
});

test("summary reports mean token usage when every row has it", () => {
  const scores = { scale: 4, colour: 4, construction: 4, background: 4, identity: 5 };
  const [row] = summarizeEvaluations([
    { caseId: "one", condition: "A", accepted: true, durationMs: 100, costUsd: null, scores, inputTokens: 100, outputTokens: 1000 },
    { caseId: "two", condition: "A", accepted: false, durationMs: 300, costUsd: null, scores, inputTokens: 300, outputTokens: 3000 },
  ]);
  assert.equal(row.meanInputTokens, 200); assert.equal(row.meanOutputTokens, 2000);
  assert.equal(summarizeEvaluations([{ caseId: "one", condition: "B", accepted: true, durationMs: 1, costUsd: null, scores }])[0].meanOutputTokens, null);
});

test("review reasons include broken-or-wavy-stripes", () => {
  assert.ok((REVIEW_REASONS as readonly string[]).includes("broken-or-wavy-stripes"));
});
