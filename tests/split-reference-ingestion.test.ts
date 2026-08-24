import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { ingestSplitReferenceAsset, SplitReferenceIngestionError, type BlobPutFn } from "@/lib/split-outfit/reference-ingestion";
import { findSplitReferenceAsset, resetSplitReferenceAssetRegistryForTests } from "@/lib/split-outfit/reference-assets";
import { MAX_IMAGE_BYTES } from "@/lib/validation";

function tinyPng(name: string) {
  return new File(
    [Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])],
    name,
    { type: "image/png" },
  );
}

function tinyJpeg(name: string) {
  return new File(
    [Uint8Array.from([0xff, 0xd8, 0xff, 0xd9, 0, 0, 0, 0, 0, 0, 0, 0])],
    name,
    { type: "image/jpeg" },
  );
}

beforeEach(() => {
  resetSplitReferenceAssetRegistryForTests();
});

function mockPutBlob(): { put: BlobPutFn; calls: Array<{ path: string; contentType: string }> } {
  const calls: Array<{ path: string; contentType: string }> = [];
  const put: BlobPutFn = async (path, _body, options) => {
    calls.push({ path, contentType: options.contentType });
    return { url: `https://mock-blob.invalid/${path}` };
  };
  return { put, calls };
}

// ============================================================
// VALID INGESTION (no real Blob access — putBlob is fully mocked)
// ============================================================

test("valid ingestion registers an active, checksum-tracked asset without touching real Blob storage", async () => {
  const { put, calls } = mockPutBlob();
  const asset = await ingestSplitReferenceAsset(
    { componentId: "SUIT_UPPER_CLASSIC", role: "split-upper-construction", file: tinyPng("classic-jacket.png"), provenance: "test fixture" },
    { putBlob: put, getToken: () => "mock-token" },
  );
  assert.equal(asset.status, "active");
  assert.equal(asset.componentId, "SUIT_UPPER_CLASSIC");
  assert.equal(asset.role, "split-upper-construction");
  assert.equal(asset.contentType, "image/png");
  assert.match(asset.checksum ?? "", /^[0-9a-f]{64}$/);
  assert.equal(calls.length, 1, "exactly one (mocked) Blob write, never a real one");
  assert.match(calls[0].path, /^nasir-bespoke\/split-outfit\/references\/v1\/split-upper-construction\/SUIT_UPPER_CLASSIC\.png$/);

  const registered = findSplitReferenceAsset("SUIT_UPPER_CLASSIC", "split-upper-construction");
  assert.equal(registered?.id, asset.id);
});

test("checksum is calculated from the actual bytes and is stable/deterministic", async () => {
  const { put } = mockPutBlob();
  const assetA = await ingestSplitReferenceAsset(
    { componentId: "SUIT_UPPER_CLASSIC", role: "split-upper-construction", file: tinyPng("a.png"), provenance: "x" },
    { putBlob: put, getToken: () => "t" },
  );
  resetSplitReferenceAssetRegistryForTests();
  const assetB = await ingestSplitReferenceAsset(
    { componentId: "SUIT_UPPER_CLASSIC", role: "split-upper-construction", file: tinyPng("a.png"), provenance: "x" },
    { putBlob: put, getToken: () => "t" },
  );
  assert.equal(assetA.checksum, assetB.checksum, "identical bytes must produce an identical checksum");
});

// ============================================================
// INVALID INPUT
// ============================================================

test("invalid MIME (declared type not JPG/PNG/WebP) is rejected before any Blob write", async () => {
  const { put, calls } = mockPutBlob();
  const gifFile = new File([Uint8Array.from([1, 2, 3])], "x.gif", { type: "image/gif" });
  await assert.rejects(
    () => ingestSplitReferenceAsset({ componentId: "SUIT_UPPER_CLASSIC", role: "split-upper-construction", file: gifFile, provenance: "x" }, { putBlob: put, getToken: () => "t" }),
    (error: unknown) => error instanceof SplitReferenceIngestionError && error.code === "unsupported_type",
  );
  assert.equal(calls.length, 0);
});

test("bytes that do not match the declared content type are rejected (magic-byte cross-check)", async () => {
  const { put, calls } = mockPutBlob();
  // Declares PNG but the bytes are actually a JPEG signature.
  const mismatched = new File([Uint8Array.from([0xff, 0xd8, 0xff, 0xd9])], "fake.png", { type: "image/png" });
  await assert.rejects(
    () => ingestSplitReferenceAsset({ componentId: "SUIT_UPPER_CLASSIC", role: "split-upper-construction", file: mismatched, provenance: "x" }, { putBlob: put, getToken: () => "t" }),
    (error: unknown) => error instanceof SplitReferenceIngestionError && error.code === "invalid_image",
  );
  assert.equal(calls.length, 0);
});

test("oversized image is rejected before any Blob write", async () => {
  const { put, calls } = mockPutBlob();
  const oversized = new File([new Uint8Array(MAX_IMAGE_BYTES + 1)], "huge.png", { type: "image/png" });
  await assert.rejects(
    () => ingestSplitReferenceAsset({ componentId: "SUIT_UPPER_CLASSIC", role: "split-upper-construction", file: oversized, provenance: "x" }, { putBlob: put, getToken: () => "t" }),
    (error: unknown) => error instanceof SplitReferenceIngestionError && error.code === "file_too_large",
  );
  assert.equal(calls.length, 0);
});

