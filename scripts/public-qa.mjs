import {chromium} from 'playwright';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const origin='https://aegis-weather-cover.sweetmoss1.chatgpt.site',evidence='https://aegis-evidence.sweetmoss1.chatgpt.site';
const d=JSON.parse(await fs.readFile(new URL('../deployments/monad-testnet.json',import.meta.url),'utf8'));
const browser=await chromium.launch({channel:'chrome',headless:true});const failures=[];try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});page.on('pageerror',error=>failures.push(error.message));
 const config=await(await fetch(`${origin}/deployment.json`)).json();assert.equal(config.contracts.manager,d.contracts.manager);assert.equal(config.chainId,10143);
 for(const route of ['','buy/','underwrite/','policies/','resolution/','operator/']){const response=await page.goto(`${origin}/${route}`,{waitUntil:'networkidle'});assert.equal(response.status(),200);await page.locator('h1').waitFor();}
 await page.getByRole('button',{name:'Prepare next event',exact:true}).waitFor();
 await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(button=>button.textContent==='Prepare next event'&&!button.disabled),{},{timeout:60000});
 assert.equal(await page.locator('.network-badge').getAttribute('title'),'Contract reads connected');
 await page.goto(origin,{waitUntil:'networkidle'});await page.setViewportSize({width:390,height:844});await page.locator('.mobile-toggle').waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await fs.mkdir(new URL('../.local/qa/',import.meta.url),{recursive:true});await page.screenshot({path:new URL('../.local/qa/public-mobile.png',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1'),fullPage:true});
 const health=await(await fetch(`${evidence}/health`)).json();assert.equal(health.storageConfigured,true);assert.equal(health.chainConfigured,true);const history=await fetch(`${evidence}/events?manager=${d.contracts.manager}&eventId=1`);assert.equal(history.status,200);assert.deepEqual(failures,[]);
 const result={checkedAt:new Date().toISOString(),publicFrontend:origin,evidenceOrigin:evidence,actualAddressesMatched:true,sixCoreRoutesHTTP200:true,onchainReadsConnected:true,mobileOverflow:false,browserErrors:failures,evidenceBindings:true,captureCatalogReachable:true,financialTransactions:'Not signed by this read-only check'};await fs.writeFile(new URL('../deployments/public-check.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}
