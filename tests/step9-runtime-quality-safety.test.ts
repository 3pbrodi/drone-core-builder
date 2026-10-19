import {test,expect} from "bun:test";

test("Automated image refresher rejects apply without written reuse rights",async()=>{
 const s=await Bun.file("supabase/functions/catalogue-image-refresh/index.ts").text();
 const block=s.indexOf('if (mode === "apply")');
 expect(block).toBeGreaterThan(0);
 const guard=s.slice(block,block+550);
 expect(guard).toContain("409");
 expect(guard).toContain("license");
 expect(guard).toContain("applied: 0");
 expect(s).toContain("const applied = 0;");
 expect(s).not.toContain("method: \"PATCH\"");
 expect(s).not.toContain("primary_image: true");
});
test("The proposed runtime SQL only selects written-license images and checked fresh offers",async()=>{
 const sql=await Bun.file("supabase/migrations/20261019230000_catalogue_runtime_licensed_images_and_fresh_offers.sql").text();
 expect(sql).toContain("i.license_name");
 expect(sql).toContain("i.license_url");
 expect(sql).toContain("last_checked_at");
 expect(sql).toContain("interval '24 hours'");
 expect(sql).toContain("security_invoker=true");
 expect(sql).toContain("insert into public.catalogue_public_runtime_products");
 expect(sql).toContain("DO NOT DEPLOY WITHOUT OWNER APPROVAL");
});
test("All 24 existing photographed products require a documented license before continued photo reuse",async()=>{
 const doc=await Bun.file("qa/step9-production-data-quality-audit.json").text();
 const audit=JSON.parse(doc);
 expect(audit.total_verified_image_rows).toBe(24);
 expect(audit.verified_images_without_license_record).toBe(24);
 expect(audit.license_safety_action).toBe("hold photos / use neutral icon pending documented rights");
 expect(audit.production_changes_authorized).toBe(false);
 expect(audit.offers_stale_gt_7_days).toBe(1);
});
