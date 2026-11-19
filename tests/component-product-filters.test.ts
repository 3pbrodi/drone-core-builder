import assert from 'node:assert/strict';
import {test} from 'node:test';
import {existsSync,readFileSync} from 'node:fs';
import {componentFilterMetadata,emptyComponentFilters,filterComponentProducts,loadAllComponentOptions,propellerBladeCount,UNKNOWN_FILTER_VALUE} from '../src/lib/component-product-filters';
import {runtimeRowToProduct} from '../supabase/functions/_shared/catalogue-runtime-product';
import type {Product} from '../src/lib/build-data';
const evidence={fields:[],motorPropeller:[],motorEscCurrent:[],fcEscConnection:[]};
const rows:Product[]=Array.from({length:1501},(_,i)=>({id:`p${i}`,category:'propellers',name:`Prop ${i}`,manufacturer:i===1500?'Last page maker':'Maker',model:'Exact model',manufacturerSku:`SKU-${i}`,variant:'black',spec:i%2?'Explicit 2-blade':'Explicit tri-blade',price:(i+1)/100,weight:2,propInches:i%2?3:5}));
const run=(filters=emptyComponentFilters(),q='')=>filterComponentProducts(rows,'propellers',q,filters,p=>p.id==='p0');
test('complete category bounds, late-page brands, inclusive prices, category and search',()=>{
 const meta=componentFilterMetadata('propellers',rows);assert.equal(meta.min,.01);assert.equal(meta.max,15.01);assert(meta.manufacturers.includes('Last page maker'));
 assert.deepEqual(run({...emptyComponentFilters(),price:[.01,.01]}).map(p=>p.id),['p0']);
 assert.deepEqual(run({...emptyComponentFilters(),price:[15.01,15.01],manufacturer:'Last page maker'},'exact SKU-1500').map(p=>p.id),['p1500']);
 assert.equal(filterComponentProducts(rows,'frame','',emptyComponentFilters(),()=>false).length,0);
 assert.equal(run(emptyComponentFilters(),'black').length,1501);
});
test('combined category, brand, blade, compatibility and genuine 3D capability filters',()=>{
 assert.deepEqual(run({...emptyComponentFilters(),attributes:{blades:'3',propInches:'5'},manufacturer:'Last page maker'}).map(p=>p.id),['p1500']);
 assert.equal(run({...emptyComponentFilters(),compatible:true}).length,1500);
 assert.equal(run({...emptyComponentFilters(),preview3D:true}).length,0);
 assert.deepEqual(filterComponentProducts(rows,'propellers','',{...emptyComponentFilters(),preview3D:true},()=>false,new Set(['p1500'])).map(p=>p.id),['p1500']);
 assert.deepEqual(propellerBladeCount({...rows[0]!,spec:'5x4.3x3 model only'}),[]);
 assert.deepEqual(propellerBladeCount({...rows[0]!,spec:'2-blade or tri-blade, revision unknown'}),[]);
 const unknown={...rows[0]!,manufacturer:undefined,spec:'No blade count'};assert.equal(filterComponentProducts([unknown] as Product[],'propellers','',{...emptyComponentFilters(),manufacturer:UNKNOWN_FILTER_VALUE,attributes:{blades:UNKNOWN_FILTER_VALUE}},()=>false).length,1);
});
test('all 31 pages loaded before filtering, deduplicated, cancellation and errors handled',async()=>{
 const calls:number[]=[];const result=await loadAllComponentOptions(async page=>{calls.push(page);return {status:'ready',products:rows.slice((page-1)*50,page*50),evidence,hasMore:page*50<rows.length}},()=>true);
 assert.equal(calls.length,31);assert.equal(result?.products.length,1501);
 const duplicate=await loadAllComponentOptions(async page=>({status:'ready',products:[rows[0]!],evidence,hasMore:page===1}),()=>true);assert.equal(duplicate?.products.length,1);
 assert.equal(await loadAllComponentOptions(async()=>({status:'ready',products:rows,evidence,hasMore:false}),()=>false),null);
 await assert.rejects(()=>loadAllComponentOptions(async()=>({status:'database_unavailable',products:[],evidence,hasMore:false}),()=>true));
});
test('real released public snapshot: exact category bounds and matching identities retained',{skip:!existsSync('qa/complete12-production-public-runtime-20261119.json')},()=>{
 const snapshot=JSON.parse(readFileSync('qa/complete12-production-public-runtime-20261119.json','utf8'));
 const products:Product[]=snapshot.products.map((row: any)=>runtimeRowToProduct(row)).filter(Boolean);
 assert.equal(products.length,133);
 for(const category of new Set(products.map(p=>p.category))){const own=products.filter(p=>p.category===category),meta=componentFilterMetadata(category,products);assert.equal(meta.min,Math.min(...own.map(p=>p.price)));assert.equal(meta.max,Math.max(...own.map(p=>p.price)));assert.equal(filterComponentProducts(products,category,'',emptyComponentFilters(),()=>false).length,own.length);}
});