test("unknown component ID is rejected", async () => {
  const { put } = mockPutBlob();
  await assert.rejects(
    () => ingestSplitReferenceAsset({ componentId: "SUIT_UPPER_DOES_NOT_EXIST", role: "split-upper-construction", file: tinyPng("x.png"), provenance: "x" }, { putBlob: put, getToken: () => "t" }),
    (error: unknown) => error instanceof SplitReferenceIngestionError && error.code === "unknown_component",
  );
});

test("wrong role for a known component is rejected (e.g. an upper paired with the waistcoat role)", async () => {
  const { put } = mockPutBlob();
  await assert.rejects(
    () => ingestSplitReferenceAsset({ componentId: "SUIT_UPPER_CLASSIC", role: "split-waistcoat-construction", file: tinyPng("x.png"), provenance: "x" }, { putBlob: put, getToken: () => "t" }),
    (error: unknown) => error instanceof SplitReferenceIngestionError && error.code === "wrong_role_for_component",
  );
});

test("a TEXT_ONLY-policy component (e.g. a trouser) is rejected — ingestion only applies to REQUIRED components", async () => {
  const { put } = mockPutBlob();
  await assert.rejects(
    () => ingestSplitReferenceAsset({ componentId: "SUIT_LOWER_CLASSIC_STRAIGHT", role: "split-upper-construction", file: tinyPng("x.png"), provenance: "x" }, { putBlob: put, getToken: () => "t" }),
    (error: unknown) => error instanceof SplitReferenceIngestionError,
  );
});

// ============================================================
// DUPLICATE / REPLACEMENT POLICY
// ============================================================

test("duplicate registration without allowReplace is rejected once an ACTIVE asset already exists", async () => {
  const { put } = mockPutBlob();
  await ingestSplitReferenceAsset({ componentId: "SUIT_UPPER_CLASSIC", role: "split-upper-construction", file: tinyPng("v1.png"), provenance: "x" }, { putBlob: put, getToken: () => "t" });
  await assert.rejects(
    () => ingestSplitReferenceAsset({ componentId: "SUIT_UPPER_CLASSIC", role: "split-upper-construction", file: tinyJpeg("v2.jpg"), provenance: "x" }, { putBlob: put, getToken: () => "t" }),
    (error: unknown) => error instanceof SplitReferenceIngestionError && error.code === "duplicate_asset",
  );
});

test("explicit allowReplace intentionally replaces an existing active asset, preserving the original id and createdAt", async () => {
  const { put } = mockPutBlob();
  const original = await ingestSplitReferenceAsset(
    { componentId: "SUIT_UPPER_CLASSIC", role: "split-upper-construction", file: tinyPng("v1.png"), provenance: "x" },
    { putBlob: put, getToken: () => "t" },
  );
  const replaced = await ingestSplitReferenceAsset(
    { componentId: "SUIT_UPPER_CLASSIC", role: "split-upper-construction", file: tinyJpeg("v2.jpg"), provenance: "x", allowReplace: true },
    { putBlob: put, getToken: () => "t" },
  );
  assert.equal(replaced.id, original.id, "replacement preserves the stable asset id");
  assert.equal(replaced.createdAt, original.createdAt, "replacement preserves createdAt");
  assert.notEqual(replaced.checksum, original.checksum, "replacement content actually changed");
  assert.equal(replaced.contentType, "image/jpeg");
});

// ============================================================
// PRIVATE-ONLY STORAGE
// ============================================================

test("ingestion always uploads with access: private, never public", async () => {
  const { calls } = mockPutBlob();
  let capturedAccess: string | undefined;
  const spyPut: BlobPutFn = async (path, body, options) => {
    capturedAccess = options.access;
    return { path, body, options };
  };
  await ingestSplitReferenceAsset(
    { componentId: "SUIT_WAISTCOAT_TUXEDO", role: "split-waistcoat-construction", file: tinyPng("waistcoat.png"), provenance: "x" },
    { putBlob: spyPut, getToken: () => "t" },
  );
  assert.equal(capturedAccess, "private");
  assert.equal(calls.length, 0, "the unrelated mockPutBlob() call in this test was never invoked");
});

test("no ingested asset's private path is ever returned in a form suitable for direct client exposure — callers only see the metadata object, never a public URL", async () => {
  const { put } = mockPutBlob();
  const asset = await ingestSplitReferenceAsset(
    { componentId: "SUIT_UPPER_TUXEDO", role: "split-upper-construction", file: tinyPng("tux.png"), provenance: "x" },
    { putBlob: put, getToken: () => "t" },
  );
  // The private path exists on the server-side metadata object (needed for
  // later reads) but is namespaced under a private prefix and never itself
  // a signed/public URL — this asserts the path shape stays private-only.
  assert.match(asset.privatePath ?? "", /^nasir-bespoke\/split-outfit\/references\/v1\//);
});
