'use client';
import {useQuery} from '@tanstack/react-query';
import {ExternalLink,FileCheck2,Clock} from 'lucide-react';
import type {Hex} from 'viem';
import {sourceURL} from '@/lib/generated/core.mjs';
import {loadWeatherSpecification,loadArchivedObservation} from '@/lib/weather-evidence';
import {date,millimetres,short,type Deployment,type Protocol} from '@/lib/protocol';

type Catalog={snapshot:{manifest_hash:Hex}|null;attempts:{status:string;detail:string|null;completed_at:number;manifest_hash:Hex}[]};
export function WeatherEvidencePanel({event:e,deployment:d}:{event:Protocol['events'][number];deployment:Deployment}){
  const spec=useQuery({queryKey:['weather-spec',d.chainId,e.terms.specHash],queryFn:()=>loadWeatherSpecification(e,d),retry:0});
  const catalog=useQuery({queryKey:['weather-catalog',d.evidenceOrigin,d.contracts?.manager,e.id.toString()],queryFn:async()=>{const response=await fetch(`${d.evidenceOrigin}/events?manager=${d.contracts!.manager}&eventId=${e.id}`,{cache:'no-store'});if(!response.ok)throw new Error('Capture history is unavailable.');return response.json() as Promise<Catalog>;},enabled:e.terms.mode===0,refetchInterval:15000,retry:0});
  const onchain=e.resolution.status>=2&&e.resolution.status!==5;
  const manifestHash=onchain?e.resolution.manifestHash:catalog.data?.snapshot?.manifest_hash;
  const evidence=useQuery({queryKey:['weather-observation',d.chainId,e.id.toString(),manifestHash,e.resolution.status,e.resolution.rainfallMilliMm.toString(),e.resolution.capturedAt.toString(),e.resolution.responseHash],queryFn:()=>loadArchivedObservation(e,d,manifestHash!),enabled:!!manifestHash,retry:0});
  const live=e.terms.mode===0;
  const replay=spec.data?.mode==='historical-replay';
  const latest=catalog.data?.attempts.at(-1);
  const source=spec.data?.source;
  return <section className="weather-evidence-panel" aria-label={`Weather evidence event ${e.id}`}>
    <div className="card-top"><div className="weather-evidence-title"><FileCheck2 size={20}/><h3>{live?'ERA5 rainfall observation':'Precommitted replay observation'}</h3></div><span className="pill">{e.resolution.status===5?'Final INVALID':onchain?'Committed onchain':manifestHash?'Archived · awaiting authority':live?'Awaiting ERA5 evidence':'Awaiting replay fixture'}</span></div>
    {!live&&<p className="simulation-label">{replay?'HISTORICAL REPLAY — TESTNET DEMONSTRATION. Actual archived ERA5 rainfall; the future purchase clock is for test execution only.':'Synthetic testnet replay. This observation is simulated, not a provider reading or a future-risk insurance market.'}</p>}
    <div className="observation-summary"><div><span>{live||replay?'Verified archive reading':'Simulated reading'}</span><strong>{evidence.data?millimetres(BigInt(evidence.data.manifest.validation.rainfallMilliMm)):'—'} <small>mm</small></strong></div><div><span>Governing observation date</span><strong className="observation-date">{spec.data?.historicalObservationDate||spec.data?.observationDate||'Loading committed specification'}</strong></div></div>
    <dl className="weather-evidence-fields"><div><dt>Resolution status</dt><dd>{['Unregistered','Awaiting evidence','Evidence committed','Final YES','Final NO','Final INVALID'][e.resolution.status]}</dd></div><div><dt>Source</dt><dd>{live?'Open-Meteo historical archive · ERA5 · rain_sum':'Precommitted synthetic fixture'}</dd></div><div><dt>Requested coordinates</dt><dd>{source?`${source.parameters.latitude}, ${source.parameters.longitude}`:'Specification unavailable'}</dd></div><div><dt>Governing grid</dt><dd>{source?`${source.governingGrid.latitude}, ${source.governingGrid.longitude}`:'Specification unavailable'}</dd></div><div><dt>Observation convention</dt><dd>Daily rainfall · mm · Asia/Kolkata</dd></div><div><dt>Evidence manifest hash</dt><dd><code>{manifestHash||'No selected evidence'}</code></dd></div><div><dt>Raw response hash</dt><dd><code>{evidence.data?.verified.responseHash||'No verified raw response'}</code></dd></div><div><dt>Snapshot retrieved</dt><dd>{evidence.data?date(evidence.data.manifest.capturedAt):'Not available'}</dd></div></dl>
    {live&&e.resolution.status===1&&!manifestHash&&<p className="availability-note"><Clock size={15}/>{latest?.detail?`${latest.detail}. No observation has been selected; retry capture while the committed window remains open.`:`ERA5 data can arrive with a delay. Capture becomes eligible ${date(e.terms.captureEligibleAt)}. Missing data is never treated as zero rainfall.`}</p>}
    {evidence.error&&<p className="error" role="status">Observation verification failed: {evidence.error.message}</p>}{spec.error&&<p className="error">Specification verification failed: {spec.error.message}</p>}{live&&catalog.error&&<p className="tiny error">{catalog.error.message} Onchain commitments remain available.</p>}
    <div className="evidence-actions">{source&&(live||replay)&&<a className="text-link" href={sourceURL(source)} target="_blank" rel="noreferrer">Exact daily source request <ExternalLink size={13}/></a>}{manifestHash&&<a className="text-link" href={`${d.evidenceOrigin}/evidence/${manifestHash}`} target="_blank" rel="noreferrer">Manifest {short(manifestHash)} <ExternalLink size={13}/></a>}</div>
    <p className="tiny">{live?'Verified means the archived bytes, date, units, source configuration, and calculation match the committed specification. Provider authenticity and the resolver remain trusted. No forecast endpoint or model substitution is used.':'Replay outcomes are isolated from live ERA5 resolution.'}</p>
  </section>;
}

