import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
// Deterministic technical fixtures, not photorealistic quality evidence or customer data.
const directory = path.resolve(".cache/quality-baseline");
await mkdir(directory, { recursive: true });
const cases = [];
async function writeCase({ id, pattern, declaredRepeatCm, fieldWidthCm, capturePair = null, captureContext }) {
  const repeat = declaredRepeatCm === null ? null : 1000 * declaredRepeatCm / fieldWidthCm;
  // Scale stroke widths with the photographed field, so a close view of the
  // same cloth enlarges the lines as well as their spacing.
  const stroke = (pattern === "stripes" ? .4 : .3) * 1000 / fieldWidthCm;
  const motif = pattern === "plain" ? ""
    : pattern === "checks" ? `<path d="M0 0H${repeat}V${repeat}" fill="none" stroke="#ddd" stroke-width="${stroke}"/>`
    : pattern === "stripes" ? `<path d="M0 0V${repeat}" stroke="#ddd" stroke-width="${stroke}"/>`
    : `<circle cx="${repeat/2}" cy="${repeat/2}" r="${repeat/8}" fill="#ccc"/>`;
  const overlay = motif ? `<defs><pattern id="p" width="${repeat}" height="${repeat}" patternUnits="userSpaceOnUse">${motif}</pattern></defs><rect width="1000" height="1000" fill="url(#p)"/>` : "";
  const svg = `<svg width="1000" height="1000" xmlns="http://www.w3.org/2000/svg"><rect width="1000" height="1000" fill="#26384d"/>${overlay}</svg>`;
  const full = await sharp(Buffer.from(svg)).png().toBuffer();
  const detail = await sharp(full).extract({ left: 250, top: 250, width: 500, height: 500 }).png().toBuffer();
  const fullReference = `${id}-full.png`, detailReference = `${id}-detail.png`;
  await writeFile(path.join(directory, fullReference), full);
  await writeFile(path.join(directory, detailReference), detail);
  cases.push({ id, pattern, fullReference, detailReference, fullSha256: createHash("sha256").update(full).digest("hex"), detailSha256: createHash("sha256").update(detail).digest("hex"), repeatPixelsInFullReference: repeat, declaredRepeatCm, fieldWidthCm, capturePair, captureContext, customerImage: null, garmentFamily: null, scores: null });
}
for (const pattern of ["checks", "stripes", "motifs"]) {
  for (const size of ["small", "large"]) {
    await writeCase({ id: `${pattern}-${size}`, pattern, declaredRepeatCm: size === "small" ? 4 : 10, fieldWidthCm: 100, capturePair: size === "small" ? `${pattern}-4cm` : null, captureContext: "wide" });
  }
  await writeCase({ id: `${pattern}-same-cloth-close`, pattern, declaredRepeatCm: 4, fieldWidthCm: 40, capturePair: `${pattern}-4cm`, captureContext: "close" });
}
await writeCase({ id: "plain-navy", pattern: "plain", declaredRepeatCm: null, fieldWidthCm: 100, captureContext: "plain-control" });
await writeFile(path.join(directory, "manifest.json"), JSON.stringify({ version: 2, recipeVersion: "procedural-fabric-v2", renderer: { sharp: sharp.versions.sharp, vips: sharp.versions.vips }, purpose: "technical calibration fixtures; no generated-output quality scores exist", paidCallsMade: 0, pilot: { authorized: false, selectedCaseIds: [], callsPlanned: null }, historicalProposal: { cases: 6, conditions: 2, repetitions: 2, calls: 24, approved: false }, conditions: ["legacy-centre-crop", "full-swatch-plus-detail"], cases }, null, 2));
console.log(`Prepared ${cases.length} deterministic swatch cases and ${cases.length * 2} PNG references under .cache/quality-baseline, including same-cloth capture pairs and a plain control. Add approved person/garment fixtures before visual evaluation; no API calls made or authorized.`);
