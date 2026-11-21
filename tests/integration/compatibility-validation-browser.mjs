// Requires the existing loopback AI fixture4289 and isolated Vite4190. No remote access.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE??'/usr/bin/chromium',args:['--no-sandbox']});
const results=[];
try {
 for(const width of [390,1280]) {
  const page=await browser.newPage({viewport:{width,height:900}});const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());if(url.hostname!=='127.0.0.1')return route.abort();
   return route.continue();
  });
  assert.equal((await page.request.post('http://127.0.0.1:4289/__test/evidence?mode=complete')).status(),200);
  await page.goto('http://127.0.0.1:4190/create-custom-build?source=ai&budget=300&wishes=6S%20ELRS%202.5%20inch',{waitUntil:'networkidle'});
  const status=page.locator('[data-build-validation]');await page.locator('[data-build-validation="verified-compatible"]').waitFor({timeout:30000});
  assert((await status.innerText()).includes('Verified compatible'));
  const checklist=page.locator('details[aria-label="Compatibility checklist"]');assert.equal(await checklist.getAttribute('open'),null);
  await checklist.locator('summary').focus();await page.keyboard.press('Enter');assert.notEqual(await checklist.getAttribute('open'),null);
  const mount=checklist.locator('[data-compatibility-check="FRAME_MOTOR_MOUNT"]');assert.equal(await mount.getAttribute('data-validation-status'),'verified-compatible');
  assert(await mount.getByRole('link',{name:/Source/}).count()>0);assert((await mount.innerText()).includes('Retrieved'));
  assert((await checklist.innerText()).includes('installed firmware remain unverified'));
  await checklist.locator('summary').click();
  await page.getByRole('button',{name:'Change Propellers',exact:true}).click();let dialog=page.getByRole('dialog');
  await dialog.locator('[data-product-option="large-prop"]').getByRole('button',{name:'Select component',exact:true}).click();await dialog.waitFor({state:'hidden'});
  await page.locator('[data-build-validation="verified-incompatible"]').waitFor();assert((await status.innerText()).includes('Verified incompatible'));
  await checklist.locator('summary').click();const clearance=checklist.locator('[data-compatibility-check="FRAME_PROPELLER_CLEARANCE"]');assert.equal(await clearance.getAttribute('data-validation-status'),'verified-incompatible');assert(await clearance.getByRole('link',{name:/Source/}).count()>0);await checklist.locator('summary').click();
  assert.equal((await page.request.post('http://127.0.0.1:4289/__test/evidence?mode=missing-wiring')).status(),200);
  await page.getByRole('button',{name:'Change Propellers',exact:true}).click();dialog=page.getByRole('dialog');
  await dialog.locator('[data-product-option="small-prop"]').getByRole('button',{name:'Select component',exact:true}).click();await dialog.waitFor({state:'hidden'});
  await page.locator('[data-build-validation="unverified"]').waitFor();assert((await status.innerText()).includes('Unverified'));
  await checklist.locator('summary').click();const wiring=checklist.locator('[data-compatibility-check="FC_ESC_CONNECTOR"]');assert.equal(await wiring.getAttribute('data-validation-status'),'unverified');assert((await wiring.innerText()).includes('missing'));
  assert.equal(await page.locator('body').evaluate(el=>el.scrollWidth<=el.clientWidth),true);assert.deepEqual(errors,[]);
  if(width===390)await page.screenshot({path:'/tmp/dronecores-validation-mobile.png',fullPage:true});
  results.push({width,verifiedCompatible:true,verifiedIncompatible:true,unverified:true,sourceLinksAndDates:true,revocationRefresh:true,keyboardChecklist:true,scopeLimitVisible:true,noOverflow:true});
  assert.equal((await page.request.post('http://127.0.0.1:4289/__test/evidence?mode=complete')).status(),200);
  await page.close();
 }
 const receipt={passed:true,results,loopbackOnly:true,syntheticProducts:true,productionWrites:false};
 await fs.writeFile('qa/compatibility-validation-browser-20261121.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
} finally {await browser.close();}
