import {test,expect} from "bun:test";
import audit from "../qa/step9-production-evidence-readonly-audit-20261019.json";
test("Legacy verified image flags do not prove photo reuse rights",()=>{
 expect(audit.published_products).toBe(24);
 expect(audit.public_products_with_verified_image_row).toBe(24);
 expect(audit.published_products_with_explictly_documented_license_and_rights_url).toBe(0);
 expect(audit.image_rows_with_verified_status_but_missing_license_metadata).toBe(24);
 expect(audit.key_risks.some(r=>r.code==="published_photos_unlicensed_or_undocumented")).toBe(true);
 expect(audit.production_mutated).toBe(false);
});
test("One historical offer remains stale; only individually dated offers count as refreshed",()=>{
 expect(audit.offer_rows).toBe(25);
 expect(audit.offers_checked_in_last_24h).toBe(24);
 expect(audit.public_products_with_offer_checked_within_24h).toBe(24);
 expect(audit.key_risks.some(r=>r.code==="older_secondary_offer")).toBe(true);
});
