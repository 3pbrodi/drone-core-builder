import {test,expect} from "bun:test";
import {evaluateDossier,type ProductDossier} from "../src/lib/catalogue-evidence-dossier";
import firstFour from "../qa/step8-four-canonical-review-packets.json";
import sources from "../qa/step8-round-20261019/37-source-evidence-review.json";
const now=new Date("2026-10-19T20:00:00Z");
function sample():ProductDossier{return {
 qaId:"example",category:"esc",model:"Exact 6S ESC",knownAccessoryOrBundle:false,
 identity:{sourceUrl:"https://example.com/model",exactVariant:true,status:"verified",reviewedBy:"reviewer"},
 requiredKeys:["escAmps"],
 fields:[{key:"escAmps",value:60,unit:"A",sourceUrl:"https://example.com/model",
  sourceExcerpt:"Rated 60 A",exactVariant:true,status:"verified",reviewedBy:"reviewer",
  reviewedAt:"2026-10-19T19:00:00Z"}],
 merchant:{merchantUrl:"https://store.example.eu/model",observedAt:"2026-10-19T19:00:00Z",
  priceEur:59.9,stock:"in_stock",euShippingConfirmed:true,exactVariantAndPack:true,
  status:"verified",reviewedBy:"reviewer"},
 media:{mode:"neutral_icon",policyApproved:true,licensedPhotoUrl:null,licenseDocumentUrl:null,licenseReviewedBy:null},
 ownerApproved:true,
};}
test("fully proven synthetic dossier passes; never counts as real-product verification",()=>{
 expect(evaluateDossier(sample(),now)).toEqual({ready:true,reasons:[]});
});
test("reviewed identity with missing field excerpt or human signoff is denied",()=>{
 const s=sample();s.fields[0].sourceExcerpt=null;s.fields[0].reviewedBy=null;
 expect(evaluateDossier(s,now).reasons).toContain("unverified_field:escAmps");
});
test("stale prices, unknown stock and no EU delivery cannot pass",()=>{
 const s=sample();s.merchant!.observedAt="2026-10-17T19:00:00Z";
 s.merchant!.stock="unknown";s.merchant!.euShippingConfirmed=false;
 expect(evaluateDossier(s,now).reasons).toEqual(expect.arrayContaining(
 ["merchant_observation_not_fresh","merchant_inventory_not_confirmed","merchant_offer_not_verified"]));
});
test("image photos require a separately reviewed actual license grant",()=>{
 const s=sample();s.media={mode:"licensed_photo",policyApproved:true,licensedPhotoUrl:"https://example.com/photo",
  licenseDocumentUrl:null,licenseReviewedBy:null};
 expect(evaluateDossier(s,now).reasons).toContain("photo_reuse_license_unverified");
});
test("owner approval is not implied by source or shop observations",()=>{
 const s=sample();s.ownerApproved=false;
 expect(evaluateDossier(s,now).reasons).toContain("owner_publication_approval_missing");
});
test("accessories cannot pass even if other fields are reviewed",()=>{
 const s=sample();s.knownAccessoryOrBundle=true;
 expect(evaluateDossier(s,now).reasons).toContain("not_standalone_component");
});
test("all four actual first product packets are blocked until real independent review",()=>{
 expect(firstFour.products).toHaveLength(4);
 for(const item of firstFour.products){
  const s:ProductDossier={
   qaId:item.qa_id,category:item.category,model:item.exact_model,knownAccessoryOrBundle:false,
   identity:{sourceUrl:item.original_source_url,exactVariant:false,status:"source_observed",reviewedBy:null},
   requiredKeys:item.technical_required_evidence.map(f=>f.field_key),
   fields:item.technical_required_evidence.map(f=>({key:f.field_key,value:f.canonical_value,unit:f.unit,
    sourceUrl:f.manufacturer_source_url,sourceExcerpt:null,exactVariant:false,
    status:"source_observed" as const,reviewedBy:null,reviewedAt:null})),
   merchant:null,media:{mode:"neutral_icon",policyApproved:false,licensedPhotoUrl:null,
    licenseDocumentUrl:null,licenseReviewedBy:null},ownerApproved:false,
  };
  const out=evaluateDossier(s,now);
  expect(out.ready).toBe(false);
  expect(out.reasons).toContain("identity_not_independently_verified");
  expect(out.reasons).toContain("owner_publication_approval_missing");
  expect(out.reasons).toContain("no_current_exact_eu_offer");
 }
});
test("37 source leads are not 37 verified catalog products",()=>{
 expect(sources.records).toHaveLength(37);
 expect(sources.records.filter(x=>!x.eligible_standalone_research)).toHaveLength(4);
 expect(sources.records.every(x=>!x.identity_human_verified&&!x.technical_specs_human_verified&&!x.eu_offer_verified&&!x.publication_approved)).toBe(true);
});
