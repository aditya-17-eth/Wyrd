import fs from 'node:fs/promises';
import path from 'node:path';
import {weatherRequest,fetchWeather,replayCandidates,assertHistoricalAvailableDate,type City} from '../evidence/src/weather-client.mjs';
const args=process.argv.slice(2),command=args.shift()||'discover';
const option=(name:string,fallback:string)=>args.includes(`--${name}`)?args[args.indexOf(`--${name}`)+1]:fallback;
const start=option('start','2026-06-01'),end=option('end','2026-09-30');
const directory=path.resolve('.local/weather');await fs.mkdir(directory,{recursive:true});
const cities:City[]=command==='discover'?['pune','mumbai']:[option('city','pune') as City];
const results=[];
for(const city of cities){
  const forecast=command==='forecast',date=option('date',start);
  const request=weatherRequest(city,command==='discover'?start:date,command==='discover'?end:date,forecast?'forecast':'historical');
  if(!forecast)assertHistoricalAvailableDate(request.parameters.end_date,Math.floor(Date.now()/1000));
  const record=await fetchWeather(request);
  await fs.writeFile(path.join(directory,`${record.responseHash}.json`),record.raw);
  const {raw,...metadata}=record;
  const candidates=command==='discover'?replayCandidates(record,city==='pune'?50:75):[];
  await fs.writeFile(path.join(directory,`${city}-${command}.json`),JSON.stringify({...metadata,candidates},null,2));
  results.push({city,apiRequest:record.apiRequest,responseHash:record.responseHash,retrievedAt:record.retrievedAt,returnedCoordinates:record.returnedCoordinates,candidates,observations:command==='discover'?undefined:record.observations});
}
console.log(JSON.stringify(results,null,2));
