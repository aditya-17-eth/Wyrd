import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {sourceConfig,sourceURL,LEGACY_VALIDATOR_VERSION,VALIDATOR_VERSION,eventSpecification,hashJSON,hashBytes,verifySpecificationTerms,validateProvider,verifyBundle,resolverCommitArgs} from '../src/core.mjs';
import {captureSnapshot} from '../src/service.mjs';
import {localStorage} from '../scripts/local-storage.mjs';
import {EvidenceStore} from '../src/storage.mjs';
const manager=`0x${'1'.repeat(40)}`,adapter=`0x${'2'.repeat(40)}`;
const spec=eventSpecification({chainId:10143,manager,adapter,eventId:1,observationStart:1792261800});
function context(s=spec){return {chainId:10143,manager,adapter,eventId:'1',requestId:`0x${'3'.repeat(64)}`,terms:{...Object.fromEntries(['observationStart','observationEnd','purchaseCutoff','minimumLeadTime','captureEligibleAt','resolutionDeadline','thresholdMilliMm','maxEventCoverage','maxBuyerCoverage'].map(f=>[f,BigInt(s[f])])),mode:0,specHash:hashJSON(s),sourceConfigHash:hashJSON(s.source)},chainTime:s.captureEligibleAt+2,resolution:{status:1}};}
const sample={latitude:18.5,longitude:73.75,timezone:'Asia/Kolkata',utc_offset_seconds:19800,daily_units:{rain_sum:'mm',time:'iso8601'},daily:{time:[spec.observationDate],rain_sum:[49.999]}};
const raw=JSON.stringify(sample);
const response=body=>new Response(body,{headers:{'content-type':'application/json'}});
async function withStore(run){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'aegis-era5-'));const local=await localStorage(dir);try{await run(new EvidenceStore(local.bucket,local.db));}finally{local.close();if(path.dirname(path.resolve(dir))!==path.resolve(os.tmpdir())||!path.basename(dir).startsWith('aegis-era5-'))throw new Error('Unsafe cleanup path');await fs.rm(dir,{recursive:true,force:true});}}

