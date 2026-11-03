import { readFile } from "node:fs/promises";
import { summarizeEvaluations } from "../lib/evaluation/summary";

const filename = process.argv[2];
if (!filename || process.argv.length !== 3) throw new Error("Usage: npm run quality:summary -- /absolute/path/to/scored-results.json");
// Deliberately offline: scores and observed costs must be supplied, never guessed
// from requested quality or inferred from a provider response that lacks billing.
const rows = JSON.parse(await readFile(filename, "utf8"));
console.log(JSON.stringify({ kind: "observed-evaluation-summary", conditions: summarizeEvaluations(rows) }, null, 2));
