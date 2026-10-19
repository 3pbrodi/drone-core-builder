# DroneCores – Step 7: release preparation (NOT a Production promotion)

**Prepared on 2026-10-19. Owner sign-off absent, release not permitted.**
Repo: `3pbrodi/drone-core-builder` · Production project: `rtwreynffguvqdcogahx` · PR base: `qa/step6-disposable-release-20261017`.

## Intent and non-negotiable release contract

We aim for a **real, source-verifiable drone-parts database powering the frontend**, not a catalogue of plausible but unsubstantiated specifications, copied photos or stale prices. The full route is:

**Manufacturer identity + exact variant + unit-aware specifications → pending source evidence → independent reviewer verification → matching EU merchant offer (price, region, stock, timestamp and pack size) → media rights or approved neutral icon → explicit owner publication authorization → fail-closed SQL gate → public runtime and configurator smoke test.**

A research-only candidate does not become a selectable part. A product may be genuinely sold by a manufacturer and *still* not meet our public data quality bar. Cached search engines and static snapshots are leads, not supply-chain truth.

## Verified read-only baseline

On 2026-10-19 a read-only Production query returned **25 catalogue products, 24 selectable, 25 offers, 40 existing imported rows and 24 public runtime products**. There are **zero of the four Step-6 QA IDs in Production**. The existing published CNHL 1300 6S and plain TBS Nano RX are *not* the targeted 3S and SE variants.

We must not overwrite the existing 25 offers, 24 visible products, their images or freshness dates. A change in these after release must be intentional and reviewed.

## The four Step-7 candidates

| Manufacturer and exact variant | Category | Manufacturer field evidence | Known EU offer | Status |
| --- | --- | --- | --- | --- |
| CNHL Black Series V2 1300mAh 3S 130C XT60, **one battery**, stock number `1301303BK` | battery | 3 cells, 1300mAh, XT60; must not merge with already published **6S** | Rotorama, research lead previously EUR 14.39; Oct-17 direct probe found exact product but could not reliably parse price or stock | **HOLD** |
| HQProp ETHIX P2 Pickle, 5.1×2.9×3, **2CW+2CCW (four props)**, manufacturer part `EthixP2-PK-PC`, GTIN `9313448340470` | propellers | Diameter 5.1in, 2.9in pitch; GTIN is **not** manufacturer part number | RCTech, Oct-17 direct EUR 2.99, stock indeterminate; Rotorama listed out-of-stock in earlier research | **HOLD** |
| TBS Crossfire Nano RX **SE**, Immortal-T V2 antenna bundle; merchant code `TBS_CROSS_NANO_SE` | receiver | 868–915MHz, 3.3–8.4V, Crossfire/CRSF; **not** standard Nano RX | RCTech, Oct-17 direct EUR 29.90 / in-stock snapshot (needs new check and independent review) | **HOLD** |
| TBS Lucid **6S** 60A 4-in-1 ESC, not 8S and not FC stack; merchant code `TBS_LUCID_ESC` | esc | 3–6 **cells**, 60A; 8-pin JST-SH 1.0mm FC connection documented in manufacturer manual | RCTech, Oct-17 direct EUR 59.90 / in-stock snapshot; older category cache had conflicted | **HOLD** |

Technical field semantic correction: `voltage`, `minVoltage` and `maxVoltage` in the **current canonical catalogue schema mean cell counts** (3, 3, 6 for the two relevant products); 11.1 and 22.2 are **nominal volts only for display**. See `qa/step6-field-semantics-correction.json`. No fabricated supply voltage is inserted into a canonical numeric cell-count field.

## Newly prepared SQL release gate (migration PROPOSAL, NOT deployed)

Migration `supabase/migrations/20261019190000_catalogue_step7_release_approval_gate.sql` does **not** run on the hosted Production project until explicitly approved later. The additive table `catalogue_release_reviews` is RLS-protected, lacks policies for `anon`/`authenticated`, and grants the existing privileged service role access only. A record requires: human-reviewed model identity/variant/pack, reviewed media mode (legally documented model photo OR explicitly approved existing neutral `ImageOff` icon), a separately reviewed **specific** merchant offer row, current verified EU/EUR **positive price and in-stock** (within 24 hours and with exact pack approval), and **explicit recorded owner approval** with provenance and timestamp. Anonymous customer accounts cannot write approvals.

