import assert from "node:assert/strict";
import test from "node:test";
import { createHash, randomBytes } from "node:crypto";
import sharp from "sharp";
import { createUploadSlot, markUploadComplete } from "@/lib/highres/ledger";
import { writeUploadChunk, expectedChunkBytes } from "@/lib/highres/upload-chunks";
import { completeUploadForUser } from "@/lib/highres/uploads";
import { UPLOAD_CHUNK_BYTES } from "@/lib/highres/upload-config";
import { presignR2Url, r2Get, R2RequestError } from "@/lib/r2-storage";

test("chunk uploads preserve a large original, enforce ownership and reject malformed parts", async (t) => {
  delete process.env.DATABASE_URL;
  process.env.R2_ACCOUNT_ID = "a".repeat(32);
  process.env.R2_BUCKET_NAME = "test-bucket";
  process.env.R2_ACCESS_KEY_ID = "test-access";
  process.env.R2_SECRET_ACCESS_KEY = "test-secret";
  const objects = new Map<string, { bytes: Uint8Array; type: string }>();
  t.mock.method(globalThis, "fetch", async (input: string, init?: RequestInit) => {
    const path = new URL(input).pathname;
    if (init?.method === "PUT") {
      objects.set(path, { bytes: new Uint8Array(init.body as Uint8Array), type: (init.headers as Record<string,string>)["Content-Type"] });
      return new Response(null, { status: 200 });
    }
    if (init?.method === "DELETE") { objects.delete(path); return new Response(null, { status: 204 }); }
    const item = objects.get(path);
    return item ? new Response(Buffer.from(item.bytes), { headers: { "Content-Type": item.type } })
      : new Response("<Error><Code>NoSuchKey</Code></Error>", { status: 404 });
  });
  const bytes = await sharp(randomBytes(1600 * 900 * 3), { raw: { width:1600, height:900, channels:3 } }).png().toBuffer();
  assert.ok(bytes.length > UPLOAD_CHUNK_BYTES);
  const slot = await createUploadSlot({ username:"owner", role:"person", filename:"original.png", contentType:"image/png", bytes:bytes.length });
  const part = (data: Uint8Array) => new Request("https://app.example/upload", { method:"PUT", body:Buffer.from(data) });
  await assert.rejects(writeUploadChunk("other",slot.id,0,part(bytes.subarray(0,10))), /Upload not found/);
  assert.throws(() => expectedChunkBytes(slot,-1), /Invalid upload part/);
  assert.throws(() => expectedChunkBytes(slot,2), /Invalid upload part/);
  await assert.rejects(writeUploadChunk("owner",slot.id,0,part(bytes.subarray(0,10))), /incomplete/);
  await assert.rejects(writeUploadChunk("owner",slot.id,1,part(bytes)), /too large/);
  await assert.rejects(completeUploadForUser("owner",slot.id), /incomplete/);
  for(let index=0; index < Math.ceil(bytes.length/UPLOAD_CHUNK_BYTES); index++) {
    await writeUploadChunk("owner",slot.id,index,part(bytes.subarray(index*UPLOAD_CHUNK_BYTES,(index+1)*UPLOAD_CHUNK_BYTES)));
  }
  const completed = await completeUploadForUser("owner",slot.id);
  assert.equal(completed.checksum,createHash("sha256").update(bytes).digest("hex"));
  assert.equal(completed.width,1600);
  assert.equal(completed.height,900);
  assert.deepEqual(Buffer.from(objects.get("/test-bucket/"+slot.pathname)!.bytes),bytes);
  assert.equal(objects.size,1);
  await assert.rejects(writeUploadChunk("owner",slot.id,0,part(bytes.subarray(0,10))), /already complete/);
  await markUploadComplete(slot.id, {});
});

test("R2 signing correctly encodes spaces and reserved characters; 403 is not treated as missing", async (t) => {
  process.env.R2_ACCOUNT_ID = "a".repeat(32);
  process.env.R2_BUCKET_NAME = "test-bucket";
  process.env.R2_ACCESS_KEY_ID = "test-access";
  process.env.R2_SECRET_ACCESS_KEY = "test-secret";
  const url = presignR2Url("folder/a b!'().png", "GET", 300, { prefix:"a b", "list-type":"2" });
  assert.ok(url.includes("/folder/a%20b%21%27%28%29.png"));
  assert.ok(url.includes("prefix=a%20b"));
  assert.ok(!url.includes("+"));
  t.mock.method(globalThis,"fetch",async () => new Response("<Error><Code>AccessDenied</Code></Error>",{status:403}));
  await assert.rejects(r2Get("missing.png"),error => error instanceof R2RequestError && error.status===403 && error.code==="AccessDenied");
});
