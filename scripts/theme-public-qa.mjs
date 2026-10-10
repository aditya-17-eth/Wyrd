import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1050}});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
try{
  await page.goto('https://aegis-weather-cover.sweetmoss1.chatgpt.site/',{waitUntil:'domcontentloaded'});
  await page.locator('h1').waitFor();await page.evaluate(()=>document.fonts.ready);
  assert.match(await page.locator('h1').innerText(),/Protection for/);
  const palette=await page.evaluate(()=>({background:getComputedStyle(document.body).backgroundColor,headline:getComputedStyle(document.querySelector('h1')).fontFamily,button:getComputedStyle(document.querySelector('.hero-buttons .button-primary')).backgroundColor}));
  assert.equal(palette.background,'rgb(247, 246, 242)');assert.equal(palette.button,'rgb(23, 23, 19)');assert.match(palette.headline,/Georgia/);
  await fs.mkdir('.local/qa',{recursive:true});await page.screenshot({path:'.local/qa/aegis-public-theme-desktop.png',fullPage:true});
  await page.goto('https://aegis-weather-cover.sweetmoss1.chatgpt.site/resolution/',{waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:'Inspect a historical rainfall event'}).waitFor();
  await page.getByRole('heading',{name:'115.6 mm',exact:true}).waitFor({timeout:60000});
  await page.getByLabel('Historical weather city').selectOption('mumbai');await page.getByRole('heading',{name:'206.8 mm',exact:true}).waitFor({timeout:60000});
  await page.screenshot({path:'.local/qa/aegis-public-weather-history.png',fullPage:true});
  assert.deepEqual(errors,[]);await fs.writeFile('.local/qa/public-theme-results.json',JSON.stringify({palette,passed:['published hero and palette','serif heading','black controls','real Pune historical discovery','real Mumbai historical discovery','no browser exceptions']},null,2));
  console.log('Published theme and historical Pune/Mumbai references verified.');
}finally{await browser.close();}
