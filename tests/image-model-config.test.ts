import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { resolveImageGenerationConfig, type ImageGenerationConfig } from "@/lib/tryon/model-config";
import { OpenAITryOnProvider, resolveFallbackCanvas, resolveHighResolutionCanvas } from "@/lib/tryon/providers/openai";
import { usageModelFallback } from "@/lib/try-on-handler";
import type { createOpenAIClient } from "@/lib/openai";
import type { TryOnInput } from "@/lib/tryon/types";

async function image(width: number, height: number) {
  const bytes = await sharp({ create: { width, height, channels: 3, background: "navy" } }).png().toBuffer();
  return { file: new File([new Uint8Array(bytes)], "fixture.png", { type: "image/png" }), mime: "image/png" as const, width, height };
}

async function recordEdit(config?: ImageGenerationConfig) {
  const person = await image(90, 160);
  const result = await image(32, 32);
  const encoded = Buffer.from(await result.file.arrayBuffer()).toString("base64");
  let request: Record<string, unknown> = {};
  const client = { images: { edit: async (params: Record<string, unknown>) => { request = params; return { data: [{ b64_json: encoded }] }; } } };
  const provider = new OpenAITryOnProvider(() => client as unknown as ReturnType<typeof createOpenAIClient>, config);
  const input: TryOnInput = { person, fabric: await image(64, 64), references: [], selection: { mode: "level1", categoryId: "suit", designId: "SUIT_01_CLASSIC" }, requestId: "model-config-test", prompt: "Synthetic instructions" };
  const output = await provider.generate(input);
  return { request, output, person };
}

test("defaults use 2.6 Sunburst with the existing quality, canvas and fabric treatment", () => {
  assert.deepEqual(resolveImageGenerationConfig({}), {
    model: "gpt-image-2.6-sunburst",
    quality: "medium",
    canvasProfile: "experimental",
    fabricTreatmentDefault: "legacy-crop",
  });
});

test("rejects unknown model at config load", () => {
  assert.throws(() => resolveImageGenerationConfig({ IMAGE_MODEL: "gpt-image-2.6-flair" }), /Unsupported IMAGE_MODEL/);
  assert.throws(() => resolveImageGenerationConfig({ IMAGE_QUALITY: "ultra" }), /Unsupported IMAGE_QUALITY/);
  assert.throws(() => resolveImageGenerationConfig({ IMAGE_CANVAS_PROFILE: "huge" }), /Unsupported IMAGE_CANVAS_PROFILE/);
  assert.throws(() => resolveImageGenerationConfig({ IMAGE_COMPLEXITY: "extreme" }), /Unsupported IMAGE_COMPLEXITY/);
  assert.throws(() => resolveImageGenerationConfig({ FABRIC_TREATMENT_DEFAULT: "zoom" }), /Unsupported FABRIC_TREATMENT_DEFAULT/);
});

test("rejects complexity for 2.5", () => {
  assert.throws(() => resolveImageGenerationConfig({ IMAGE_MODEL: "gpt-image-2.5-sunburst", IMAGE_COMPLEXITY: "medium" }), /complexity requires a 2.6 model/);
  assert.equal(resolveImageGenerationConfig({ IMAGE_COMPLEXITY: "medium" }).complexity, "medium");
});

test("edit call carries configured values", async () => {
  const config: ImageGenerationConfig = { model: "gpt-image-2.6-flare", quality: "high", canvasProfile: "stable", complexity: "medium", fabricTreatmentDefault: "legacy-crop" };
  const { request, output, person } = await recordEdit(config);
  assert.equal(request.model, "gpt-image-2.6-flare");
  assert.equal(request.quality, "high");
  assert.equal(request.complexity, "medium");
  assert.equal(request.size, resolveFallbackCanvas(person.width, person.height));
  assert.equal("input_fidelity" in request, false);
  assert.equal(output.metadata.model, "gpt-image-2.6-flare");
  assert.equal(output.metadata.quality, "high");
});

test("never sends complexity to 2.5", async () => {
  const { request } = await recordEdit({ model: "gpt-image-2.5-sunburst", quality: "medium", canvasProfile: "experimental", fabricTreatmentDefault: "legacy-crop" });
  assert.equal("complexity" in request, false);
  assert.equal(request.model, "gpt-image-2.5-sunburst");
});

test("default provider config reaches the edit request", async () => {
  const { request, person } = await recordEdit();
  assert.equal(request.model, "gpt-image-2.6-sunburst");
  assert.equal(request.quality, "medium");
  assert.equal(request.size, resolveHighResolutionCanvas(person.width, person.height));
  assert.equal("complexity" in request, false);
});

test("history metadata falls back to configured model", () => {
  const config: ImageGenerationConfig = { model: "gpt-image-2.6-flare", quality: "high", canvasProfile: "stable", fabricTreatmentDefault: "legacy-crop" };
  assert.deepEqual(usageModelFallback(undefined, config), { provider: "openai", model: "gpt-image-2.6-flare", quality: "high" });
  assert.deepEqual(usageModelFallback({ provider: "openai", model: "gpt-image-2.5-sunburst", quality: "medium" }, config), { provider: "openai", model: "gpt-image-2.5-sunburst", quality: "medium" });
});
