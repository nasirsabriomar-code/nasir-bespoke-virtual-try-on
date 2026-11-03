import { readFile, writeFile, access, realpath } from "node:fs/promises";
import path from "node:path";
const [directory, filename = "comparison.html"] = process.argv.slice(2);
if (!directory || process.argv.length > 4 || path.basename(filename) !== filename) throw new Error("Usage: npm run quality:report -- RUN_DIRECTORY [NEW_REPORT_FILENAME.html]");
const root = await realpath(directory);
const runs: unknown = JSON.parse(await readFile(path.join(root, "private-condition-key.json"), "utf8"));
if (!Array.isArray(runs) || runs.length > 500 || runs.some(row => !row || !/^[a-zA-Z0-9_-]{1,100}$/.test(row.runId) || !/^[a-zA-Z0-9_-]{1,80}$/.test(row.caseId) || !["A", "B"].includes(row.id) || !Number.isInteger(row.repeat))) throw new Error("Invalid prepared run key.");
const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
let body = "";
for (const caseId of new Set(runs.map(row => row.caseId))) {
  body += `<section><h2>${escape(caseId)}</h2><div class="pair">`;
  for (const run of runs.filter(row => row.caseId === caseId)) {
    const relative = `${run.runId}/generated.png`;
    let present = false;
    try {
      const actual = await realpath(path.join(root, relative));
      if (!actual.startsWith(root + path.sep)) throw new Error("Output image escapes run directory.");
      await access(actual); present = true;
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    body += `<article><h3>Condition ${run.id} · Repetition ${run.repeat}</h3>${present ? `<img src="${relative}" alt="${escape(caseId)} condition ${run.id} result">` : '<p class="missing">No generated output supplied. This is an offline prepared case, not an accuracy result.</p>'}<p>Run: ${escape(run.runId)}</p><fieldset><legend>Review notes (not saved)</legend><label>Acceptable? <select><option>Not reviewed</option><option>Yes</option><option>No</option></select></label><p>Score scale, colour, construction, background and identity from 1–5 in score-template.json. Record actual duration and observed cost; leave unknown cost null.</p></fieldset></article>`;
  }
  body += "</div></section>";
}
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Outfit comparison</title><style>body{font:16px system-ui;max-width:1400px;margin:auto;padding:24px;background:#f5f4f0;color:#202020}.pair{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:20px}article{background:white;padding:20px;border:1px solid #aaa}img{width:100%;height:auto}fieldset{margin-top:20px}.missing{padding:48px 12px;background:#eee}section{margin-bottom:40px}</style><h1>Outfit comparison</h1><p>Conditions are blinded here. Keep private-condition-key.json separate until scoring. Missing images are never represented as successful generations. Review controls are scratch notes only; save scored results in JSON for quality:summary.</p>${body}</html>`;
await writeFile(path.join(root, filename), html, { flag: "wx" });
console.log(`Created ${path.join(root, filename)}. No provider calls.`);
