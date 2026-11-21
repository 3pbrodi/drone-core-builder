// Requires the existing loopback fixture4289 + isolated Vite4190; denies remote browser requests.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE??'/usr/bin/chromium',args:['--no-sandbox']});
const results=[];
try {
 for(const width of [390,1280]) {
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  const mode=async value=>assert.equal((await page.request.post(`http://127.0.0.1:4289/__test/evidence?mode=${value}`)).status(),200);
  await mode('complete');
  await page.goto('http://127.0.0.1:4190/create-custom-build?source=ai&budget=300&wishes=6S%20ELRS%202.5%20inch',{waitUntil:'networkidle'});
  const status=page.locator('[data-build-validation]'),checklist=page.locator('#compatibility-checklist');
  await page.locator('[data-build-validation="verified-compatible"]').waitFor({timeout:30000});
  assert.equal(await page.locator('[data-ai-selection-warning]').count(),0);
  await checklist.locator('summary').click();assert((await checklist.innerText()).includes('installed firmware remain unverified'));await checklist.locator('summary').click();
  results.push({width,scenario:'valid',status:'verified-compatible',scope:'listed checks only'});
  let target='small';
  const refresh=async()=>{
   if(await checklist.getAttribute('open')!==null)await checklist.locator('summary').click();
   await page.getByRole('button',{name:'Change Frame',exact:true}).click();const dialog=page.getByRole('dialog');
   const option=dialog.locator(`[data-product-option="${target}"]`);
   if(await option.getByRole('button',{name:'Keep selected',exact:true}).count())target=target==='small'?'blue':'small';
   await dialog.locator(`[data-product-option="${target}"]`).getByRole('button',{name:'Select component',exact:true}).click();await dialog.waitFor({state:'hidden'});
   target=target==='small'?'blue':'small';
  };
  for(const item of [
   {mode:'mismatched-wiring',code:'FC_ESC_CONNECTOR',status:'verified-incompatible',scenario:'wiring mismatch'},
   {mode:'unsupported-combination',code:'MOTOR_PROPELLER_SIZE_GUIDANCE',status:'unverified',scenario:'unsupported pairing'},
   {mode:'missing-dimensions',code:'FRAME_MOTOR_MOUNT',status:'unverified',scenario:'missing dimensions'},
   {mode:'revoked-evidence',code:'FC_ESC_CONNECTOR',status:'unverified',scenario:'revoked proof'},
  ]) {
   await mode(item.mode);await refresh();await page.locator(`[data-build-validation="${item.status}"]`).waitFor();
   const notice=page.locator(`[data-ai-selection-warning="${item.status}"]`);await notice.getByRole('link',{name:'Review current checks',exact:true}).click();
   assert.notEqual(await checklist.getAttribute('open'),null);
   const check=checklist.locator(`[data-compatibility-check="${item.code}"]`);assert.equal(await check.getAttribute('data-validation-status'),item.status);
   if(item.mode==='missing-dimensions'){
    assert((await check.innerText()).includes('frame.mount'));
    assert.equal(await checklist.locator('[data-compatibility-check="FRAME_PROPELLER_CLEARANCE"]').getAttribute('data-validation-status'),'unverified');
   }
   assert.equal(await page.locator('body').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
   results.push({width,scenario:item.scenario,status:item.status,reviewNotice:true,checklistNavigation:true,noOverflow:true});
   await mode('complete');await refresh();await page.locator('[data-build-validation="verified-compatible"]').waitFor();assert.equal(await page.locator('[data-ai-selection-warning]').count(),0);
  }
  // The actual public projection removes withdrawn rows; also verify that shape.
  await mode('missing-wiring');await refresh();await page.locator('[data-build-validation="unverified"]').waitFor();
  assert.equal(await page.locator('[data-ai-selection-warning="unverified"]').count(),1);
  await mode('complete');await refresh();await page.locator('[data-build-validation="verified-compatible"]').waitFor();
  assert.deepEqual(errors,[]);await page.close();
 }
 const receipt={passed:true,results,scenariosPerViewport:5,withdrawnRowRemovalAndRestoration:true,loopbackOnly:true,syntheticData:true,productionReads:false,productionWrites:false};
 await fs.writeFile('qa/ai-build-release-browser-20261121.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
} finally {await browser.close();}
