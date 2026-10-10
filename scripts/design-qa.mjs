import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const origin=process.env.AEGIS_QA_ORIGIN||'http://127.0.0.1:3000';
const output=new URL('../.local/qa/',import.meta.url);
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1050},reducedMotion:'reduce'});
const page=await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const screenshot=async name=>page.screenshot({path:new URL(name,output).pathname.replace(/^\/([A-Z]:)/,'$1'),fullPage:true});
try {
  await page.goto(origin,{waitUntil:'networkidle'});await page.locator('h1').waitFor();await page.evaluate(()=>document.fonts.ready);await screenshot('aegis-home-desktop.png');
  const deployment=JSON.parse(await fs.readFile(new URL('../deployments/local.json',import.meta.url),'utf8'));
  assert.equal(deployment.chainId,31337);assert.equal(new URL(deployment.rpcUrl).hostname,'127.0.0.1');
  await context.addInitScript(d=>sessionStorage.setItem('aegis-deployment',JSON.stringify(d)),deployment);
  await page.goto(`${origin}/explore/`,{waitUntil:'networkidle'});await page.locator('.market-card').first().waitFor();
  await screenshot('aegis-markets-desktop.png');
  const target=await page.locator('.market-card').first().getAttribute('href');
  await page.locator('.market-card').first().click();await page.locator('.market-detail-heading').waitFor();assert.ok(await page.locator('.quote-card').count()>0);await screenshot('aegis-market-detail.png');
  await page.goto(`${origin}/explore/`,{waitUntil:'networkidle'});
  await page.getByRole('tab',{name:'Travel Upcoming'}).click();
  assert.equal(await page.locator('.market-card').count(),0);assert.equal(await page.locator('.quote-card').count(),0);
  await page.getByText('Upcoming category · No markets available').waitFor();await screenshot('aegis-travel-upcoming.png');
  for(const category of ['Agriculture','Logistics','Events']){await page.getByRole('tab',{name:`${category} Upcoming`}).click();assert.equal(await page.locator('.market-card').count(),0);await page.getByText('Upcoming category · No markets available').waitFor();}
  await page.getByRole('tab',{name:'Weather',exact:true}).click();await page.locator('.banner-weather').waitFor();await screenshot('aegis-weather.png');
  await page.getByRole('button',{name:'Filters',exact:true}).click();await page.getByLabel('Market status',{exact:true}).selectOption('Invalid');assert.equal(await page.locator('.market-card').count(),0);await page.getByRole('button',{name:'Reset filters'}).click();
  await page.getByRole('button',{name:'Demo replay',exact:true}).click();await page.locator('.demo-tag').first().waitFor();
  await page.getByRole('button',{name:'Live-data',exact:true}).click();await page.getByRole('textbox',{name:'Search markets'}).fill('no-such-market');assert.equal(await page.locator('.market-card').count(),0);await page.getByRole('button',{name:'Clear search'}).click();
  const layout=[];
  for(const width of [1440,1024,768,390]) {
    await page.setViewportSize({width,height:width===390?844:1050});
    for(const route of ['/', '/explore/', target, '/buy/', '/underwrite/', '/policies/', '/resolution/', '/operator/', '/docs/']) {
      await page.goto(`${origin}${route}`,{waitUntil:'networkidle'});await page.locator('h1,h2').first().waitFor();
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);
      assert.equal(overflow,false,`${route} overflow at ${width}px`);layout.push({route,width,overflow});
      if(width===390&&route==='/')await screenshot('aegis-home-mobile.png');
    }
  }
  await page.goto(origin,{waitUntil:'networkidle'});await page.getByRole('button',{name:'Toggle navigation'}).click();await page.getByRole('navigation',{name:'Main navigation'}).getByRole('link',{name:'Explore',exact:true}).click();await page.waitForURL('**/explore/');assert.match(page.url(),/explore/);
  assert.deepEqual(errors,[]);
  await fs.writeFile(new URL('design-results.json',output),JSON.stringify({passed:['category previews contain no markets','real local-chain discovery and detail','search and filters','live and synthetic separation','mobile navigation','no browser exceptions'],layout},null,2));
  console.log(`Design QA passed: ${layout.length} route/viewport checks, category and discovery interactions.`);
} finally {await browser.close();}

