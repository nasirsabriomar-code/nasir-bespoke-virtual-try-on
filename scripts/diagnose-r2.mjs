import {createHash,createHmac} from 'node:crypto';import {r2Get} from '../lib/r2-storage.ts';
const env=Object.fromEntries(['R2_ACCOUNT_ID','R2_BUCKET_NAME','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY'].map(k=>[k,process.env[k]?.trim()||'']));
console.log('R2_CONFIG_SHAPE',JSON.stringify(Object.fromEntries(Object.entries(env).map(([k,v])=>[k,{present:!!v,length:v.length,valid:k==='R2_ACCOUNT_ID'?/^[a-f0-9]{32}$/.test(v):undefined}]))));
const code=async r=>{const t=r.ok?'':await r.text();console.log('R2_RESULT',JSON.stringify({status:r.status,code:t.match(/<Code>([^<]+)<\/Code>/)?.[1]||null,contentType:r.headers.get('content-type'),size:r.headers.get('content-length')}));if(r.ok)await r.body?.cancel()};
try {await code(await r2Get('nasir-bespoke/catalogue/level1/v1/SUIT_01_CLASSIC/approved.png'));}catch(e){console.log('R2_ERROR',e.name,e.cause?.code||'');}
const enc=s=>encodeURIComponent(s).replace(/[!'()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase());
const h=(k,s)=>createHmac('sha256',k).update(s).digest();const hash=s=>createHash('sha256').update(s).digest('hex');
try {const host=env.R2_ACCOUNT_ID+'.r2.cloudflarestorage.com',uri='/'+enc(env.R2_BUCKET_NAME),date=new Date().toISOString().replace(/[:-]|\.\d{3}/g,''),day=date.slice(0,8),scope=day+'/auto/s3/aws4_request';
const params={'list-type':'2','max-keys':'1000','prefix':'nasir-bespoke/catalogue/','X-Amz-Algorithm':'AWS4-HMAC-SHA256','X-Amz-Credential':env.R2_ACCESS_KEY_ID+'/'+scope,'X-Amz-Date':date,'X-Amz-Expires':'300','X-Amz-SignedHeaders':'host'};
const query=Object.entries(params).map(([k,v])=>[enc(k),enc(v)]).sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0).map(p=>p.join('=')).join('&');
const canonical=['GET',uri,query,'host:'+host+'\n','host','UNSIGNED-PAYLOAD'].join('\n');
const key=h(h(h(h('AWS4'+env.R2_SECRET_ACCESS_KEY,day),'auto'),'s3'),'aws4_request'),sig=createHmac('sha256',key).update(['AWS4-HMAC-SHA256',date,scope,hash(canonical)].join('\n')).digest('hex');
const r=await fetch('https://'+host+uri+'?'+query+'&X-Amz-Signature='+sig);
const t=await r.text();console.log('R2_BUCKET_METADATA',JSON.stringify({status:r.status,code:t.match(/<Code>([^<]+)<\/Code>/)?.[1]||null,keyCount:t.match(/<KeyCount>([^<]+)<\/KeyCount>/)?.[1],truncated:t.match(/<IsTruncated>([^<]+)<\/IsTruncated>/)?.[1],keys:[...t.matchAll(/<Key>([^<]+)<\/Key>/g)].map(m=>m[1])}));
}catch(e){console.log('R2_LIST_ERROR',e.name,e.cause?.code||'');}
try {const {get}=await import('@vercel/blob');const b=await get('nasir-bespoke/catalogue/level1/v1/SUIT_01_CLASSIC/approved.png',{access:'private',token:process.env.NASIR_BLOB_READ_WRITE_TOKEN});console.log('BLOB_SOURCE_METADATA',JSON.stringify({found:!!b,status:b?.statusCode,hasStream:!!b?.stream}));await b?.stream?.cancel();}catch(e){console.log('BLOB_SOURCE_ERROR',JSON.stringify({name:e.name,status:e.statusCode||e.status,code:e.code}));}
console.log('DIAGNOSTIC_COMPLETE_NO_RELEASE');process.exit(1);