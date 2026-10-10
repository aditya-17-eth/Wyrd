import {keccak256, toHex, encodeAbiParameters} from 'viem';
export const LEGACY_VALIDATOR_VERSION = 'aegis-era5-daily-v1';
export const VALIDATOR_VERSION = 'aegis-era5-daily-v2';
export const MULTICITY_VERSION = 'aegis-era5-daily-v3';
export const LOCATIONS = Object.freeze({
  pune:Object.freeze({id:'pune',displayName:'Pune',latitude:'18.5204',longitude:'73.8567',grid:Object.freeze({latitude:'18.5',longitude:'73.75'})}),
  mumbai:Object.freeze({id:'mumbai',displayName:'Mumbai',latitude:'19.0760',longitude:'72.8777',grid:Object.freeze({latitude:'19',longitude:'73'})})
});
export const DAY = 86400;
export const ZERO_HASH = `0x${'0'.repeat(64)}`;
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  if (typeof value === 'bigint' || value === undefined || (typeof value==='number' && !Number.isFinite(value))) throw new Error('Invalid canonical JSON value');
  return JSON.stringify(value);
}
export const hashBytes = value => keccak256(typeof value === 'string' ? toHex(value) : value);
export const hashJSON = value => hashBytes(canonical(value));
export function dateInIST(timestamp) { return new Date((Number(timestamp)+19800)*1000).toISOString().slice(0,10); }
export function nextObservationStart(timestamp) {
  let midnight=Math.floor((Number(timestamp)+19800)/DAY)*DAY-19800;
  do { midnight+=DAY; } while(midnight<Number(timestamp)+3*DAY || new Date((midnight+19800)*1000).getUTCDay()!==6);
  return midnight;
}
export function sourceConfig(date,version=VALIDATOR_VERSION,city='pune') {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(`${date}T00:00:00Z`))||new Date(`${date}T00:00:00Z`).toISOString().slice(0,10)!==date) throw new Error('Invalid observation date');
  if(![LEGACY_VALIDATOR_VERSION,VALIDATOR_VERSION,MULTICITY_VERSION].includes(version)) throw new Error('Unsupported validator version');
  if(!Object.hasOwn(LOCATIONS,city)||version!==MULTICITY_VERSION&&city!=='pune') throw new Error('Unsupported city for validator');
  if(version===MULTICITY_VERSION){const location=LOCATIONS[city];return {endpoint:'https://archive-api.open-meteo.com/v1/archive',parameters:{latitude:location.latitude,longitude:location.longitude,start_date:date,end_date:date,daily:'rain_sum',models:'era5',timezone:'Asia/Kolkata',precipitation_unit:'mm',cell_selection:'nearest'},governingGrid:{...location.grid},validatorVersion:version,city};}
  const legacy=version===LEGACY_VALIDATOR_VERSION;
  return {endpoint:'https://archive-api.open-meteo.com/v1/archive', parameters:{latitude:legacy?'18.5204':'18.5196',longitude:legacy?'73.8567':'73.8554',start_date:date,end_date:date,daily:'rain_sum',models:'era5',timezone:'Asia/Kolkata',precipitation_unit:'mm',cell_selection:'nearest',...(legacy?{elevation:'nan'}:{})},governingGrid:{latitude:'18.5',longitude:'73.75'},validatorVersion:version};
}
export function committedSource(spec){
  const expected=sourceConfig(spec.historicalObservationDate||spec.observationDate,spec.source?.validatorVersion,spec.city||'pune');
  if(canonical(spec.source)!==canonical(expected)) throw new Error('Unsupported or changed source configuration');
  return expected;
}
export function sourceURL(source) {
  // Preserve the original v1/v2 URL order even after canonical JSON reload sorts keys.
  const order=['latitude','longitude','start_date','end_date','daily','models','timezone','precipitation_unit','cell_selection','elevation'];
  const keys=[...order.filter(key=>Object.hasOwn(source.parameters,key)),...Object.keys(source.parameters).filter(key=>!order.includes(key)).sort()];
  return `${source.endpoint}?${new URLSearchParams(keys.map(key=>[key,source.parameters[key]]))}`;
}
export function verifySpecificationTerms(spec,terms) {
  if(hashJSON(spec)!==terms.specHash || hashJSON(spec.source)!==terms.sourceConfigHash) throw new Error('Specification hash binding mismatch');
  for(const field of ['observationStart','observationEnd','purchaseCutoff','minimumLeadTime','captureEligibleAt','resolutionDeadline','thresholdMilliMm','maxEventCoverage','maxBuyerCoverage']) {
    if(String(spec[field])!==String(terms[field])) throw new Error(`Specification differs from onchain ${field}`);
  }
  if((spec.mode==='live'?0:['synthetic','historical-replay'].includes(spec.mode)?1:-1)!==terms.mode) throw new Error('Specification mode mismatch');
  if(spec.mode!=='historical-replay'&&spec.historicalObservationDate)throw new Error('Historical date cannot override a live observation');
  if(spec.mode==='historical-replay' && (!spec.historicalObservationDate || spec.demonstrationMode!=='HISTORICAL REPLAY — TESTNET DEMONSTRATION' || Date.parse(spec.historicalObservationDate+'T00:00:00Z')/1000>=spec.observationStart)) throw new Error('Invalid historical replay separation');
  if(spec.mode==='historical-replay'&&(spec.source?.validatorVersion!==MULTICITY_VERSION||spec.historicalObservationStart!==Date.parse(spec.historicalObservationDate+'T00:00:00+05:30')/1000||spec.historicalObservationEnd!==spec.historicalObservationStart+DAY))throw new Error('Invalid historical observation boundaries');
  committedSource(spec);
  if(spec.observationDate!==dateInIST(spec.observationStart) || Number(spec.observationStart)%DAY!==DAY-19800) throw new Error('Wrong observation calendar boundaries');
  if(Number(spec.observationEnd)-Number(spec.observationStart)!==DAY || spec.timezone!=='Asia/Kolkata') throw new Error('Wrong daily observation window');
  if(terms.mode===1 && (!spec.fixture || spec.fixture.responseHash!==terms.fixtureResponseHash || String(spec.fixture.rainfallMilliMm)!==String(terms.fixtureRainfallMilliMm) || ({YES:1,NO:2,INVALID:3}[spec.fixture.outcome])!==terms.fixtureOutcome)) throw new Error('Specification fixture mismatch');
  return true;
}
export function milliMm(value) {
  const text=String(value); if(!/^\d+(\.\d{1,3})?$/.test(text)) throw new Error('Rainfall must be a nonnegative decimal with at most three fractional digits');
  const [whole,fraction='']=text.split('.'); const scaled=BigInt(whole)*1000n+BigInt(fraction.padEnd(3,'0'));
  if(scaled>10_000_000n) throw new Error('Rainfall out of range'); return scaled;
}
export function validateProvider(raw, spec) {
  const data=JSON.parse(typeof raw==='string'?raw:new TextDecoder().decode(raw)); const expected=committedSource(spec);
  if(!data||typeof data!=='object'||Array.isArray(data)) throw new Error('Malformed provider response');
  if(data.error) throw new Error(`Provider error: ${data.reason || 'unknown'}`);
  if(String(data.latitude)!==expected.governingGrid.latitude || String(data.longitude)!==expected.governingGrid.longitude) throw new Error('Wrong governing grid');
  if(data.timezone!=='Asia/Kolkata' || data.utc_offset_seconds!==19800) throw new Error('Wrong timezone or offset');
  if(data.daily_units?.rain_sum!=='mm' || data.daily_units?.time!=='iso8601') throw new Error('Wrong units');
  if(!Array.isArray(data.daily?.time) || data.daily.time.length!==1 || data.daily.time[0]!==(spec.historicalObservationDate||spec.observationDate) || !Array.isArray(data.daily?.rain_sum) || data.daily.rain_sum.length!==1) throw new Error('Missing or incompatible observation');
  if(data.daily.rain_sum[0]===null||data.daily.rain_sum[0]===undefined) throw Object.assign(new Error('ERA5 observation is unavailable or delayed'),{code:'OBSERVATION_UNAVAILABLE'});
  if(typeof data.daily.rain_sum[0]!=='number'||!Number.isFinite(data.daily.rain_sum[0])) throw new Error('Rainfall observation must be a finite number');
  const value=milliMm(data.daily.rain_sum[0]);
  return {rainfallMilliMm:value.toString(),reportedValue:String(data.daily.rain_sum[0]),unit:'mm',grid:expected.governingGrid,outcome:value>=BigInt(spec.thresholdMilliMm)?'YES':'NO'};
}
export function eventSpecification({chainId,manager,adapter,eventId,observationStart,mode='live',fixture,city='pune',thresholdMilliMm='50000',validatorVersion=VALIDATOR_VERSION,historicalObservationDate}) {
  const start=Number(observationStart), end=start+DAY; const date=dateInIST(start);
  return {schema:'aegis-event-v1',product:'PUNE_RAINFALL_COVER',chainId,manager:manager.toLowerCase(),adapter:adapter.toLowerCase(),eventId:String(eventId),mode,
    observationDate:date,observationStart:start,observationEnd:end,timezone:'Asia/Kolkata',purchaseCutoff:start-DAY,minimumLeadTime:DAY,
    thresholdMilliMm:String(thresholdMilliMm),source:sourceConfig(historicalObservationDate||date,validatorVersion,city),captureEligibleAt:end+5*DAY,resolutionDeadline:end+14*DAY,
    ...(validatorVersion===MULTICITY_VERSION?{city,product:`${city.toUpperCase()}_RAINFALL_COVER`,weatherVariable:'rain_sum',unit:'mm',gridCellSelection:'nearest',resolutionGracePeriodDays:14}:{}),
    ...(historicalObservationDate?{historicalObservationDate,historicalObservationStart:Date.parse(historicalObservationDate+'T00:00:00+05:30')/1000,historicalObservationEnd:Date.parse(historicalObservationDate+'T00:00:00+05:30')/1000+DAY,demonstrationMode:'HISTORICAL REPLAY — TESTNET DEMONSTRATION'}:{}),
    snapshotRule:'FIRST_VALID_RESPONSE_ARCHIVED_BY_AEGIS_AFTER_CAPTURE_ELIGIBILITY',revisionPolicy:'FROZEN_SERVED_SNAPSHOT_INCLUDING_PRELIMINARY_ERA5T; NO_LATER_CORRECTIONS',
    maxEventCoverage:'1000000000',maxBuyerCoverage:'200000000',invalidRule:'NO_VALID_ONCHAIN_COMMITMENT_BY_DEADLINE; PERMISSIONLESS_TIMEOUT_ONLY',
    ...(fixture?{fixture:{outcome:fixture.outcome,rainfallMilliMm:String(fixture.rainfallMilliMm),responseHash:fixture.responseHash}}:{}),
    disclosures:['EDUCATIONAL TESTNET; MOCK FUNDS HAVE NO VALUE; NO REAL WORLD COVERAGE','TRUSTED CAPTURE SERVICE AND RESOLVER; NO CHALLENGE WINDOW','GRIDDED REANALYSIS, NOT A LOCAL WEATHER STATION','SERVED DATA MAY BE PRELIMINARY; UPSTREAM RELEASE IDENTIFIER IS NOT PROVIDED']};
}
export function authorizationMessage({origin,action,manager,eventId,payloadHash,expiresAt,nonce}) {
  return `AEGIS Evidence Authorization v1\nOrigin: ${origin}\nChain: 10143\nAction: ${action}\nManager: ${manager.toLowerCase()}\nEvent: ${eventId}\nPayload: ${payloadHash}\nExpires: ${expiresAt}\nNonce: ${nonce}`;
}
export function fixtureBundle(spec, {outcome,rainfallMilliMm}, capturedAt) {
  const raw=canonical({simulation:true,label:'TESTNET DEMONSTRATION — SIMULATED EVENT RESULT',rainfallMilliMm:String(rainfallMilliMm),outcome});
  const responseHash=hashBytes(raw);
  const manifest={schema:'aegis-evidence-v1',kind:'synthetic',chainId:spec.chainId,manager:spec.manager,adapter:spec.adapter,eventId:spec.eventId,specHash:hashJSON(spec),sourceConfigHash:hashJSON(spec.source),responseHash,capturedAt:Number(capturedAt),validatorVersion:spec.source.validatorVersion,validation:{valid:outcome!=='INVALID',rainfallMilliMm:String(rainfallMilliMm),outcome},label:'TESTNET DEMONSTRATION — SIMULATED EVENT RESULT'};
  return {raw,responseHash,manifest,manifestHash:hashJSON(manifest)};
}
export function timeoutPayload({chainId,adapter,requestId,specHash,resolutionDeadline}) {
  return encodeAbiParameters([{type:'string'},{type:'uint256'},{type:'address'},{type:'bytes32'},{type:'bytes32'},{type:'uint64'}],['AEGIS_TIMEOUT_V1',BigInt(chainId),adapter,requestId,specHash,BigInt(resolutionDeadline)]);
}
export function verifyBundle(manifest,raw,spec) {
  committedSource(spec);
  if(manifest.specHash!==hashJSON(spec) || manifest.sourceConfigHash!==hashJSON(spec.source)) throw new Error('Specification binding mismatch');
  for(const field of ['chainId','manager','adapter','eventId']) if(String(manifest[field]).toLowerCase()!==String(spec[field]).toLowerCase()) throw new Error(`Wrong ${field} binding`);
  if(hashBytes(raw)!==manifest.responseHash) throw new Error('Response bytes tampered');
  if(manifest.kind==='live') {
    if(spec.mode!=='live') throw new Error('Live evidence cannot resolve a replay fixture');
    if(manifest.validatorVersion!==spec.source.validatorVersion || canonical(manifest.source)!==canonical(spec.source) || manifest.sourceURL!==sourceURL(spec.source)) throw new Error('Manifest source binding mismatch');
    if(!Number.isSafeInteger(manifest.capturedAt)||manifest.httpStatus!==200) throw new Error('Invalid provider capture metadata');
    if(manifest.capturedAt<spec.captureEligibleAt || manifest.capturedAt>=spec.resolutionDeadline) throw new Error('Snapshot outside capture window');
    if(canonical(validateProvider(raw,spec))!==canonical(manifest.validation)) throw new Error('Rainfall calculation mismatch');
  } else if(manifest.kind==='historical-replay') {
    if(spec.mode!=='historical-replay'||manifest.label!==spec.demonstrationMode)throw new Error('Historical replay cannot settle a live market');
    if(manifest.validatorVersion!==spec.source.validatorVersion||canonical(manifest.source)!==canonical(spec.source)||manifest.sourceURL!==sourceURL(spec.source)||manifest.httpStatus!==200||!Number.isSafeInteger(manifest.capturedAt)||manifest.capturedAt<Date.parse(spec.historicalObservationDate+'T00:00:00+05:30')/1000+6*DAY)throw new Error('Invalid replay provider metadata');
    if(!spec.fixture||manifest.responseHash!==spec.fixture.responseHash||canonical(validateProvider(raw,spec))!==canonical(manifest.validation)||manifest.validation.outcome!==spec.fixture.outcome||manifest.validation.rainfallMilliMm!==spec.fixture.rainfallMilliMm)throw new Error('Historical replay calculation mismatch');
  } else if(manifest.kind==='synthetic') {
    if(spec.mode!=='synthetic') throw new Error('Replay evidence cannot resolve a live market');
    const payload=JSON.parse(typeof raw==='string'?raw:new TextDecoder().decode(raw)); if(!payload.simulation || !spec.fixture || payload.outcome!==spec.fixture.outcome || String(payload.rainfallMilliMm)!==spec.fixture.rainfallMilliMm || manifest.responseHash!==spec.fixture.responseHash) throw new Error('Fixture mismatch');
    if(manifest.validation?.outcome!==spec.fixture.outcome||String(manifest.validation.rainfallMilliMm)!==spec.fixture.rainfallMilliMm)throw new Error('Fixture calculation mismatch');
  } else throw new Error('Unsupported evidence kind');
  return {manifestHash:hashJSON(manifest),responseHash:manifest.responseHash,validation:manifest.validation};
}

