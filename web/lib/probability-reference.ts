import type {Hex} from 'viem';
// This information service cannot authorize or mutate a quote or resolution.
export type ProbabilityReferenceRequest={specHash:Hex;observationStart:bigint;observationEnd:bigint;thresholdMilliMm:bigint};
export type ProbabilityReferenceResult=
  | {status:'unavailable';message:'Pricing reference unavailable';reason:string}
  | {status:'available';specHash:Hex;source:string;issuedAt:bigint;validMembers:bigint;triggerMembers:bigint;calibration:'uncalibrated ensemble estimate'|'validated historical estimate'};
export interface ProbabilityReference {read(request:ProbabilityReferenceRequest):Promise<ProbabilityReferenceResult>}
export const probabilityReference:ProbabilityReference={async read(){return{status:'unavailable',message:'Pricing reference unavailable',reason:'No validated pricing dataset is configured. Premiums remain manager-selected offers.'};}};
