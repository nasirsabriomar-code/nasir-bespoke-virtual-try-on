import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { parseFabricGuidance } from "@/lib/tryon/fabric-guidance";
import { parseBackgroundControl } from "@/lib/tryon/background-control";
import { cropFabricDetail } from "@/lib/tryon/fabric-reference";
import { OpenAITryOnProvider, prepareProviderReferences } from "@/lib/tryon/providers/openai";
import { createOpenAIClient } from "@/lib/openai";
import { handleTryOnRequest } from "@/lib/try-on-handler";
import { prepareBackgroundEdit, compositeBackground } from "@/lib/tryon/background-preservation";
import type { TryOnInput } from "@/lib/tryon/types";
import { promptImageIndicesAreValid } from "@/lib/tryon/image-layout";
import { buildTryOnPrompt } from "@/lib/tryon/prompt";
import { buildLevel1TryOnPrompt } from "@/lib/catalog/level1-prompt";
import { DEFAULT_LEVEL1_CATALOGUE } from "@/lib/catalog/level1-seed";
import { CATALOG_SEED } from "@/lib/catalog/seed";
import { buildSplitOutfitPrompt } from "@/lib/split-outfit/prompt";
import { resolveSplitOutfitRecipe } from "@/lib/split-outfit/generation";
import { DEFAULT_SPLIT_OUTFIT_STATE } from "@/lib/split-outfit/catalogue";
async function image(colour: string, width = 800, height = 800) {
  const bytes = await sharp({ create: { width, height, channels: 3, background: colour } }).png().toBuffer();
  return { file: new File([bytes], "synthetic.png", { type: "image/png" }), mime: "image/png" as const, width, height };
}

test("final SDK packets bind all split fabric combinations and optional waistcoat to actual image indices", async () => {
  const fixture = await image("navy", 64, 64);
  const encoded = Buffer.from(await fixture.file.arrayBuffer()).toString("base64");
  for (const waistcoat of [false, true]) for (let bits = 0; bits < 16; bits++) {
    const presence = { jacket: Boolean(bits & 1), trousers: Boolean(bits & 2), shirt: Boolean(bits & 4), waistcoat: waistcoat && Boolean(bits & 8) };
    const resolved = await resolveSplitOutfitRecipe(JSON.stringify({ ...DEFAULT_SPLIT_OUTFIT_STATE, ...(waistcoat ? { upperId: "SUIT_UPPER_THREE_PIECE", waistcoatId: "SUIT_WAISTCOAT_CLASSIC" } : {}) }));
    const refs = ["split-upper", "split-lower", "split-shirt", ...(waistcoat ? ["split-waistcoat"] : []), "split-footwear"];
    const fabrics = Object.entries({ fabric: presence.jacket, lowerFabric: presence.trousers, shirtFabric: presence.shirt, waistcoatFabric: presence.waistcoat }).filter(([, value]) => value).map(([role]) => role);
    const stems: Record<string, string> = { fabric: "fabric-reference", lowerFabric: "lower-fabric-reference", shirtFabric: "shirt-fabric-reference", waistcoatFabric: "waistcoat-fabric-reference" };
    const expected = ["person-reference", ...refs.map(role => role + "-blueprint"), ...fabrics.map(role => stems[role]), ...(presence.jacket ? ["fabric-reference-detail"] : [])];
    let calls = 0;
    const provider = new OpenAITryOnProvider(() => ({ images: { edit: async (request: { image: File[]; prompt: string }) => {
      calls++; assert.deepEqual(request.image.map(file => file.name), expected.map(stem => stem + ".png"));
      expected.forEach((stem, index) => assert.ok(request.prompt.includes(`Image ${index + 1} — ${stem.replaceAll("-", " ")}.`)));
      assert.equal(promptImageIndicesAreValid(request.prompt, expected.length), true);
      assert.equal(request.prompt.split("PANEL MATERIAL POLICY:").length - 1, 1);
      assert.match(request.prompt, /Camera distance, swatch zoom and detail cropping do not change/);
      assert.doesNotMatch(request.prompt, /Every other pixel stays|for colour, shade, and texture only|and the same scale as Image/);
      return { data: [{ b64_json: encoded }] };
    } } }) as unknown as ReturnType<typeof createOpenAIClient>);
    await provider.generate({ person: fixture, references: refs.map(role => ({ role, image: fixture })), selection: { mode: "split" }, prompt: buildSplitOutfitPrompt(resolved, presence), requestId: "packet-fixture", ...Object.fromEntries(fabrics.map(role => [role, fixture])), ...(presence.jacket ? { fabricGuidance: { fabric: { mode: "full-detail", repeatWidthCm: 4 } } } : {}) } as TryOnInput);
    assert.equal(calls, 1);
  }
});

