import { createHash, createHmac } from "node:crypto";

const encode = (value) => encodeURIComponent(value).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
const digest = (value) => createHash("sha256").update(value).digest("hex");
const hmac = (key, value) => createHmac("sha256", key).update(value).digest();

// Bucket administration requires header authentication; presigned URLs are for objects.
export async function bucketRequest(method, query, body = "") {
  const account = process.env.R2_ACCOUNT_ID?.trim();
  const bucket = process.env.R2_BUCKET_NAME?.trim();
  const access = process.env.R2_ACCESS_KEY_ID?.trim();
  const secret = process.env.R2_SECRET_ACCESS_KEY?.trim();
  if (!account || !bucket || !access || !secret) throw new Error("R2 configuration missing");
  const host = account + ".r2.cloudflarestorage.com";
  const uri = "/" + encode(bucket);
  const params = Object.entries(query).map(([k,v]) => [encode(k),encode(v)]).sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0).map(p => p.join("=")).join("&");
  const date = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const day = date.slice(0,8);
  const scope = day + "/auto/s3/aws4_request";
  const headers = {"host":host,"x-amz-content-sha256":digest(body),"x-amz-date":date};
  if (method === "PUT") {
    headers["content-type"] = "application/xml";
    headers["content-md5"] = createHash("md5").update(body).digest("base64");
  }
  const names = Object.keys(headers).sort();
  const signed = names.join(";");
  const canonicalHeaders = names.map(k => k + ":" + headers[k] + "\n").join("");
  const canonical = [method,uri,params,canonicalHeaders,signed,digest(body)].join("\n");
  const key = hmac(hmac(hmac(hmac("AWS4"+secret,day),"auto"),"s3"),"aws4_request");
  const signature = createHmac("sha256",key).update(["AWS4-HMAC-SHA256",date,scope,digest(canonical)].join("\n")).digest("hex");
  headers.authorization = "AWS4-HMAC-SHA256 Credential="+access+"/"+scope+", SignedHeaders="+signed+", Signature="+signature;
  return fetch("https://"+host+uri+"?"+params,{method,headers, ...(method==="PUT"?{body}:{}),cache:"no-store"});
}
