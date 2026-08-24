import assert from "node:assert/strict";
import test from "node:test";
import { SIGNATURE_LOOK_LIBRARY } from "@/lib/showroom/look-library";
import { recommendSignatureLooks } from "@/lib/showroom/recommendation-engine";
import { MAX_RECOMMENDATIONS } from "@/lib/showroom/scoring-config";
import type { RecommendationProfile, SignatureLook } from "@/lib/showroom/types";

test("Business + Executive: The Boardroom Authority ranks first and strongly", () => {
  const profile: RecommendationProfile = { occasion: "business", stylePersonality: "executive", formality: 4 };
  const results = recommendSignatureLooks(profile, SIGNATURE_LOOK_LIBRARY);
  assert.ok(results.length > 0);
  assert.equal(results[0].look.id, "LOOK_SUIT_BOARDROOM_AUTHORITY");
  assert.ok(results[0].score >= 90, `expected a strong match, got ${results[0].score}`);
});

test("Black Tie + Black Tie: The Black Tie ranks first", () => {
  const profile: RecommendationProfile = { occasion: "black-tie", stylePersonality: "black-tie", formality: 5 };
  const results = recommendSignatureLooks(profile, SIGNATURE_LOOK_LIBRARY);
  assert.equal(results[0].look.id, "LOOK_SUIT_BLACK_TIE");
  assert.ok(results[0].score >= 90);
});

test("Wedding + Classic: The Three-Piece Gentleman ranks first and strongly", () => {
  const profile: RecommendationProfile = { occasion: "wedding", stylePersonality: "classic", formality: 4 };
  const results = recommendSignatureLooks(profile, SIGNATURE_LOOK_LIBRARY);
  assert.equal(results[0].look.id, "LOOK_SUIT_THREE_PIECE_GENTLEMAN");
  assert.ok(results[0].score >= 90);
});

test("Celebration + Modern Statement: The Statement Evening ranks first and strongly", () => {
  const profile: RecommendationProfile = { occasion: "celebration", stylePersonality: "modern-statement", formality: 4 };
  const results = recommendSignatureLooks(profile, SIGNATURE_LOOK_LIBRARY);
  assert.equal(results[0].look.id, "LOOK_SUIT_STATEMENT_EVENING");
  assert.ok(results[0].score >= 90);
});

test("the same profile against the same library always returns the same order (deterministic, no randomness)", () => {
  const profile: RecommendationProfile = { occasion: "reception", stylePersonality: "classic", formality: 3 };
  const first = recommendSignatureLooks(profile, SIGNATURE_LOOK_LIBRARY).map((r) => r.look.id);
  const second = recommendSignatureLooks(profile, SIGNATURE_LOOK_LIBRARY).map((r) => r.look.id);
  const third = recommendSignatureLooks(profile, SIGNATURE_LOOK_LIBRARY).map((r) => r.look.id);
  assert.deepEqual(first, second);
  assert.deepEqual(second, third);
});

test("never returns more than MAX_RECOMMENDATIONS (3) results", () => {
  const profile: RecommendationProfile = { occasion: "reception", stylePersonality: "classic", formality: 3 };
  const results = recommendSignatureLooks(profile, SIGNATURE_LOOK_LIBRARY);
  assert.ok(results.length <= MAX_RECOMMENDATIONS);
  assert.equal(MAX_RECOMMENDATIONS, 3);
});