The existing SQL `catalogue_publication_blockers` function is amended **without removing any identity/technical/evidence requirement** to append `catalogue_step7_release_blockers`. This shared SQL path is called by both `catalogue_publish_product` and the `selectable:false→true` UPDATE trigger. Pre-existing selectable Production records remain unchanged when this migration is eventually approved; unpublished records cannot be newly made visible without the additional checks. Backed by **local-only negative tests**, including a synthetic owner/media approval that still cannot publish without an eligible exact EU offer; synthetic record is rolled back.

**Important:** An approved neutral icon policy must be a separate human decision; we have not yet received that approval. The regular frontend ProductThumbnail already falls back to `ImageOff` when `product.image` is absent. Unlicensed manufacturer/seller images are *not* downloaded into this project.

## Required sign-offs BEFORE any Production candidate insertion or publication

1. Independently verify each original manufacturer page, variant, exact pack and **all 13 category required field values**. Confirm corrected cell-count representation. Record source URL and reviewer identity; call existing `catalogue_verify_identity_evidence`, `catalogue_promote_identity`, `catalogue_verify_spec_evidence`, and `catalogue_complete_technical_review` only after the reviewer genuinely attests each item.
2. Check each merchant's exact **HTTPS product page today**, matching the manufacturer variant, merchant SKU/GTIN where available and units per package. Capture price EUR, stock `in_stock`, shipping region EU and exact UTC `last_checked_at`. Resolve conflicting cached stock by fresh direct merchant evidence; absence/failed parsing means **HOLD**. Add a verified offer only after human confirmation with existing `catalogue_add_verified_eu_offer`.
3. Approve **one** media policy: legally licensed model photo with usable written license proof, *or* no copied photo and a neutral `ImageOff` icon. Never claim seller or manufacturer imagery is free to reuse.
4. Require a specific, documented **owner authorization** for a named product/variant before inserting any `catalogue_release_reviews.owner_approved=true`. Do not infer consent from this "prepare Step 7" request.
5. Re-run fresh disposable migrations/fixtures and negative SQL gate tests; then a preview acceptance test against the actual frontend Runtime Catalogue, ideally in a disposable preview environment with the intended product and offer.
6. **Only after explicit owner instructions**: on Production create the real product candidate (never overwrite plain TBS Nano or CNHL 6S), attach reviewed source evidence, promote and add exact offer(s), insert documented approvals, run `catalogue_publication_blockers` (must be empty), and publish only named passing candidates. No direct toggling of `selectable` in place of review.
7. Verify expected runtime visibility, category, image fallback, displayed merchant/currency/stock, compatibility constraints and changes against baseline **24 selectable / 25 offers**. If wrong, use the audited `catalogue_unpublish_product` path and investigate; do not delete historical evidence.

## Scaling the whole catalogue

After the first two fully accepted products, process the remaining 26-item shortlist by component category. Return to the 171 original manufacturer-source leads with the updated access/quality gates. Structural `validated` is only a parsing status, never owner approval. Store every manufacturer/source URL, normalized specs with meaningful unit semantics, review timestamp, merchant SKU, EU price/stock, verification confidence and model-photo license.

Recommended eventual architecture: **canonical product** (stable identity and specs) 1→N **EU merchant offers** (time-varying price/stock), with separate **exact-model evidence** and **review event history**. The public configurator reads only canonical/selectable products with appropriately verified offers, and the nightly merchant-refresh worker updates offers without overwriting stable manufacturer facts. Existing no-image fallback permits lawfully blank media after a documented policy approval.

## Proofs and status

Previous [Step 6 all-green disposable run](https://github.com/3pbrodi/drone-core-builder/actions/runs/39032855460). New [Step 7 isolated gated run](https://github.com/3pbrodi/drone-core-builder/actions/runs/39299600571), with both release table and promotion function in the 24th **disposable** migration. Download the attached machine-readable audit from the successful run's GitHub Actions artifacts.

**Readiness decision:** `PREPARED_FOR_FINAL_REVIEW`; `NOT_READY_FOR_PRODUCTION_PUBLICATION`. No merged `main`, no production schema writes, no live deployment, no created Production QA candidates and no license assumptions.
