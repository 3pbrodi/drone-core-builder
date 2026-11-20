// Start ai-build-fixture.ts on4289 and isolated Vite on4190 first.
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
import assert from 'node:assert/strict';import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE??'/usr/bin/chromium',args:['--no-sandbox']});
const results=[];
try{for(const width of [390,1280]){
 const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 await page.goto('http://127.0.0.1:4190/ai-build',{waitUntil:'networkidle'});
 await page.getByLabel('Budget in euros').fill('300');await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByRole('button',{name:/Easy to Fly/}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByRole('radio',{name:'Sky Blue',exact:true}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByLabel('Special wishes').fill('6S ELRS 2.5 inch');await page.getByRole('button',{name:/Create|Generate|Build my|Open .*build|Open .*configurator/i}).click();
 const report=page.getByRole('region',{name:'AI matching result'});await report.waitFor({timeout:30000});await report.getByText('Initial AI catalogue recommendation',{exact:true}).waitFor();
 assert(new URL(page.url()).searchParams.get('wishes')==='6S ELRS 2.5 inch');assert.equal(new URL(page.url()).searchParams.get('budget'),'300');assert.equal(new URL(page.url()).searchParams.get('color'),'Sky Blue');
 await report.getByText('Preferred color: Sky Blue',{exact:true}).waitFor();await report.getByText('Hardware checks: verified against current rules.',{exact:true}).waitFor();
 const frame=page.locator('[data-component-category="frame"]');await frame.getByText('Synthetic frame',{exact:true}).waitFor();
 await report.getByText('Why these components?',{exact:true}).click();assert((await report.innerText()).includes('4 sales pack(s)'));assert((await report.innerText()).includes('€130.00')||(await report.innerText()).includes('130,00'));
 assert.equal(await page.locator('body').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
 await page.getByRole('button',{name:'Change Frame',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.locator('[data-product-option]').first().waitFor();await dialog.locator('[data-product-option]').first().getByRole('button',{name:/Select component|Keep selected/,exact:true}).click();await dialog.waitFor({state:'hidden'});await report.waitFor();
 if(width===390)await page.screenshot({path:'/tmp/dronecores-ai-build-mobile.png',fullPage:true});
 // Skip must clear typed wishes instead of retaining the previous React state.
 await page.goto('http://127.0.0.1:4190/ai-build',{waitUntil:'networkidle'});for(let n=0;n<3;n++)await page.getByRole('button',{name:'Skip',exact:true}).click();await page.getByLabel('Special wishes').fill('4S and 6S conflicting');await page.getByRole('button',{name:'Skip',exact:true}).click();await page.getByRole('region',{name:'AI matching result'}).waitFor();assert(!new URL(page.url()).searchParams.has('wishes'));
 await page.goto('http://127.0.0.1:4190/create-custom-build?source=ai&budget=300&priorities=range',{waitUntil:'networkidle'});await page.getByRole('region',{name:'AI matching result'}).waitFor();await page.locator('[data-component-category="gps"]').waitFor();await page.getByRole('region',{name:'AI matching result'}).getByText('Initial AI catalogue recommendation',{exact:true}).waitFor();
 await page.goto('http://127.0.0.1:4190/create-custom-build?source=ai&budget=300&wishes=4S%20and%206S',{waitUntil:'networkidle'});await page.getByRole('region',{name:'AI matching result'}).getByText(/Conflicting battery cell counts/).waitFor();assert.equal(await page.locator('[data-component-category="frame"]').getByText('Missing',{exact:true}).count(),1);
 assert.deepEqual(errors,[]);results.push({width,fourAnswersApplied:true,packBudget:true,compatibleFixture:true,manualSelection:true,skipClearsWishes:true,rangeGps:true,conflictBlocked:true,noOverflow:true});await page.close();
}
 const receipt={passed:true,results,localOnly:true,syntheticProducts:true,productionWrites:false};await fs.writeFile('qa/ai-build-20261120.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
}finally{await browser.close()}
