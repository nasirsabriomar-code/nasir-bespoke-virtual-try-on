import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { resolveRunConditions } from "../lib/evaluation/manifest";
import { loadComparisonCases } from "../lib/evaluation/cases";
import { planCells } from "../lib/evaluation/runner";
import { prepareProviderPacket } from "../lib/tryon/providers/openai";

// Offline only. No provider or storage calls are made: references must be local approved files.
const [filename, output] = process.argv.slice(2);
if (!filename || !output || process.argv.length !== 4) throw new Error("Usage: npm run quality:prepare-outfit -- manifest.json NEW_OUTPUT_DIRECTORY");
// Validate every case and image before creating an immutable output directory.
const { manifest, inputs } = await loadComparisonCases(filename);
await mkdir(path.dirname(path.resolve(output)), { recursive: true });
await mkdir(output); // Refuse overwrite, including an existing empty run directory.
const mapping = [];
const scores = [];
for (const cell of planCells(inputs, resolveRunConditions(manifest), manifest.repetitions)) {
  const runId = `${cell.caseId}-${cell.conditionId}-${cell.repeat}`;
  const directory = path.join(output, runId);
  await mkdir(directory);
  const prepared = await prepareProviderPacket(cell.input, cell.config);
  const files = [];
  for (const [index, part] of prepared.parts.entries()) {
    const name = `${index + 1}-${part.stem}.${part.image.mime === "image/png" ? "png" : part.image.mime === "image/webp" ? "webp" : "jpg"}`;
    const bytes = new Uint8Array(await part.image.file.arrayBuffer());
    await writeFile(path.join(directory, name), bytes);
    files.push({ index: index + 1, name, sha256: createHash("sha256").update(bytes).digest("hex") });
  }
  await writeFile(path.join(directory, "packet.json"), JSON.stringify({ runId, model: cell.config.model, quality: cell.config.quality, config: cell.config, size: prepared.requestedSize, prompt: prepared.providerPrompt, preprocessingVersion: "production-packet-v1", fabricGuidance: prepared.guidance, files, paidCallsMade: 0, status: "prepared-only" }, null, 2));
  mapping.push({ runId, caseId: cell.caseId, id: cell.conditionId, config: cell.config, repeat: cell.repeat });
  scores.push({ caseId: cell.caseId, condition: cell.conditionId, runId, accepted: null, durationMs: null, costUsd: null, scores: null });
}
await writeFile(path.join(output, "private-condition-key.json"), JSON.stringify(mapping, null, 2));
await writeFile(path.join(output, "score-template.json"), JSON.stringify(scores, null, 2));
await writeFile(path.join(output, "README.txt"), "Prepared references only: no generated outputs and no paid calls. Condition key is separate from scoring. Quality is a planned experiment setting, not a change to production defaults. Use actual observed durations/costs and reviewed output scores with quality:summary.\n");
console.log(`Prepared ${mapping.length} offline packets. Paid calls: 0. Output: ${path.resolve(output)}`);
