import assert from 'node:assert/strict';
import {test} from 'node:test';
import {catalogueRuntimeEndpoint,publicCatalogueRuntime} from '../src/lib/catalogue-endpoint';
test('public product catalogue is independent of missing or unrelated auth configuration',()=>{
 for(const env of [{NODE_ENV:'development'},{NODE_ENV:'production'},{NODE_ENV:'development',VITE_SUPABASE_URL:'https://unrelated-auth.supabase.co'},{SUPABASE_URL:'https://unrelated-auth.supabase.co'}])assert.equal(catalogueRuntimeEndpoint(env),publicCatalogueRuntime);
});
test('dedicated catalogue configuration retains precedence',()=>{
 assert.equal(catalogueRuntimeEndpoint({CATALOGUE_RUNTIME_URL:'https://catalogue.example/query',VITE_SUPABASE_URL:'https://auth.example'}),'https://catalogue.example/query');
 assert.equal(catalogueRuntimeEndpoint({VITE_CATALOGUE_RUNTIME_URL:'https://catalogue.example/query'}),'https://catalogue.example/query');
});
test('public defaults and Vite variables cannot bypass local-only or test isolation',()=>{
 for(const mode of [{NODE_ENV:'test'},{NODE_ENV:'development',CATALOGUE_LOCAL_ONLY:'true'}]){
  assert.throws(()=>catalogueRuntimeEndpoint(mode));
  assert.throws(()=>catalogueRuntimeEndpoint({...mode,VITE_SUPABASE_URL:'https://auth.supabase.co'}));
  assert.throws(()=>catalogueRuntimeEndpoint({...mode,VITE_CATALOGUE_RUNTIME_URL:publicCatalogueRuntime}));
  assert.equal(catalogueRuntimeEndpoint({...mode,VITE_SUPABASE_URL:'http://127.0.0.1:4289'}),'http://127.0.0.1:4289/functions/v1/catalogue-runtime');
 }
});
