import assert from "node:assert/strict";
import test from "node:test";
import { validateCatalogSelection } from "@/lib/catalog/compatibility";
import { ACCESSORIES, GARMENT_BLUEPRINTS } from "@/lib/catalog/seed";
import { buildTryOnPrompt } from "@/lib/tryon/prompt";

const getBlueprint = (id: string) => {
  const blueprint = GARMENT_BLUEPRINTS.find((item) => item.id === id);
  assert.ok(blueprint, `missing blueprint ${id}`);
  return blueprint;
};

const getAccessory = (id: string) => {
  const accessory = ACCESSORIES.find((item) => item.id === id);
  assert.ok(accessory, `missing accessory ${id}`);
  return accessory;
};

test("V1 catalog is explicitly men's-only and has visual references for every active option", () => {
  assert.ok(GARMENT_BLUEPRINTS.length >= 12);
  assert.ok(ACCESSORIES.some((item) => item.id === "turban-none"));
  assert.ok(ACCESSORIES.some((item) => item.id === "shoes-keep-existing"));
  for (const item of [...GARMENT_BLUEPRINTS, ...ACCESSORIES]) {
    assert.equal(item.gender, "menswear");
    assert.ok(item.displayReference.path.startsWith("/catalog/"));
    assert.ok(item.aiReferences.every((reference) => reference.path.startsWith("/catalog/")));
  }
  assert.equal(GARMENT_BLUEPRINTS.some((item) => /women|dress|gown|skirt/i.test(`${item.name} ${item.description}`)), false);
});

test("linked Kurta Pajama and three-piece suit selections validate without an independent lower choice", () => {
  const turban = getAccessory("turban-none");
  const shoes = getAccessory("shoes-keep-existing");
  const kurta = getBlueprint("kurta-pajama");
  const pajama = getBlueprint("mens-pajama-classic");
  validateCatalogSelection({ upper: kurta, lower: pajama, turban, shoes });

  const suit = getBlueprint("suit-base");
  const threePiece = getBlueprint("suit-three-piece");
  validateCatalogSelection({ upper: suit, subtype: threePiece, lower: getBlueprint("trousers-tailored"), turban, shoes });
});

test("prompt composer is deterministic, men's-only, and maps reference roles", () => {
  const prompt = buildTryOnPrompt({
    upper: getBlueprint("suit-base"),
    subtype: getBlueprint("suit-three-piece"),
    lower: getBlueprint("trousers-tailored"),
    turban: getAccessory("turban-none"),
    shoes: getAccessory("shoes-oxford"),
  }, { outfitProvided: true });
  assert.match(prompt, /NASIR BESPOKE/i);
  assert.match(prompt, /exclusively men's clothing/i);
  assert.match(prompt, /Image 1 — male customer/i);
  assert.match(prompt, /Image 2 — customer-supplied outfit construction/i);
  assert.match(prompt, /Image 3 — physical showroom fabric/i);
  assert.match(prompt, /Image 4 — selected upper/i);
  assert.match(prompt, /This is an edit of Image 1/i);
  assert.match(prompt, /do not reproduce.*reference image's person/i);
  assert.match(prompt, /same photograph of the same person in the same place/i);
  assert.match(prompt, /Image 5 — independently selected men's lower/i);
  assert.match(prompt, /Image 6 — selected men's suit subtype/i);
  assert.match(prompt, /Oxford/i);
  assert.match(prompt, /Do not add a turban/i);
});

test("prompt composer supports outfit-only mode and catalog mode without an outfit", () => {
  const outfitPrompt = buildTryOnPrompt(undefined, { outfitProvided: true });
  assert.match(outfitPrompt, /OUTFIT-ONLY MODE/);
  assert.match(outfitPrompt, /Image 2 — customer-supplied outfit construction/);
  assert.match(outfitPrompt, /Image 3 — physical showroom fabric/);
  assert.doesNotMatch(outfitPrompt, /SELECTED TURBAN/);

  const catalogPrompt = buildTryOnPrompt({
    upper: getBlueprint("coat-blazer"),
    lower: getBlueprint("trousers-tailored"),
    turban: getAccessory("turban-none"),
    shoes: getAccessory("shoes-keep-existing"),
  }, { outfitProvided: false });
  assert.match(catalogPrompt, /Image 2 — physical showroom fabric/);
  assert.match(catalogPrompt, /Image 3 — selected upper/);
  assert.doesNotMatch(catalogPrompt, /customer-supplied outfit construction/);
});


test("trousers-tailored is compatible with suit and kurta and invalid lower/subtype IDs fail closed", async () => {
  const { findCatalogSelection } = await import("@/lib/catalog/store");
  const tailored = getBlueprint("trousers-tailored");
  assert.ok(tailored.compatibleCategories?.includes("suit"));
  assert.ok(tailored.compatibleCategories?.includes("kurta"));

  const suit = getBlueprint("suit-base");
  assert.doesNotThrow(() => validateCatalogSelection({
    upper: suit,
    lower: tailored,
    turban: getAccessory("turban-none"),
    shoes: getAccessory("shoes-oxford"),
  }));

  assert.equal(await findCatalogSelection({ upperGarmentId: "suit-base", lowerGarmentId: "nonexistent-lower", turbanId: "turban-none", shoeId: "shoes-oxford" }), null);
  assert.equal(await findCatalogSelection({ upperGarmentId: "suit-base", garmentSubtypeId: "nonexistent-subtype", turbanId: "turban-none", shoeId: "shoes-oxford" }), null);
});
