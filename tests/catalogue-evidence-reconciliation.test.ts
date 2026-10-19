import {test,expect} from "bun:test";
import {resolveMerchantEvidence,type MerchantEvidenceObservation} from "../src/lib/catalogue-evidence-reconciliation";

const t=new Date("2026-10-19T20:10:00Z");
const fresh="2026-10-19T20:00:00Z";
const product=(overrides:Partial<MerchantEvidenceObservation>={}):MerchantEvidenceObservation=>({
 sourceUrl:"https://www.rctech.de/tbs-lucid-60a-6s-4-in-1-esc",
 sourceType:"exact_product_page",exactSku:"TBS_LUCID_ESC",
 exactGtin:"703674150797",exactVariantAndPack:true,
 priceEUR:59.90,stock:"in_stock",checkedAt:fresh,...overrides
});
const category=(overrides:Partial<MerchantEvidenceObservation>={}):MerchantEvidenceObservation=>({
 sourceUrl:"https://www.rctech.de/flugelektronik/regler-esc",
 sourceType:"category_card",exactSku:"TBS_LUCID_ESC",
 exactGtin:"703674150797",exactVariantAndPack:true,
 priceEUR:59.90,stock:"in_stock",checkedAt:fresh,...overrides
});
function review(x:MerchantEvidenceObservation[],sku="TBS_LUCID_ESC",gtin:string|null="703674150797"){
 return resolveMerchantEvidence(x,sku,gtin,t);
}
test("Exactly matching fresh product price+stock, SKU, GTIN can proceed to manual review ONLY",()=>{
 const result=review([product(),category()]);
 expect(result.status).toBe("ready_for_human_review");
 expect(result.blockers).toEqual([]);
 expect(result.observedPriceEUR).toBe(59.9);
 expect(result.observedStock).toBe("in_stock");
});
test("RCTech Lucid 6S product says available, exact category says sold out -> HARD BLOCK",()=>{
 const result=review([product(),category({stock:"out_of_stock"})]);
 expect(result.status).toBe("blocked");
 expect(result.observedStock).toBe("unknown");
 expect(result.blockers).toContain("conflicting_stock_between_product_and_category");
});
test("8S alternate variant cannot clear 6S gate",()=>{
 const r=review([product(),category({exactSku:"TBS_LUCID_8S",exactVariantAndPack:false})]);
 expect(r.blockers).toEqual(expect.arrayContaining(["merchant_sku_mismatch","variant_or_pack_not_exact"]));
});
test("Older stale or future-dated observations cannot be approved",()=>{
 expect(review([product({checkedAt:"2026-10-17T12:00:00Z"})]).blockers)
   .toContain("source_missing_stale_or_future_timestamp");
 expect(review([product({checkedAt:"2026-10-20T12:00:00Z"})]).blockers)
   .toContain("source_missing_stale_or_future_timestamp");
});
test("Missing or wrong GTIN cannot prove the exact Nano SE bundle",()=>{
 const a=review([product({exactGtin:"741587426240"})],"TBS_CROSS_NANO_SE","741587426158");
 expect(a.blockers).toContain("merchant_gtin_mismatch");
});
test("Shop category or search index alone cannot become public retailer offer",()=>{
 expect(review([category()]).blockers).toContain("no_exact_product_page");
 expect(review([product(),{...category(),sourceType:"search_index"}]).blockers)
  .toContain("search_index_not_live_offer_evidence");
});
test("No-price, no-stock, negative, currency conversion guesses remain blocked",()=>{
 expect(review([product({priceEUR:null,stock:"unknown"})]).blockers)
  .toEqual(expect.arrayContaining(["missing_positive_exact_eur_price","no_current_confirmed_exact_page_stock"]));
 expect(review([product({priceEUR:-5})]).blockers).toContain("missing_positive_exact_eur_price");
});
test("HTTPS required, packs never assumed, missing timestamps block",()=>{
 const r=review([product({sourceUrl:"http://rctech.example/sku",exactVariantAndPack:false,checkedAt:null})]);
 expect(r.blockers).toEqual(expect.arrayContaining(["invalid_https_source","variant_or_pack_not_exact","source_missing_stale_or_future_timestamp"]));
});
test("Unknown category stock does not fabricate conflicting status",()=>{
 const r=review([product(),category({stock:"unknown"})]);
 expect(r.status).toBe("ready_for_human_review");
 expect(r.observedStock).toBe("in_stock");
});
test("No observations or duplicate exact-page prices cannot be treated as one offer",()=>{
 expect(review([]).blockers).toEqual(expect.arrayContaining(["no_observations","no_exact_product_page"]));
 expect(review([product(),product({priceEUR:60.9})]).blockers).toEqual(expect.arrayContaining([
  "exact_product_observation_not_unique","contradictory_exact_page_price"
 ]));
});