test("full and outfit packets retain local satin/embroidery exceptions and explicit edit boundaries", async () => {
  const fixture = await image("grey", 64, 64); const encoded = Buffer.from(await fixture.file.arrayBuffer()).toString("base64");
  for (const mode of ["level1", "outfit"] as const) for (const detailCount of [0, 1, 2]) for (const designId of ["SUIT_02_TUXEDO", "SHERWANI_05_ROYAL"]) {
    const design = DEFAULT_LEVEL1_CATALOGUE.designs.find(item => item.id === designId)!;
    const refs = mode === "level1" ? ["curated-design", ...Array.from({ length: detailCount }, () => "curated-detail")] : [];
    const prompt = mode === "level1" ? buildLevel1TryOnPrompt({ design, category: DEFAULT_LEVEL1_CATALOGUE.categories.find(item => item.id === design.categoryId)!, primaryAsset: DEFAULT_LEVEL1_CATALOGUE.assets[0], detailAssets: Array.from({ length: detailCount }, () => DEFAULT_LEVEL1_CATALOGUE.assets[0]) }, "both") : buildTryOnPrompt(undefined, { outfitProvided: true });
    const expected = mode === "level1" ? ["person-reference", ...refs.map(role => role + "-blueprint"), "fabric-reference"] : ["person-reference", "outfit-style-reference", "fabric-reference"];
    const provider = new OpenAITryOnProvider(() => ({ images: { edit: async (request: { image: File[]; prompt: string }) => {
      assert.deepEqual(request.image.map(file => file.name), expected.map(stem => stem + ".png"));
      assert.match(request.prompt, /Explicitly selected satin\/grosgrain\/contrast facings/);
      assert.match(request.prompt, /Selected embroidery is permitted/);
      assert.match(request.prompt, /EDIT REGION \(prompt-only\)/);
      if (mode === "level1") assert.match(request.prompt, designId === "SUIT_02_TUXEDO" ? /satin peak lapel/ : /Do not simplify the ornate embroidery/);
      assert.equal(promptImageIndicesAreValid(request.prompt, expected.length), true);
      return { data: [{ b64_json: encoded }] };
    } } }) as unknown as ReturnType<typeof createOpenAIClient>);
    await provider.generate({ person: fixture, fabric: fixture, ...(mode === "outfit" ? { outfit: fixture } : {}), references: refs.map(role => ({ role, image: fixture })), selection: { mode }, prompt, requestId: "full-packet-fixture" } as TryOnInput);
  }
});

