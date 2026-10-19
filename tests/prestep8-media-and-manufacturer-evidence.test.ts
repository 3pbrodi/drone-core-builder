import {test,expect} from "bun:test";
import manufacturer from "../qa/prestep8-manufacturer-source-verification.json";
import media from "../qa/prestep8-media-rights-register.json";
import candidates from "../qa/step8-four-canonical-review-packets.json";

test("Four exact product reviews stay pending and require separate human sign-off",()=>{
 expect(manufacturer.total_products).toBe(4);
 expect(manufacturer.source_claims_total).toBe(13);
 expect(manufacturer.public_release_permission).toBe(false);
 expect(manufacturer.human_manufacturer_review_completed).toBe(false);
 const byId=new Map(candidates.products.map(x=>[x.qa_id,x]));
 expect(new Set(manufacturer.products.map(x=>x.qa_id)).size).toBe(4);
 let claimCount=0;
 for(const p of manufacturer.products){
   expect(p.approve_identity).toBe(false);
   expect(p.human_reviewer).toBeNull();
   expect(p.offer_verified).toBe(false);
   const original=byId.get(p.qa_id);
   expect(original).toBeDefined();
   expect(original!.exact_variant_review.approved).toBe(false);
   for(const c of p.required_fields){
      const raw=original!.technical_required_evidence.find(f=>f.field_key===c.field_key)!;
      expect(raw).toBeDefined();
      expect(c.canonical_value).toEqual(raw.canonical_value);
      expect(c.unit).toEqual(raw.unit);
      expect(c.source_url.startsWith("https://")).toBe(true);
      expect(c.short_evidence_reference.length).toBeGreaterThan(5);
      expect(c.source_status).toContain("pending_");
      expect(c.reviewer_approved).toBe(false);
      expect(c.reviewer).toBeNull();
      expect(c.reviewed_at).toBeNull();
      claimCount++;
   }
 }
 expect(claimCount).toBe(13);
});
test("Safety against mixing 3S and 6S, normal and SE, four-pack vs two-pack",()=>{
 const batteries=manufacturer.products.find(x=>x.category==="battery")!;
 expect(batteries.identity_claim).toContain("1301303BK");
 expect(batteries.variant_exclusions.join(" ")).toContain("6S");
 expect(batteries.required_fields.find(x=>x.field_key==="voltage")!.canonical_value).toBe(3);
 const props=manufacturer.products.find(x=>x.category==="propellers")!;
 expect(props.identity_claim).toContain("2CW + 2CCW");
 expect(props.variant_exclusions.join(" ")).toContain("2-piece");
 const receiver=manufacturer.products.find(x=>x.category==="receiver")!;
 expect(receiver.identity_claim).toContain("(SE)");
 expect(receiver.variant_exclusions.join(" ")).toContain("standard");
 const esc=manufacturer.products.find(x=>x.category==="esc")!;
 expect(esc.required_fields.find(x=>x.field_key==="minVoltage")!.canonical_value).toBe(3);
 expect(esc.required_fields.find(x=>x.field_key==="maxVoltage")!.canonical_value).toBe(6);
 expect(esc.required_fields.find(x=>x.field_key==="escInput")!.source_status).toContain("pending_new_reviewer");
});
test("Unlicensed external photos are never imported, hotlinked or considered verified",()=>{
 expect(media.photo_reuse_authorized_count).toBe(0);
 expect(media.products).toHaveLength(4);
 expect(media.neutral_icon_mode.proposed).toBe(true);
 expect(media.neutral_icon_mode.user_policy_approved).toBe(false);
 expect(media.neutral_icon_mode.new_vendor_photos_fetched).toBe(0);
 expect(media.neutral_icon_mode.new_vendor_photos_redistributed).toBe(0);
 expect(media.neutral_icon_mode.license_source).toBe("https://lucide.dev/license");
 for(const p of media.products){
    expect(p.allow_unlicensed_third_party_image).toBe(false);
    expect(p.image_url).toBeNull();
    expect(p.source_image_url).toBeNull();
    expect(p.license_url).toBeNull();
    expect(p.media_policy_approved).toBe(false);
    expect(p.can_publish_photo).toBe(false);
 }
 expect(media.products.map(x=>x.qa_id).sort()).toEqual(
   manufacturer.products.map(x=>x.qa_id).sort()
 );
});
test("Existing thumbnail has no-image fallback without external image or new dependency",async()=>{
 const src=await Bun.file("src/components/BuildInterface.tsx").text();
 expect(src).toContain("function ProductThumbnail");
 expect(src).toContain("ImageOff");
 expect(src).toContain("{image && !failed ? (");
 expect(src).toContain("onError={() => setFailed(true)}");
});
test("The source register does not falsely grant media reuse",()=>{
 expect(media.rights_sources.length).toBeGreaterThanOrEqual(4);
 for(const s of media.rights_sources) {
   expect(s.source.startsWith("https://")).toBe(true);
   expect(s.reuse_permission).toBe("not_granted");
 }
 expect(media.neutral_icon_mode.license_notice_requirement).toContain("ISC");
});
