import { list, get } from "@vercel/blob";
import { bucketRequest } from "./r2-bucket-admin.mjs";
const token = process.env.NASIR_BLOB_READ_WRITE_TOKEN;
const result = await list({prefix:"nasir-bespoke/catalogue/",limit:1000,token});
console.log("BLOB_LIST",JSON.stringify({count:result.blobs.length,hasMore:result.hasMore}));
const source = result.blobs.find(b => b.pathname === "nasir-bespoke/catalogue/level1/v1/SUIT_01_CLASSIC/approved.png");
if (source) {
 console.log("BLOB_HOST",JSON.stringify({private:new URL(source.url).hostname.endsWith(".private.blob.vercel-storage.com")}));
 try {
   const r = await fetch(source.url,{headers:{Authorization:"Bearer "+token},cache:"no-store"});
   const t = r.ok ? "" : await r.text();
   console.log("BLOB_RAW_READ",JSON.stringify({status:r.status,suspended:/suspend/i.test(t),quota:/quota|limit|bandwidth/i.test(t),unauthorized:/unauthor/i.test(t),code:r.headers.get("x-vercel-error")}));
   await r.body?.cancel();
   if(r.ok) {const b=await get(source.url,{access:"private",token,useCache:false});console.log("BLOB_SDK_READ",b?.statusCode);await b?.stream?.cancel();}
 } catch(e) {console.log("BLOB_FETCH_ERROR",e.name);}
}
const cors=await bucketRequest("GET",{cors:""});
const xml=await cors.text();
console.log("R2_CORS_HEADER_AUTH",JSON.stringify({status:cors.status,code:xml.match(/<Code>([^<]+)<\/Code>/)?.[1],message:xml.match(/<Message>([^<]+)<\/Message>/)?.[1],origins:[...xml.matchAll(/<AllowedOrigin>([^<]+)<\/AllowedOrigin>/g)].map(m=>m[1]),methods:[...xml.matchAll(/<AllowedMethod>([^<]+)<\/AllowedMethod>/g)].map(m=>m[1]),headers:[...xml.matchAll(/<AllowedHeader>([^<]+)<\/AllowedHeader>/g)].map(m=>m[1])}));
console.log("DIAGNOSTIC_COMPLETE_NO_RELEASE");process.exit(1);
