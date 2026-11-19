import { createServerFn } from "@tanstack/react-start";
import type { ServerCatalogueSnapshot } from "./catalogue-database.server";
import type { CatalogueQueryResult } from "./catalogue-query.server";
import type { BuildSelection, Category, Product } from "./build-data";
import { normalizeCatalogueQuery, normalizeIds, type CatalogueQuery } from "../../supabase/functions/_shared/catalogue-query";

function snapshot(result: CatalogueQueryResult): ServerCatalogueSnapshot {
 return {...result,evidence:{...result.evidence,fields:result.evidence.fields.map(row=>({...row,field:row.field as keyof Product}))}};
}
export const getConfiguratorComponents = createServerFn({method:"GET"})
 .inputValidator((data:CatalogueQuery)=>normalizeCatalogueQuery({...data,mode:"page",withEvidence:true,withManufacturers:false}))
 .handler(async ({data})=>{
  const {fetchCatalogueQuery}=await import("./catalogue-query.server");
  const result=await fetchCatalogueQuery(data);
  return {...snapshot(result),page:result.page,hasMore:result.hasMore,total:result.total};
 });

export const getConfiguratorCatalogue = createServerFn({method:"GET"})
 .inputValidator((data:{ids?:string[]})=>({ids:normalizeIds(data?.ids)}))
 .handler(async ({data}):Promise<ServerCatalogueSnapshot>=>{
  try {
   const {fetchCatalogueQuery}=await import("./catalogue-query.server");
   const {createProductCatalogue,productCatalogue,rebaseBuildSelectionToCatalogue}=await import("./catalogue-service");
   const exact=await fetchCatalogueQuery({mode:"ids",ids:data.ids});
   const known=new Set(exact.products.map(p=>p.id));
   const legacy=data.ids.filter(id=>!known.has(id)&&productCatalogue.getProductById(id));
   if(!legacy.length) return snapshot(exact);
   // Preserve existing template/AI matching on the server. Only chosen products
   // reach SSR/the browser; exact saved IDs never need this legacy scan.
   const categories=[...new Set(legacy.map(id=>productCatalogue.getProductById(id)!.category))];
   const candidates=[...exact.products];
   await Promise.all(categories.map(async category=>{
    for(let page=1;;page++) {
     const result=await fetchCatalogueQuery({mode:"page",category,page,withEvidence:false});
     candidates.push(...result.products);
     if(!result.hasMore) break;
    }
   }));
   const selection:BuildSelection={};
   for(const id of data.ids) {
    const product=exact.products.find(p=>p.id===id)??productCatalogue.getProductById(id);
    if(product) selection[product.category as Category]=id;
   }
   const rebased=rebaseBuildSelectionToCatalogue(selection,createProductCatalogue(candidates));
   return snapshot(await fetchCatalogueQuery({mode:"ids",ids:[...new Set([...known,...Object.values(rebased)])]}));
  } catch {
   return {source:"unavailable",status:"database_unavailable",products:[],evidence:{fields:[],motorPropeller:[],motorEscCurrent:[],fcEscConnection:[]},validation:{ok:false,missingCategories:[],duplicateProductIds:[],rejectedProductIds:[],invalidProductIds:[]},error:"Verified catalogue could not be loaded."};
  }
 });
