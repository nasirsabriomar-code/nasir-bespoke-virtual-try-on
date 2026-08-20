import assert from "node:assert/strict";
import test from "node:test";
import { AuthMergeError, mergeAuthUserBlobs } from "@/lib/auth/merge-users";

// Syntactically valid bcrypt-shaped fixture (never a real hash of any real
// password) — matches the same $2[aby]$NN$<53 chars> pattern lib/auth/config.ts
// enforces on the real allowlist.
const FIXTURE_HASH = `$2b$12$${"N".repeat(53)}`;

function blob(users: Array<Record<string, unknown>>): string {
  return Buffer.from(JSON.stringify(users)).toString("base64");
}

// ==== MERGE ====

test("merges two single-user blobs into one multi-user allowlist", () => {
  const managerBlob = blob([{ username: "manager1", displayName: "Manager One", passwordHash: FIXTURE_HASH, role: "MANAGER" }]);
  const tailorBlob = blob([{ username: "tailor1", displayName: "Tailor One", passwordHash: FIXTURE_HASH, role: "MASTER_TAILOR" }]);

  const merged = mergeAuthUserBlobs([managerBlob, tailorBlob]);
  const decoded = JSON.parse(Buffer.from(merged, "base64").toString("utf8"));

  assert.equal(decoded.length, 2);
  assert.deepEqual(
    decoded.map((u: { username: string }) => u.username).sort(),
    ["manager1", "tailor1"],
  );
});

test("accepts an already-merged multi-user blob alongside a new single-user blob", () => {
  const existing = blob([
    { username: "manager1", displayName: "Manager One", passwordHash: FIXTURE_HASH, role: "MANAGER" },
    { username: "staff1", displayName: "Staff One", passwordHash: FIXTURE_HASH, role: "STAFF" },
  ]);
  const newUser = blob([{ username: "qc1", displayName: "QC One", passwordHash: FIXTURE_HASH, role: "QC_STAFF" }]);

  const decoded = JSON.parse(Buffer.from(mergeAuthUserBlobs([existing, newUser]), "base64").toString("utf8"));
  assert.equal(decoded.length, 3);
});

test("last blob wins on a duplicate username (rotation)", () => {
  const first = blob([{ username: "manager1", displayName: "Manager One", passwordHash: FIXTURE_HASH, role: "MANAGER" }]);
  const second = blob([{ username: "manager1", displayName: "Manager One Renamed", passwordHash: FIXTURE_HASH, role: "MANAGER" }]);

  const decoded = JSON.parse(Buffer.from(mergeAuthUserBlobs([first, second]), "base64").toString("utf8"));
  assert.equal(decoded.length, 1);
  assert.equal(decoded[0].displayName, "Manager One Renamed");
});

test("an entry missing a role defaults to no role field (least privilege at read time)", () => {
  const noRole = blob([{ username: "plain1", displayName: "Plain One", passwordHash: FIXTURE_HASH }]);
  const decoded = JSON.parse(Buffer.from(mergeAuthUserBlobs([noRole]), "base64").toString("utf8"));
  assert.equal(decoded[0].role, undefined);
});

// ==== VALIDATION ====

test("rejects an entry with an invalid username", () => {
  const bad = blob([{ username: "Not Valid!", displayName: "X", passwordHash: FIXTURE_HASH, role: "STAFF" }]);
  assert.throws(() => mergeAuthUserBlobs([bad]), AuthMergeError);
});

test("rejects an entry whose passwordHash is not a bcrypt hash", () => {
  const bad = blob([{ username: "user1", displayName: "X", passwordHash: "plaintext-not-a-hash", role: "STAFF" }]);
  assert.throws(() => mergeAuthUserBlobs([bad]), AuthMergeError);
});

test("rejects an entry with an unknown role", () => {
  const bad = blob([{ username: "user1", displayName: "X", passwordHash: FIXTURE_HASH, role: "SUPERADMIN" }]);
  assert.throws(() => mergeAuthUserBlobs([bad]), AuthMergeError);
});

test("rejects a value that is not valid base64-encoded JSON", () => {
  assert.throws(() => mergeAuthUserBlobs(["not-base64-json!!"]), AuthMergeError);
});

test("rejects an empty array of blobs", () => {
  assert.throws(() => mergeAuthUserBlobs([]), AuthMergeError);
});

test("rejects a merge that would exceed the 50-user limit", () => {
  const many = Array.from({ length: 51 }, (_, i) => ({
    username: `user${i}`,
    displayName: `User ${i}`,
    passwordHash: FIXTURE_HASH,
    role: "STAFF",
  }));
  assert.throws(() => mergeAuthUserBlobs([blob(many)]), AuthMergeError);
});
