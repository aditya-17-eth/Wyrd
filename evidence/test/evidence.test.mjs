import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {privateKeyToAccount} from 'viem/accounts';
import {canonical,hashBytes,hashJSON,eventSpecification,validateProvider,sourceConfig,verifySpecificationTerms,verifyBundle,fixtureBundle,authorizationMessage} from '../src/core.mjs';
import {localStorage} from '../scripts/local-storage.mjs';import {EvidenceStore} from '../src/storage.mjs';import {captureSnapshot,handle} from '../src/service.mjs';
const manager=`0x${'1'.repeat(40)}`,adapter=`0x${'2'.repeat(40)}`;
const spec=eventSpecification({chainId:10143,manager,adapter,eventId:1,observationStart:1792261800});
const sample={latitude:18.5,longitude:73.75,timezone:'Asia/Kolkata',utc_offset_seconds:19800,daily_units:{rain_sum:'mm',time:'iso8601'},daily:{time:[spec.observationDate],rain_sum:[50]}};
const raw=JSON.stringify(sample);
const ctx={chainId:10143,manager,adapter,eventId:'1',requestId:`0x${'3'.repeat(64)}`,terms:{...Object.fromEntries(['observationStart','observationEnd','purchaseCutoff','minimumLeadTime','captureEligibleAt','resolutionDeadline','thresholdMilliMm','maxEventCoverage','maxBuyerCoverage'].map(field=>[field,BigInt(spec[field])])),mode:0,specHash:hashJSON(spec),sourceConfigHash:hashJSON(spec.source)},chainTime:spec.captureEligibleAt,resolution:{status:1}};
test('canonical specification must match every onchain material numeric term',()=>{assert.equal(verifySpecificationTerms(spec,ctx.terms),true);for(const field of ['thresholdMilliMm','purchaseCutoff','observationStart','maxEventCoverage','maxBuyerCoverage'])assert.throws(()=>verifySpecificationTerms(spec,{...ctx.terms,[field]:BigInt(ctx.terms[field])+1n}),new RegExp(field));});
async function withStore(run){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'aegis-evidence-'));const local=await localStorage(dir);try{await run(new EvidenceStore(local.bucket,local.db));}finally{local.close();if(path.dirname(path.resolve(dir))!==path.resolve(os.tmpdir())||!path.basename(dir).startsWith('aegis-evidence-'))throw new Error('Unsafe cleanup path');await fs.rm(dir,{recursive:true,force:true});}}
test('canonical serialization ignores object insertion order',()=>assert.equal(hashJSON({b:1,a:'2'}),hashJSON({a:'2',b:1})));
test('threshold is inclusive, decimal exact, no rounding across 50 mm',()=>{assert.equal(validateProvider(raw,spec).outcome,'YES');assert.equal(validateProvider(JSON.stringify({...sample,daily:{...sample.daily,rain_sum:[49.999]}}),spec).outcome,'NO');});
for(const [name,mutate] of [
  ['grid',d=>{d.longitude=73.9;}],['units',d=>{d.daily_units.rain_sum='inch';}],['date',d=>{d.daily.time=['2020-01-01'];}],['missing reading',d=>{d.daily.rain_sum=[null];}],['timezone',d=>{d.timezone='UTC';}],['duplicate date',d=>{d.daily.time.push(spec.observationDate);}],['precision',d=>{d.daily.rain_sum=[49.9999];}],['negative rainfall',d=>{d.daily.rain_sum=[-1];}]
])test(`reject ${name}`,()=>{const d=structuredClone(sample);mutate(d);assert.throws(()=>validateProvider(JSON.stringify(d),spec));});
test('no ERA5-Land or Best Match substitution',()=>{const changed=structuredClone(spec);changed.source.parameters.models='best_match';assert.throws(()=>validateProvider(raw,changed),/changed source/);});
test('valid snapshot archives exact bytes and first selection survives upstream revisions',()=>withStore(async store=>{
  let calls=0;const now=()=>spec.captureEligibleAt+1;
  const result=await captureSnapshot(ctx,spec,store,{now,fetcher:async()=>{++calls;return new Response(raw,{headers:{'content-type':'application/json',date:'Wed, 21 Oct 2026 00:00:00 GMT'}});}});
  assert.equal(result.eligibleToCommit,true);assert.equal(await (await store.get(result.responseHash)).text(),raw);assert.equal(verifyBundle(result.manifest,raw,spec).manifestHash,result.manifestHash);
  const reused=await captureSnapshot(ctx,spec,store,{now,fetcher:async()=>{++calls;return new Response(raw.replace('[50]','[10]'),{headers:{'content-type':'application/json'}});}});assert.equal(reused.manifestHash,result.manifestHash);assert.equal(calls,1);
}));
test('failed HTTP attempts retained before first valid response',()=>withStore(async store=>{
  const result=await captureSnapshot(ctx,spec,store,{now:()=>spec.captureEligibleAt+1,fetcher:async()=>new Response('provider unavailable',{status:503})});assert.equal(result.eligibleToCommit,false);assert.equal(await(await store.get(result.responseHash)).text(),'provider unavailable');
  assert.equal((await store.history(`${manager}:1`))[0].status,'failed');assert.equal(await store.snapshot(`${manager}:1`),null);
}));
for(const delayedPut of [1,2])test(`archive deadline checked after storage upload ${delayedPut}`,()=>withStore(async store=>{
  let clock=spec.resolutionDeadline-1,puts=0;const delayed=Object.create(store);
  delayed.put=async(...args)=>{await store.put(...args);if(++puts===delayedPut)clock=spec.resolutionDeadline;};
  const result=await captureSnapshot(ctx,spec,delayed,{now:()=>clock,fetcher:async()=>new Response(raw,{headers:{'content-type':'application/json'}})});
  assert.equal(result.eligibleToCommit,false);assert.equal(result.manifest.validation,null);
  assert.equal(await store.snapshot(`${manager}:1`),null);
  const attempts=await store.history(`${manager}:1`);assert.equal(attempts.length,1);assert.equal(attempts[0].status,'failed');
}));
test('serialize concurrent captures',()=>withStore(async store=>{
  let unblock;const pending=new Promise(resolve=>{unblock=resolve;});let entered;const started=new Promise(resolve=>{entered=resolve;});
  const one=captureSnapshot(ctx,spec,store,{now:()=>spec.captureEligibleAt+1,fetcher:async()=>{entered();await pending;return new Response(raw,{headers:{'content-type':'application/json'}});}});await started;
  await assert.rejects(captureSnapshot(ctx,spec,store,{now:()=>spec.captureEligibleAt+1,fetcher:async()=>new Response(raw,{headers:{'content-type':'application/json'}})}),/in progress/);unblock();await one;
}));
test('reject exact deadline and early capture',()=>withStore(async store=>{
  await assert.rejects(captureSnapshot({...ctx,chainTime:spec.resolutionDeadline},spec,store,{now:()=>spec.resolutionDeadline}),/capture window/);
  await assert.rejects(captureSnapshot({...ctx,chainTime:spec.captureEligibleAt-1},spec,store,{now:()=>spec.captureEligibleAt-1}),/capture window/);
}));
test('detect tampered raw bytes and bindings',()=>withStore(async store=>{
  const result=await captureSnapshot(ctx,spec,store,{now:()=>spec.captureEligibleAt+1,fetcher:async()=>new Response(raw,{headers:{'content-type':'application/json'}})});
  assert.throws(()=>verifyBundle(result.manifest,`${raw} `,spec),/tampered/);assert.throws(()=>verifyBundle({...result.manifest,adapter:manager},raw,spec),/binding/);
}));
test('archive stays readable with no frontend and no manager RPC access',()=>withStore(async store=>{
  const hash=hashBytes(raw);await store.put(hash,raw);const response=await handle(new Request(`https://independent.test/evidence/${hash}`),{},{store});assert.equal(response.status,200);assert.equal(await response.text(),raw);
}));
test('storage rejects changed bytes and has no overwrite/delete route',()=>withStore(async store=>{
  await assert.rejects(store.put(hashBytes(raw),'changed'),/hash mismatch/);const response=await handle(new Request(`https://independent.test/evidence/${hashBytes(raw)}`,{method:'DELETE'}),{},{store});assert.equal(response.status,404);
}));
test('wallet signatures bound to origin, payload and unique nonce',()=>withStore(async store=>{
  const account=privateKeyToAccount(`0x${'4'.repeat(64)}`);const fixedNow=1_900_000_000;
  const context={...ctx,authority:account.address,admin:account.address};const objects=[{kind:'specification',payload:spec}],expiresAt=fixedNow+60,nonce='test-nonce-123';
  const message=authorizationMessage({origin:'https://independent.test',action:'publish',manager,eventId:1,payloadHash:hashJSON(objects),expiresAt,nonce});const signature=await account.signMessage({message});
  const makeRequest=()=>new Request('https://independent.test/publish',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({manager,eventId:1,objects,expiresAt,nonce,signature})});
  const result=await handle(makeRequest(),{},{store,loadContext:async()=>context,now:()=>fixedNow});assert.equal(result.status,200);const replay=await handle(makeRequest(),{},{store,loadContext:async()=>context,now:()=>fixedNow});assert.equal(replay.status,409);
}));
