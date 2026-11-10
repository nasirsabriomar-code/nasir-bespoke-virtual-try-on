import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { resolveRunConditions } from "../lib/evaluation/manifest";
import { loadComparisonCases } from "../lib/evaluation/cases";
import { planCells, runComparison } from "../lib/evaluation/runner";
import { OpenAITryOnProvider } from "../lib/tryon/providers/openai";

// PAID: every cell is one OpenAI image edit. Nothing is called unless --confirm-paid is passed.
const args = process.argv.slice(2);
const confirmPaid = args.includes("--confirm-paid");
const [filename, output] = args.filter(arg => arg !== "--confirm-paid");
if (!filename || !output || args.length > 3) throw new Error("Usage: npm run quality:run -- manifest.json OUTPUT_DIRECTORY [--confirm-paid]");

const { manifest, inputs } = await loadComparisonCases(filename);
const conditions = resolveRunConditions(manifest);
const cells = planCells(inputs, conditions, manifest.repetitions);
console.log(`${inputs.length} cases × ${conditions.length} conditions × ${manifest.repetitions} repetitions = ${cells.length} paid image calls (cells already on disk are skipped).`);
for (const condition of conditions) console.log(`  ${condition.id}: ${JSON.stringify(condition.config)}`);
if (!confirmPaid) {
  console.log("Dry run only. Re-run with --confirm-paid after the owner approves this call count.");
  process.exit(1);
}

await mkdir(output, { recursive: true });
// The condition key stays outside the per-cell folders so reviewers can score blind by condition letter.
await writeFile(path.join(output, "private-condition-key.json"), JSON.stringify(conditions, null, 2));
const result = await runComparison({ cells, outputDir: output, confirmPaid, providerFor: config => new OpenAITryOnProvider(undefined, config), log: line => console.log(line) });
console.log(`Done. Called ${result.called}, skipped ${result.skipped}, failed ${result.failed}. Score ${path.resolve(output, "score-template.json")} then run quality:summary.`);