test('configured coordinates request precisely one committed ERA5 date in IST',()=>{
  const url=new URL(sourceURL(spec.source));
  assert.equal(url.origin+url.pathname,'https://archive-api.open-meteo.com/v1/archive');
  assert.deepEqual(Object.fromEntries(url.searchParams),{latitude:'18.5196',longitude:'73.8554',start_date:spec.observationDate,end_date:spec.observationDate,daily:'rain_sum',models:'era5',timezone:'Asia/Kolkata',precipitation_unit:'mm',cell_selection:'nearest'});
  assert.equal(spec.source.validatorVersion,VALIDATOR_VERSION);
  assert.throws(()=>sourceConfig('2026-02-30'),/Invalid observation date/);
});
test('registered v1 terms retain their original source URL and hashes',()=>withStore(async store=>{
  const legacy={...spec,source:sourceConfig(spec.observationDate,LEGACY_VALIDATOR_VERSION)};
  const ctx=context(legacy);
  assert.equal(verifySpecificationTerms(legacy,ctx.terms),true);
  assert.throws(()=>verifySpecificationTerms({...legacy,source:spec.source},ctx.terms),/hash binding/);
  const captured=await captureSnapshot(ctx,legacy,store,{now:()=>ctx.chainTime,fetcher:async url=>{assert.equal(new URL(url).searchParams.get('latitude'),'18.5204');assert.equal(new URL(url).searchParams.get('elevation'),'nan');return response(raw);}});
  assert.equal(captured.manifest.validatorVersion,LEGACY_VALIDATOR_VERSION);
  assert.equal(verifyBundle(captured.manifest,raw,legacy).manifestHash,captured.manifestHash);
}));
test('delayed null observations are archived, retryable, and never interpreted as zero',()=>withStore(async store=>{
  const ctx=context(),missing=JSON.stringify({...sample,daily:{...sample.daily,rain_sum:[null]}});
  const pending=await captureSnapshot(ctx,spec,store,{now:()=>ctx.chainTime,fetcher:async()=>response(missing)});
  assert.equal(pending.eligibleToCommit,false);assert.equal(pending.observationStatus,'awaiting-data');assert.equal(pending.retryable,true);assert.equal(pending.retryAfter,ctx.chainTime+3600);assert.equal(pending.manifest.validation,null);
  assert.equal(pending.responseHash,hashBytes(missing));assert.equal(await(await store.get(pending.responseHash)).text(),missing);assert.equal(await store.snapshot(`${manager}:1`),null);
  const ready=await captureSnapshot(ctx,spec,store,{now:()=>ctx.chainTime,fetcher:async url=>{assert.equal(new URL(url).searchParams.get('start_date'),spec.observationDate);return response(raw);}});
  assert.equal(ready.eligibleToCommit,true);assert.equal((await store.history(`${manager}:1`)).length,2);
  assert.equal((await store.snapshot(`${manager}:1`)).manifest_hash,ready.manifestHash);
}));
for(const status of [429,503])test(`ERA5 HTTP ${status} retains failure bytes and a pending retry`,()=>withStore(async store=>{
  const ctx=context();const result=await captureSnapshot(ctx,spec,store,{now:()=>ctx.chainTime,fetcher:async()=>new Response('unavailable',{status})});
  assert.equal(result.retryable,true);assert.equal(result.manifest.validation,null);assert.equal(await store.snapshot(`${manager}:1`),null);assert.equal(await(await store.get(result.responseHash)).text(),'unavailable');
}));
test('network failure archives a failure manifest without a fabricated observation',()=>withStore(async store=>{
  const ctx=context(),result=await captureSnapshot(ctx,spec,store,{now:()=>ctx.chainTime,fetcher:async()=>{throw new TypeError('Network unavailable');}});
  assert.equal(result.retryable,true);assert.equal(result.eligibleToCommit,false);assert.equal(result.manifest.validation,null);assert.equal((await store.history(`${manager}:1`))[0].status,'failed');
}));
test('wrong dates, text rainfall, timezone offsets, and monthly arrays fail validation',()=>{
  for(const changed of [{...sample,utc_offset_seconds:0},{...sample,daily:{time:[spec.observationDate,'2026-10-19'],rain_sum:[49.999,0]}},{...sample,daily:{...sample.daily,rain_sum:['49.999']}},null])assert.throws(()=>validateProvider(JSON.stringify(changed),spec));
  for(const [field,value] of [['endpoint','https://api.open-meteo.com/v1/forecast'],['models','era5_land'],['models','best_match'],['timezone','auto'],['daily','precipitation_sum']]){
    const changed=structuredClone(spec);if(field==='endpoint')changed.source.endpoint=value;else changed.source.parameters[field]=value;assert.throws(()=>validateProvider(raw,changed),/source configuration/);
  }
});
test('non-JSON and partial responses are never selected',()=>withStore(async store=>{
  const ctx=context();for(const r of [new Response(raw),new Response(raw,{status:206,headers:{'content-type':'application/json'}})]){const result=await captureSnapshot(ctx,spec,store,{now:()=>ctx.chainTime,fetcher:async()=>r});assert.equal(result.eligibleToCommit,false);assert.equal(await store.snapshot(`${manager}:1`),null);}
}));
test('verified observation produces the unchanged authorized resolver argument tuple',()=>withStore(async store=>{
  const ctx=context(),result=await captureSnapshot(ctx,spec,store,{now:()=>ctx.chainTime,fetcher:async()=>response(raw)});
  const args=resolverCommitArgs(ctx,result.manifest,raw,spec,'https://evidence.example');
  assert.deepEqual(args,[ctx.requestId,ctx.terms.specHash,ctx.terms.sourceConfigHash,result.manifestHash,result.responseHash,49999n,BigInt(ctx.chainTime),1n,`https://evidence.example/evidence/${result.manifestHash}`]);
  assert.throws(()=>resolverCommitArgs({...ctx,requestId:`0x${'9'.repeat(64)}`},result.manifest,raw,spec,'https://evidence.example'),/request binding/);
  assert.throws(()=>resolverCommitArgs({...ctx,chainTime:spec.resolutionDeadline},result.manifest,raw,spec,'https://evidence.example'),/resolution window/);
  assert.throws(()=>resolverCommitArgs({...ctx,resolution:{status:3}},result.manifest,raw,spec,'https://evidence.example'),/no longer/);
  assert.throws(()=>resolverCommitArgs(ctx,result.manifest,`${raw} `,spec,'https://evidence.example'),/tampered/);
  assert.throws(()=>verifyBundle({...result.manifest,kind:'synthetic'},raw,spec),/Replay evidence/);
  assert.throws(()=>verifyBundle({...result.manifest,sourceURL:'https://api.open-meteo.com/v1/forecast'},raw,spec),/source binding/);
}));
test('capturing committed or synthetic events cannot fetch another observation',()=>withStore(async store=>{
  const ctx=context();let fetched=false;
  await assert.rejects(captureSnapshot({...ctx,resolution:{status:2}},spec,store,{fetcher:async()=>{fetched=true;return response(raw);}}),/already has committed/);
  assert.equal(fetched,false);
}));
