// Loopback-only synthetic fixture; requires the local website on4190 and filter fixture on4289.
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE??'/usr/bin/chromium',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1280,height:960}}),errors=[],external=[];
await page.route('**/*',route=>{if(new URL(route.request().url()).hostname==='127.0.0.1')return route.continue();external.push(route.request().url());return route.abort()});page.on('pageerror',e=>errors.push(String(e)));
try{
 await page.goto('http://127.0.0.1:4190/create-custom-build?product=frame-000',{waitUntil:'networkidle'});
 await page.getByRole('button',{name:'Select Propellers',exact:true}).click();
 const dialog=page.getByRole('dialog');await dialog.getByText('60 matching products · 60 in this category',{exact:true}).waitFor();await dialog.getByRole('button',{name:'Product filters',exact:true}).click();
 const headings=()=>dialog.getByRole('heading',{name:/Synthetic propellers/});assert.equal(await headings().count(),50);
 assert.equal(await dialog.getByRole('slider',{name:'Minimum price'}).getAttribute('aria-valuemin'),'1');assert.equal(await dialog.getByRole('slider',{name:'Maximum price'}).getAttribute('aria-valuemax'),'60');
 assert(await dialog.getByLabel('Brand',{exact:true}).locator('option').filter({hasText:'Last page brand'}).count());
 await dialog.getByRole('button',{name:/Show more components/}).click();assert.equal(await headings().count(),60);
 await dialog.getByLabel('Search components',{exact:true}).fill('PROPELLERS-059');assert.equal(await headings().count(),1);
 await dialog.getByLabel('Brand',{exact:true}).selectOption('Last page brand');await dialog.getByLabel('Blade count',{exact:true}).selectOption('2');assert.equal(await headings().count(),1);
 await dialog.getByRole('button',{name:'Reset filters',exact:true}).click();assert.equal(await headings().count(),50);
 const maximum=dialog.getByRole('slider',{name:'Maximum price'});await maximum.focus();await maximum.press('ArrowLeft');await dialog.getByText('59 matching products · 60 in this category',{exact:true}).waitFor();
 await dialog.getByRole('button',{name:'Reset filters',exact:true}).click();
 await dialog.getByRole('switch',{name:'Compatibility',exact:true}).click();await dialog.getByText('59 matching products · 60 in this category',{exact:true}).waitFor();assert.equal(await dialog.getByRole('heading',{name:'Synthetic propellers 005',exact:true}).count(),0);assert.equal(await dialog.getByRole('heading',{name:'Synthetic propellers 006',exact:true}).count(),1);
 await dialog.getByRole('switch',{name:'3D preview',exact:true}).click();await dialog.getByText('0 matching products · 60 in this category',{exact:true}).waitFor();assert.equal(await headings().count(),0);
 await dialog.getByRole('button',{name:'Reset filters',exact:true}).first().click();
 await dialog.getByLabel('Blade count',{exact:true}).selectOption('__not_specified__');assert.equal(await headings().count(),1);await dialog.getByRole('button',{name:'Reset filters',exact:true}).click();
 await dialog.getByLabel('Brand',{exact:true}).selectOption('Last page brand');await page.keyboard.press('Escape');assert.equal(await dialog.count(),0);await page.getByRole('button',{name:'Select Propellers',exact:true}).click();await dialog.getByText('60 matching products · 60 in this category',{exact:true}).waitFor();await dialog.getByRole('button',{name:'Product filters',exact:true}).click();
 await page.setViewportSize({width:390,height:844});assert.equal(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth),true);
 await dialog.getByLabel('Brand',{exact:true}).selectOption('Last page brand');await dialog.getByRole('button',{name:'Select component',exact:true}).click();await dialog.waitFor({state:'hidden'});await page.getByText('Synthetic propellers 059',{exact:true}).first().waitFor();await page.getByText('Synthetic frame 000',{exact:true}).first().waitFor();
 await page.getByRole('button',{name:'Select Motors',exact:true}).click();await dialog.getByText('0 matching products · 0 in this category',{exact:true}).waitFor();await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Change Propellers',exact:true}).click();await dialog.getByText('60 matching products · 60 in this category',{exact:true}).waitFor();await dialog.getByRole('button',{name:'Product filters',exact:true}).click();
 await dialog.getByLabel('Search components',{exact:true}).focus();await page.keyboard.press('Shift+Tab');assert.equal(await dialog.evaluate(el=>el.contains(document.activeElement)),true);
 await page.screenshot({path:'/tmp/dronecores-component-filters-mobile.png'});
 const metrics=await(await fetch('http://127.0.0.1:4289/metrics')).json();assert(metrics.some(q=>q.category==='propellers'&&q.page===2));assert.deepEqual(errors,[]);
 const receipt={passed:true,localOnly:true,fullCategoryPagination:true,priceRange:true,brandFromLaterPage:true,combinedFilters:true,bladeCountAndUnknown:true,confirmedConflictHiddenUnknownKept:true,threeDNoFalseMatches:true,search:true,showMore:true,resetOnCategoryOpen:true,selectionAndExistingFramePreserved:true,emptyCategory:true,mobileNoHorizontalOverflow:true,keyboardEscapeAndFocusContainment:true,productionWrites:false};await fs.writeFile('/workspace/drone-core-builder/qa/component-product-filters-browser-20261119.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
}catch(e){console.error(await page.locator('body').innerText());throw e}finally{await browser.close()}