test("a lower rankPriority (curated higher priority) ranks first among otherwise-equally-matched looks, not by id", () => {
  // Two looks with identical occasion/style/formality match (so identical
  // occasion/style/formality score contributions) but different rankPriority
  // and ids that would sort in the OPPOSITE order alphabetically — proving
  // the ordering is driven by rankPriority, not incidental id ordering.
  const base = SIGNATURE_LOOK_LIBRARY.find((look) => look.id === "LOOK_SUIT_CLASSIC_GENTLEMAN")!;
  const lowerPriority: SignatureLook = { ...base, id: "Z_LOOK_LOWER_PRIORITY_NUMBER", rankPriority: 1 };
  const higherPriority: SignatureLook = { ...base, id: "A_LOOK_HIGHER_PRIORITY_NUMBER", rankPriority: 2 };

  const profile: RecommendationProfile = { occasion: base.occasions[0], stylePersonality: base.stylePersonality, formality: base.formality };
  const results = recommendSignatureLooks(profile, [lowerPriority, higherPriority]);

  assert.equal(results[0].look.id, "Z_LOOK_LOWER_PRIORITY_NUMBER", "lower rankPriority (1) must rank first despite sorting later alphabetically");
  assert.equal(results[1].look.id, "A_LOOK_HIGHER_PRIORITY_NUMBER");
  assert.ok(results[0].score > results[1].score);
});

test("tie-break falls back to look id when rankPriority is also equal", () => {
  const base = SIGNATURE_LOOK_LIBRARY.find((look) => look.id === "LOOK_SUIT_CLASSIC_GENTLEMAN")!;
  const lookB: SignatureLook = { ...base, id: "LOOK_TEST_TIE_B", rankPriority: 10 };
  const lookA: SignatureLook = { ...base, id: "LOOK_TEST_TIE_A", rankPriority: 10 };

  const profile: RecommendationProfile = { occasion: base.occasions[0], stylePersonality: base.stylePersonality, formality: base.formality };
  const results = recommendSignatureLooks(profile, [lookB, lookA]);

  assert.equal(results[0].score, results[1].score);
  assert.equal(results[0].look.id, "LOOK_TEST_TIE_A");
  assert.equal(results[1].look.id, "LOOK_TEST_TIE_B");
});

test("reasons correspond only to matched declared profile fields — never fabricated", () => {
  const profile: RecommendationProfile = { occasion: "business", stylePersonality: "executive", formality: 4 };
  const results = recommendSignatureLooks(profile, SIGNATURE_LOOK_LIBRARY);

  const boardroom = results.find((r) => r.look.id === "LOOK_SUIT_BOARDROOM_AUTHORITY")!;
  assert.ok(boardroom.reasons.some((reason) => reason.toLowerCase().includes("business")));
  assert.ok(boardroom.reasons.some((reason) => reason.toLowerCase().includes("executive")));
  assert.ok(boardroom.reasons.some((reason) => reason.toLowerCase().includes("formality")));
  assert.ok(boardroom.reasons.length <= 3);

  const classic = results.find((r) => r.look.id === "LOOK_SUIT_CLASSIC_GENTLEMAN");
  if (classic) {
    // Classic's stylePersonality is "classic", not "executive" — no style-match reason should appear.
    assert.ok(!classic.reasons.some((reason) => reason.toLowerCase().includes("executive")));
  }

  for (const reason of boardroom.reasons) {
    const lower = reason.toLowerCase();
    for (const forbidden of ["body", "age", "skin", "attractive", "wealth", "social status", "ethnic"]) {
      assert.ok(!lower.includes(forbidden), `reason must never reference "${forbidden}": ${reason}`);
    }
  }
});

test("recommendSignatureLooks only accepts a declared profile and a look library — it never receives customer image/person data", () => {
  assert.equal(recommendSignatureLooks.length, 2);
});

test("an inactive look never appears in recommendations, even if it would otherwise score highest", () => {
  const base = SIGNATURE_LOOK_LIBRARY.find((look) => look.id === "LOOK_SUIT_BLACK_TIE")!;
  const draftClone: SignatureLook = { ...base, id: "LOOK_TEST_DRAFT_BLACK_TIE", status: "draft", rankPriority: 0 };
  const profile: RecommendationProfile = { occasion: "black-tie", stylePersonality: "black-tie", formality: 5 };

  const results = recommendSignatureLooks(profile, [...SIGNATURE_LOOK_LIBRARY, draftClone]);
  assert.ok(!results.some((r) => r.look.id === draftClone.id));
});
