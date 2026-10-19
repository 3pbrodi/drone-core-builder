import {test,expect} from "bun:test";
import {isFreshEuroOfferTimestamp,MAX_EU_OFFER_AGE_MS} from "../supabase/functions/_shared/catalogue-offer-freshness";
const now=Date.parse("2026-10-19T20:40:00Z");
test("A real EU seller observation from 1 hour ago is valid for at most 24 hours",()=>{
 expect(isFreshEuroOfferTimestamp("2026-10-19T19:40:00Z",now)).toBe(true);
 expect(isFreshEuroOfferTimestamp("2026-10-18T20:40:00Z",now)).toBe(true);
 expect(MAX_EU_OFFER_AGE_MS).toBe(86400000);
});
test("Freshness expires at runtime even if public snapshot table never refreshes",()=>{
 expect(isFreshEuroOfferTimestamp("2026-10-18T20:39:59Z",now)).toBe(false);
 expect(isFreshEuroOfferTimestamp("2026-09-28T18:43:34Z",now)).toBe(false);
});
test("Malformed, missing, unzoned, and future checks are never an approved offer",()=>{
 for(const t of [null,undefined,"","unknown","Oct 19 2026","2026-10-19T19:30:00",now,{},[]]){
   expect(isFreshEuroOfferTimestamp(t,now)).toBe(false);
 }
 expect(isFreshEuroOfferTimestamp("2026-10-19T20:40:01Z",now)).toBe(false);
});
test("PostgREST offset timestamps including microseconds are checked",()=>{
 expect(isFreshEuroOfferTimestamp("2026-10-19T22:35:00.123456+02:00",now)).toBe(true);
 expect(isFreshEuroOfferTimestamp("2026-10-18 19:35:00.100+00:00",now)).toBe(false);
});
test("Both public catalogue code paths enforce the same timestamp and positive EUR price rule",async()=>{
 const src=await Bun.file("src/lib/catalogue-database.server.ts").text();
 const edge=await Bun.file("supabase/functions/catalogue-runtime/index.ts").text();
 for(const text of [src,edge]){
   expect(text).toContain("isFreshEuroOfferTimestamp(row.last_checked_at)");
   expect(text).toContain('row.currency !== "EUR"');
   expect(text).toContain('row.offer_region !== "EU"');
   expect(text).toContain("row.price_amount > 0");
 }
});
