// Read-only provider compatibility audit. Never creates or resolves a market.
import fs from 'node:fs/promises';
import {sourceConfig,sourceURL,validateProvider,hashBytes} from '../evidence/src/core.mjs';
const observationDate=process.argv[2];if(!observationDate)throw new Error('Supply one exact historical date: node scripts/check-era5-source.mjs YYYY-MM-DD');
const source=sourceConfig(observationDate),url=sourceURL(source);
const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(15000),headers:{accept:'application/json'}});
const raw=new Uint8Array(await response.arrayBuffer());
if(response.status!==200||!response.headers.get('content-type')?.includes('application/json'))throw new Error(`Provider unavailable or incompatible: HTTP ${response.status}`);
const validation=validateProvider(raw,{observationDate,source,thresholdMilliMm:'50000'});
await fs.mkdir(new URL('../.local/qa/',import.meta.url),{recursive:true});
await fs.writeFile(new URL('../.local/qa/era5-provider-response.json',import.meta.url),raw);
const result={purpose:'READ-ONLY PROVIDER AUDIT — NOT MARKET SETTLEMENT OR REPLAY INSURANCE',sourceURL:url,observedDate:observationDate,retrievedAt:new Date().toISOString(),httpStatus:response.status,responseHash:hashBytes(raw),rainfallMilliMm:validation.rainfallMilliMm,unit:validation.unit,grid:validation.grid};
await fs.writeFile(new URL('../.local/qa/era5-provider-check.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
