// Explicitly opt-in; ordinary unit tests never depend on provider uptime.
import assert from 'node:assert/strict';
import {fetchWeather,weatherRequest} from '../evidence/src/weather-client.mjs';
for(const city of ['pune','mumbai']){
  const record=await fetchWeather(weatherRequest(city,'2026-07-04'));
  assert.equal(record.units,'mm');assert.equal(record.observations[0].status,'available');
  console.log(JSON.stringify({city,date:record.observations[0].date,rainfallMm:record.observations[0].rainfallMm,returnedCoordinates:record.returnedCoordinates,apiRequest:record.apiRequest,responseHash:record.responseHash,retrievedAt:record.retrievedAt}));
}
