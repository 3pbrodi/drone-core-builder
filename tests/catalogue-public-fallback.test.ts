import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fetchPublicCatalogueQuery,readCatalogueWithPublicFallback,PublicCatalogueReadError,browserCatalogueEndpoint} from '../src/lib/catalogue-public-query';
const evidence={fields:[],motorPropeller:[],motorEscCurrent:[],fcEscConnection:[]};
const result={queryVersion:1,source:'database',status:'ready',products:[],total:0,page:1,pageSize:50,hasMore:false,evidence,manufacturers:[],rejectedProductIds:[],validation:{ok:true,missingCategories:[],duplicateProductIds:[],rejectedProductIds:[],invalidProductIds:[]}} as const;
test('a blocked preview server call recovers through the scoped public query without credentials',async()=>{
 let calls=0;
 const request:typeof fetch=async(url,options)=>{calls++;const q=JSON.parse(new URL(String(url)).searchParams.get('query')!);assert.equal(q.category,'motors');assert.equal(q.page,2);assert.deepEqual(q.selectedIds,['selected']);assert.equal(options?.credentials,'omit');assert.equal(new Headers(options?.headers).get('authorization'),null);assert.equal(new Headers(options?.headers).get('apikey'),null);return Response.json(result)};
 const value=await readCatalogueWithPublicFallback(async()=>{throw Error('preview server function unavailable')},{category:'motors',page:2,selectedIds:['selected']},q=>fetchPublicCatalogueQuery(q,'http://127.0.0.1/query',request));assert.equal(value.status,'ready');assert.equal(calls,1);
});
test('unavailable selected-ID lookup recovers but a healthy primary does not duplicate requests',async()=>{
 let calls=0;const publicRead=async(q:any)=>{calls++;assert.deepEqual(q.ids,['motor']);return {...result,products:[]} as any};
 assert.equal((await readCatalogueWithPublicFallback(async()=>({status:'database_unavailable'}),{mode:'ids',ids:['motor']},publicRead)).status,'ready');
 assert.equal((await readCatalogueWithPublicFallback(async()=>({status:'ready'}),{mode:'ids',ids:['motor']},publicRead)).status,'ready');assert.equal(calls,1);
});
test('HTTP and malformed public responses remain errors with safe diagnostics',async()=>{
 await assert.rejects(()=>fetchPublicCatalogueQuery({},'http://127.0.0.1/query',async()=>new Response('',{status:403})),/HTTP 403/);
 await assert.rejects(()=>fetchPublicCatalogueQuery({},'http://127.0.0.1/query',async()=>Response.json({status:'ready',products:[]})),/unsupported/);
 await assert.rejects(()=>fetchPublicCatalogueQuery({},'http://127.0.0.1/query',async()=>{throw Error('private backend details')}),e=>e instanceof PublicCatalogueReadError&&!e.message.includes('private'));
});

test('browser isolation survives a forwarded preview host and unrelated auth URLs',()=>{
 assert.throws(()=>browserCatalogueEndpoint({VITE_CATALOGUE_LOCAL_ONLY:'true',VITE_SUPABASE_URL:'https://auth.supabase.co'},'forwarded-preview.example'));
 assert.equal(browserCatalogueEndpoint({VITE_SUPABASE_URL:'https://unrelated-auth.supabase.co'},'preview.lovable.app'),'https://rtwreynffguvqdcogahx.supabase.co/functions/v1/catalogue-runtime');
 assert.throws(()=>browserCatalogueEndpoint({},'127.0.0.1'));
});
