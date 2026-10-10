import {createPublicClient,formatUnits,decodeEventLog,type Address,type Abi,type Hex} from 'viem';import {monadTestnet,anvil} from 'viem/chains';import {abis} from './generated/abis';import {pacedHttp} from './rpc';
import {LogScanner} from './log-scanner.mjs';
import {hashBytes,verifySpecificationTerms} from './generated/core.mjs';
type WeatherMetadata={city:string;displayName:string;mode:string;observationDate:string};
const weatherMetadata=new Map<string,WeatherMetadata>();
async function marketWeather(terms:Record<string,unknown>,d:Deployment,eventId:bigint):Promise<WeatherMetadata|undefined>{
  const hash=String(terms.specHash);if(weatherMetadata.has(hash))return weatherMetadata.get(hash);
  try{const response=await fetch(String(terms.specificationURI),{signal:AbortSignal.timeout(2500)});if(!response.ok)return;const bytes=new Uint8Array(await response.arrayBuffer());if(hashBytes(bytes)!==hash)return;const spec=JSON.parse(new TextDecoder().decode(bytes));verifySpecificationTerms(spec,terms);if(spec.chainId!==d.chainId||spec.manager!==d.contracts!.manager.toLowerCase()||spec.adapter!==d.contracts!.resolver.toLowerCase()||spec.eventId!==eventId.toString())return;
    const metadata={city:spec.city||'pune',displayName:spec.city==='mumbai'?'Mumbai':'Pune',mode:spec.mode,observationDate:spec.historicalObservationDate||spec.observationDate};weatherMetadata.set(hash,metadata);return metadata;
  }catch{return;}
}
export type Deployment={chainId:number;status:string;rpcUrl:string;explorer:string;evidenceOrigin:string;deploymentBlock:string|null;contracts:{token:Address;manager:Address;resolver:Address}|null;wallets:{A:Address;B:Address;C:Address};events:{id:string;mode:string;outcome?:string;specification?:Record<string,unknown>}[];transactions:{hash:Hex;label:string}[]};
// Format financial integers without converting to Number, including values above 2^53.
export function exactMoney(value:bigint|undefined){if(value===undefined)return '—';const negative=value<0n;const amount=negative?-value:value;const [whole,frac='']=formatUnits(amount,6).split('.');return `${negative?'−':''}${whole.replace(/\B(?=(\d{3})+(?!\d))/g,',')}${frac?'.'+frac:''}`;}
export const short=(address:string)=>`${address.slice(0,6)}…${address.slice(-4)}`;
export function millimetres(value:bigint){const whole=value/1000n;const fraction=(value%1000n).toString().padStart(3,'0').replace(/0+$/,'');return `${whole}${fraction?'.'+fraction:''}`;}
export const date=(timestamp:number|bigint)=>new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kolkata'}).format(new Date(Number(timestamp)*1000))+' IST';
export const statusNames=['Unregistered','Awaiting evidence','Evidence committed','Final YES','Final NO','Final INVALID'];
export const phaseNames=['Funding','Underwriting','Run-off','Closed'];
type VaultState={accountedAssets:bigint;reservedCoverage:bigint;availableCapacity:bigint;unassignedSurplus:bigint;activePolicies:bigint;realizedPremiums:bigint;settledPayouts:bigint;totalDeposited:bigint;totalRedeemed:bigint;totalSupply:bigint;phase:number;mode:number;quotingManager:Address;issuanceDeadline:bigint};
const verifiedMulticall=new Set<string>();
const probeResults=new Map<string,Promise<boolean>>();
const clientKey=(d:Deployment)=>`${d.chainId}:${d.rpcUrl}`;
function buildClient(d:Deployment){return createPublicClient({chain:d.chainId===31337?anvil:monadTestnet,transport:pacedHttp(d.rpcUrl,{local:d.chainId===31337}),batch:{multicall:verifiedMulticall.has(clientKey(d))?{batchSize:8192,wait:24}:false},pollingInterval:1500});}
const clients=new Map<string,ReturnType<typeof buildClient>>();
export function publicClient(d:Deployment){const key=clientKey(d);if(!clients.has(key))clients.set(key,buildClient(d));return clients.get(key)!;}
async function verifyMulticall(d:Deployment){
  if(d.chainId!==10143||!d.contracts)return false;const key=clientKey(d);
  if(!probeResults.has(key)){const probe=(async()=>{const client=publicClient(d);const code=await client.getCode({address:monadTestnet.contracts.multicall3.address});if(!code||code==='0x')return false;
    const asset=await client.readContract({address:d.contracts!.manager,abi:abis.AegisPolicyManager,functionName:'asset'});
    const [aggregated]=await client.multicall({contracts:[{address:d.contracts!.manager,abi:abis.AegisPolicyManager,functionName:'asset'}],allowFailure:false});
    if(asset.toLowerCase()!==aggregated.toLowerCase())throw new Error('Multicall response differs from direct contract read');
    verifiedMulticall.add(key);clients.delete(key);return true;})();probeResults.set(key,probe);probe.catch(()=>probeResults.delete(key));}
  return probeResults.get(key)!;
}
export async function readProtocol(d:Deployment,address?:Address){
  if(!d.contracts)return null;if(await publicClient(d).getChainId()!==d.chainId)throw new Error('Configured RPC is on the wrong network');await verifyMulticall(d);
  const source=publicClient(d),snapshot=await source.getBlock({blockTag:'latest'});
  const client={...source,readContract:((parameters:Parameters<typeof source.readContract>[0])=>source.readContract({...parameters,blockNumber:snapshot.number})) as typeof source.readContract,getBalance:((parameters:Parameters<typeof source.getBalance>[0])=>source.getBalance({address:parameters.address,blockNumber:snapshot.number})) as typeof source.getBalance};
  const {manager,token,resolver}=d.contracts;
  const [block,counts,authority]=await Promise.all([Promise.resolve(snapshot),Promise.all((['eventCount','vaultCount','quoteCount','policyCount','premiumEscrow'] as const).map(functionName=>client.readContract({address:manager,abi:abis.AegisPolicyManager,functionName}))),client.readContract({address:resolver,abi:abis.DemoWeatherResolver,functionName:'authority'})]);
  const [eventCount,vaultCount,quoteCount,policyCount,escrow]=counts;
  const read=async(to:Address,abi:Abi,functionName:string,args:readonly unknown[]=[])=>client.readContract({address:to,abi,functionName,args});
  const events=await Promise.all(Array.from({length:Number(eventCount)},async(_,i)=>{const id=BigInt(i+1);const [terms,requestId,exposure]=await Promise.all([client.readContract({address:manager,abi:abis.AegisPolicyManager,functionName:'getEvent',args:[id]}),client.readContract({address:manager,abi:abis.AegisPolicyManager,functionName:'requestIds',args:[id]}),client.readContract({address:manager,abi:abis.AegisPolicyManager,functionName:'eventExposure',args:[id]})]);const resolution=await client.readContract({address:resolver,abi:abis.DemoWeatherResolver,functionName:'getResolution',args:[requestId]});const buyerPurchased=address?await client.readContract({address:manager,abi:abis.AegisPolicyManager,functionName:'buyerCoveragePurchased',args:[id,address]}):undefined;const weather=await marketWeather(terms,d,id);return{id,terms,requestId,exposure,resolution,buyerPurchased,weather};}));
  const vaults=await Promise.all(Array.from({length:Number(vaultCount)},async(_,i)=>{const id=BigInt(i+1),vault=await client.readContract({address:manager,abi:abis.AegisPolicyManager,functionName:'vaults',args:[id]});const fields=['accountedAssets','reservedCoverage','availableCapacity','unassignedSurplus','activePolicies','realizedPremiums','settledPayouts','totalDeposited','totalRedeemed','totalSupply','phase','mode','quotingManager','issuanceDeadline'] as const;const values=await Promise.all(fields.map(field=>read(vault,abis.AegisUnderwritingVault,field)));const data=Object.fromEntries(fields.map((field,j)=>[field,values[j]])) as unknown as VaultState;const shares=address?await client.readContract({address:vault,abi:abis.AegisUnderwritingVault,functionName:'balanceOf',args:[address]}):undefined;const invited=address?await client.readContract({address:vault,abi:abis.AegisUnderwritingVault,functionName:'invited',args:[address]}):false;const depositAllowance=address?await client.readContract({address:token,abi:abis.MockUSDC,functionName:'allowance',args:[address,vault]}):undefined;return{id,address:vault,...data,shares,invited,depositAllowance};}));
  const quotes=await Promise.all(Array.from({length:Number(quoteCount)},async(_,i)=>({id:BigInt(i+1),...await client.readContract({address:manager,abi:abis.AegisPolicyManager,functionName:'quotes',args:[BigInt(i+1)]}).then(q=>({eventId:q[0],vaultId:q[1],coverage:q[2],premium:q[3],expiry:q[4],status:q[5],specHash:q[6]}))})));
  const policies=await Promise.all(Array.from({length:Number(policyCount)},async(_,i)=>({id:BigInt(i+1),...await client.readContract({address:manager,abi:abis.AegisPolicyManager,functionName:'getPolicy',args:[BigInt(i+1)]})})));
  const balances=address?await Promise.all([client.readContract({address:token,abi:abis.MockUSDC,functionName:'balanceOf',args:[address]}),client.readContract({address:token,abi:abis.MockUSDC,functionName:'allowance',args:[address,manager]}),client.getBalance({address})]):undefined;
  return{events,vaults,quotes,policies,escrow,authority,now:block.timestamp,tokenBalance:balances?.[0],allowance:balances?.[1],monBalance:balances?.[2]};
}
export type Protocol=NonNullable<Awaited<ReturnType<typeof readProtocol>>>;
export type HistoryEntry={hash:Hex|null;block:bigint|null;event:string;requestId?:Hex;eventId?:bigint;policyId?:bigint;account?:Address;amount?:bigint;timestamp?:bigint};
const blockTimes=new Map<string,bigint>();
const logScanners=new Map<string,LogScanner>();
export async function readHistory(d:Deployment):Promise<HistoryEntry[]>{
  if(!d.contracts||d.deploymentBlock===null)return[];
  const client=publicClient(d),latest=d.chainId===10143?(await client.getBlock({blockTag:'finalized'})).number:await client.getBlockNumber();const vaultCount=await client.readContract({address:d.contracts.manager,abi:abis.AegisPolicyManager,functionName:'vaultCount'});const vaultAddresses=await Promise.all(Array.from({length:Number(vaultCount)},(_,i)=>client.readContract({address:d.contracts!.manager,abi:abis.AegisPolicyManager,functionName:'vaults',args:[BigInt(i+1)]})));const addresses=[d.contracts.manager,d.contracts.resolver,...vaultAddresses];
  const key=`${clientKey(d)}:${d.contracts.manager}:${d.deploymentBlock}`;if(!logScanners.has(key))logScanners.set(key,new LogScanner(BigInt(d.deploymentBlock)));
  const logs=await logScanners.get(key)!.scan(latest,(range:{fromBlock:bigint;toBlock:bigint})=>client.getLogs({address:addresses,...range})) as Awaited<ReturnType<typeof client.getLogs>>;
  const times=new Map<bigint,bigint>();await Promise.all([...new Set(logs.slice(-100).map(log=>log.blockNumber).filter((n):n is bigint=>n!==null))].map(async n=>{const key=`${clientKey(d)}:${n}`;if(!blockTimes.has(key))blockTimes.set(key,(await client.getBlock({blockNumber:n})).timestamp);times.set(n,blockTimes.get(key)!);}));
  return logs.map(log=>{const entry:HistoryEntry={hash:log.transactionHash,block:log.blockNumber,event:'Contract transaction',timestamp:log.blockNumber!==null?times.get(log.blockNumber):undefined};
    try{const decoded=decodeEventLog({abi:[...abis.AegisPolicyManager,...abis.DemoWeatherResolver,...abis.AegisUnderwritingVault],data:log.data,topics:log.topics});entry.event=decoded.eventName;const args=decoded.args as Record<string,unknown>;if(typeof args.requestId==='string')entry.requestId=args.requestId as Hex;if(typeof args.id==='string')entry.requestId=args.id as Hex;if(typeof args.eventId==='bigint')entry.eventId=args.eventId;if(typeof args.policyId==='bigint')entry.policyId=args.policyId;if(typeof args.buyer==='string')entry.account=args.buyer as Address;if(typeof args.underwriter==='string')entry.account=args.underwriter as Address;const amount=args.premium??args.assets??(typeof args.refund==='bigint'&&args.refund>0n?args.refund:args.payout);if(typeof amount==='bigint')entry.amount=amount;}catch{}
    return entry;
  }).reverse();
}
