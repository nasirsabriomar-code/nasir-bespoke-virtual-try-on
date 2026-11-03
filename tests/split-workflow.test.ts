import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile, readFile, mkdir, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import sharp from "sharp";
import { parseComparisonManifest, comparisonConditions } from "@/lib/evaluation/manifest";
import { DEFAULT_SPLIT_OUTFIT_STATE } from "@/lib/split-outfit/catalogue";
import { getSplitCatalogueView } from "@/lib/split-outfit/view";
import { parsePendingGeneration } from "@/lib/pending-generation";
import { parseReview } from "@/lib/history/review-types";
import { buildResultSummary } from "@/lib/result-summary";

const manifest = () => ({ version: 1, experiment: "fabric-treatment", repetitions: 1, cases: [{ id: "one", recipe: DEFAULT_SPLIT_OUTFIT_STATE, person: "fixture.png", fabrics: { fabric: "fixture.png", lowerFabric: "fixture.png" }, references: { "split-upper": "fixture.png", "split-lower": "fixture.png", "split-shirt": "fixture.png", "split-footwear": "fixture.png" } }] });
test("comparison conditions change one factor, and reject duplicate IDs and invalid bounds", () => {
  assert.equal(parseComparisonManifest(manifest()).cases.length, 1);
  assert.throws(() => parseComparisonManifest({ ...manifest(), cases: [...manifest().cases, ...manifest().cases] }));
  for (const repetitions of [0, 6, 1.5]) assert.throws(() => parseComparisonManifest({ ...manifest(), repetitions }));
  assert.equal(new Set(comparisonConditions("fabric-treatment").map(row => row.quality)).size, 1);
  assert.equal(new Set(comparisonConditions("quality").map(row => row.treatment)).size, 1);
});
test("submitted assignments survive pending recovery; legacy summaries still parse", () => {
  const summary = buildResultSummary({ mode: "split", splitOutfit: DEFAULT_SPLIT_OUTFIT_STATE, hasUploadedFabric: true, fabrics: { jacket: true, trousers: true }, trousersLinked: true });
  const pending = { key: crypto.randomUUID(), createdAt: Date.now(), summary };
  assert.deepEqual(parsePendingGeneration(JSON.stringify(pending))?.summary, summary);
  assert.match(summary.pieces![1].source, /Linked/);
  assert.equal(summary.pieces!.length, 4);
  assert.ok(parsePendingGeneration(JSON.stringify({ ...pending, summary: { garment: "Legacy", fabric: "Legacy", shoes: "Legacy" } })));
  assert.equal(parsePendingGeneration(JSON.stringify({ ...pending, summary: { ...summary, pieces: [{ label: 42 }] } })), null);
});
test("catalogue reports configured families without exposing private references", () => {
  const view = getSplitCatalogueView("suit");
  assert.deepEqual(view.families?.filter(item => item.configured).map(item => item.id), ["suit"]);
  assert.equal(view.families?.filter(item => !item.configured).length, 6);
  assert.doesNotMatch(JSON.stringify(view), /privatePath|checksum|constructionFragment/);
});
test("old and new feedback reasons are compatible and arbitrary reasons are rejected", () => {
  for (const reason of ["wrong-colour", "wrong-material", "changed-customer"]) assert.ok(parseReview({ decision: "rejected", favourite: false, reasons: [reason] }));
  assert.equal(parseReview({ decision: "rejected", favourite: false, reasons: ["invented"] }), null);
});
test("offline comparison produces production packets, refuses overwrites and escaping files, and reports missing outputs", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "bespoke-comparison-"));
  try {
    const fixture = await sharp({ create: { width: 640, height: 960, channels: 3, background: "navy" } }).png().toBuffer();
    await writeFile(path.join(root, "fixture.png"), fixture);
    await writeFile(path.join(root, "manifest.json"), JSON.stringify(manifest()));
    await writeFile(path.join(root, "no-network.mjs"), 'globalThis.fetch = () => { throw new Error("Offline tool attempted network access"); };');
    const env = { ...process.env };
    for (const key of Object.keys(env)) if (/^(DATABASE_|UPSTASH_|NASIR_|R2_|OPENAI_|AUTH_|BLOB_)/.test(key)) delete env[key];
    const run = (script: string, args: string[]) => spawnSync(process.execPath, ["--import=tsx", `--import=${path.join(root, "no-network.mjs")}`, script, ...args], { cwd: process.cwd(), env, encoding: "utf8" });
    const output = path.join(root, "prepared");
    const prepared = run("scripts/prepare-outfit-comparison.mts", [path.join(root, "manifest.json"), output]);
    assert.equal(prepared.status, 0, prepared.stderr);
    const first = JSON.parse(await readFile(path.join(output, "one-A-1", "packet.json"), "utf8"));
    const second = JSON.parse(await readFile(path.join(output, "one-B-1", "packet.json"), "utf8"));
    assert.equal(first.paidCallsMade, 0);
    assert.equal(first.files[0].name, "1-person-reference.png");
    assert.equal(second.files.length, first.files.length + 2);
    assert.match(first.prompt, /FINAL INPUT MANIFEST/);
    assert.match(first.prompt, /EDIT REGION/);
    assert.equal(first.quality, second.quality);
    assert.equal(first.size, second.size);
    assert.notEqual(run("scripts/prepare-outfit-comparison.mts", [path.join(root, "manifest.json"), output]).status, 0);
    const report = run("scripts/report-outfit-comparison.mts", [output]);
    assert.equal(report.status, 0, report.stderr);
    assert.match(await readFile(path.join(output, "comparison.html"), "utf8"), /No generated output supplied/);
    await writeFile(path.join(output, "one-A-1", "generated.png"), fixture);
    assert.equal(run("scripts/report-outfit-comparison.mts", [output, "review.html"]).status, 0);
    assert.match(await readFile(path.join(output, "review.html"), "utf8"), /one-A-1\/generated.png/);
    await mkdir(path.join(root, "confined"));
    await symlink(path.join(root, "fixture.png"), path.join(root, "confined", "fixture.png"));
    await writeFile(path.join(root, "confined", "manifest.json"), JSON.stringify(manifest()));
    const escaped = run("scripts/prepare-outfit-comparison.mts", [path.join(root, "confined", "manifest.json"), path.join(root, "escaped")]);
    assert.notEqual(escaped.status, 0);
    assert.match(escaped.stderr, /escapes/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
