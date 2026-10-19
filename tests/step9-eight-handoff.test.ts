import {test,expect} from "bun:test";
import p from "../qa/step9-eight-source-backed-handoff.json";
import four from "../qa/step8-four-canonical-review-packets.json";

test("Eight separate actual product families, 41 claim references, all still review-pending",()=>{
 expect(p.products).toHaveLength(8);
 expect(new Set(p.products.map(x=>x.qa_id)).size).toBe(8);
 expect(p.products.reduce((sum,x)=>sum+x.technical_claims.length,0)).toBe(41);
 for(const x of p.products){
   expect(x.manufacturer_identity_verified).toBe(false);
   expect(x.required_fields_verification).toBe("pending_human_review");
   expect(x.verified_offer_count).toBe(0);
   expect(x.available_images.photo_reuse_rights).toBe("not_granted");
   expect(x.available_images.image_url).toBeNull();
   expect(x.available_images.licensed_icon_available).toBe(true);
   expect(x.available_images.owner_media_policy_approval).toBe(false);
   expect(x.owner_approved_publication).toBe(false);
   expect(x.release_status).toBe("HOLD");
   expect(x.manufacturer_source.startsWith("https://")).toBe(true);
   expect(x.technical_claims.every(cl=>cl.length===4)).toBe(true);
 }
});
test("All original four canonical required-field values remain unit-correct and source matched",()=>{
 for(const original of four.products) {
   const handoff=p.products.find(x=>x.qa_id===original.qa_id);
   expect(handoff).toBeDefined();
   for(const field of original.technical_required_evidence){
     const newClaim=handoff!.technical_claims.find(c=>c[0]===field.field_key);
     expect(newClaim).toBeDefined();
     expect(newClaim![1]).toEqual(field.canonical_value);
   }
 }
});
test("ESC 6S stock conflict is not verified as live in-stock",()=>{
 const esc=p.products.find(x=>x.category==="esc")!;
 expect(esc.merchant!.research_stock).toBe("CONFLICTING");
 expect(esc.merchant!.category_listing_stock).toBe("out_of_stock");
 expect(esc.merchant!.product_page_stock).toBe("in_stock");
 expect(esc.risk).toContain("conflicting_exact_merchant_stock");
 expect(esc.merchant!.url).toContain("lucid-60a-6s");
});
test("SpeedyBee variants and single CCW airplane prop remain blocked for quad build",()=>{
 const frame=p.products.find(x=>x.category==="frame")!;
 const motor=p.products.find(x=>x.category==="motors")!;
 const prop=p.products.find(x=>x.qa_id==="qa-step8-review-1")!;
 expect(frame.risk.join(" ")).toContain("Bee35");
 expect(motor.risk).toContain("four_option_combinations");
 expect(prop.risk).toContain("not_auto_eligible_in_multirotor_configurator");
 expect(prop.model_variant).toContain("ONE");
 expect(motor.merchant).toBeNull();
});
test("Unit, manufacturer SKU, merchant SKU, GTIN are not conflated",()=>{
 const bat=p.products.find(x=>x.category==="battery")!;
 const rx=p.products.find(x=>x.category==="receiver")!;
 const hq=p.products.find(x=>x.qa_id==="qa-hqprop-ethix-p2-pickle-2cw2ccw")!;
 expect(bat.manufacturer_sku).toBe("1301303BK");
 expect(bat.technical_claims.find(c=>c[0]==="voltage")?.[1]).toBe(3);
 expect(rx.manufacturer_sku).toBeNull();
 expect(rx.merchant_sku).toBe("TBS_CROSS_NANO_SE");
 expect(rx.gtin).toBe("741587426158");
 expect(hq.manufacturer_sku).not.toBe(hq.gtin);
});

test("Foxeer source confirms analog and 4.5–25 V without fabricating lens/ratio SKU",()=>{
 const f=p.products.find(x=>x.qa_id==="qa-step8-review-72")!;
 expect(f.category).toBe("camera");
 expect(f.technical_claims.find(c=>c[0]==="cameraVideoInterface")?.[1]).toBe("CVBS");
 expect(f.technical_claims.find(c=>c[0]==="cameraMinVoltageV")?.[1]).toBe(4.5);
 expect(f.technical_claims.find(c=>c[0]==="cameraMaxVoltageV")?.[1]).toBe(25);
 expect(f.risk).toContain("ratio_4by3_vs_16by9_not_selected");
 expect(f.risk).toContain("lens_1point8_vs_2point1_not_selected");
 expect(f.verified_offer_count).toBe(0);
 expect(f.manufacturer_identity_verified).toBe(false);
});
