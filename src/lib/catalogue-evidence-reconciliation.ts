/** A conservative evidence reconciliation layer for *research observations*.
 * Merchant parsers cannot grant manual approval, and conflicting stock signals
 * must NEVER result in a public offer. No Production access.
 */
export type MerchantEvidenceObservation={
  sourceUrl:string;
  sourceType:"exact_product_page"|"category_card"|"search_index";
  exactSku:string|null;
  exactGtin:string|null;
  exactVariantAndPack:boolean;
  priceEUR:number|null;
  stock:"in_stock"|"out_of_stock"|"preorder"|"unknown";
  checkedAt:string|null;
};
export type MerchantReviewResolution={
  status:"ready_for_human_review"|"blocked";
  observedPriceEUR:number|null;
  observedStock:"in_stock"|"out_of_stock"|"unknown";
  blockers:string[];
  sourcesUsed:string[];
};
function validHttps(s:string) {
  try{const u=new URL(s);return u.protocol==="https:"&&!!u.hostname;}catch{return false;}
}
export function resolveMerchantEvidence(
 observations:MerchantEvidenceObservation[],
 expectedSku:string|null,
 expectedGtin:string|null,
 asOf:Date,
 maxHours=24,
):MerchantReviewResolution {
 const reasons:string[]=[];
 if(!observations.length)reasons.push("no_observations");
 if(!observations.some(x=>x.sourceType==="exact_product_page"))
   reasons.push("no_exact_product_page");
 // The exact page controls price; a category view is corroborative, never the
 // source of a first-party price nor permission to publish.
 const exact=observations.filter(x=>x.sourceType==="exact_product_page");
 if(exact.length!==1)reasons.push("exact_product_observation_not_unique");
 const p=exact.length===1?exact[0]:null;
 const sourcesUsed=observations.map(x=>x.sourceUrl);
 for(const obs of observations){
   if(!validHttps(obs.sourceUrl))reasons.push("invalid_https_source");
   const age=obs.checkedAt?asOf.getTime()-Date.parse(obs.checkedAt):NaN;
   if(!Number.isFinite(age)||age<0||age>maxHours*3600*1000)
     reasons.push("source_missing_stale_or_future_timestamp");
   if(obs.sourceType==="search_index")reasons.push("search_index_not_live_offer_evidence");
   if(!obs.exactVariantAndPack) reasons.push("variant_or_pack_not_exact");
   if(expectedSku!==null && obs.exactSku!==expectedSku)
     reasons.push("merchant_sku_mismatch");
   if(expectedGtin!==null && obs.exactGtin!==expectedGtin)
     reasons.push("merchant_gtin_mismatch");
 }
 if(!p||p.priceEUR===null||!Number.isFinite(p.priceEUR)||p.priceEUR<=0)
   reasons.push("missing_positive_exact_eur_price");
 const stocks=new Set(observations.filter(o=>o.sourceType!=="search_index"
     && o.stock!=="unknown").map(o=>o.stock));
 if(stocks.size>1)reasons.push("conflicting_stock_between_product_and_category");
 if(!p||p.stock!=="in_stock")reasons.push("no_current_confirmed_exact_page_stock");
 // If another exact same-SKU observed price disagrees, keep it ambiguous.
 // Do not infer same price across variants from category listing!
 const prices=new Set(exact.filter(x=>x.priceEUR!==null).map(x=>x.priceEUR));
 if(prices.size>1)reasons.push("contradictory_exact_page_price");
 const blockers=[...new Set(reasons)];
 return {
   status:blockers.length===0?"ready_for_human_review":"blocked",
   observedPriceEUR:p?.priceEUR??null,
   observedStock:blockers.some(b=>b==="conflicting_stock_between_product_and_category")
     ?"unknown":p?.stock==="in_stock"?"in_stock":p?.stock==="out_of_stock"?"out_of_stock":"unknown",
   blockers,sourcesUsed,
 };
}
