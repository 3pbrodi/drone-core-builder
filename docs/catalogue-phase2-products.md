# Catalogue Phase 2 — verified product expansion

Phase 2 expands the verified runtime catalogue from 16 to 24 products: three selectable products in each of the eight configurator categories.

All eight additions passed the normal evidence-first promotion workflow:

1. non-selectable candidate import
2. exact-model manufacturer identity verification
3. canonical identity promotion
4. field-level manufacturer / official-documentation evidence for every publication-required technical field
5. verified runtime weight
6. completed technical review
7. verified EU / EUR merchant offer
8. zero publication blockers
9. publication with `selectable=true`
10. successful public `catalogue-runtime` coverage check
11. successful 24/24 nightly-offer-refresh verification

Prices and stock states below are a snapshot from 2026-09-28. The nightly offer refresh is authoritative after this point.

| Category | Product | Canonical technical source | EU offer snapshot |
| --- | --- | --- | --- |
| Frame | GEPRC GEP-MK5 O4 Pro DC Frame | https://geprc.com/product/gep-mk5-o4-pro-dc-frame/ | RCTech.de — EUR 89.90 — in stock |
| Motors | iFlight XING2 2207 1750KV | https://shop.iflight.com/XING2-2207-4S-6S-FPV-Motor-Unibell-Black-for-Nazgul-Evoque-F5-pro1610 | Rotorama — EUR 25.59 — in stock |
| Flight controller | GEPRC GEP-F405-HD V3 Flight Controller | https://geprc.com/product/gep-f405-hd-v3-flight-controller/ and official GEPRC manual | FPV24 — EUR 33.90 — in stock |
| ESC | GEPRC TAKER H60_BLS 60A 4IN1 ESC | https://geprc.com/product/geprc-taker-h60_bls-60a-4in1-esc/ and official GEPRC manual | FPV24 — EUR 48.90 — out of stock |
| Propellers | HQProp 5X4.3X3V1S | https://hqprop.com/hq-durable-prop-5x43x3v1s-2cw2ccw-poly-carbonate-p0048.html | FPVGarage — EUR 2.77 — in stock |
| Battery | Tattu R-Line V5.0 1200mAh 6S 150C XT60 | https://genstattu.com/tattu-r-line-version-5-0-1200mah-6s-150c-22-2v-lipo-battery-pack-with-xt60-plug/ | Rotorama — EUR 33.89 — in stock |
| Camera | RunCam Phoenix 2 SE V2 | https://shop.runcam.com/runcam-phoenix-2-special-edition/ | Rotorama — EUR 25.89 — in stock |
| Receiver | RadioMaster RP1 V2 ExpressLRS 2.4GHz Nano Receiver LBT | https://www.radiomasterrc.com/products/rp1-expresslrs-2-4ghz-nano-receiver | Rotorama — EUR 22.49 — in stock |

## Evidence notes

- The XING2 2207 1750KV manufacturer table specifies 25.2V for the exact variant. DroneCores normalizes that value to a 6S LiPo configuration and records the normalization caveat with the evidence.
- The GEPRC flight controller and ESC catalogue connector labels are normalized to `GEPRC FC adapter harness` because official package contents/manuals document the supplied adapter harness. This field alone is not treated as proof of a universal connector pinout or wire order.
- The GEPRC flight controller's analog camera and CRSF/SBUS receiver integration values are sourced from the official GEPRC manual, not inferred from product marketing text.
- The HQProp offer is a color variant of the same DP5X4.3X3V1S-PC core model. The manufacturer remains authoritative for canonical dimensions and weight.
- Out-of-stock products remain visible and selectable. The configurator displays `Out of Stock` instead of the individual price while preserving the verified offer price internally.

## Runtime verification

After publication, the public runtime endpoint returned:

- `status=ready`
- `validation.ok=true`
- 24 total products
- 8/8 Phase 2 products present
- 3 visible/selectable products per category

The nightly offer refresh then completed with 24 targets, 24 successful checks, zero failures, and 24 applied offer updates.
