import {canonical,hashBytes,hashJSON,eventSpecification,fixtureBundle,nextObservationStart,ZERO_HASH,MULTICITY_VERSION,validateProvider,sourceURL,verifyBundle} from './core.mjs';
export function prepareEvent(deployment,eventId,now,mode='synthetic',outcome='YES',options={}){
  let fixture;
  if(!['synthetic','live','historical-replay'].includes(mode))throw new Error('Unsupported market mode');
  const city=options.city||'pune',thresholdMilliMm=String(options.thresholdMilliMm||(city==='mumbai'?'75000':'50000'));
  if(!['pune:50000','pune:20000','mumbai:75000'].includes(`${city}:${thresholdMilliMm}`))throw new Error('Unsupported market template');
  if(mode==='historical-replay'){
    const record=options.record;if(!record||record.kind!=='historical'||record.city!==city||record.observations.length!==1||record.responseHash!==hashBytes(record.raw))throw new Error('Supply a verified exact-day historical record');
    if(record.retrievedAt>now||Date.parse(record.observations[0].date+'T00:00:00+05:30')/1000+6*86400>record.retrievedAt)throw new Error('Historical publication waiting period has not elapsed');
    if(record.observations[0].status!=='available')throw new Error('Missing historical rainfall');
    const rainfallMilliMm=record.observations[0].rainfallMilliMm;
    outcome=BigInt(rainfallMilliMm)>=BigInt(thresholdMilliMm)?'YES':'NO';fixture={outcome,rainfallMilliMm,responseHash:record.responseHash};
  }
  if(mode==='synthetic'){
    const rainfallMilliMm=outcome==='YES'?Number(BigInt(thresholdMilliMm)+10000n):outcome==='NO'?Number(BigInt(thresholdMilliMm)/5n):0;
    const raw=canonical({simulation:true,label:'TESTNET DEMONSTRATION — SIMULATED EVENT RESULT',rainfallMilliMm:String(rainfallMilliMm),outcome});
    fixture={outcome,rainfallMilliMm,responseHash:hashBytes(raw)};
  }
  const spec=eventSpecification({chainId:deployment.chainId,manager:deployment.contracts.manager,adapter:deployment.contracts.resolver,eventId,observationStart:nextObservationStart(now),mode,fixture,city,thresholdMilliMm,validatorVersion:options.validatorVersion||(Object.keys(options).length||mode==='historical-replay'?MULTICITY_VERSION:undefined),historicalObservationDate:mode==='historical-replay'?options.record.observations[0].date:undefined});
  let bundle=fixture?fixtureBundle(spec,fixture,now):undefined;
  if(mode==='historical-replay'){
    const record=options.record,raw=record.raw,validation=validateProvider(raw,spec);
    if(record.apiRequest!==sourceURL(spec.source))throw new Error('Historical record request differs from specification');
    const manifest={schema:'aegis-evidence-v1',kind:'historical-replay',label:spec.demonstrationMode,chainId:spec.chainId,manager:spec.manager,adapter:spec.adapter,eventId:spec.eventId,specHash:hashJSON(spec),sourceConfigHash:hashJSON(spec.source),source:spec.source,sourceURL:record.apiRequest,sourceProvider:'Open-Meteo',dataset:'era5',observationDate:spec.historicalObservationDate,thresholdMilliMm:spec.thresholdMilliMm,responseHash:hashBytes(raw),capturedAt:record.retrievedAt,httpStatus:200,validatorVersion:spec.source.validatorVersion,validation};
    bundle={raw,responseHash:hashBytes(raw),manifest,manifestHash:hashJSON(manifest)};verifyBundle(manifest,raw,spec);
  }
  const terms={specHash:hashJSON(spec),sourceConfigHash:hashJSON(spec.source),observationStart:spec.observationStart,observationEnd:spec.observationEnd,purchaseCutoff:spec.purchaseCutoff,minimumLeadTime:spec.minimumLeadTime,captureEligibleAt:spec.captureEligibleAt,resolutionDeadline:spec.resolutionDeadline,thresholdMilliMm:spec.thresholdMilliMm,maxEventCoverage:spec.maxEventCoverage,maxBuyerCoverage:spec.maxBuyerCoverage,mode:mode==='live'?0:1,fixtureManifestHash:bundle?.manifestHash||ZERO_HASH,fixtureResponseHash:bundle?.responseHash||ZERO_HASH,fixtureRainfallMilliMm:String(fixture?.rainfallMilliMm||0),fixtureOutcome:fixture?({YES:1,NO:2,INVALID:3}[outcome]):0,specificationURI:`${deployment.evidenceOrigin}/evidence/${hashJSON(spec)}`};
  return{spec,terms,...(bundle?{bundle}:{})};
}
