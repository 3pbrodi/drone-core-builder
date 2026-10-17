import { test, expect } from "bun:test";
import { checkStep6Release, type Step6Review } from "../src/lib/catalogue-step6-release-gate";
import evidence from "../qa/step5-four-products-source-evidence.json";

const now = new Date("2026-10-17T12:00:00Z");
function good(): Step6Review {
  return {
    id: "test-only-not-real",
    identityVerifiedByHuman: true,
    mandatorySpecsVerifiedByHuman: true,
    variantAndPackVerified: true,
    offer: {
      url:"https://www.example-merchant.eu/exact-product",
      currency:"EUR", price:19.95, stock:"in_stock",
      checkedAt:"2026-10-17T11:30:00Z", directExactPage:true,
      exactModelVariantAndPack:true, reviewApproved:true, conflicts:false,
    },
    media: { mode:"neutral_icon", licenseEvidenceUrl:null,
      licenseReviewed:false, neutralIconApproved:true },
    ownerApprovedPublication:true,
  };
}

test("all four actual step5 candidates remain blocked; no accidental approval", () => {
  for(const item of evidence.candidates) {
    const r:Step6Review={
      id:item.candidate_id,
      identityVerifiedByHuman:false,
      mandatorySpecsVerifiedByHuman:false,
      variantAndPackVerified:false,
      offer: {
        url:item.offers[0].url, currency:"EUR",
        price:item.offers[0].last_indexed_price,
        stock:item.offers[0].stock_from_search==="in_stock"?"in_stock":"unknown",
        checkedAt:null, directExactPage:false,
        exactModelVariantAndPack:false, reviewApproved:false,
        conflicts:item.offers[0].stock_from_search==="conflicting",
      },
      media:{mode:"neutral_icon",licenseEvidenceUrl:null,licenseReviewed:false,neutralIconApproved:false},
      ownerApprovedPublication:false,
    };
    const blockers=checkStep6Release(r,now);
    expect(blockers).toContain("identity_not_approved");
    expect(blockers).toContain("offer_not_fresh");
    expect(blockers).toContain("offer_not_exact_verified");
    expect(blockers).toContain("neutral_icon_policy_not_approved");
    expect(blockers).toContain("owner_approval_missing");
  }
});

test("even verified technical data cannot make an old offer publishable", () => {
  const r=good();r.offer!.checkedAt="2026-10-15T11:30:00Z";
  expect(checkStep6Release(r,now)).toContain("offer_not_fresh");
});

test("out of stock / contradictory offer is denied", () => {
  const r=good();r.offer!.stock="out_of_stock";r.offer!.conflicts=true;
  expect(checkStep6Release(r,now)).toEqual(expect.arrayContaining(
    ["no_confirmed_stock","conflicting_offer_evidence"]
  ));
});

test("reject stale, future, untrustworthy or non-EUR offer evidence", () => {
  const r=good();r.offer!.checkedAt="2026-10-18T00:00:00Z";
  r.offer!.currency="USD";r.offer!.directExactPage=false;
  expect(checkStep6Release(r,now)).toEqual(expect.arrayContaining(
    ["invalid_eur_price","offer_not_fresh","offer_not_exact_verified"]
  ));
});

test("refuse external product image without approved license URL", () => {
  const r=good();r.media.mode="licensed_image";r.media.neutralIconApproved=false;
  expect(checkStep6Release(r,now)).toContain("image_rights_not_verified");
});

test("neutral ImageOff icon route can be approved without vendor photo", () => {
  const r=good();
  expect(checkStep6Release(r,now)).toEqual([]);
  r.media.neutralIconApproved=false;
  expect(checkStep6Release(r,now)).toContain("neutral_icon_policy_not_approved");
});

test("owner approval always mandatory even if all other gates pass", () => {
  const r=good();r.ownerApprovedPublication=false;
  expect(checkStep6Release(r,now)).toEqual(["owner_approval_missing"]);
});