test("legacy no-change clothing and selected footwear retain separate authority in the SDK packet", async () => {
  const fixture = await image("grey", 64, 64); const encoded = Buffer.from(await fixture.file.arrayBuffer()).toString("base64");
  const selection = { upper: CATALOG_SEED.blueprints.find(item => item.category === "no-change")!, turban: CATALOG_SEED.accessories.find(item => item.id === "turban-none")!, shoes: CATALOG_SEED.accessories.find(item => item.id === "shoes-oxford")! };
  const provider = new OpenAITryOnProvider(() => ({ images: { edit: async (request: { image: File[]; prompt: string }) => {
    assert.deepEqual(request.image.map(file => file.name), ["person-reference.png", "fabric-reference.png", "shoes-blueprint.png"]);
    assert.match(request.prompt, /Image 3 — selected men's shoe reference/);
    assert.match(request.prompt, /no-change pieces retain Image 1's appearance/);
    assert.doesNotMatch(request.prompt, /Image 1 wins|pose, hands, footwear, lighting/);
    return { data: [{ b64_json: encoded }] };
  } } }) as unknown as ReturnType<typeof createOpenAIClient>);
  await provider.generate({ person: fixture, fabric: fixture, references: [{ role: "shoes", image: fixture }], selection: { mode: "catalog" }, prompt: buildTryOnPrompt(selection, { outfitProvided: false }), requestId: "legacy-shoes" } as TryOnInput);
});

test("invalid final image references fail before invoking the SDK", async () => {
  const fixture = await image("grey", 64, 64); let calls = 0;
  const provider = new OpenAITryOnProvider(() => ({ images: { edit: async () => { calls++; throw new Error("must not call"); } } }) as unknown as ReturnType<typeof createOpenAIClient>);
  await assert.rejects(provider.generate({ person: fixture, references: [], selection: { mode: "catalog" }, prompt: "Use Image 9", requestId: "invalid-map" } as TryOnInput), /mapping is invalid/);
  assert.equal(calls, 0);
});

test("fabric and edit-region schemas reject injected fields and out-of-bounds geometry", () => {
  for (const value of [{ fabric: { mode: "full-detail", prompt: "injected" } }, { person: { mode: "full-detail" } }, { fabric: { mode: "full-detail", crop: { x: .9, y: 0, width: .5, height: .5 } } }, { fabric: { mode: "full-detail", repeatWidthCm: -1 } }]) assert.throws(() => parseFabricGuidance(value));
  assert.throws(() => parseBackgroundControl({ mode: "composite", region: { x: 0, y: 0, width: 2, height: .5 } }));
  assert.throws(() => parseBackgroundControl({ mode: "composite", url: "https://outside.invalid" }));
  assert.deepEqual(parseBackgroundControl(undefined), { mode: "prompt-only" });
});

test("full-swatch/detail inputs retain original image indices and separate scale from detail", async () => {
  const person = await image("grey"); const fabric = await image("navy"); const lower = await image("green");
  const input = { person, fabric, lowerFabric: lower, selection: { mode: "level1" }, references: [{ role: "curated-design", image: await image("white") }], fabricGuidance: { fabric: { mode: "full-detail", repeatWidthCm: 4 }, lowerFabric: { mode: "full-detail", crop: { x: 0, y: 0, width: .25, height: .5 } } } } as TryOnInput;
  const prepared = await prepareProviderReferences(input);
  assert.equal(prepared.parts.length, 6);
  assert.equal(prepared.parts[2].stem, "fabric-reference");
  assert.equal(prepared.parts[3].stem, "lower-fabric-reference");
  assert.equal(prepared.parts[2].image.file.size, fabric.file.size);
  assert.equal(prepared.parts[4].image.width, 400);
  assert.equal(prepared.parts[5].image.width, 200);
  assert.match(prepared.guidance, /Image 3.*complete fabric/);
  assert.match(prepared.guidance, /Image 5.*cropped detail/);
  assert.match(prepared.guidance, /width 4 cm/);
});

test("detail crop coordinates follow the upright EXIF preview", async () => {
  const bytes = await sharp({ create: { width: 800, height: 1200, channels: 3, background: "red" } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
  const result = await cropFabricDetail({ file: new File([bytes], "rotated.jpg", { type: "image/jpeg" }), mime: "image/jpeg" }, { x: 0, y: 0, width: .25, height: .5 });
  assert.equal(result.width, 300); assert.equal(result.height, 400);
});

test("compositing retains normalized original pixels outside the approved rectangle", async () => {
  const person = await image("red", 64, 64);
  const control = parseBackgroundControl({ mode: "composite", region: { x: .25, y: .25, width: .5, height: .5 }, featherPixels: 0 });
  const prepared = await prepareBackgroundEdit(person, "64x64", control);
  const generated = await image("blue", 64, 64);
  const result = await compositeBackground(prepared.base, new Uint8Array(await generated.file.arrayBuffer()), prepared.mask);
  const { data, info } = await sharp(Buffer.from(result)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const offset = (y * info.width + x) * 3;
    const inside = x >= 16 && x < 48 && y >= 16 && y < 48;
    assert.deepEqual([...data.subarray(offset, offset + 3)], inside ? [0, 0, 255] : [255, 0, 0]);
  }
});

test("background mask feathering stays inside the selected edit region and supports lower output dimensions", async () => {
  const prepared = await prepareBackgroundEdit(await image("red", 64, 64), "64x64", parseBackgroundControl({ mode: "masked", region: { x: .25, y: .25, width: .5, height: .5 }, featherPixels: 4 }));
  const mask = await sharp(prepared.mask).ensureAlpha().raw().toBuffer();
  assert.equal(mask[(16 * 64 + 16) * 4 + 3], 255);
  assert.equal(mask[(32 * 64 + 32) * 4 + 3], 0);
  const result = await compositeBackground(prepared.base, new Uint8Array(await (await image("blue", 32, 32)).file.arrayBuffer()), prepared.mask);
  assert.equal((await sharp(Buffer.from(result)).metadata()).width, 32);
});

test("background compositing rejects a changed output aspect ratio instead of stretching the customer", async () => {
  const prepared = await prepareBackgroundEdit(await image("red", 64, 64), "64x64", parseBackgroundControl({ mode: "composite", region: { x: .25, y: .25, width: .5, height: .5 } }));
  const changed = await image("blue", 32, 48);
  await assert.rejects(compositeBackground(prepared.base, new Uint8Array(await changed.file.arrayBuffer()), prepared.mask), /cannot be aligned safely/);
});

test("provider mask stays PNG and matches the first image across compatibility and size fallbacks", async () => {
  const person = await image("red", 64, 64); const fabric = await image("navy", 64, 64);
  const generated = await image("blue", 32, 32);
  const encoded = Buffer.from(await generated.file.arrayBuffer()).toString("base64");
  let attempts = 0; let prompt = "";
  const client = { images: { edit: async (request: { image: File[]; mask: File; prompt: string; size: string; quality: string; output_format: string }) => {
    attempts++; prompt = request.prompt;
    assert.equal(request.image.length, 3); assert.equal(request.image[0].type, "image/png"); assert.equal(request.mask.type, "image/png");
    const source = await sharp(Buffer.from(await request.image[0].arrayBuffer())).metadata();
    const mask = await sharp(Buffer.from(await request.mask.arrayBuffer())).metadata();
    assert.equal(mask.width, source.width); assert.equal(mask.height, source.height);
    assert.equal(request.quality, "medium"); assert.equal(request.output_format, "png");
    assert.match(request.prompt, /EDIT REGION \(composite\)/);
    assert.match(request.prompt, /Image 2.*complete fabric/); assert.match(request.prompt, /Image 3.*cropped detail/);
    if (attempts === 1) throw { status: 400, code: "invalid_image_file", message: "Invalid image file" };
    if (attempts === 2) throw { status: 400, message: "Unsupported size dimensions" };
    return { data: [{ b64_json: encoded }], quality: "medium", size: request.size };
  } } };
  const provider = new OpenAITryOnProvider(() => client as unknown as ReturnType<typeof createOpenAIClient>);
  const output = await provider.generate({ person, fabric, references: [], selection: { mode: "level1", categoryId: "suit", designId: "SUIT_01_CLASSIC" }, requestId: "synthetic-provider-test", prompt: "Synthetic instructions", fabricGuidance: { fabric: { mode: "full-detail", repeatWidthCm: 4 } }, backgroundControl: { mode: "composite", region: { x: .25, y: .25, width: .5, height: .5 }, featherPixels: 0 } });
  assert.equal(attempts, 3); assert.equal(output.metadata.outputWidth, 32);
  assert.deepEqual(output.metadata.provenance?.fallbackReasons, ["image-format", "size"]);
  assert.equal(output.metadata.provenance?.promptHash, createHash("sha256").update(prompt).digest("hex"));
  const pixels = await sharp(Buffer.from(output.bytes)).removeAlpha().raw().toBuffer();
  assert.deepEqual([...pixels.subarray(0, 3)], [255, 0, 0]);
  assert.deepEqual([...pixels.subarray((16 * 32 + 16) * 3, (16 * 32 + 16) * 3 + 3)], [0, 0, 255]);
});

test("invalid or unmatched fabric controls are rejected before the rate limiter and provider", async () => {
  let paid = 0; let rate = 0;
  const person = await image("grey", 64, 64); const fabric = await image("blue", 64, 64);
  for (const guidance of [{ fabric: { mode: "full-detail", prompt: "injected" } }, { lowerFabric: { mode: "full-detail" } }]) {
    const body = new FormData(); body.set("person", person.file); body.set("fabric", fabric.file);
    body.set("selectionMode", "catalog"); body.set("upperGarmentId", "coat-blazer"); body.set("turbanId", "turban-none"); body.set("shoeId", "shoes-keep-existing"); body.set("fabricGuidance", JSON.stringify(guidance));
    const response = await handleTryOnRequest(new Request("http://localhost/api/try-on", { method: "POST", headers: { origin: "http://localhost" }, body }), { authenticate: async () => ({ username: "fixture", displayName: "Fixture", passwordHash: "unused" }), rateLimit: async () => { rate++; throw new Error("must not reach"); }, generate: async () => { paid++; throw new Error("must not reach"); } });
    assert.equal(response.status, 400);
  }
  assert.equal(paid, 0); assert.equal(rate, 0);
});
