import assert from "node:assert/strict";
import test from "node:test";
import { addSessionResult, recoveryMatchesCustomer, referencesForSessionResult, releaseSessionResults, submissionSwatches, SESSION_RESULT_LIMIT, type SessionResult } from "@/lib/session-results";

const item = (id: string, owned: string[] = []): SessionResult => ({ id, resultUrl: `r${id}`, originalUrl: `o${id}`, summary: { garment: "g", fabric: "f", shoes: "s" }, swatches: {}, ownedUrls: owned, recovered: false });

test("results append newest last and drop the oldest beyond the limit", () => {
  const revoked: string[] = [];
  let list: SessionResult[] = [];
  for (let i = 0; i <= SESSION_RESULT_LIMIT; i++) list = addSessionResult(list, item(String(i), [`blob:${i}`]), u => revoked.push(u));
  assert.equal(list.length, 6);
  assert.deepEqual([list[0].id, list[5].id, revoked], ["1", "6", ["blob:0"]]);
});

test("release revokes every owned url", () => {
  const revoked: string[] = [];
  assert.deepEqual(releaseSessionResults([item("a", ["blob:a"]), item("b", ["blob:b1", "blob:b2"])], u => revoked.push(u)), []);
  assert.deepEqual(revoked, ["blob:a", "blob:b1", "blob:b2"]);
});

test("stored history assets are used when a history id exists", () => {
  const out = submissionSwatches({ historyId: "h1", files: { jacket: new File([], "j"), shirt: new File([], "s") }, trousersLinked: true, createUrl: () => "blob:x" });
  assert.deepEqual(out, { swatches: { jacket: "/api/history/h1/asset/fabric", trousers: "/api/history/h1/asset/fabric", shirt: "/api/history/h1/asset/shirt-fabric" }, ownedUrls: [] });
});

test("session swatches survive later fabric changes", () => {
  let n = 0;
  const out = submissionSwatches({ files: { jacket: new File([], "j") }, trousersLinked: false, createUrl: () => `blob:own${n++}` });
  assert.deepEqual(out, { swatches: { jacket: "blob:own0" }, ownedUrls: ["blob:own0"] });
});

test("linked trousers without a history id share the jacket's owned url", () => {
  let n = 0;
  const out = submissionSwatches({ files: { jacket: new File([], "j") }, trousersLinked: true, createUrl: () => `blob:own${n++}` });
  assert.deepEqual(out, { swatches: { jacket: "blob:own0", trousers: "blob:own0" }, ownedUrls: ["blob:own0"] });
});

test("recovered results carry no swatches", () => {
  assert.deepEqual(submissionSwatches({ files: {}, trousersLinked: false, createUrl: () => "blob:never" }), { swatches: {}, ownedUrls: [] });
});

test("recovered results contribute no comparison references", () => {
  assert.deepEqual(referencesForSessionResult({ ...item("r"), recovered: true, swatches: {} }), []);
});

test("comparison references come from the result's own swatches, linked trousers once", () => {
  const refs = referencesForSessionResult({ ...item("s"), swatches: { jacket: "/a/fabric", trousers: "/a/fabric", shirt: "/a/shirt-fabric" }, summary: { garment: "g", fabric: "f", shoes: "s", pieces: [{ label: "Trousers", design: "N", source: "Linked jacket cloth", cloth: "linked-to-jacket" }] } });
  assert.deepEqual(refs, [{ label: "Jacket fabric", url: "/a/fabric" }, { label: "Shirt fabric", url: "/a/shirt-fabric" }]);
});

test("a recovered result belongs to the current customer only when the photo matches", () => {
  assert.equal(recoveryMatchesCustomer("blob:a", null), true);
  assert.equal(recoveryMatchesCustomer(undefined, null), true);
  assert.equal(recoveryMatchesCustomer("blob:a", "blob:a"), true);
  assert.equal(recoveryMatchesCustomer("blob:a", "blob:b"), false);
  assert.equal(recoveryMatchesCustomer(undefined, "blob:b"), false);
});
