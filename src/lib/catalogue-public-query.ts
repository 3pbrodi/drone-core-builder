import { catalogueRuntimeEndpoint } from './catalogue-endpoint';
import { normalizeCatalogueQuery, type CatalogueQuery } from '../../supabase/functions/_shared/catalogue-query';
import type { loadCatalogueQuery } from '../../supabase/functions/_shared/catalogue-query-service';
import type { Category, Product } from './build-data';
import type { CatalogueEvidenceSnapshot } from './catalogue-evidence';

type RawResult = Awaited<ReturnType<typeof loadCatalogueQuery<Category>>>;
export type PublicCatalogueResult = Omit<RawResult,'evidence'> & {evidence:CatalogueEvidenceSnapshot};
export class PublicCatalogueReadError extends Error {}

export function browserCatalogueEndpoint(
  env:Record<string,string|undefined>={
    MODE:import.meta.env?.MODE,
    VITE_CATALOGUE_LOCAL_ONLY:import.meta.env?.["VITE_CATALOGUE_LOCAL_ONLY"],
    VITE_CATALOGUE_RUNTIME_URL:import.meta.env?.["VITE_CATALOGUE_RUNTIME_URL"],
    VITE_SUPABASE_URL:import.meta.env?.["VITE_SUPABASE_URL"],
  },
  hostname=typeof location==='undefined'?'':location.hostname,
): string {
  const loopback=['localhost','127.0.0.1','[::1]'].includes(hostname);
  return catalogueRuntimeEndpoint({
    NODE_ENV:env['MODE'],
    CATALOGUE_LOCAL_ONLY:loopback?'true':env['VITE_CATALOGUE_LOCAL_ONLY'],
    CATALOGUE_RUNTIME_URL:env['VITE_CATALOGUE_RUNTIME_URL'],
    VITE_SUPABASE_URL:env['VITE_SUPABASE_URL'],
  });
}

/** Read-only public API. No auth/session or database secret is sent by this transport. */
export async function fetchPublicCatalogueQuery(input:CatalogueQuery,endpoint:string,request:typeof fetch=fetch):Promise<PublicCatalogueResult> {
  const query=normalizeCatalogueQuery(input),url=new URL(endpoint);
  url.searchParams.set('query',JSON.stringify(query));
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try {
    let response:Response;
    try {response=await request(url,{headers:{accept:'application/json'},credentials:'omit',signal:controller.signal});}
    catch {throw new PublicCatalogueReadError(controller.signal.aborted?'The product service timed out. Please retry.':'The public product service could not be reached. Please retry.');}
    if(!response.ok) throw new PublicCatalogueReadError(`The product service returned HTTP ${response.status}. Please retry.`);
    let result:RawResult;
    try {result=await response.json();}catch{throw new PublicCatalogueReadError('The product service returned an invalid response.');}
    if(!result || result.queryVersion!==1 || result.status!=='ready' || !Array.isArray(result.products) || !result.evidence ||
      !['fields','motorPropeller','motorEscCurrent','fcEscConnection'].every(key=>Array.isArray(result.evidence[key as keyof typeof result.evidence])) ||
      !Number.isSafeInteger(result.total) || result.total<0 || typeof result.hasMore!=='boolean')
      throw new PublicCatalogueReadError('The product service returned an unsupported catalogue response.');
    return {...result,evidence:{...result.evidence,fields:result.evidence.fields.map(row=>({...row,field:row.field as keyof Product}))}};
  } finally {clearTimeout(timer);}
}

export async function readCatalogueWithPublicFallback<T extends {status:string}>(
  primary:()=>Promise<T>,query:CatalogueQuery,
  publicRead:(query:CatalogueQuery)=>Promise<PublicCatalogueResult> = q=>fetchPublicCatalogueQuery(q,browserCatalogueEndpoint()),
):Promise<T|PublicCatalogueResult> {
  try {const result=await primary();if(result.status==='ready') return result;}catch{/* A preview server-function failure must not hide a healthy public catalogue. */}
  return publicRead(query);
}
