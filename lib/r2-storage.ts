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

function encode(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function encodePath(value: string) {
  return value.split("/").map(encode).join("/");
}

function canonicalQuery(params: Record<string, string>) {
  return Object.entries(params).map(([key, value]) => [encode(key), encode(value)])
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map((entry) => entry.join("=")).join("&");
}

function signingKey(secret: string, date: string) {
  const dateKey = hmac("AWS4" + secret, date);
  const regionKey = hmac(dateKey, REGION);
  const serviceKey = hmac(regionKey, SERVICE);
  return hmac(serviceKey, "aws4_request");
}

export function presignR2Url(pathname: string, method: "GET" | "PUT" | "DELETE" | "HEAD", expiresSeconds = 300, query: Record<string, string> = {}) {
  const { accountId, accessKeyId, secretAccessKey, bucket } = config();
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const date = amzDate.slice(0, 8);
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const canonicalUri = `/${encode(bucket)}${pathname ? `/${encodePath(pathname)}` : ""}`;
  const scope = `${date}/${REGION}/${SERVICE}/aws4_request`;
  const params: Record<string, string> = {
    ...query,
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${accessKeyId}/${scope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(Math.min(Math.max(expiresSeconds, 1), 3600)),
    "X-Amz-SignedHeaders": "host",
  };
  const queryString = canonicalQuery(params);
  const canonicalRequest = [
    method,
    canonicalUri,
    queryString,
    `host:${host}\n`,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonicalRequest)].join("\n");
  const signature = createHmac("sha256", signingKey(secretAccessKey, date)).update(stringToSign).digest("hex");
  return `https://${host}${canonicalUri}?${queryString}&X-Amz-Signature=${signature}`;
}

export async function r2Put(pathname: string, body: Blob | Uint8Array, contentType: string) {
  const response = await fetch(presignR2Url(pathname, "PUT"), {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: body instanceof Blob ? body : Buffer.from(body),
  });
  if (!response.ok) throw new Error(`R2 upload failed with status ${response.status}.`);
}

export class R2RequestError extends Error {
  constructor(public readonly status: number, public readonly code: string) {
    super(`R2 request failed (${status}, ${code}).`);
    this.name = "R2RequestError";
  }
}

export async function r2Get(pathname: string) {
  const response = await fetch(presignR2Url(pathname, "GET"), { cache: "no-store" });
  if (!response.ok && response.status !== 404) {
    const xml = await response.text();
    const code = xml.match(/<Code>([A-Za-z0-9]+)<\/Code>/)?.[1] || "UnknownError";
    console.error("r2_read_failed", { status: response.status, code });
    throw new R2RequestError(response.status, code);
  }
  return response;
}

export async function r2Delete(pathname: string) {
  const response = await fetch(presignR2Url(pathname, "DELETE"), { method: "DELETE" });
  if (!response.ok && response.status !== 404) throw new Error(`R2 delete failed with status ${response.status}.`);
}
