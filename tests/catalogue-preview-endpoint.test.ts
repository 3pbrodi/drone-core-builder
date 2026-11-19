import assert from 'node:assert/strict';
import {test} from 'node:test';
import {catalogueRuntimeEndpoint} from '../src/lib/catalogue-endpoint';
const project='https://rtwreynffguvqdcogahx.supabase.co';
test('Lovable development preview resolves the public Vite URL without server credentials',()=>{
 assert.equal(catalogueRuntimeEndpoint({NODE_ENV:'development',VITE_SUPABASE_URL:project+'/'}),project+'/functions/v1/catalogue-runtime');
 assert.equal(catalogueRuntimeEndpoint({NODE_ENV:'production',VITE_SUPABASE_URL:project}),project+'/functions/v1/catalogue-runtime');
});
test('explicit runtime and server project settings retain precedence',()=>{
 assert.equal(catalogueRuntimeEndpoint({NODE_ENV:'development',CATALOGUE_RUNTIME_URL:'http://127.0.0.1:4289/query',VITE_SUPABASE_URL:project}),'http://127.0.0.1:4289/query');
 assert.equal(catalogueRuntimeEndpoint({NODE_ENV:'development',SUPABASE_URL:'https://explicit.supabase.co',VITE_SUPABASE_URL:project}),'https://explicit.supabase.co/functions/v1/catalogue-runtime');
});
test('Vite configuration cannot bypass local-only or test isolation',()=>{
 for(const mode of [{NODE_ENV:'test'},{NODE_ENV:'development',CATALOGUE_LOCAL_ONLY:'true'}]){
  assert.throws(()=>catalogueRuntimeEndpoint({...mode,VITE_SUPABASE_URL:project}));
  assert.equal(catalogueRuntimeEndpoint({...mode,VITE_SUPABASE_URL:'http://127.0.0.1:4289'}),'http://127.0.0.1:4289/functions/v1/catalogue-runtime');
 }
 assert.throws(()=>catalogueRuntimeEndpoint({NODE_ENV:'development'}));
});
