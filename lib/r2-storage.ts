import "server-only";

import { createHash, createHmac } from "node:crypto";

const REGION = "auto";
const SERVICE = "s3";

export class R2ConfigurationError extends Error {
  constructor() {
    super("Cloudflare R2 storage is not configured.");
    this.name = "R2ConfigurationError";
  }
}

export function isR2Configured() {
  return Boolean(
    process.env.R2_ACCOUNT_ID?.trim() &&
    process.env.R2_ACCESS_KEY_ID?.trim() &&
    process.env.R2_SECRET_ACCESS_KEY?.trim() &&
    process.env.R2_BUCKET_NAME?.trim()
  );
}

function config() {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_BUCKET_NAME?.trim();
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) throw new R2ConfigurationError();
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

function hmac(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function encodePath(value: string) {
  return value.split("/").map((part) => encodeURIComponent(part)).join("/");
}

function signingKey(secret: string, date: string) {
  const dateKey = hmac("AWS4" + secret, date);
  const regionKey = hmac(dateKey, REGION);
  const serviceKey = hmac(regionKey, SERVICE);
  return hmac(serviceKey, "aws4_request");
}

export function presignR2Url(pathname: string, method: "GET" | "PUT" | "DELETE", expiresSeconds = 300) {
  const { accountId, accessKeyId, secretAccessKey, bucket } = config();
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const date = amzDate.slice(0, 8);
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const canonicalUri = `/${encodeURIComponent(bucket)}/${encodePath(pathname)}`;
  const scope = `${date}/${REGION}/${SERVICE}/aws4_request`;
  const params = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${accessKeyId}/${scope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(Math.min(Math.max(expiresSeconds, 1), 3600)),
    "X-Amz-SignedHeaders": "host",
  });
  params.sort();
  const canonicalRequest = [
    method,
    canonicalUri,
    params.toString(),
    `host:${host}\n`,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonicalRequest)].join("\n");
  const signature = createHmac("sha256", signingKey(secretAccessKey, date)).update(stringToSign).digest("hex");
  params.set("X-Amz-Signature", signature);
  return `https://${host}${canonicalUri}?${params.toString()}`;
}

export async function r2Put(pathname: string, body: Blob | Uint8Array, contentType: string) {
  const response = await fetch(presignR2Url(pathname, "PUT"), {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: body instanceof Blob ? body : Buffer.from(body),
  });
  if (!response.ok) throw new Error(`R2 upload failed with status ${response.status}.`);
}

export async function r2Get(pathname: string) {
  return fetch(presignR2Url(pathname, "GET"));
}

export async function r2Delete(pathname: string) {
  const response = await fetch(presignR2Url(pathname, "DELETE"), { method: "DELETE" });
  if (!response.ok && response.status !== 404) throw new Error(`R2 delete failed with status ${response.status}.`);
}
