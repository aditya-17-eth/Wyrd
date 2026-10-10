import {keccak256,type Hex,type WalletClient,type Address} from 'viem';
import {verifySpecificationTerms,verifyBundle,resolverCommitArgs,authorizationMessage} from './generated/core.mjs';
import {publicClient,type Deployment,type Protocol} from './protocol';
import {abis} from './generated/abis';

export async function signedEvidencePost(d:Deployment,walletClient:WalletClient|undefined,address:Address|undefined,action:'capture'|'publish',body:Record<string,unknown>,payloadHash:Hex,eventId:string){
  if(!walletClient||!address)throw new Error('Connect authorized wallet');
  const origin=new URL(d.evidenceOrigin).origin,expiresAt=Math.floor(Date.now()/1000)+180,nonce=crypto.randomUUID();
  const message=authorizationMessage({origin,action,manager:d.contracts!.manager,eventId,payloadHash,expiresAt,nonce});
  const signature=await walletClient.signMessage({account:address,message});
  const response=await fetch(`${origin}/${action}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...body,manager:d.contracts!.manager,eventId,expiresAt,nonce,signature})});
  const result=await response.json();if(!response.ok)throw new Error(result.error||'Evidence request failed');return result;
}

export async function archivedBytes(uri:string,expectedHash:string){
  const response=await fetch(uri,{cache:'no-store'});
  if(!response.ok)throw new Error(`Evidence archive unavailable (HTTP ${response.status}). Retry when the service is available.`);
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(keccak256(bytes)!==expectedHash)throw new Error('Archived evidence bytes do not match the committed hash.');
  return bytes;
}
export async function loadWeatherSpecification(event:Protocol['events'][number],d:Deployment){
  const bytes=await archivedBytes(event.terms.specificationURI,event.terms.specHash);
  const spec=JSON.parse(new TextDecoder().decode(bytes));
  verifySpecificationTerms(spec,event.terms);
  if(spec.chainId!==d.chainId||spec.manager!==d.contracts!.manager.toLowerCase()||spec.adapter.toLowerCase()!==d.contracts!.resolver.toLowerCase()||spec.eventId!==event.id.toString())throw new Error('Archived specification belongs to a different market.');
  return spec;
}
export async function loadArchivedObservation(event:Protocol['events'][number],d:Deployment,manifestHash:Hex){
  const origin=new URL(d.evidenceOrigin).origin;
  const spec=await loadWeatherSpecification(event,d);
  const manifestBytes=await archivedBytes(`${origin}/evidence/${manifestHash}`,manifestHash);
  const manifest=JSON.parse(new TextDecoder().decode(manifestBytes));
  const raw=await archivedBytes(`${origin}/evidence/${manifest.responseHash}`,manifest.responseHash);
  const verified=verifyBundle(manifest,raw,spec);
  if(verified.manifestHash!==manifestHash)throw new Error('Archived manifest is not canonical.');
  if(event.terms.mode===0&&manifest.requestId!==event.requestId)throw new Error('Evidence belongs to a different resolver request.');
  if(event.resolution.status>=2&&event.resolution.status!==5&&(event.resolution.manifestHash!==manifestHash||event.resolution.responseHash!==verified.responseHash||event.resolution.rainfallMilliMm!==BigInt(manifest.validation.rainfallMilliMm)||event.resolution.capturedAt!==BigInt(manifest.capturedAt)))throw new Error('Archived rainfall or timestamp differs from the onchain observation.');
  return {spec,manifest,raw,verified};
}
export async function verifiedResolverArgs(event:Protocol['events'][number],d:Deployment,manifestHash:Hex){
  const bundle=await loadArchivedObservation(event,d,manifestHash);
  if(event.terms.mode===0){
    const response=await fetch(`${d.evidenceOrigin}/events?manager=${d.contracts!.manager}&eventId=${event.id}`,{cache:'no-store'});
    if(!response.ok)throw new Error('Cannot verify the selected ERA5 snapshot. Retry the independent evidence service.');
    const catalog=await response.json();
    if(catalog.snapshot?.manifest_hash!==manifestHash)throw new Error('Only the first selected valid ERA5 snapshot may be committed.');
  }
  const client=publicClient(d);
  const [block,resolution]=await Promise.all([client.getBlock({blockTag:'latest'}),client.readContract({address:d.contracts!.resolver,abi:abis.DemoWeatherResolver,functionName:'getResolution',args:[event.requestId]})]);
  return resolverCommitArgs({chainId:d.chainId,manager:d.contracts!.manager,adapter:d.contracts!.resolver,eventId:event.id.toString(),requestId:event.requestId,terms:event.terms,resolution,chainTime:Number(block.timestamp)},bundle.manifest,bundle.raw,bundle.spec,d.evidenceOrigin);
}
