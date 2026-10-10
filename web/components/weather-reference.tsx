'use client';
import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {hashBytes} from '@/lib/generated/core.mjs';
import {validateWeatherResponse,weatherRequest,type City,type WeatherRecord} from '@/lib/generated/weather-client.mjs';
import {date,type Deployment,type Protocol} from '@/lib/protocol';
import {loadWeatherSpecification} from '@/lib/weather-evidence';

async function reference(d:Deployment,route:string){
  const response=await fetch(`${d.evidenceOrigin}${route}`,{signal:AbortSignal.timeout(45000)});
  const record=await response.json();if(!response.ok)throw new Error(record.error||'Weather reference unavailable');
  return record as WeatherRecord;
}
export function ForecastReference({event,deployment:d}:{event:Protocol['events'][number];deployment:Deployment}){
  const spec=useQuery({queryKey:['weather-spec',d.chainId,event.terms.specHash],queryFn:()=>loadWeatherSpecification(event,d),retry:0});
  const forecast=useQuery({queryKey:['forecast',d.evidenceOrigin,spec.data?.city,spec.data?.observationDate],queryFn:()=>reference(d,`/weather/forecast?city=${spec.data?.city||'pune'}&date=${spec.data!.observationDate}`),enabled:!!spec.data&&event.terms.mode===0,retry:0,staleTime:600000});
  return <section className="panel"><h3>Forecast reference</h3>{event.terms.mode===1?<p className="muted">Historical and synthetic demonstrations have no future-risk forecast.</p>:forecast.data?<><div className="observation-summary"><div><span>Expected rainfall · {forecast.data.observations[0].date}</span><strong>{forecast.data.observations[0].rainfallMm??'Unavailable'} <small>mm</small></strong></div></div><p className="tiny">Open-Meteo forecast · retrieved {date(forecast.data.retrievedAt)}. No calibrated uncertainty estimate is supplied.</p><a className="text-link" href={forecast.data.apiRequest} target="_blank" rel="noreferrer">Inspect forecast request</a></>:<p className="muted">{forecast.isFetching?'Retrieving forecast…':forecast.error?.message||'Forecast unavailable.'}</p>}<p className="tiny">Reference only. Final settlement uses the committed historical ERA5 observation. Underwriter quotes remain authoritative.</p></section>;
}
export function HistoricalDiscovery({deployment:d}:{deployment:Deployment}){
  const [city,setCity]=useState<City>('pune');
  const history=useQuery({queryKey:['historical-discovery',d.evidenceOrigin,city],queryFn:async()=>{
    const record=await reference(d,`/weather/history?city=${city}`);
    const response=await fetch(`${d.evidenceOrigin}/evidence/${record.responseHash}`,{signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error('Historical archive unavailable');const bytes=new Uint8Array(await response.arrayBuffer());if(hashBytes(bytes)!==record.responseHash)throw new Error('Historical response hash mismatch');
    const validated=validateWeatherResponse(bytes,weatherRequest(city,record.request.parameters.start_date,record.request.parameters.end_date));return {...record,...validated};
  },retry:0,staleTime:3600000});
  const threshold=city==='pune'?50:75;
  const cases=['YES','NO'].map(outcome=>({outcome,reading:history.data?.observations.find(o=>o.status==='available'&&(Number(o.rainfallMm)>=threshold)===(outcome==='YES'))}));
  return <section className="panel weather-evidence-panel"><div className="card-top"><h2>Inspect a historical rainfall event</h2><label>Location<select aria-label="Historical weather city" value={city} onChange={e=>setCity(e.target.value as City)}><option value="pune">Pune</option><option value="mumbai">Mumbai</option></select></label></div><p className="simulation-label">HISTORICAL REPLAY — TESTNET DEMONSTRATION</p><p className="muted">Real archived ERA5 readings for June–September 2026. Discovery candidates are not registered markets, quotes, or advance-purchased insurance.</p>{history.data?<><div className="fields-grid">{cases.map(({outcome,reading})=><div key={outcome}><span>{outcome} · rainfall {outcome==='YES'?'≥':'<'} {threshold} mm</span><h3>{reading?`${reading.rainfallMm} mm`:'No candidate found'}</h3><p>{reading?.date}</p></div>)}</div><dl className="weather-evidence-fields"><div><dt>Requested coordinates</dt><dd>{history.data.requestedCoordinates.latitude}, {history.data.requestedCoordinates.longitude}</dd></div><div><dt>Returned grid coordinates</dt><dd>{history.data.returnedCoordinates.latitude}, {history.data.returnedCoordinates.longitude}</dd></div><div><dt>Source</dt><dd>Open-Meteo · ERA5 · rain_sum · mm · Asia/Kolkata</dd></div><div><dt>Retrieved</dt><dd>{date(history.data.retrievedAt)}</dd></div><div><dt>Archived response hash</dt><dd><code>{history.data.responseHash}</code></dd></div></dl><div className="evidence-actions"><a className="text-link" href={`${d.evidenceOrigin}/evidence/${history.data.responseHash}`} target="_blank" rel="noreferrer">Inspect archived response</a><a className="text-link" href={history.data.apiRequest} target="_blank" rel="noreferrer">Exact provider request</a></div></>:<p role="status" className={history.error?'error':'muted'}>{history.isFetching?'Retrieving and verifying historical ERA5 bytes…':history.error?.message||'Historical source unavailable.'}</p>}<p className="tiny">A hash verifies consistency of archived bytes. The weather provider and resolver remain trusted. A registered replay’s onchain evidence and payout appear separately below.</p></section>;
}
