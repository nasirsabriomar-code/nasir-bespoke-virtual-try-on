import assert from 'node:assert/strict';
import sharp from 'sharp';
import bcrypt from 'bcryptjs';
import { performance } from 'node:perf_hooks';
import { handleTryOnRequest } from '../lib/try-on-handler';
import { acquireGenerationLock, releaseGenerationLock } from '../lib/generation-guard';
import { createSessionToken, getSessionCookieName } from '../lib/auth/session';
import { POST as restoreReference } from '../app/api/catalogue-recovery/route';
import { recoveryManifest } from '../lib/catalog/recovery';
import { queueGenerationDeletion, pendingGenerationDeletions } from '../lib/highres/ledger';
import { cleanupRetainedGenerations } from '../lib/history/deletion';

// Run from the repository root:
// NODE_ENV=test NODE_OPTIONS=--conditions=react-server node --import=tsx security/redteam-round2-probes.mts
// Isolated process, synthetic identities, no environment-file loading and no live services.
assert.equal(process.env.NODE_ENV, 'test', 'These probes require NODE_ENV=test');
for (const key of Object.keys(process.env)) if (/^(DATABASE_|UPSTASH_|R2_|OPENAI_|AUTH_|BLOB_|CRON_)/.test(key)) delete process.env[key];
process.env.AUTH_SESSION_SECRET = 'synthetic-redteam-fixture-secret-at-least-32-bytes';
const user = { username:'redteam', displayName:'Synthetic staff', passwordHash:bcrypt.hashSync('fixture-only',4) };
process.env.AUTH_USERS_JSON = JSON.stringify([user]);
const realError = console.error; console.error = () => {};
const lease = await acquireGenerationLock(user.username);
assert.ok(lease);
const bytes = await sharp({create:{width:6000,height:6000,channels:3,background:'navy'}}).png().toBuffer();
let quotaChecks=0; let providerCalls=0;
const send = async (data: Uint8Array) => {
 const form = new FormData(); form.set('selectionMode','outfit');
 for (const role of ['person','fabric','outfit']) form.set(role,new File([new Uint8Array(data)],role+'.png',{type:'image/png'}));
 const req=new Request('http://localhost/api/try-on',{method:'POST',headers:{origin:'http://localhost'},body:form});
 const start=performance.now();
 const response=await handleTryOnRequest(req,{
  authenticate:async()=>user,
  rateLimit:async()=>{quotaChecks++;return {allowed:false,limit:1,remaining:0,resetAt:Date.now()+60000};},
  generate:async()=>{providerCalls++;throw new Error('must not run');},
 });
 return {status:response.status,body:await response.json(),elapsedMs:Math.round(performance.now()-start)};
};
const malformed=await send(bytes.subarray(0,24));
const compressed=await send(bytes);
assert.equal(malformed.status,409); assert.equal(compressed.status,409); assert.equal(quotaChecks,0);
console.log(JSON.stringify({probe:'legacy-admission-bypass',compressedBytes:bytes.length,decodedPixelsPerRequest:108000000,malformed,compressed,quotaChecks,providerCalls}));
await releaseGenerationLock(lease);

// Queue 100 deterministic storage failures before one healthy pending deletion.
process.env.R2_ACCOUNT_ID='a'.repeat(32);process.env.R2_BUCKET_NAME='fixture';process.env.R2_ACCESS_KEY_ID='fixture';process.env.R2_SECRET_ACCESS_KEY='fixture';
const ids:string[]=[];
for(let i=0;i<101;i++) {
 const id=crypto.randomUUID();ids.push(id);
 await queueGenerationDeletion({id,username:user.username,occurredAt:new Date().toISOString(),status:'success',durationMs:1,provider:'fixture',model:'fixture',quality:'medium',device:{kind:'desktop',browser:'fixture',operatingSystem:'fixture'},assets:{result:{pathname:`nasir-bespoke/generations/${id}/result.png`,contentType:'image/png'}}});
}
const originalFetch=globalThis.fetch;let healthyAttempts=0;
globalThis.fetch=async(input: RequestInfo | URL)=>{
 if(String(input).includes(ids[100])) {healthyAttempts++;return new Response(null,{status:204});}
 return new Response(null,{status:503});
};
const cleanup1=await cleanupRetainedGenerations();const cleanup2=await cleanupRetainedGenerations();
assert.equal(healthyAttempts,1); assert.equal(cleanup2.removed,1);
console.log(JSON.stringify({probe:'cleanup-starvation',cleanup1,cleanup2,healthyAttempts,healthyStillQueued:(await pendingGenerationDeletions(200)).some(e=>e.id===ids[100])}));
globalThis.fetch=originalFetch;

const reference=(await recoveryManifest())[0]; assert.ok(reference);
let controller!:ReadableStreamDefaultController<Uint8Array>;
const body=new ReadableStream<Uint8Array>({start(c){controller=c;c.enqueue(new Uint8Array([1]));}});
const cookie=`${getSessionCookieName()}=${await createSessionToken(user.username)}`;
const request=new Request(`http://localhost/api/catalogue-recovery?id=${encodeURIComponent(reference.id)}`,{method:'POST',headers:{origin:'http://localhost',cookie},body,duplex:'half'} as RequestInit);
const started=performance.now();let settled=false;
const pending=restoreReference(request).then(r=>{settled=true;return r;});
await new Promise(resolve=>setTimeout(resolve,31000));
const stillReading=!settled;if(stillReading) controller.close();const result=await pending;
assert.equal(stillReading,false); assert.equal(result.status,408);
console.log(JSON.stringify({probe:'recovery-body-deadline-bypass',stillReadingAfter31Seconds:stillReading,elapsedMs:Math.round(performance.now()-started),finalStatus:result.status}));
console.error=realError;
