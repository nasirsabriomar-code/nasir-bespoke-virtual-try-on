import { createHash } from "node:crypto";
import { requireRequestUser } from "@/lib/auth/session";
import { isSameOriginRequest } from "@/lib/request-security";
import { recoveryManifest } from "@/lib/catalog/recovery";
import { r2Get, r2Put } from "@/lib/r2-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!await requireRequestUser(request)) return Response.json({ error: "Sign in required." }, { status: 401 });
  const manifest = await recoveryManifest();
  return Response.json({ assets: manifest.map(({ id, checksum, contentType }) => ({ id, checksum, contentType })) },
    { headers: { "Cache-Control": "no-store, private" } });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return Response.json({ error: "Request blocked." }, { status: 403 });
  if (!await requireRequestUser(request)) return Response.json({ error: "Sign in required." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  const asset = (await recoveryManifest()).find(a => a.id === id);
  if (!asset) return Response.json({ error: "Approved reference not found." }, { status: 404 });
  const reader = request.body?.getReader();
  if (!reader) return Response.json({ error: "Image is required." }, { status: 400 });
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4 * 1024 * 1024) {
        await reader.cancel();
        return Response.json({ error: "Reference exceeds 4 MB." }, { status: 413 });
      }
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = Buffer.concat(parts);
  if (createHash("sha256").update(bytes).digest("hex") !== asset.checksum) {
    return Response.json({ error: "This file does not match the approved reference." }, { status: 400 });
  }
  const existing = await r2Get(asset.privatePath);
  if (existing.ok) {
    const current = new Uint8Array(await existing.arrayBuffer());
    if (createHash("sha256").update(current).digest("hex") !== asset.checksum) {
      return Response.json({ error: "Existing reference differs; review is required." }, { status: 409 });
    }
  } else {
    await r2Put(asset.privatePath, bytes, asset.contentType);
  }
  const verify = await r2Get(asset.privatePath);
  if (!verify.ok || createHash("sha256").update(new Uint8Array(await verify.arrayBuffer())).digest("hex") !== asset.checksum) {
    return Response.json({ error: "Storage verification failed." }, { status: 503 });
  }
  return Response.json({ restored: true, id: asset.id }, { headers: { "Cache-Control": "no-store, private" } });
}