// The authority signs these unchanged deployed resolver arguments only after archive verification.
export function resolverCommitArgs(ctx,manifest,raw,spec,evidenceOrigin){
  if(![10143,31337].includes(ctx.chainId)) throw new Error('Unsupported settlement chain');
  verifySpecificationTerms(spec,ctx.terms);
  const checked=verifyBundle(manifest,raw,spec);
  if(manifest.chainId!==ctx.chainId || manifest.manager!==ctx.manager.toLowerCase() || manifest.adapter.toLowerCase()!==ctx.adapter.toLowerCase() || manifest.eventId!==String(ctx.eventId)) throw new Error('Resolver event binding mismatch');
  if(ctx.resolution.status!==1) throw new Error('Event is no longer awaiting evidence');
  if(!manifest.validation || manifest.validation.outcome==='INVALID') throw new Error('No verified rainfall observation to commit');
  if(!Number.isSafeInteger(manifest.capturedAt)||manifest.capturedAt<=0||manifest.capturedAt>ctx.chainTime) throw new Error('Invalid evidence timestamp');
  if(ctx.terms.mode===0){
    if(manifest.kind!=='live'||manifest.requestId!==ctx.requestId) throw new Error('Live resolver request binding mismatch');
    if(ctx.chainTime<Number(ctx.terms.captureEligibleAt)||ctx.chainTime>=Number(ctx.terms.resolutionDeadline)) throw new Error('Outside committed resolution window');
  }else if(!['synthetic','historical-replay'].includes(manifest.kind)||checked.manifestHash!==ctx.terms.fixtureManifestHash||checked.responseHash!==ctx.terms.fixtureResponseHash||String(manifest.validation.rainfallMilliMm)!==String(ctx.terms.fixtureRainfallMilliMm)) throw new Error('Precommitted replay fixture mismatch');
  const origin=new URL(evidenceOrigin);
  if(origin.protocol!=='https:'&&!(ctx.chainId===31337&&origin.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(origin.hostname))) throw new Error('Use a secure independent evidence archive');
  return [ctx.requestId,ctx.terms.specHash,ctx.terms.sourceConfigHash,checked.manifestHash,checked.responseHash,BigInt(manifest.validation.rainfallMilliMm),BigInt(manifest.capturedAt),1n,`${origin.origin}/evidence/${checked.manifestHash}`];
}
