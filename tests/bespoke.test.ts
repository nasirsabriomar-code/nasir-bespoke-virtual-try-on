import assert from "node:assert/strict";
import test from "node:test";
import { BESPOKE_CONFIGURATION_PROFILES } from "@/lib/bespoke/suit-profile";
import {
  BespokeConfigurationError,
  buildOutfitSpecification,
  compileVisualizationPrompt,
  resolveBespokeConfiguration,
} from "@/lib/bespoke/engine";
import { CATALOG_SEED } from "@/lib/catalog/seed";

const profile = BESPOKE_CONFIGURATION_PROFILES[0]!;
const catalogSelection = {
  upper: CATALOG_SEED.blueprints.find((item) => item.id === "suit-base")!,
  subtype: CATALOG_SEED.blueprints.find((item) => item.id === "suit-three-piece")!,
  turban: CATALOG_SEED.accessories.find((item) => item.id === "turban-none")!,
  shoes: CATALOG_SEED.accessories.find((item) => item.id === "shoes-oxford")!,
};

function selections(overrides: Record<string, string>) {
  const result = { ...overrides };
  for (const group of profile.groups) if (group.defaultOptionId && result[group.id] === undefined) result[group.id] = group.defaultOptionId;
  return result;
}

test("three-piece double-breasted suit creates a complete controlled outfit specification", () => {
  const configuration = resolveBespokeConfiguration(profile, {
    profileId: profile.id,
    selections: selections({
      "suit-composition": "suit-three-piece", "jacket-closure": "double-breasted", "jacket-buttons": "six-by-two",
      "jacket-fit": "tailored-fit", "lapel-type": "peak-lapel", "lapel-width": "wide-lapel",
      "shoulder-construction": "structured-shoulder", "hip-pockets": "jetted-hip", "vents": "double-vents",
      "sleeve-button-count": "four-sleeve-buttons", "trouser-rise": "high-rise", "trouser-pleats": "single-pleat",
      "trouser-waistband": "side-adjusters", "shoe-family": "shoes-oxford", "turban-family": "turban-none",
    }),
  });
  assert.equal(configuration.selections["jacket-buttons"], "six-by-two");
  assert.ok(configuration.options.some((item) => item.groupId === "waistcoat-closure"));
  const specification = buildOutfitSpecification(catalogSelection, configuration);
  assert.equal(specification.garment.subtypeName, "Three-Piece Suit");
  const prompt = compileVisualizationPrompt("BASE", specification, configuration);
  assert.match(prompt, /JACKET:/);
  assert.match(prompt, /6×2 double-breasted/);
  assert.match(prompt, /WAISTCOAT:/);
  assert.match(prompt, /Do not omit the waistcoat/);
});

test("two-piece suit removes inactive waistcoat configuration from the resolved specification", () => {
  const configuration = resolveBespokeConfiguration(profile, {
    profileId: profile.id,
    selections: selections({ "suit-composition": "suit-two-piece", "waistcoat-closure": "waistcoat-double", "shoe-family": "shoes-loafer", "turban-family": "turban-none" }),
  });
  assert.equal(configuration.selections["waistcoat-closure"], undefined);
  assert.ok(!configuration.options.some((item) => item.section === "waistcoat"));
});

test("incompatible double-breasted button layout is rejected before compilation", () => {
  assert.throws(() => resolveBespokeConfiguration(profile, {
    profileId: profile.id,
    selections: { "suit-composition": "suit-two-piece", "jacket-closure": "single-breasted", "jacket-buttons": "six-by-two" },
  }), BespokeConfigurationError);
});

test("all active bespoke options remain visual and controlled", () => {
  for (const group of profile.groups) for (const option of group.options) {
    assert.ok(option.thumbnail.path.startsWith("/catalog/"));
    assert.ok(option.promptFragment.length > 5);
    if (option.priority !== "non-visual") assert.ok(option.visibleIn.length > 0);
  }
});
