import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { parseComparisonManifest, type ComparisonManifest } from "./manifest";
import { resolveSplitOutfitRecipe } from "@/lib/split-outfit/generation";
import { hasPhotographedWaistcoat } from "@/lib/split-outfit/image-map";
import { buildSplitOutfitPrompt } from "@/lib/split-outfit/prompt";
import { grayscaleConstruction } from "@/lib/tryon/neutralize-construction";
import { validateImageFile } from "@/lib/validate-image";
import type { TryOnInput } from "@/lib/tryon/types";

/** Reads a local comparison manifest and validates every case and image. No provider or storage calls. */
export async function loadComparisonCases(filename: string): Promise<{ manifest: ComparisonManifest; inputs: { id: string; input: TryOnInput }[] }> {
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
  const inputs: { id: string; input: TryOnInput }[] = [];
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
  return { manifest, inputs };
}
