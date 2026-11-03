import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { centerFabricRepeat, resolveHighResolutionCanvas, resolveFallbackCanvas } from "@/lib/tryon/providers/openai";
import { detectImageDimensions } from "@/lib/validation";
import { fetchUploadWithTimeout, recoverGeneration } from "@/lib/generation-recovery";

test("lossy, lossless and extended WebP dimensions agree with the actual image", async () => {
  for (const options of [{ lossless: false }, { lossless: true }, { lossless: false, alpha: true }]) {
    const bytes = await sharp({ create: { width: 640, height: 480, channels: options.alpha ? 4 : 3, background: { r: 20, g: 60, b: 90, alpha: options.alpha ? 0.5 : 1 } } }).webp(options).toBuffer();
    assert.deepEqual(detectImageDimensions(bytes, "image/webp"), { width: 640, height: 480 });
  }
});

test("fabric crop dimensions describe the rotated output for every EXIF orientation", async () => {
  for (let orientation = 1; orientation <= 8; orientation++) {
    const bytes = await sharp({ create: { width: 800, height: 1200, channels: 3, background: "red" } }).jpeg().withMetadata({ orientation }).toBuffer();
    const result = await centerFabricRepeat({ file: new File([bytes], "fabric.jpg", { type: "image/jpeg" }), mime: "image/jpeg" });
    const metadata = await sharp(Buffer.from(await result.file.arrayBuffer())).metadata();
    assert.equal(result.width, metadata.width);
    assert.equal(result.height, metadata.height);
    assert.equal(result.width! * result.height!, 400 * 600);
  }
});

test("all requested canvases respect edge, pixel, divisibility and aspect constraints", () => {
  for (const [resolve, pixels] of [[resolveHighResolutionCanvas, 3840 * 2160], [resolveFallbackCanvas, 2560 * 1440]] as const) {
    for (const ratio of [0.1, 1 / 3, 0.4, 9 / 16, 1, 16 / 9, 2.5, 3, 10]) {
      const [width, height] = resolve(1000 * ratio, 1000).split("x").map(Number);
      assert.ok(width <= 3840 && height <= 3840);
      assert.equal(width % 16, 0); assert.equal(height % 16, 0);
      assert.ok(width * height <= pixels && width * height >= 655360);
      assert.ok(width / height <= 3 && height / width <= 3);
      assert.ok(Math.abs(width / height - Math.max(1 / 3, Math.min(3, ratio))) < 0.025);
    }
  }
  assert.equal(resolveHighResolutionCanvas(900, 1600), "2160x3840");
});

test("a stalled status read is bounded and recovery can subsequently finish", async () => {
  let calls = 0;
  const result = await recoverGeneration("same-key", {
    readStatus: async (key, signal) => {
      assert.equal(key, "same-key");
      if (calls++ === 0) return new Promise((_, reject) => signal!.addEventListener("abort", () => reject(new Error("deadline"))));
      return { state: "complete", resultUrl: "/r", originalUrl: "/o" };
    }, wait: async () => {},
  }, { readTimeoutMs: 10, totalTimeoutMs: 1000 });
  assert.equal(result.kind, "complete"); assert.equal(calls, 2);
});

test("recovery overall deadline bounds a status reader that ignores cancellation", async () => {
  const result = await recoverGeneration("same-key", { readStatus: () => new Promise(() => {}), wait: async () => {} }, { readTimeoutMs: 10, totalTimeoutMs: 30 });
  assert.deepEqual(result, { kind: "unknown" });
});

test("upload deadlines include stalled response bodies", async (t) => {
  let aborted = false;
  t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    init.signal!.addEventListener("abort", () => { aborted = true; });
    return new Response(new ReadableStream({ start() {} }));
  });
  await assert.rejects(fetchUploadWithTimeout("/api/try-on/uploads", { method: "POST" }, 10), { name: "AbortError" });
  assert.equal(aborted, true);
});
