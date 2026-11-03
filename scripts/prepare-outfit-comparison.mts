import { readFile, writeFile, mkdir, realpath } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { parseComparisonManifest, comparisonConditions } from "../lib/evaluation/manifest";
import { resolveSplitOutfitRecipe } from "../lib/split-outfit/generation";
import { hasPhotographedWaistcoat } from "../lib/split-outfit/image-map";
import { buildSplitOutfitPrompt } from "../lib/split-outfit/prompt";
import { prepareProviderPacket } from "../lib/tryon/providers/openai";
import { grayscaleConstruction } from "../lib/tryon/neutralize-construction";
import { validateImageFile } from "../lib/validate-image";
import type { TryOnInput } from "../lib/tryon/types";

// Offline only. No provider or storage calls are made: references must be local approved files.
const [filename, output] = process.argv.slice(2);
if (!filename || !output || process.argv.length !== 4) throw new Error("Usage: npm run quality:prepare-outfit -- manifest.json NEW_OUTPUT_DIRECTORY");
const root = await realpath(path.dirname(path.resolve(filename)));
const manifest = parseComparisonManifest(JSON.parse(await readFile(filename, "utf8")));
async function image(relative: string) {
  if (path.isAbsolute(relative)) throw new Error("Fixture paths must be relative to the manifest directory.");
  const file = await realpath(path.resolve(root, relative));
  if (!file.startsWith(root + path.sep)) throw new Error("Fixture escapes the manifest directory.");
  const bytes = await readFile(file);
  const extension = path.extname(file).toLowerCase();
  const mime = extension === ".png" ? "image/png" : extension === ".webp" ? "image/webp" : extension === ".jpg" || extension === ".jpeg" ? "image/jpeg" : null;
  if (!mime) throw new Error("Unsupported fixture image extension.");
  const validated = await validateImageFile(new File([bytes], path.basename(file), { type: mime }), "comparison fixture");
  return { file: validated.file, mime: validated.mime, width: validated.width, height: validated.height };
}
// Validate every case and image before creating an immutable output directory.
const inputs = [];
for (const item of manifest.cases) {
  const resolved = await resolveSplitOutfitRecipe(JSON.stringify(item.recipe));
  if (item.fabrics.waistcoatFabric && !hasPhotographedWaistcoat(resolved)) throw new Error("Waistcoat fabric requires a waistcoat.");
  const roles = ["split-upper", "split-lower", "split-shirt", ...(hasPhotographedWaistcoat(resolved) ? ["split-waistcoat"] : []), "split-footwear"] as const;
  if (Object.keys(item.references).length !== roles.length) throw new Error("Construction reference set does not match recipe.");
  const refs: TryOnInput["references"] = [];
  for (const role of roles) {
    const file = item.references[role as keyof typeof item.references];
    if (!file) throw new Error(`Missing ${role}`);
    refs.push({ role: role as TryOnInput["references"][number]["role"], image: await image(file) });
  }
  const cloth: Partial<Pick<TryOnInput, "fabric" | "lowerFabric" | "shirtFabric" | "waistcoatFabric">> = {};
  for (const role of Object.keys(item.fabrics) as (keyof typeof item.fabrics)[]) cloth[role] = await image(item.fabrics[role]!);
  const presence = { jacket: Boolean(cloth.fabric), trousers: Boolean(cloth.lowerFabric), shirt: Boolean(cloth.shirtFabric), waistcoat: Boolean(cloth.waistcoatFabric) };
  const neutralRoles = new Set([...(cloth.fabric ? ["split-upper"] : []), ...(cloth.lowerFabric ? ["split-lower"] : []), ...(cloth.shirtFabric ? ["split-shirt"] : []), ...(cloth.waistcoatFabric ? ["split-waistcoat"] : [])]);
  const references = await Promise.all(refs.map(async ref => ({ ...ref, image: neutralRoles.has(ref.role) ? await grayscaleConstruction(ref.image) : ref.image })));
  inputs.push({ id: item.id, input: { selection: { mode: "split" as const, ...resolved.state }, requestId: item.id, person: await image(item.person), ...cloth, references, prompt: buildSplitOutfitPrompt(resolved, presence) } });
}
await mkdir(path.dirname(path.resolve(output)), { recursive: true });
await mkdir(output); // Refuse overwrite, including an existing empty run directory.
const mapping = [];
const scores = [];
for (const item of inputs) for (const condition of comparisonConditions(manifest.experiment)) for (let repeat = 1; repeat <= manifest.repetitions; repeat++) {
  const runId = `${item.id}-${condition.id}-${repeat}`;
  const directory = path.join(output, runId);
  await mkdir(directory);
  const fabricGuidance = Object.fromEntries(["fabric", "lowerFabric", "shirtFabric", "waistcoatFabric"].filter(role => role in item.input).map(role => [role, { mode: condition.treatment }]));
  const prepared = await prepareProviderPacket({ ...item.input, fabricGuidance } as TryOnInput);
  const files = [];
  for (const [index, part] of prepared.parts.entries()) {
    const name = `${index + 1}-${part.stem}.${part.image.mime === "image/png" ? "png" : part.image.mime === "image/webp" ? "webp" : "jpg"}`;
    const bytes = new Uint8Array(await part.image.file.arrayBuffer());
    await writeFile(path.join(directory, name), bytes);
    files.push({ index: index + 1, name, sha256: createHash("sha256").update(bytes).digest("hex") });
  }
  await writeFile(path.join(directory, "packet.json"), JSON.stringify({ runId, model: "gpt-image-2.5-sunburst", quality: condition.quality, size: prepared.requestedSize, prompt: prepared.providerPrompt, preprocessingVersion: "production-packet-v1", fabricGuidance: prepared.guidance, files, paidCallsMade: 0, status: "prepared-only" }, null, 2));
  mapping.push({ runId, caseId: item.id, ...condition, repeat });
  scores.push({ caseId: item.id, condition: condition.id, runId, accepted: null, durationMs: null, costUsd: null, scores: null });
}
await writeFile(path.join(output, "private-condition-key.json"), JSON.stringify(mapping, null, 2));
await writeFile(path.join(output, "score-template.json"), JSON.stringify(scores, null, 2));
await writeFile(path.join(output, "README.txt"), "Prepared references only: no generated outputs and no paid calls. Condition key is separate from scoring. Quality is a planned experiment setting, not a change to production defaults. Use actual observed durations/costs and reviewed output scores with quality:summary.\n");
console.log(`Prepared ${mapping.length} offline packets. Paid calls: 0. Output: ${path.resolve(output)}`);
