// Isolated LOCAL chain + explicitly mocked provider transport. Never touches public contracts.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import httpServer from 'node:http';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createPublicClient,createWalletClient,http} from 'viem';
import {anvil} from 'viem/chains';
import {mnemonicToAccount} from 'viem/accounts';
import {prepareEvent} from './event-bundle.mjs';
import {hashJSON,hashBytes,authorizationMessage,resolverCommitArgs} from '../evidence/src/core.mjs';
import {context as loadContext,handle} from '../evidence/src/service.mjs';
import {EvidenceStore} from '../evidence/src/storage.mjs';
import {localStorage} from '../evidence/scripts/local-storage.mjs';
const rpc='http://127.0.0.1:8546',origin='http://127.0.0.1:8788';
const child=spawn(fileURLToPath(new URL('../.tools/foundry/anvil.exe',import.meta.url)),['--network','monad','--chain-id','31337','--host','127.0.0.1','--port','8546','--silent'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
let startupError='';child.stderr.on('data',data=>{startupError+=data.toString();});
const client=createPublicClient({chain:anvil,transport:http(rpc,{timeout:1000,retryCount:0})});
const A=mnemonicToAccount('test test test test test test test test test test test junk',{addressIndex:0});
const B=mnemonicToAccount('test test test test test test test test test test test junk',{addressIndex:1});
const wallet=createWalletClient({account:A,chain:anvil,transport:http(rpc)});
const artifacts=JSON.parse(await fs.readFile(new URL('../.local/artifacts.json',import.meta.url),'utf8'));
const runDir=new URL(`../.local/oracle-qa/${Date.now()}/`,import.meta.url);await fs.mkdir(runDir,{recursive:true});
let local,server,clock,providerCalls=0;const receipts=[];
async function receipt(hash,label){const r=await client.waitForTransactionReceipt({hash});assert.equal(r.status,'success');receipts.push({hash,label,block:r.blockNumber.toString()});return r;}
async function deploy(name,args=[]){return(await receipt(await wallet.deployContract({...artifacts[name],args}),name)).contractAddress;}
async function write(address,name,functionName,args){const params={address,abi:artifacts[name].abi,functionName,args,account:A};const sim=await client.simulateContract(params);const gas=await client.estimateContractGas(params);return receipt(await wallet.writeContract({...sim.request,gas:gas+gas/10n}),functionName);}
try{
  for(let i=0;i<30;i++){if(child.exitCode!==null)throw new Error(`Isolated Anvil failed: ${startupError}`);try{assert.equal(await client.getChainId(),31337);break;}catch(error){if(i===29)throw error;await new Promise(resolve=>setTimeout(resolve,150));}}
  const token=await deploy('MockUSDC'),manager=await deploy('AegisPolicyManager',[token,A.address]),resolver=await deploy('DemoWeatherResolver',[manager,A.address]);await write(manager,'AegisPolicyManager','initializeAdapter',[resolver]);
  const d={chainId:31337,evidenceOrigin:origin,contracts:{token,manager,resolver}};
  const prepared=prepareEvent(d,1n,Number((await client.getBlock()).timestamp),'live');await write(manager,'AegisPolicyManager','registerEvent',[prepared.terms]);
  // Advance only this owned test process. The existing 8545 chain is never reset or warped.
  await client.request({method:'evm_setNextBlockTimestamp',params:[prepared.spec.captureEligibleAt+10]});await client.request({method:'evm_mine',params:[]});clock=Number((await client.getBlock()).timestamp);
  local=await localStorage(fileURLToPath(new URL('evidence/',runDir)));const store=new EvidenceStore(local.bucket,local.db);
  const env={RPC_URL:rpc,ALLOWED_MANAGERS:manager,LOCAL_ONLY:'true'};
  const providerRaw=JSON.stringify({latitude:18.5,longitude:73.75,timezone:'Asia/Kolkata',utc_offset_seconds:19800,daily_units:{time:'iso8601',rain_sum:'mm'},daily:{time:[prepared.spec.observationDate],rain_sum:[49.999]}});
  server=httpServer.createServer(async(req,res)=>{try{const chunks=[];for await(const c of req)chunks.push(c);const request=new Request(`${origin}${req.url}`,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});const result=await handle(request,env,{store,now:()=>clock,fetcher:async url=>{++providerCalls;const query=new URL(url);assert.equal(query.origin+query.pathname,'https://archive-api.open-meteo.com/v1/archive');assert.equal(query.searchParams.get('latitude'),'18.5196');assert.equal(query.searchParams.get('start_date'),prepared.spec.observationDate);assert.equal(query.searchParams.get('end_date'),prepared.spec.observationDate);assert.equal(query.searchParams.get('models'),'era5');return new Response(providerRaw,{headers:{'content-type':'application/json'}});}});res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));}catch(error){res.writeHead(500);res.end(error.message);}});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(8788,'127.0.0.1',resolve);});
  async function signed(action,body,payloadHash){const expiresAt=clock+180,nonce=crypto.randomUUID();const message=authorizationMessage({origin,action,manager,eventId:'1',payloadHash,expiresAt,nonce});const signature=await A.signMessage({message});const r=await fetch(`${origin}/${action}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...body,manager,eventId:'1',expiresAt,nonce,signature})});const result=await r.json();assert.equal(r.status,200,JSON.stringify(result));return result;}
  const objects=[{kind:'specification',payload:prepared.spec}];await signed('publish',{objects},hashJSON(objects));
  const captured=await signed('capture',{},prepared.terms.specHash);assert.equal(captured.eligibleToCommit,true);assert.equal(providerCalls,1);
  const bytes=new Uint8Array(await(await fetch(`${origin}/evidence/${captured.responseHash}`)).arrayBuffer());assert.equal(hashBytes(bytes),captured.responseHash);
  const ctx=await loadContext(env,manager,'1');const args=resolverCommitArgs(ctx,captured.manifest,bytes,prepared.spec,origin);
  await assert.rejects(client.simulateContract({account:B,address:resolver,abi:artifacts.DemoWeatherResolver.abi,functionName:'commitEvidence',args}),/Unauthorized/);
  await write(resolver,'DemoWeatherResolver','commitEvidence',args);await write(resolver,'DemoWeatherResolver','finalize',[ctx.requestId]);
  const resolution=await client.readContract({address:resolver,abi:artifacts.DemoWeatherResolver.abi,functionName:'getResolution',args:[ctx.requestId]});assert.equal(resolution.status,4);assert.equal(resolution.rainfallMilliMm,49999n);assert.equal(resolution.manifestHash,captured.manifestHash);assert.equal(resolution.responseHash,captured.responseHash);
  await fs.writeFile(new URL('results.json',runDir),JSON.stringify({network:'ISOLATED LOCAL ONLY',providerTransport:'MOCKED ERA5 RESPONSE — NOT A REAL WEATHER OBSERVATION',contracts:d.contracts,sourceURL:captured.manifest.sourceURL,manifestHash:captured.manifestHash,responseHash:captured.responseHash,resolutionStatus:'Final NO',receipts},null,2));
  await fs.mkdir(new URL('../.local/qa/',import.meta.url),{recursive:true});await fs.writeFile(new URL('../.local/qa/oracle-integration-results.json',import.meta.url),JSON.stringify({network:'ISOLATED LOCAL ONLY',providerTransport:'MOCKED',passed:['authorized specification publication','exact date ERA5 request','raw response archival','evidence hashes','unauthorized resolver rejected','real local commitEvidence receipt','real local finalization','inclusive threshold produces NO at 49.999 mm'],record:fileURLToPath(new URL('results.json',runDir))},null,2));
  console.log('Oracle integration QA passed: mocked ERA5 transport, independent archive, and real authorized LOCAL commit/finalization.');
}finally{if(server)await new Promise(resolve=>server.close(resolve));if(local)local.close();child.kill();}
