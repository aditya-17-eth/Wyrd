import {LOCATIONS,MULTICITY_VERSION,sourceConfig,sourceURL,milliMm,hashBytes,dateInIST,DAY,canonical} from './core.mjs';

export function weatherRequest(city,startDate,endDate=startDate,kind='historical'){
  const source=sourceConfig(startDate,MULTICITY_VERSION,city);
  sourceConfig(endDate,MULTICITY_VERSION,city);
  const days=(Date.parse(endDate)-Date.parse(startDate))/86400000+1;
  if(!Number.isInteger(days)||days<1||days>366)throw new Error('Weather range must contain 1–366 days');
  if(!['historical','forecast'].includes(kind))throw new Error('Unsupported weather request');
  source.parameters.end_date=endDate;
  if(kind==='forecast') {source.endpoint='https://api.open-meteo.com/v1/forecast';delete source.parameters.models;delete source.governingGrid;source.validatorVersion='aegis-forecast-reference-v1';if(days>16)throw new Error('Forecast range exceeds 16 days');}
  return {...source,kind,city};
}
export function validateWeatherResponse(raw,request){
  // Derive the entire allowlisted request again: dataset selection is not echoed by the provider.
  const expected=weatherRequest(request.city,request.parameters.start_date,request.parameters.end_date,request.kind);
  if(canonical(expected)!==canonical(request))throw new Error('Wrong dataset or weather request');
  const data=JSON.parse(typeof raw==='string'?raw:new TextDecoder().decode(raw));
  if(!data||Array.isArray(data)||data.error)throw new Error('Invalid provider response');
  if(data.timezone!=='Asia/Kolkata'||data.utc_offset_seconds!==19800)throw new Error('Wrong weather timezone');
  if(data.daily_units?.time!=='iso8601'||data.daily_units?.rain_sum!=='mm')throw new Error('Wrong rainfall units');
  if(!Number.isFinite(data.latitude)||!Number.isFinite(data.longitude))throw new Error('Missing grid coordinates');
  if(request.kind==='historical'&&(String(data.latitude)!==request.governingGrid.latitude||String(data.longitude)!==request.governingGrid.longitude))throw new Error('Wrong ERA5 grid cell');
  if(request.kind==='forecast'&&(Math.abs(data.latitude-Number(request.parameters.latitude))>1||Math.abs(data.longitude-Number(request.parameters.longitude))>1))throw new Error('Forecast grid is outside the requested location');
  const days=(Date.parse(request.parameters.end_date)-Date.parse(request.parameters.start_date))/86400000+1;
  if(!Array.isArray(data.daily?.time)||!Array.isArray(data.daily?.rain_sum)||data.daily.time.length!==days||data.daily.rain_sum.length!==days)throw new Error('Incompatible daily arrays');
  const observations=data.daily.time.map((date,i)=>{
    if(date!==new Date(Date.parse(request.parameters.start_date)+i*86400000).toISOString().slice(0,10))throw new Error('Wrong observation date');
    const value=data.daily.rain_sum[i];
    if(value===null)return {date,status:'unavailable',rainfallMm:null,rainfallMilliMm:null};
    if(typeof value!=='number'||!Number.isFinite(value))throw new Error('Invalid rainfall');
    return {date,status:'available',rainfallMm:value,rainfallMilliMm:milliMm(value).toString()};
  });
  return {city:request.city,displayName:LOCATIONS[request.city].displayName,dataset:request.kind==='historical'?'era5':'Open-Meteo forecast best match',variable:'rain_sum',units:'mm',timezone:data.timezone,gridCellSelection:'nearest',requestedCoordinates:{latitude:request.parameters.latitude,longitude:request.parameters.longitude},returnedCoordinates:{latitude:data.latitude,longitude:data.longitude},observations};
}
export async function fetchWeather(request,{fetcher=fetch,now=()=>Math.floor(Date.now()/1000),sleep=ms=>new Promise(r=>setTimeout(r,ms)),attempts=3}={}){
  if(!Number.isInteger(attempts)||attempts<1||attempts>3)throw new Error('At most three HTTP attempts');
  // Validate inputs before any network call.
  const checked=weatherRequest(request.city,request.parameters.start_date,request.parameters.end_date,request.kind);
  if(canonical(checked)!==canonical(request))throw new Error('Changed weather configuration');
  const apiRequest=sourceURL(request);
  let lastError;
  for(let attempt=0;attempt<attempts;attempt++){
    try{
      const response=await fetcher(apiRequest,{signal:AbortSignal.timeout(10000),redirect:'error',headers:{accept:'application/json'}});
      if(response.status!==200)throw Object.assign(new Error(`Weather provider HTTP ${response.status}`),{retryable:response.status===429||response.status>=500});
      if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('Weather response is not JSON');
      if(Number(response.headers.get('content-length'))>1_000_000)throw new Error('Weather response too large');
      const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.length>1_000_000)throw new Error('Weather response too large');
      const raw=new TextDecoder('utf-8',{fatal:true}).decode(bytes);if(hashBytes(raw)!==hashBytes(bytes))throw new Error('Provider response cannot be archived without altering bytes');
      const validated=validateWeatherResponse(raw,request);
      return {...validated,kind:request.kind,apiRequest,retrievedAt:now(),responseHash:hashBytes(raw),raw,request};
    }catch(error){lastError=error;if(!(error.retryable||['TimeoutError','AbortError','TypeError'].includes(error.name))||attempt===attempts-1)throw error;await sleep(250*2**attempt);}
  }
  throw lastError;
}
export function replayCandidates(record,thresholdMm){
  if(record.kind!=='historical')throw new Error('Forecasts cannot be replay evidence');
  const threshold=milliMm(thresholdMm);
  return ['YES','NO'].map(outcome=>{
    const observation=record.observations.find(o=>o.status==='available'&&(BigInt(o.rainfallMilliMm)>=threshold)===(outcome==='YES'));
    return observation?{...observation,city:record.city,thresholdMm,outcome,dataset:record.dataset,requestedCoordinates:record.requestedCoordinates,returnedCoordinates:record.returnedCoordinates,apiRequest:record.apiRequest,responseHash:record.responseHash,retrievedAt:record.retrievedAt,label:'HISTORICAL REPLAY — TESTNET DEMONSTRATION',registeredMarket:false}:null;
  });
}
export function assertHistoricalAvailableDate(date,now){
  sourceConfig(date,MULTICITY_VERSION);
  if(date>=dateInIST(now-5*DAY))throw new Error('ERA5 publication waiting period has not elapsed');
}
