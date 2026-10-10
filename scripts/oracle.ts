import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createPublicClient,createWalletClient,http,encodeFunctionData,type Hex,type Address} from 'viem';
import {privateKeyToAccount} from 'viem/accounts';
import {monadTestnet,anvil} from 'viem/chains';
import {abis} from '../evidence/src/generated/abis.mjs';
import {context} from '../evidence/src/service.mjs';
import {hashJSON,hashBytes,verifySpecificationTerms,verifyBundle,resolverCommitArgs,authorizationMessage} from '../evidence/src/core.mjs';
import {weatherRequest,fetchWeather,type City} from '../evidence/src/weather-client.mjs';
import {prepareEvent} from './event-bundle.mjs';

const argv=process.argv.slice(2),command=argv.shift();
const option=(name:string,fallback='')=>argv.includes(`--${name}`)?argv[argv.indexOf(`--${name}`)+1]:fallback;
if(!['prepare','resolve','verify'].includes(command||''))throw new Error('Use prepare, resolve, or verify');
const d=JSON.parse(await fs.readFile(option('deployment','deployments/monad-testnet.json'),'utf8'));
if(![10143,31337].includes(d.chainId)||!d.contracts)throw new Error('Verified testnet/local deployment required');
const client=createPublicClient({chain:d.chainId===10143?monadTestnet:anvil,transport:http(d.rpcUrl,{timeout:10000,retryCount:1})});
if(await client.getChainId()!==d.chainId)throw new Error('Wrong blockchain');
const origin=new URL(d.evidenceOrigin);
if(origin.protocol!=='https:'&&!(d.chainId===31337&&['127.0.0.1','localhost'].includes(origin.hostname)&&origin.protocol==='http:'))throw new Error('Independent HTTPS evidence archive required');
await fs.mkdir('.local/oracle',{recursive:true});
if(command==='prepare'){
  const city=option('city','pune') as City,mode=option('mode','live');
  if(!['live','historical-replay'].includes(mode))throw new Error('Use live or historical-replay');
  const threshold=option('threshold',city==='mumbai'?'75':'50');
  if(!['20','50','75'].includes(threshold))throw new Error('Unsupported threshold');
  const count=await client.readContract({address:d.contracts.manager,abi:abis.AegisPolicyManager,functionName:'eventCount'}) as bigint;
  const block=await client.getBlock();
  const record=mode==='historical-replay'?await fetchWeather(weatherRequest(city,option('date'))):undefined;
  const prepared=prepareEvent(d,count+1n,Number(block.timestamp),mode,'YES',{city,thresholdMilliMm:(BigInt(threshold)*1000n).toString(),...(record?{record}:{})});
  const filename=`.local/oracle/${d.chainId}-${prepared.spec.eventId}-${mode}.json`;
  await fs.writeFile(filename,JSON.stringify(prepared,null,2));
  console.log(`Prepared ${filename}. Review immutable terms before administrator registration. No transaction submitted.`);
}else{
  const eventId=option('event');if(!/^\d+$/.test(eventId)||BigInt(eventId)<1n)throw new Error('Supply --event <registered market ID>');
  const env={RPC_URL:d.rpcUrl,ALLOWED_MANAGERS:d.contracts.manager,LOCAL_ONLY:d.chainId===31337?'true':'false'};
  let ctx=await context(env,d.contracts.manager,eventId);
  const readObject=async(hash:Hex)=>{const response=await fetch(`${origin.origin}/evidence/${hash}`,{signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error('Evidence object unavailable');const bytes=new Uint8Array(await response.arrayBuffer());if(hashBytes(bytes)!==hash)throw new Error('Evidence hash mismatch');return bytes;};
  const spec=JSON.parse(new TextDecoder().decode(await readObject(ctx.terms.specHash)));verifySpecificationTerms(spec,ctx.terms);
  if(spec.chainId!==d.chainId||spec.manager!==ctx.manager||spec.adapter!==ctx.adapter.toLowerCase()||spec.eventId!==eventId)throw new Error('Wrong registered specification');
  const account=process.env.ORACLE_PRIVATE_KEY?privateKeyToAccount(process.env.ORACLE_PRIVATE_KEY as Hex):null;
  const cast=fileURLToPath(new URL('../.tools/foundry/cast.exe',import.meta.url));
  const castRun=(args:string[])=>new Promise<string>((resolve,reject)=>{
    if(!process.stdin.isTTY)throw new Error('Run in your terminal to unlock ORACLE_ACCOUNT, or configure ORACLE_PRIVATE_KEY in the server environment. Never enter secrets in chat.');
    const child=spawn(cast,[...args,'--account',process.env.ORACLE_ACCOUNT||'aegis-testnet'],{stdio:['inherit','pipe','inherit'],windowsHide:true});let output='';child.stdout.on('data',chunk=>output+=chunk);child.on('error',reject);child.on('close',code=>code===0?resolve(output.trim()):reject(new Error('User-controlled signer failed')));
  });
  const signedPost=async(action:string,body:Record<string,unknown>,payloadHash:Hex)=>{
    const expiresAt=Math.floor(Date.now()/1000)+180,nonce=crypto.randomUUID();
    const message=authorizationMessage({origin:origin.origin,action,manager:ctx.manager,eventId,payloadHash,expiresAt,nonce});
    const signature=account?await account.signMessage({message}):await castRun(['wallet','sign',message]);
    const response=await fetch(`${origin.origin}/${action}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...body,manager:ctx.manager,eventId,expiresAt,nonce,signature}),signal:AbortSignal.timeout(45000)});
    const result=await response.json();if(!response.ok)throw new Error(result.error||'Evidence service rejected request');return result;
  };
  const receipts:{hash:Hex;action:string}[]=[];
  const write=async(functionName:string,args:unknown[],address:Address=ctx.adapter as Address,abi=abis.DemoWeatherResolver)=>{
    if(account&&account.address.toLowerCase()!==ctx.authority.toLowerCase())throw new Error('Signing account is not authorized resolver');
    const params={address,abi,functionName,args,account:ctx.authority as Address};
    const simulated=await client.simulateContract(params),estimated=await client.estimateContractGas(params),gas=estimated+estimated/10n;
    const hash=account?await createWalletClient({account,chain:client.chain,transport:http(d.rpcUrl)}).writeContract({...simulated.request,gas}):await castRun(['send',address,'--data',encodeFunctionData({abi,functionName,args}),'--rpc-url',d.rpcUrl,'--chain',String(d.chainId),'--gas-limit',String(gas),'--async']) as Hex;
    if(!/^0x[0-9a-fA-F]{64}$/.test(hash))throw new Error('Signer returned invalid transaction hash');
    const receipt=await client.waitForTransactionReceipt({hash});if(receipt.status!=='success')throw new Error('Resolution transaction reverted');receipts.push({hash,action:functionName});
  };
  let manifestHash:Hex;
  if(ctx.resolution.status===1){
    if(command==='verify')throw new Error('Market has no onchain evidence yet');
    if(ctx.terms.mode===0){
      if(ctx.chainTime<Number(ctx.terms.captureEligibleAt)||ctx.chainTime>=Number(ctx.terms.resolutionDeadline))throw new Error('Outside committed ERA5 window; collateral stays reserved. Follow the specification timeout procedure separately.');
      const result=await signedPost('capture',{},ctx.terms.specHash);
      if(!result.eligibleToCommit)throw new Error(`ERA5 unresolved: ${result.manifest?.error||result.observationStatus}; retryAfter=${result.retryAfter||'manual review'}. No NO/INVALID submitted.`);
      manifestHash=result.manifestHash;
    }else{
      const prepared=JSON.parse(await fs.readFile(option('bundle'),'utf8'));
      if(hashJSON(prepared.spec)!==ctx.terms.specHash)throw new Error('Wrong replay bundle');
      const objects=[{kind:'specification',payload:prepared.spec},{kind:'raw-fixture',payload:prepared.bundle.raw},{kind:'fixture-manifest',payload:prepared.bundle.manifest}];
      await signedPost('publish',{objects},hashJSON(objects));manifestHash=ctx.terms.fixtureManifestHash;
    }
    const manifest=JSON.parse(new TextDecoder().decode(await readObject(manifestHash))),raw=await readObject(manifest.responseHash);
    ctx=await context(env,ctx.manager,eventId);await write('commitEvidence',resolverCommitArgs(ctx,manifest,raw,spec,origin.origin));
  }else manifestHash=ctx.resolution.manifestHash;
  ctx=await context(env,ctx.manager,eventId);
  if(ctx.resolution.status===2&&command==='resolve'){await write('finalize',[ctx.requestId]);ctx=await context(env,ctx.manager,eventId);}
  if(![2,3,4].includes(ctx.resolution.status))throw new Error('No verified rainfall settlement');
  const manifest=JSON.parse(new TextDecoder().decode(await readObject(manifestHash))),raw=await readObject(manifest.responseHash);const checked=verifyBundle(manifest,raw,spec);
  if(checked.manifestHash!==ctx.resolution.manifestHash||checked.responseHash!==ctx.resolution.responseHash||BigInt(manifest.validation.rainfallMilliMm)!==ctx.resolution.rainfallMilliMm||BigInt(manifest.capturedAt)!==ctx.resolution.capturedAt||ctx.resolution.status>=3&&ctx.resolution.status!==(manifest.validation.outcome==='YES'?3:4))throw new Error('Onchain outcome differs from archived evidence');
  const policies=[];
  const policyCount=await client.readContract({address:ctx.manager as Address,abi:abis.AegisPolicyManager,functionName:'policyCount'}) as bigint;
  for(let id=1n;id<=policyCount;id++){
    let policy=await client.readContract({address:ctx.manager as Address,abi:abis.AegisPolicyManager,functionName:'getPolicy',args:[id]}) as {eventId:bigint;settled:boolean;coverage:bigint;payout:bigint;outcome:number};
    if(policy.eventId!==BigInt(eventId))continue;
    if(!policy.settled&&command==='resolve'&&ctx.resolution.status>=3){await write('settlePolicy',[id],ctx.manager as Address,abis.AegisPolicyManager);policy=await client.readContract({address:ctx.manager as Address,abi:abis.AegisPolicyManager,functionName:'getPolicy',args:[id]}) as typeof policy;}
    if(policy.settled&&(policy.outcome!==ctx.resolution.status-2||policy.payout!==(manifest.validation.outcome==='YES'?policy.coverage:0n)))throw new Error('Policy payout differs from finalized observation');
    policies.push({policyId:id.toString(),settled:policy.settled,payout:policy.payout.toString()});
  }
  const record={chainId:d.chainId,manager:ctx.manager,eventId,specHash:ctx.terms.specHash,manifestHash,responseHash:checked.responseHash,evidenceReference:`${origin.origin}/evidence/${manifestHash}`,rainfallMilliMm:manifest.validation.rainfallMilliMm,outcome:manifest.validation.outcome,status:ctx.resolution.status,policies,receipts};
  await fs.writeFile(`.local/oracle/${d.chainId}-${eventId}-resolution-${Date.now()}.json`,JSON.stringify(record,null,2));console.log(JSON.stringify(record,null,2));
}
