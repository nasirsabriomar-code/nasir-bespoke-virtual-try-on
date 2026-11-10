import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ImageGenerationConfig } from "@/lib/tryon/model-config";
import type { TryOnInput, TryOnProvider } from "@/lib/tryon/types";

export type RunCell = { caseId: string; conditionId: string; repeat: number; input: TryOnInput; config: ImageGenerationConfig };

const FABRIC_ROLES = ["fabric", "lowerFabric", "shirtFabric", "waistcoatFabric"] as const;

/** Every case × condition × repetition, with the condition's fabric treatment applied to each supplied cloth. */
export function planCells(cases: { id: string; input: TryOnInput }[], conditions: { id: string; config: ImageGenerationConfig }[], repetitions: number): RunCell[] {
  const cells: RunCell[] = [];
  for (const item of cases) for (const condition of conditions) for (let repeat = 1; repeat <= repetitions; repeat++) {
    const fabricGuidance = Object.fromEntries(FABRIC_ROLES.filter(role => item.input[role]).map(role => [role, { mode: condition.config.fabricTreatmentDefault }]));
    cells.push({ caseId: item.id, conditionId: condition.id, repeat, config: condition.config, input: { ...item.input, requestId: `${item.id}-${condition.id}-${repeat}`, fabricGuidance } });
  }
  return cells;
}

async function exists(file: string) {
  try { await access(file); return true; } catch { return false; }
}

/**
 * Generates each cell sequentially, writing every result as soon as it arrives.
 * A cell with an existing PNG or error record is skipped, so an interrupted run
 * never bills a finished cell twice. Delete a cell's `.error.json` to retry it.
 */
export async function runComparison(options: { cells: RunCell[]; outputDir: string; confirmPaid: boolean; providerFor: (config: ImageGenerationConfig) => TryOnProvider; log?: (line: string) => void }) {
  const { cells, outputDir, confirmPaid, providerFor, log = () => {} } = options;
  if (!confirmPaid) throw new Error(`Refusing to make ${cells.length} paid image calls without --confirm-paid.`);
  let called = 0, skipped = 0, failed = 0;
  for (const cell of cells) {
    const directory = path.join(outputDir, cell.caseId, cell.conditionId);
    const png = path.join(directory, `${cell.repeat}.png`);
    const metaFile = path.join(directory, `${cell.repeat}.json`);
    const errorFile = path.join(directory, `${cell.repeat}.error.json`);
    if (await exists(png) || await exists(errorFile)) { skipped++; continue; }
    await mkdir(directory, { recursive: true });
    called++;
    const started = Date.now();
    try {
      const output = await providerFor(cell.config).generate(cell.input);
      await writeFile(png, output.bytes);
      const meta = { caseId: cell.caseId, conditionId: cell.conditionId, repeat: cell.repeat, config: cell.config, ...output.metadata };
      await writeFile(metaFile, JSON.stringify(meta, null, 2));
      log(`ok ${cell.caseId}/${cell.conditionId}/${cell.repeat} ${output.metadata.durationMs}ms`);
    } catch (error) {
      failed++;
      const message = error instanceof Error ? error.message : String(error);
      await writeFile(errorFile, JSON.stringify({ caseId: cell.caseId, conditionId: cell.conditionId, repeat: cell.repeat, config: cell.config, durationMs: Date.now() - started, error: message.slice(0, 500) }, null, 2));
      log(`failed ${cell.caseId}/${cell.conditionId}/${cell.repeat}: ${message.slice(0, 200)}`);
    }
  }
  await writeScoreTemplate(cells, outputDir);
  return { called, skipped, failed };
}

/** Rebuilt from every finished cell on disk, so a resumed run keeps earlier rows. Staff fill accepted/scores/reasons. */
async function writeScoreTemplate(cells: RunCell[], outputDir: string) {
  const rows = [];
  for (const cell of cells) {
    const metaFile = path.join(outputDir, cell.caseId, cell.conditionId, `${cell.repeat}.json`);
    if (!await exists(metaFile)) continue;
    const meta = JSON.parse(await readFile(metaFile, "utf8")) as { durationMs: number; usage?: { inputTokens: number; outputTokens: number } };
    rows.push({ caseId: cell.caseId, condition: cell.conditionId, repeat: cell.repeat, accepted: null, durationMs: meta.durationMs, costUsd: null, scores: null, reasons: [], ...(meta.usage ? { inputTokens: meta.usage.inputTokens, outputTokens: meta.usage.outputTokens } : {}) });
  }
  if (rows.length) await writeFile(path.join(outputDir, "score-template.json"), JSON.stringify(rows, null, 2));
}
