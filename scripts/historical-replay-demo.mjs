// Owns an isolated Anvil process. Actual archived Open-Meteo bytes; mock assets only.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import httpServer from 'node:http';
import {fileURLToPath} from 'node:url';
import {createPublicClient,createWalletClient,http,toHex} from 'viem';
import {anvil} from 'viem/chains';
import {mnemonicToAccount} from 'viem/accounts';
import {prepareEvent} from './event-bundle.mjs';
import {fetchWeather,weatherRequest} from '../evidence/src/weather-client.mjs';
import {canonical,hashJSON,verifyBundle,resolverCommitArgs,verifySpecificationTerms} from '../evidence/src/core.mjs';
import {EvidenceStore} from '../evidence/src/storage.mjs';
import {localStorage} from '../evidence/scripts/local-storage.mjs';
import {handle} from '../evidence/src/service.mjs';

const runDir=new URL(`../.local/historical-replay/${Date.now()}/`,import.meta.url);await fs.mkdir(runDir,{recursive:true});
const records=[];
for(const date of ['2026-07-04','2026-06-01'])records.push(await fetchWeather(weatherRequest('pune',date)));
const rpc='http://127.0.0.1:8546',origin='http://127.0.0.1:8788';
const child=spawn(fileURLToPath(new URL('../.tools/foundry/anvil.exe',import.meta.url)),['--network','monad','--chain-id','31337','--host','127.0.0.1','--port','8546','--silent'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
let startupError='';child.stderr.on('data',data=>startupError+=data);
const client=createPublicClient({chain:anvil,transport:http(rpc,{timeout:1000,retryCount:0})});
const accounts=[0,1].map(addressIndex=>mnemonicToAccount('test test test test test test test test test test test junk',{addressIndex}));
const [A,B]=accounts.map(account=>createWalletClient({account,chain:anvil,transport:http(rpc)}));
const artifacts=JSON.parse(await fs.readFile(new URL('../.local/artifacts.json',import.meta.url),'utf8')),receipts=[],scenarios=[];
let local,server;
async function receipt(hash,action){const r=await client.waitForTransactionReceipt({hash});assert.equal(r.status,'success');receipts.push({hash,action,block:r.blockNumber.toString()});return r;}
async function deploy(name,args=[]){return(await receipt(await A.deployContract({...artifacts[name],args}),`deploy ${name}`)).contractAddress;}
async function write(wallet,address,name,functionName,args=[]){const params={address,abi:artifacts[name].abi,functionName,args,account:wallet.account};const sim=await client.simulateContract(params),gas=await client.estimateContractGas(params);return receipt(await wallet.writeContract({...sim.request,gas:gas+gas/10n}),functionName);}
const read=(address,name,functionName,args=[])=>client.readContract({address,abi:artifacts[name].abi,functionName,args});
try{
  for(let i=0;i<30;i++){if(child.exitCode!==null)throw new Error(startupError);try{assert.equal(await client.getChainId(),31337);break;}catch(error){if(i===29)throw error;await new Promise(r=>setTimeout(r,150));}}
  const token=await deploy('MockUSDC'),manager=await deploy('AegisPolicyManager',[token,accounts[0].address]),resolver=await deploy('DemoWeatherResolver',[manager,accounts[0].address]);await write(A,manager,'AegisPolicyManager','initializeAdapter',[resolver]);
  const d={chainId:31337,rpcUrl:rpc,evidenceOrigin:origin,contracts:{token,manager,resolver}};
  local=await localStorage(fileURLToPath(new URL('evidence/',runDir)));const store=new EvidenceStore(local.bucket,local.db);
  const env={RPC_URL:rpc,ALLOWED_MANAGERS:manager,LOCAL_ONLY:'true'};
  server=httpServer.createServer(async(req,res)=>{try{const chunks=[];for await(const chunk of req)chunks.push(chunk);const request=new Request(`${origin}${req.url}`,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});const response=await handle(request,env,{store});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch(error){res.writeHead(500);res.end(error.message);}});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(8788,'127.0.0.1',resolve);});
  const deploymentFile=fileURLToPath(new URL('deployment.json',runDir));await fs.writeFile(deploymentFile,JSON.stringify(d,null,2));
  const cli=async(command,eventId,bundle)=>{
    const args=['--experimental-strip-types',fileURLToPath(new URL('./oracle.ts',import.meta.url)),command,'--deployment',deploymentFile,'--event',String(eventId),...(bundle?['--bundle',bundle]:[])];
    // Conventional disposable Anvil key, passed only in child memory; never written or logged.
    const processEnv={...process.env,ORACLE_PRIVATE_KEY:toHex(accounts[0].getHdKey().privateKey)};
    const output=await new Promise((resolve,reject)=>{const runner=spawn(process.execPath,args,{env:processEnv,windowsHide:true,stdio:['ignore','pipe','pipe']});let stdout='',stderr='';runner.stdout.on('data',chunk=>stdout+=chunk);runner.stderr.on('data',chunk=>stderr+=chunk);runner.on('error',reject);runner.on('close',code=>code===0?resolve(stdout):reject(new Error(`Oracle CLI failed: ${stderr}`)));});
    return JSON.parse(output);
  };
  for(const wallet of [A,B])await write(wallet,token,'MockUSDC','faucet');
  await write(A,manager,'AegisPolicyManager','createVault',[accounts[0].address,(await client.getBlock()).timestamp+3n*86400n,[accounts[0].address],1]);
  const vault=await read(manager,'AegisPolicyManager','vaults',[1n]);await write(A,token,'MockUSDC','approve',[vault,1000_000_000n]);await write(A,vault,'AegisUnderwritingVault','deposit',[1000_000_000n]);await write(A,vault,'AegisUnderwritingVault','beginUnderwriting');await write(B,token,'MockUSDC','approve',[manager,50_000_000n]);
  for(const record of records){
    const eventId=await read(manager,'AegisPolicyManager','eventCount')+1n;
    const prepared=prepareEvent(d,eventId,Number((await client.getBlock()).timestamp),'historical-replay','YES',{city:'pune',record});
    verifySpecificationTerms(prepared.spec,prepared.terms);verifyBundle(prepared.bundle.manifest,record.raw,prepared.spec);
    await write(A,manager,'AegisPolicyManager','registerEvent',[prepared.terms]);
    await store.put(hashJSON(prepared.spec),canonical(prepared.spec));await store.put(prepared.bundle.responseHash,record.raw,'application/json');await store.put(prepared.bundle.manifestHash,canonical(prepared.bundle.manifest));
    await fs.writeFile(new URL(`${eventId}-bundle.json`,runDir),JSON.stringify(prepared,null,2));
    await write(A,manager,'AegisPolicyManager','publishQuote',[eventId,1n,200_000_000n,25_000_000n,(await client.getBlock()).timestamp+86400n]);await write(B,manager,'AegisPolicyManager','purchase',[eventId]);
    const policyId=await read(manager,'AegisPolicyManager','policyCount'),requestId=await read(manager,'AegisPolicyManager','requestIds',[eventId]);scenarios.push({eventId,policyId,requestId,prepared,record});
  }
  assert.equal(await read(vault,'AegisUnderwritingVault','reservedCoverage'),400_000_000n);assert.equal(await read(manager,'AegisPolicyManager','premiumEscrow'),50_000_000n);
  for(const s of scenarios){
    const ctx={chainId:31337,manager,adapter:resolver,eventId:String(s.eventId),requestId:s.requestId,terms:await read(manager,'AegisPolicyManager','getEvent',[s.eventId]),resolution:await read(resolver,'DemoWeatherResolver','getResolution',[s.requestId]),chainTime:Number((await client.getBlock()).timestamp)};
    const args=resolverCommitArgs(ctx,s.prepared.bundle.manifest,s.record.raw,s.prepared.spec,origin);
    await assert.rejects(client.simulateContract({account:accounts[1],address:resolver,abi:artifacts.DemoWeatherResolver.abi,functionName:'commitEvidence',args}),/Unauthorized/);
    const resolved=await cli('resolve',s.eventId,fileURLToPath(new URL(`${s.eventId}-bundle.json`,runDir)));
    for(const tx of resolved.receipts){const receipt=await client.getTransactionReceipt({hash:tx.hash});receipts.push({...tx,block:receipt.blockNumber.toString()});}
    assert.equal(resolved.policies[0].settled,true);
    const verified=await cli('verify',s.eventId);assert.equal(verified.outcome,s.prepared.bundle.manifest.validation.outcome);
    const duplicate=await cli('resolve',s.eventId);assert.equal(duplicate.receipts.length,0);
    const policy=await read(manager,'AegisPolicyManager','getPolicy',[s.policyId]);assert.equal(policy.payout,s.prepared.bundle.manifest.validation.outcome==='YES'?200_000_000n:0n);
    await assert.rejects(client.simulateContract({account:accounts[1],address:manager,abi:artifacts.AegisPolicyManager.abi,functionName:'settlePolicy',args:[s.policyId]}));
    s.payout=policy.payout.toString();
  }
  assert.equal(await read(vault,'AegisUnderwritingVault','reservedCoverage'),0n);assert.equal(await read(vault,'AegisUnderwritingVault','accountedAssets'),850_000_000n);assert.equal(await read(manager,'AegisPolicyManager','premiumEscrow'),0n);
  const result={network:'ISOLATED LOCAL MONAD ANVIL ONLY — NOT PUBLIC TESTNET',provider:'REAL OPEN-METEO ERA5 RESPONSES',label:'HISTORICAL REPLAY — TESTNET DEMONSTRATION',contracts:d.contracts,archiveDirectory:fileURLToPath(new URL('evidence/objects/',runDir)),cases:scenarios.map(s=>({eventId:String(s.eventId),policyId:String(s.policyId),date:s.prepared.spec.historicalObservationDate,rainfallMm:s.record.observations[0].rainfallMm,outcome:s.prepared.bundle.manifest.validation.outcome,payout:s.payout,premium:'25000000',coverage:'200000000',apiRequest:s.record.apiRequest,responseHash:s.record.responseHash,manifestHash:s.prepared.bundle.manifestHash,specHash:s.prepared.terms.specHash})),reservedCoverageBeforeSettlement:'400000000',reservedCoverageAfterSettlement:'0',finalVaultAssets:'850000000',receipts};
  await fs.writeFile(new URL('results.json',runDir),JSON.stringify(result,null,2));await fs.writeFile(new URL('../.local/historical-replay-results.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify({record:fileURLToPath(new URL('results.json',runDir)),...result},null,2));
}finally{if(server)await new Promise(resolve=>server.close(resolve));local?.close();child.kill();}
