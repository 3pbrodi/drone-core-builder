// Start ai-build-fixture.ts4289 + isolated Vite4190; no production browser access.
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
import assert from 'node:assert/strict';import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE??'/usr/bin/chromium',args:['--no-sandbox']});
const results=[];
try{for(const width of [390,1280]){
 const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 let release;const gate=new Promise(resolve=>release=resolve);let released=false;
 await page.route('**/*',async route=>{const url=new URL(route.request().url());if(url.hostname!=='127.0.0.1')return route.abort();if(url.port==='4289'&&url.searchParams.has('query')&&JSON.parse(url.searchParams.get('query')).mode==='page'&&!released)await gate;return route.continue();});
 const workers=[];page.on('worker',w=>workers.push(w.url()));
 await page.goto('http://127.0.0.1:4190/ai-build',{waitUntil:'networkidle'});
 await page.getByLabel('Budget in euros').fill('300');await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByRole('button',{name:/Easy to Fly/}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByRole('radio',{name:'Sky Blue',exact:true}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByLabel('Special wishes').fill('6S ELRS 2.5 inch');await page.getByRole('button',{name:'Open my build',exact:true}).click();
 const loading=page.getByRole('main',{name:'Preparing AI build'});await loading.waitFor();assert.equal(await loading.getAttribute('aria-busy'),'true');
 const wheel=page.locator('[data-loading-wheel]');assert.equal(await wheel.evaluate(el=>getComputedStyle(el).animationName),'spin');
 const firstTransform=await wheel.evaluate(el=>getComputedStyle(el).transform);await page.waitForTimeout(150);assert.notEqual(await wheel.evaluate(el=>getComputedStyle(el).transform),firstTransform);
 await loading.getByRole('status').getByText('Loading verified products…',{exact:true}).waitFor();released=true;release();
 const report=page.getByRole('region',{name:'AI matching result'});await report.getByText('AI recommendation',{exact:true}).waitFor({timeout:30000});assert.equal(await loading.count(),0);assert(workers.some(url=>url.includes('ai-build.worker')));
 assert.equal(new URL(page.url()).searchParams.get('wishes'),'6S ELRS 2.5 inch');assert.equal(new URL(page.url()).searchParams.get('budget'),'300');assert.equal(new URL(page.url()).searchParams.get('color'),'Sky Blue');
 await page.getByText('Physical fit unverified',{exact:true}).waitFor();
 const checklist=page.locator('details[aria-label="Compatibility checklist"]');assert.equal(await checklist.getAttribute('open'),null);await checklist.locator('summary').click();
 assert(await checklist.locator('[data-compatibility-check]').count()>10);assert((await checklist.innerText()).includes('full physical installation'));assert(await checklist.getByRole('link',{name:/Source/}).count()>0);await checklist.locator('summary').click();
 const details=report.locator('details');assert.equal(await details.getAttribute('open'),null);assert.equal(await report.getByText(/Free-text review/).isVisible(),false);assert((await report.boundingBox()).height<110);
 await report.locator('summary').click();await report.getByText('Preferred color: Sky Blue',{exact:true}).waitFor();assert((await report.innerText()).includes('4 sales pack(s)'));await report.locator('summary').click();
 const stats=page.getByRole('region',{name:'Build statistics'});const weightStat=stats.locator('div').filter({has:page.getByText('Takeoff weight (est.)',{exact:true})}).last();
 assert((await stats.innerText()).includes('km/h model range'));assert((await stats.innerText()).includes('g model range'));
 const estimate=page.getByRole('group',{name:'Performance estimate details'});await page.locator('details[aria-label="Performance estimate details"] summary').click();const estimateDetails=page.locator('details[aria-label="Performance estimate details"]');assert((await estimateDetails.innerText()).includes('rotations/s'));assert((await estimateDetails.innerText()).includes('No measured airflow'));await estimateDetails.locator('summary').click();
 const initialStats=await stats.innerText();await page.getByRole('button',{name:'Change Frame',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.locator('[data-product-option="large"]').getByRole('button',{name:'Select component',exact:true}).click();await dialog.waitFor({state:'hidden'});assert.notEqual(await stats.innerText(),initialStats);
 assert.equal(await page.locator('body').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
 if(width===390)await page.screenshot({path:'/tmp/dronecores-ai-performance-mobile.png',fullPage:true});
 await page.goto('http://127.0.0.1:4190/ai-build',{waitUntil:'networkidle'});for(let n=0;n<3;n++)await page.getByRole('button',{name:'Skip',exact:true}).click();await page.getByLabel('Special wishes').fill('4S and 6S conflicting');await page.getByRole('button',{name:'Skip',exact:true}).click();await page.getByRole('region',{name:'AI matching result'}).waitFor();assert(!new URL(page.url()).searchParams.has('wishes'));
 await page.goto('http://127.0.0.1:4190/create-custom-build?source=ai&budget=300&priorities=range',{waitUntil:'networkidle'});await page.getByRole('region',{name:'AI matching result'}).getByText('AI recommendation',{exact:true}).waitFor();await page.locator('[data-component-category="gps"]').waitFor();
 await page.goto('http://127.0.0.1:4190/create-custom-build?source=ai&budget=300&wishes=4S%20and%206S',{waitUntil:'networkidle'});const conflict=page.getByRole('region',{name:'AI matching result'});await conflict.getByText('Build needs attention',{exact:true}).waitFor();await conflict.locator('summary').click();await conflict.getByText(/Conflicting battery cell counts/).waitFor();assert.equal(await page.locator('[data-component-category="frame"]').getByText('Missing',{exact:true}).count(),1);
 assert.deepEqual(errors,[]);results.push({width,animatedSpinner:true,workerSearch:true,compactCollapsedReport:true,compatibilityChecklist:true,physicalFitScope:true,estimatedWeightAndSpeed:true,manualChangesRecalculate:true,fourAnswers:true,rangeGps:true,conflictsBlocked:true,noOverflow:true});await page.close();
}
 const receipt={passed:true,results,localOnly:true,syntheticProducts:true,productionWrites:false};await fs.writeFile('qa/ai-compatibility-audit-20261121.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
}finally{await browser.close()}
