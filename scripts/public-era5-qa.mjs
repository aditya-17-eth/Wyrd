// Production read-only browser check. No injected wallet or contract writes.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const origin='https://aegis-weather-cover.sweetmoss1.chatgpt.site';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1050}});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
try{
  await page.goto(`${origin}/resolution/`,{waitUntil:'networkidle'});await page.getByRole('heading',{name:'The evidence behind every outcome.'}).waitFor();
  await page.goto(`${origin}/operator/`,{waitUntil:'networkidle'});await page.getByRole('combobox',{name:'Prepared event mode'}).selectOption('live');
  await page.getByRole('button',{name:'Prepare next event'}).click();
  const preview=page.locator('.spec-preview').first();await preview.waitFor();const prepared=JSON.parse(await preview.innerText());
  assert.equal(prepared.mode,'live');assert.equal(prepared.source.parameters.latitude,'18.5196');assert.equal(prepared.source.parameters.longitude,'73.8554');assert.equal(prepared.source.parameters.models,'era5');assert.equal(prepared.source.parameters.timezone,'Asia/Kolkata');assert.equal(prepared.source.parameters.start_date,prepared.source.parameters.end_date);assert.equal(prepared.source.validatorVersion,'aegis-era5-daily-v2');assert.equal('fixture' in prepared,false);
  assert.equal(await page.getByRole('button',{name:'Register event onchain'}).isEnabled(),false,'disconnected wallet cannot register');
  await page.goto(origin,{waitUntil:'networkidle'});await page.getByRole('heading',{name:'Underwrite uncertainty.'}).waitFor();assert.deepEqual(errors,[]);
  await fs.mkdir(new URL('../.local/qa/',import.meta.url),{recursive:true});await page.screenshot({path:new URL('../.local/qa/era5-production.png',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1'),fullPage:true});
  const result={mode:'PRODUCTION READ-ONLY; NO WALLET OR TRANSACTIONS',url:origin,passed:['resolution route','operator live-event preparation','v2 coordinates and exact date source','no replay fixture in live specification','disconnected writes disabled','homepage','no browser exceptions'],preparedObservationDate:prepared.observationDate};
  await fs.writeFile(new URL('../.local/qa/public-era5-results.json',import.meta.url),JSON.stringify(result,null,2));console.log('Production ERA5 browser QA passed: read-only routes and configured live-event preparation.');
}finally{await browser.close();}
