import { test, expect } from "bun:test";
import packets from "../qa/step8-four-canonical-review-packets.json";

const categories=["battery","propellers","receiver","esc"];
test("All four canonical packets are pending and exact-model sourced",()=>{
 const rows=packets.products;
 expect(rows).toHaveLength(4);
 expect(rows.map(x=>x.category).sort()).toEqual(categories.sort());
 expect(rows.every(x=>x.original_source_url.startsWith("https://"))).toBe(true);
 expect(new Set(rows.map(x=>x.qa_id)).size).toBe(4);
 for(const x of rows){
  expect(x.publication.allowed).toBe(false);
  expect(x.publication.owner_approved).toBe(false);
  expect(x.image_policy.approved).toBe(false);
  expect(x.image_policy.manufacturer_image_reuse).toBe(false);
  expect(x.exact_variant_review.approved).toBe(false);
  expect(x.merchant_offers.length).toBeGreaterThan(0);
  expect(x.merchant_offers.every(o=>o.verified===false)).toBe(true);
  for(const ev of x.technical_required_evidence) {
   expect(ev.evidence_status).toBe("pending_human_review");
   expect(ev.verified_by).toBeNull();
   expect(ev.verified_at).toBeNull();
   expect(ev.manufacturer_source_url.startsWith("https://")).toBe(true);
  }
 }
});
test("all 13 required evidence fields are in canonical database units",()=>{
 const rows=packets.products;
 const all=rows.flatMap(x=>x.technical_required_evidence);
 expect(all).toHaveLength(13);
 const battery=rows.find(x=>x.category==="battery")!;
 const esc=rows.find(x=>x.category==="esc")!;
 const b=battery.technical_required_evidence.find(x=>x.field_key==="voltage")!;
 expect(b.canonical_value).toBe(3);
 expect(b.unit).toBe("battery_cells");
 for(const [key,value] of [["minVoltage",3],["maxVoltage",6]] as const) {
   const cell=esc.technical_required_evidence.find(x=>x.field_key===key)!;
   expect(cell.unit).toBe("battery_cells");
   expect(cell.canonical_value).toBe(value);
 }
});
test("no old 6S CNHL or ordinary Nano receiver was conflated",()=>{
 const cn=packets.products.find(x=>x.category==="battery")!;
 expect(cn.manufacturer_sku).toBe("1301303BK");
 expect(cn.package_quantity).toBe(1);
 const rx=packets.products.find(x=>x.category==="receiver")!;
 expect(rx.exact_model).toContain("SE");
 const p=packets.products.find(x=>x.category==="propellers")!;
 expect(p.manufacturer_sku).toBe("EthixP2-PK-PC");
 expect(p.gtin).not.toBe(p.manufacturer_sku);
 expect(p.package_quantity).toBe(4);
});
