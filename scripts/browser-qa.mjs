import {chromium} from 'playwright';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const deployment=JSON.parse(await fs.readFile(new URL('../deployments/local.json',import.meta.url),'utf8'));if(deployment.chainId!==31337||new URL(deployment.rpcUrl).hostname!=='127.0.0.1')throw new Error('Browser test wallet requires loopback local chain');
const browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:1440,height:1050},reducedMotion:'reduce'});const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
await fs.mkdir(new URL('../.local/qa/',import.meta.url),{recursive:true});
try{
  await page.goto('http://127.0.0.1:3000',{waitUntil:'networkidle'});await page.locator('h1').waitFor();await page.screenshot({path:new URL('../.local/qa/desktop.png',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1'),fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.locator('.mobile-toggle').waitFor();await page.waitForFunction(()=>{const sidebar=document.querySelector('.sidebar');return !sidebar||sidebar.getBoundingClientRect().right<=0;});await page.screenshot({path:new URL('../.local/qa/mobile.png',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1'),fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false,'mobile horizontal overflow');
  await page.setViewportSize({width:1440,height:1050});
  await context.addInitScript(({d})=>{
    sessionStorage.setItem('aegis-deployment',JSON.stringify(d));const handlers={};let account=sessionStorage.getItem('aegis-qa-wallet')||d.wallets.B;let reject=false;let chain=sessionStorage.getItem('aegis-qa-chain')||'0x7a69';
    window.aegisTestWallet={select(address){account=address;sessionStorage.setItem('aegis-qa-wallet',address);(handlers.accountsChanged||[]).forEach(fn=>fn([address]));},rejectNext(){reject=true;},setChain(value){chain=value;sessionStorage.setItem('aegis-qa-chain',value);(handlers.chainChanged||[]).forEach(fn=>fn(value));}};
    window.ethereum={isMetaMask:true,on(event,fn){(handlers[event]||=[]).push(fn);},removeListener(event,fn){handlers[event]=(handlers[event]||[]).filter(f=>f!==fn);},async request({method,params=[]}){
      if(['eth_accounts','eth_requestAccounts'].includes(method))return[account];if(method==='eth_chainId')return chain;if(method==='wallet_switchEthereumChain'){chain=params[0].chainId;sessionStorage.setItem('aegis-qa-chain',chain);(handlers.chainChanged||[]).forEach(fn=>fn(chain));return null;}
      if(method==='eth_sendTransaction'&&reject){reject=false;throw Object.assign(new Error('Local test wallet rejected signing'),{code:4001});}
      if(method==='personal_sign'){method='eth_sign';params=[account,params[0]];}
      const response=await fetch(d.rpcUrl,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});const result=await response.json();if(result.error)throw Object.assign(new Error(result.error.message),{code:result.error.code});return result.result;
    }};
  },{d:deployment});
  await page.goto('http://127.0.0.1:3000/buy/',{waitUntil:'networkidle'});await page.getByRole('button',{name:'Connect wallet'}).click();
  const lastEvent=deployment.events.findLast(e=>e.mode==='synthetic'&&e.outcome==='NO'&&e.purpose!=='underwriting-qa');
  const cards=page.locator('.quote-card');await cards.first().waitFor();
  const quoteCard=cards.filter({hasText:'Vault #2'}).filter({hasText:'25 mUSDC premium'}).last();
  await quoteCard.getByRole('button',{name:'Buy this coverage'}).waitFor({state:'visible'});await page.evaluate(()=>window.aegisTestWallet.setChain('0x1'));await page.getByRole('button',{name:'Switch network'}).waitFor();assert.equal(await quoteCard.getByRole('button',{name:'Buy this coverage'}).isEnabled(),false,'wrong network blocks purchase');await page.getByRole('button',{name:'Switch network'}).click();
  await page.evaluate(()=>window.aegisTestWallet.rejectNext());await quoteCard.getByRole('button',{name:'Buy this coverage'}).click();await page.getByRole('status').filter({hasText:/rejected/i}).waitFor();assert.equal(await page.locator('.confirmation-card').count(),0,'rejection produces no policy confirmation');
  await quoteCard.getByRole('button',{name:'Buy this coverage'}).click();await page.getByRole('status').filter({hasText:'Transaction confirmed.'}).waitFor({timeout:30000});
  await page.goto('http://127.0.0.1:3000/policies/',{waitUntil:'networkidle'});await page.locator('.policy-card').last().waitFor();assert.ok(await page.locator('.policy-card').count()>=5);
  await page.goto('http://127.0.0.1:3000/operator/',{waitUntil:'networkidle'});await page.evaluate(address=>window.aegisTestWallet.select(address),deployment.wallets.A);
  await page.locator('select').last().selectOption(lastEvent.id);
  await page.locator('input[type=file]').nth(1).setInputFiles(new URL(`../.local/events/local-${lastEvent.id}-NO.json`,import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1'));
  const commit=page.getByRole('button',{name:'Commit reviewed evidence'});await commit.waitFor();await commit.click();await page.getByRole('status').filter({hasText:'Transaction confirmed.'}).waitFor({timeout:30000});
  await page.getByRole('button',{name:'Finalize committed outcome'}).click();await page.getByRole('status').filter({hasText:'Transaction confirmed.'}).waitFor({timeout:30000});
  await page.evaluate(address=>window.aegisTestWallet.select(address),deployment.wallets.B);await page.goto('http://127.0.0.1:3000/policies/',{waitUntil:'networkidle'});const lastPolicy=page.locator('.policy-card').last();await lastPolicy.getByRole('button',{name:'Settle policy'}).click();await page.getByRole('status').filter({hasText:'Transaction confirmed.'}).waitFor({timeout:30000});await lastPolicy.getByText('Settled NO').waitFor();
  for(const route of ['underwrite','resolution','operator']){await page.goto(`http://127.0.0.1:3000/${route}/`,{waitUntil:'networkidle'});await page.locator('h1').waitFor();}
  await page.goto('http://127.0.0.1:3000/resolution/',{waitUntil:'networkidle'});const eventCard=page.locator('.event-panel').filter({hasText:`Event #${lastEvent.id} · Pune rainfall`});
  for(const name of ['EvidenceCommitted','OutcomeFinalized','PolicySettled'])await eventCard.getByText(name,{exact:true}).waitFor();
  await page.route('http://127.0.0.1:8787/evidence/**',route=>route.abort());await eventCard.getByRole('button',{name:'Verify evidence hashes'}).click();await eventCard.getByRole('status').filter({hasText:'Failed to fetch'}).waitFor();await page.unroute('http://127.0.0.1:8787/evidence/**');
  await eventCard.getByRole('button',{name:'Verify evidence hashes'}).click();await eventCard.getByRole('status').filter({hasText:'match'}).waitFor();
  const underwritingEvent=deployment.events.findLast(e=>e.purpose==='underwriting-qa');
  if(underwritingEvent){
    const confirmed=()=>page.getByRole('status').filter({hasText:'Transaction confirmed.'}).waitFor({timeout:30000});
    await page.evaluate(address=>window.aegisTestWallet.select(address),deployment.wallets.A);
    await page.goto('http://127.0.0.1:3000/operator/',{waitUntil:'networkidle'});await page.getByRole('button',{name:'Create vault epoch'}).click();await confirmed();
    await page.goto('http://127.0.0.1:3000/underwrite/',{waitUntil:'networkidle'});const vaultPanel=page.locator('.vault-panel').last();await vaultPanel.getByText('Funding',{exact:true}).waitFor();
    assert.equal(await vaultPanel.getByRole('button',{name:'Deposit mUSDC'}).isEnabled(),false,'deposit requires allowance');
    await vaultPanel.getByRole('button',{name:'Approve deposit'}).click();await confirmed();await vaultPanel.getByRole('button',{name:'Deposit mUSDC'}).click();await confirmed();
    await vaultPanel.getByRole('button',{name:'Open underwriting'}).click();await confirmed();
    assert.equal(await vaultPanel.getByRole('button',{name:'Redeem all shares'}).isEnabled(),false,'capital stays locked');
    await vaultPanel.locator('select').selectOption(underwritingEvent.id);await vaultPanel.getByRole('button',{name:'Publish 200-mUSDC quote'}).click();await confirmed();
    await page.evaluate(address=>window.aegisTestWallet.select(address),deployment.wallets.B);await page.goto('http://127.0.0.1:3000/buy/',{waitUntil:'networkidle'});await page.locator('.quote-card').last().getByRole('button',{name:'Buy this coverage'}).click();await confirmed();
    await page.evaluate(address=>window.aegisTestWallet.select(address),deployment.wallets.A);await page.goto('http://127.0.0.1:3000/underwrite/',{waitUntil:'networkidle'});await page.locator('.vault-panel').last().getByRole('button',{name:'End issuance'}).click();await confirmed();assert.equal(await page.locator('.vault-panel').last().getByRole('button',{name:'Close settled epoch'}).isEnabled(),false,'active liabilities prevent epoch closure');
    await page.goto('http://127.0.0.1:3000/operator/',{waitUntil:'networkidle'});await page.locator('select').last().selectOption(underwritingEvent.id);await page.locator('input[type=file]').nth(1).setInputFiles(new URL(`../.local/events/local-${underwritingEvent.id}-NO.json`,import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1'));await page.getByRole('button',{name:'Commit reviewed evidence'}).click();await confirmed();await page.getByRole('button',{name:'Finalize committed outcome'}).click();await confirmed();
    await page.evaluate(address=>window.aegisTestWallet.select(address),deployment.wallets.B);await page.goto('http://127.0.0.1:3000/policies/',{waitUntil:'networkidle'});await page.locator('.policy-card').last().getByRole('button',{name:'Settle policy'}).click();await confirmed();
    await page.getByRole('tab',{name:'Transaction history'}).click();await page.getByRole('cell',{name:'PolicySettled',exact:true}).first().waitFor();
    await page.evaluate(address=>window.aegisTestWallet.select(address),deployment.wallets.A);await page.goto('http://127.0.0.1:3000/underwrite/',{waitUntil:'networkidle'});await page.locator('.vault-panel').last().getByRole('button',{name:'Close settled epoch'}).click();await confirmed();await page.locator('.vault-panel').last().getByRole('button',{name:'Redeem all shares'}).click();await confirmed();await page.locator('.vault-panel').last().getByText('Closed',{exact:true}).waitFor();
  }
  const health=await(await fetch('http://127.0.0.1:8787/health')).json();assert.equal(health.storageConfigured,true);assert.deepEqual(errors,[],'browser JavaScript errors');
  await fs.writeFile(new URL('../.local/qa/browser-results.json',import.meta.url),JSON.stringify({network:'LOCAL ONLY',passed:['desktop/mobile layout','no horizontal mobile overflow','rejection produces no success','real local-chain buyer purchase','authority evidence commitment','permissionless finalization','NO settlement','evidence failure and hash verification','deposit approval and funding','authorized quote publication','capital lock guards','epoch closure and redemption','wallet-attributed history','all core routes'],pageErrors:errors},null,2));console.log('Browser QA passed: local-chain purchase, deposit, quotes, settlement, lock guards, redemption, and evidence verification.');
}finally{await browser.close();}

