import {test,expect} from "bun:test";
import audit from "../qa/step8-round-20261019/37-source-evidence-review.json";

test("37 historical source leads are not 37 verified products",()=>{
 expect(audit.totals.original_source_rows).toBe(171);
 expect(audit.totals.research_leads).toBe(37);
 expect(audit.records).toHaveLength(37);
 expect(audit.totals.http_accessible_source_pages).toBe(37);
 expect(audit.totals.potential_standalone_components).toBe(33);
 expect(audit.totals.excluded_accessory_records).toBe(4);
 expect(audit.totals.human_verified_fields).toBe(0);
 expect(audit.totals.approved_eu_offers).toBe(0);
 expect(audit.totals.licensed_vendor_photos).toBe(0);
 expect(audit.totals.production_writes).toBe(0);
 expect(audit.records.every(x=>x.identity_human_verified===false &&
  x.technical_specs_human_verified===false && x.eu_offer_verified===false &&
  x.media_license_verified===false && x.publication_approved===false)).toBe(true);
});
test("Both so-called batteries are accessories, never LiPo candidates",()=>{
 const batteries=audit.records.filter(x=>x.category==="battery");
 expect(batteries).toHaveLength(2);
 expect(batteries.every(x=>x.eligible_standalone_research===false)).toBe(true);
 expect(batteries.every(x=>x.classification==="accessory_not_battery")).toBe(true);
 expect(batteries.some(x=>/anti-slip/i.test(x.model))).toBe(true);
 expect(batteries.some(x=>/ummagrip/i.test(x.model))).toBe(true);
});
test("Spare bearing and frame arm are excluded from their full-product categories",()=>{
 const accessory=audit.records.filter(x=>!x.eligible_standalone_research);
 expect(accessory).toHaveLength(4);
 expect(accessory.map(x=>x.category).sort()).toEqual(["battery","battery","frame","motors"]);
 expect(accessory.some(x=>x.classification==="accessory_not_motor")).toBe(true);
 expect(accessory.some(x=>x.classification==="accessory_not_complete_frame")).toBe(true);
});
test("HTTP 200 and generic SHOP title are not sufficient product-identity verification",()=>{
 expect(audit.totals.model_family_title_hints).toBe(13);
 const ambiguous=audit.records.filter(x=>x.automated_review_hint==="ambiguous_model_or_variant");
 expect(ambiguous.length).toBe(24);
 expect(ambiguous.some(x=>x.extracted_product_heading==="SHOP")).toBe(true);
 expect(ambiguous.every(x=>x.identity_human_verified===false)).toBe(true);
});
test("Research retains eight categories, source URLs and all gaps",()=>{
 expect(new Set(audit.records.map(x=>x.category)).size).toBe(8);
 expect(audit.records.filter(x=>x.required_fields_missing_from_archived_normalization.length>0).length).toBe(31);
 const domains=new Set(["www.hqprop.com","www.foxeer.com","www.speedybee.com","www.team-blacksheep.com"]);
 expect(audit.records.every(x=>{
  try{return domains.has(new URL(x.official_manufacturer_url).hostname);}catch{return false;}
 })).toBe(true);
 expect(new Set(audit.records.map(x=>x.pilot_id)).size).toBe(37);
 expect(audit.records.every(x=>Array.isArray(x.review_blockers))).toBe(true);
});
