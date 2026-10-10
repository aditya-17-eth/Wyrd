export type City = 'pune'|'mumbai';
export type WeatherRequest = {city:City;kind:'historical'|'forecast';endpoint:string;parameters:Record<string,string>;governingGrid?:{latitude:string;longitude:string};validatorVersion:string};
export type Observation = {date:string;status:'available'|'unavailable';rainfallMm:number|null;rainfallMilliMm:string|null};
export type WeatherRecord = {city:City;displayName:string;kind:'historical'|'forecast';dataset:string;variable:'rain_sum';units:'mm';timezone:string;gridCellSelection:string;requestedCoordinates:{latitude:string;longitude:string};returnedCoordinates:{latitude:number;longitude:number};observations:Observation[];apiRequest:string;retrievedAt:number;responseHash:`0x${string}`;raw:string;request:WeatherRequest};
export function weatherRequest(city:City,start:string,end?:string,kind?:'historical'|'forecast'):WeatherRequest;
export function fetchWeather(request:WeatherRequest,options?:Record<string,unknown>):Promise<WeatherRecord>;
export function validateWeatherResponse(raw:string|Uint8Array,request:WeatherRequest):Omit<WeatherRecord,'raw'|'request'|'kind'|'retrievedAt'|'responseHash'|'apiRequest'>;
export function replayCandidates(record:WeatherRecord,thresholdMm:number):unknown[];
export function assertHistoricalAvailableDate(date:string,now:number):void;
