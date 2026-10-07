import { list, get } from "@vercel/blob";
import { readdir, readFile } from "node:fs/promises";
const token=process.env.NASIR_BLOB_READ_WRITE_TOKEN;
const b=await list({prefix:"nasir-bespoke/catalogue/",limit:1000,token});
const source=b.blobs.find(b=>b.pathname==="nasir-bespoke/catalogue/level1/v1/SUIT_01_CLASSIC/approved.png");
console.log("BLOB_STORE_ID","store_"+new URL(source.url).hostname.split(".")[0]);
try{const data=await get(source.url,{access:"private",token,useCache:false});console.log("BLOB_CONSISTENT_GET",data?.statusCode);await data?.stream?.cancel();}catch(e){console.log("BLOB_CONSISTENT_GET_FAILED",JSON.stringify({name:e.name,unauthorized:/unauthor/i.test(e.message)}));}
async function walk(dir) {for (const f of await readdir(dir,{withFileTypes:true})) {const p=dir+"/"+f.name;if(f.isDirectory())await walk(p);else if(/route\.md$/.test(p)){console.log("NEXT_ROUTE_DOC_PATH",p);console.log("NEXT_ROUTE_DOC", (await readFile(p,"utf8")).slice(0,7000));}}}
try{await walk("node_modules/next/dist/docs");}catch(e){console.log("NEXT_DOCS",e.code);}
console.log("DIAGNOSTIC_COMPLETE_NO_RELEASE");process.exit(1);
