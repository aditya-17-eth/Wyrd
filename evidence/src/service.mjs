import {createPublicClient,http,recoverMessageAddress,getAddress,hexToBytes} from 'viem';
import {abis} from './generated/abis.mjs';
import {canonical,hashJSON,hashBytes,committedSource,sourceURL,validateProvider,verifySpecificationTerms,authorizationMessage,verifyBundle,timeoutPayload,VALIDATOR_VERSION,LEGACY_VALIDATOR_VERSION,ZERO_HASH} from './core.mjs';
import {EvidenceStore} from './storage.mjs';
import {weatherRequest,fetchWeather,replayCandidates,assertHistoricalAvailableDate} from './weather-client.mjs';
import {MULTICITY_VERSION} from './core.mjs';
const weatherCache=new Map();

const json=(value,status=200,headers={})=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json',...headers}});
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const keyFor=(manager,eventId)=>`${manager.toLowerCase()}:${eventId}`;
export async function context(env,manager,eventId){
  if(!/^0x[0-9a-fA-F]{40}$/.test(manager)||!/^\d+$/.test(String(eventId))) fail('Invalid event identifier');
  if(!(env.ALLOWED_MANAGERS||'').toLowerCase().split(',').map(s=>s.trim()).includes(manager.toLowerCase())) fail('Manager is not configured as a verified deployment',503);
  const client=createPublicClient({transport:http(env.RPC_URL||'https://testnet-rpc.monad.xyz',{timeout:10000,retryCount:1})});
  const chainId=await client.getChainId(); if(chainId!==10143 && !(env.LOCAL_ONLY==='true' && chainId===31337)) fail('Evidence service connected to wrong chain',503);
  const [terms,adapter,requestId,admin,block]=await Promise.all([
    client.readContract({address:manager,abi:abis.AegisPolicyManager,functionName:'getEvent',args:[BigInt(eventId)]}),
    client.readContract({address:manager,abi:abis.AegisPolicyManager,functionName:'adapter'}),
    client.readContract({address:manager,abi:abis.AegisPolicyManager,functionName:'requestIds',args:[BigInt(eventId)]}),
    client.readContract({address:manager,abi:abis.AegisPolicyManager,functionName:'administrator'}),client.getBlock({blockTag:'latest'})]);
  if(terms.specHash===ZERO_HASH) fail('Event does not exist',404);
  const [authority,resolution]=await Promise.all([
    client.readContract({address:adapter,abi:abis.DemoWeatherResolver,functionName:'authority'}),
    client.readContract({address:adapter,abi:abis.DemoWeatherResolver,functionName:'getResolution',args:[requestId]})]);
  return {chainId,manager:manager.toLowerCase(),eventId:String(eventId),terms,adapter,requestId,admin,authority,resolution,chainTime:Number(block.timestamp)};
}
async function authorize(request,url,body,ctx,action,payloadHash,store,now){
  if(!Number.isSafeInteger(body.expiresAt)||body.expiresAt<now||body.expiresAt>now+300||!/^[-a-zA-Z0-9]{8,80}$/.test(body.nonce||'')) fail('Expired or malformed authorization',401);
  const message=authorizationMessage({origin:url.origin,action,manager:ctx.manager,eventId:ctx.eventId,payloadHash,expiresAt:body.expiresAt,nonce:body.nonce});
  let signer;try{signer=await recoverMessageAddress({message,signature:body.signature});}catch{fail('Invalid wallet signature',401);}
  if(getAddress(signer)!==getAddress(ctx.authority) && !(action==='publish'&&getAddress(signer)===getAddress(ctx.admin))) fail('Wallet is not the event resolver',403);
  if(!await store.consumeAuthorization(hashBytes(message),body.expiresAt)) fail('Authorization already used',409);
}
export async function captureSnapshot(ctx,spec,store,{fetcher=fetch,now=()=>Math.floor(Date.now()/1000)}={}){
  verifySpecificationTerms(spec,ctx.terms);
  if(ctx.terms.mode!==0) fail('Use the explicitly synthetic fixture publisher');
  if(ctx.resolution?.status!==1) fail('Event already has committed evidence or a finalized outcome',409);
  const startedAt=now();
  if(ctx.chainTime<Number(ctx.terms.captureEligibleAt)||ctx.chainTime>=Number(ctx.terms.resolutionDeadline)||startedAt<spec.captureEligibleAt||startedAt>=spec.resolutionDeadline) fail('Outside committed capture window');
  const key=keyFor(ctx.manager,ctx.eventId); const selected=await store.snapshot(key);
  if(selected) return {manifestHash:selected.manifest_hash,reused:true,eligibleToCommit:true,observationStatus:'verified',retryable:false,retryAfter:null};
  const token=crypto.randomUUID(); const lock=await store.acquire(key,token,startedAt); if(!lock||lock.token!==token) fail('Capture already in progress',409);
  try {
    const selectedAfterLock=await store.snapshot(key); if(selectedAfterLock) return {manifestHash:selectedAfterLock.manifest_hash,reused:true,eligibleToCommit:true,observationStatus:'verified',retryable:false,retryAfter:null};
    const source=committedSource(spec); if(hashJSON(source)!==ctx.terms.sourceConfigHash || hashJSON(spec)!==ctx.terms.specHash) fail('Source or specification binding mismatch');
    const exactURL=sourceURL(source); let raw=new Uint8Array(); let status=null; let headers={}; let validation=null; let detail=null;let failureCode=null;
    try {
      let response;
      for(let attempt=0;attempt<3;attempt++){
        try{response=await fetcher(exactURL,{signal:AbortSignal.timeout(10000),redirect:'error',headers:{accept:'application/json'}});if(response.status!==429&&response.status<500||attempt===2)break;await response.body?.cancel();}
        catch(error){if(attempt===2||!['TimeoutError','AbortError','TypeError'].includes(error.name))throw error;}
        if(now()+30>=spec.resolutionDeadline)throw new Error('Retry would exceed committed capture deadline');
        await new Promise(resolve=>setTimeout(resolve,250*2**attempt));
      }
      status=response.status; for(const name of ['content-type','date','etag','last-modified']) if(response.headers.has(name)) headers[name]=response.headers.get(name);
      if(Number(response.headers.get('content-length')||0)>1_000_000) throw new Error('Provider response too large');
      raw=new Uint8Array(await response.arrayBuffer()); if(raw.length>1_000_000) throw new Error('Provider response too large');
      if(response.status!==200) throw Object.assign(new Error(`ERA5 provider returned HTTP ${response.status}`),{code:response.status===429||response.status>=500?'PROVIDER_UNAVAILABLE':'PROVIDER_REJECTED'});
      if(!(response.headers.get('content-type')||'').toLowerCase().includes('application/json')) throw new Error('Provider response is not JSON');
      validation=validateProvider(new TextDecoder().decode(raw),spec);
    } catch(error){detail=error.message;failureCode=error.code||(['TimeoutError','AbortError','TypeError'].includes(error.name)?'PROVIDER_UNAVAILABLE':'INVALID_RESPONSE');}
    const completedAt=now(); if(completedAt>=spec.resolutionDeadline){validation=null;detail='Response completed after resolution deadline';}
    const responseHash=hashBytes(raw); await store.put(responseHash,raw,'application/octet-stream');
    if(now()>=spec.resolutionDeadline){validation=null;detail='Raw response archived after resolution deadline';}
    let manifest={schema:'aegis-evidence-v1',kind:'live',chainId:ctx.chainId,manager:ctx.manager,adapter:ctx.adapter.toLowerCase(),eventId:ctx.eventId,requestId:ctx.requestId,specHash:ctx.terms.specHash,sourceConfigHash:ctx.terms.sourceConfigHash,
      sourceURL:exactURL,source,requestStartedAt:startedAt,capturedAt:completedAt,httpStatus:status,responseHeaders:headers,responseHash,responseLength:raw.length,validatorVersion:source.validatorVersion,validation,error:detail,failureCode,selectionRule:spec.snapshotRule,revisionPolicy:spec.revisionPolicy};
    let manifestHash=hashJSON(manifest); await store.put(manifestHash,canonical(manifest));
    if(validation&&now()>=spec.resolutionDeadline){validation=null;detail='Evidence archive completed after resolution deadline';manifest={...manifest,validation,error:detail,unselectedCandidateHash:manifestHash};manifestHash=hashJSON(manifest);await store.put(manifestHash,canonical(manifest));}
    await store.record(key,{startedAt,completedAt:now(),status:validation?'valid':'failed',responseHash,detail},manifestHash);
    if(validation){const frozen=await store.snapshot(key);if(frozen.manifest_hash!==manifestHash)return{manifestHash:frozen.manifest_hash,reused:true};}
    const retryable=!validation&&['PROVIDER_UNAVAILABLE','OBSERVATION_UNAVAILABLE'].includes(failureCode)&&now()+3600<spec.resolutionDeadline;
    return {manifestHash,responseHash,manifest,eligibleToCommit:!!validation,observationStatus:validation?'verified':retryable?'awaiting-data':'failed-validation',retryable,retryAfter:retryable?now()+3600:null};
  } finally { await store.release(key,token); }
}
export async function handle(request,env,{loadContext=context,fetcher=fetch,store:providedStore,now=()=>Math.floor(Date.now()/1000)}={}){
  const url=new URL(request.url); let response;
  try {
    const origin=request.headers.get('origin'); const allowed=(env.ALLOWED_ORIGINS||'').split(',').map(s=>s.trim());
    if(request.method==='OPTIONS') return new Response(null,{status:204,headers:{'access-control-allow-origin':allowed.includes(origin)?origin:'*','access-control-allow-methods':'GET,HEAD,POST,OPTIONS','access-control-allow-headers':'content-type'}});
    if(url.pathname==='/health') return json({service:'AEGIS independent evidence archive',storageConfigured:!!(env.DB&&env.BUCKET)||!!providedStore,chainConfigured:!!env.ALLOWED_MANAGERS,validatorVersion:MULTICITY_VERSION,supportedValidatorVersions:[LEGACY_VALIDATOR_VERSION,VALIDATOR_VERSION,MULTICITY_VERSION]});
    if(url.pathname==='/') return new Response('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>AEGIS Evidence Archive</title><style>body{background:#101219;color:#eee9db;font:16px system-ui;max-width:760px;margin:12vh auto;padding:24px}h1{font-size:48px}a{color:#b5a4ff}code{color:#c5d8ca}</style><p>AEGIS / INDEPENDENT EVIDENCE</p><h1>Inspect the evidence.</h1><p>Content-addressed raw responses, immutable snapshot selection, and public capture histories. This archive is deployed independently of the AEGIS frontend.</p><p>Resolution uses a trusted testnet authority. Stored hashes detect altered bytes; they do not establish independent weather truth.</p><p><a href="/health">Service configuration</a> · Objects: <code>/evidence/0x…</code> · Capture history: <code>/events?manager=0x…&amp;eventId=1</code></p></html>',{headers:{'content-type':'text/html; charset=utf-8'}});
    if(!providedStore && (!env.DB||!env.BUCKET)) fail('Evidence storage bindings are unavailable',503);
    const store=providedStore||new EvidenceStore(env.BUCKET,env.DB);
    const objectMatch=url.pathname.match(/^\/evidence\/(0x[0-9a-f]{64})$/);
    if(objectMatch && ['GET','HEAD'].includes(request.method)) {
      const object=await store.get(objectMatch[1]); if(!object) fail('Evidence object not found',404);
      const bytes=new Uint8Array(await object.arrayBuffer()); if(hashBytes(bytes)!==objectMatch[1]) fail('Archived object integrity failure',500);
      response=new Response(request.method==='HEAD'?null:bytes,{headers:{'content-type':object.httpMetadata?.contentType||'application/octet-stream','cache-control':'public,max-age=31536000,immutable','etag':`"${objectMatch[1]}"`}});
    } else if(['/weather/forecast','/weather/history'].includes(url.pathname)&&request.method==='GET') {
      const city=url.searchParams.get('city')||'pune',historical=url.pathname==='/weather/history';
      const start=historical?url.searchParams.get('start')||'2026-06-01':url.searchParams.get('date')||'';
      const end=historical?url.searchParams.get('end')||'2026-09-30':start;
      const query=weatherRequest(city,start,end,historical?'historical':'forecast');
      if(historical)assertHistoricalAvailableDate(end,now());
      else {const first=Date.parse(start+'T00:00:00+05:30')/1000;if(first<now()-86400||first>now()+15*86400)fail('Forecast date is outside the supported horizon',422);}
      const cacheKey=url.origin+JSON.stringify(query),cached=weatherCache.get(cacheKey);
      if(cached&&cached.expiresAt>now())response=json(cached.result);
      else {
        const record=await fetchWeather(query,{fetcher,now});
        if(historical)await store.put(record.responseHash,record.raw,'application/json');
        const {raw,...metadata}=record;
        const result={...metadata,referenceOnly:!historical,settlementEligible:false,registeredMarket:false,uncertainty:'No calibrated probability or uncertainty interval is supplied by this deterministic forecast reference.',...(historical?{evidenceReference:`${url.origin}/evidence/${record.responseHash}`,candidates:replayCandidates(record,city==='pune'?50:75)}:{})};
        if(weatherCache.size>=64)weatherCache.delete(weatherCache.keys().next().value);
        weatherCache.set(cacheKey,{expiresAt:now()+(historical?3600:600),result});response=json(result);
      }
    } else if(url.pathname==='/events' && request.method==='GET') {
      const manager=url.searchParams.get('manager')||'', eventId=url.searchParams.get('eventId')||''; if(!/^0x[0-9a-fA-F]{40}$/.test(manager)||!/^\d+$/.test(eventId)) fail('Invalid event');
      const key=keyFor(manager,eventId); response=json({snapshot:await store.snapshot(key),attempts:await store.history(key)});
    } else if(['/capture','/publish','/timeout'].includes(url.pathname)&&request.method==='POST') {
      if(Number(request.headers.get('content-length')||0)>1_200_000) fail('Request too large',413);
      const text=await request.text();if(text.length>1_200_000) fail('Request too large',413);const body=JSON.parse(text);
      const ctx=await loadContext(env,body.manager,body.eventId);
      if(url.pathname==='/timeout') {
        if(ctx.terms.mode!==0||ctx.resolution.status!==1||ctx.chainTime<Number(ctx.terms.resolutionDeadline)) fail('Timeout is not available');
        const payload=timeoutPayload({chainId:ctx.chainId,adapter:ctx.adapter,requestId:ctx.requestId,specHash:ctx.terms.specHash,resolutionDeadline:ctx.terms.resolutionDeadline});
        const bytes=hexToBytes(payload),hash=hashBytes(bytes); await store.put(hash,bytes,'application/octet-stream');
        response=json({timeoutEvidenceHash:hash,evidenceURI:`${url.origin}/evidence/${hash}`,reason:'No valid evidence committed by deadline',attempts:await store.history(keyFor(ctx.manager,ctx.eventId))});
      } else if(url.pathname==='/publish') {
        await authorize(request,url,body,ctx,'publish',hashJSON(body.objects),store,now());
        if(!Array.isArray(body.objects)||body.objects.length>4) fail('Publish at most four objects');
        let specification;
        for(const object of body.objects) if(object.kind==='specification') {
          if(hashJSON(object.payload)!==ctx.terms.specHash || object.payload.chainId!==ctx.chainId || object.payload.eventId!==ctx.eventId || object.payload.adapter.toLowerCase()!==ctx.adapter.toLowerCase() || object.payload.manager!==ctx.manager || hashJSON(object.payload.source)!==ctx.terms.sourceConfigHash) fail('Wrong specification binding');
          verifySpecificationTerms(object.payload,ctx.terms); specification=object.payload;
        }
        if(!specification){const object=await store.get(ctx.terms.specHash);if(object) specification=JSON.parse(await object.text());}
        if(!specification) fail('Publish the committed specification first');
        for(const object of body.objects){
          if(object.kind==='specification') await store.put(hashJSON(object.payload),canonical(object.payload));
          else if(object.kind==='raw-fixture') {if(ctx.terms.mode!==1||hashBytes(object.payload)!==ctx.terms.fixtureResponseHash) fail('Wrong synthetic response'); await store.put(hashBytes(object.payload),object.payload,'application/octet-stream');}
          else if(object.kind==='fixture-manifest') {
            if(ctx.terms.mode!==1||hashJSON(object.payload)!==ctx.terms.fixtureManifestHash) fail('Wrong synthetic manifest');
            const raw=body.objects.find(o=>o.kind==='raw-fixture')?.payload; if(!raw) fail('Include raw fixture bytes'); verifyBundle(object.payload,raw,specification); await store.put(hashJSON(object.payload),canonical(object.payload));
          }else fail('Unsupported object type');
        }
        response=json({published:body.objects.map(o=>({hash:o.kind==='raw-fixture'?hashBytes(o.payload):hashJSON(o.payload)}))});
      } else {
        await authorize(request,url,body,ctx,'capture',ctx.terms.specHash,store,now());
        const object=await store.get(ctx.terms.specHash);if(!object) fail('Committed specification is not archived',409);
        const spec=JSON.parse(await object.text()); response=json(await captureSnapshot(ctx,spec,store,{fetcher,now}));
      }
    } else fail('Route not found',404);
  } catch(error){response=json({error:error.message},error.status||500);}
  const headers=new Headers(response.headers);headers.set('access-control-allow-origin','*');headers.set('x-content-type-options','nosniff');
  return new Response(response.body,{status:response.status,headers});
}
