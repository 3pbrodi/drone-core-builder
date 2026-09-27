# DroneCores Catalogue Phase A — Canonical Product Data Review

Reviewed: 2026-09-28

This document records the Phase A quality review for the current static catalogue. It does not turn demo data into verified production data. Stable product IDs remain unchanged so Custom Build, AI Build, Templates, and saved references can continue to resolve the same selections.

## Review rules

- Manufacturer documentation is preferred for technical specifications.
- Retailer data may support offer/availability or identity when manufacturer material is unavailable, but it is not automatically treated as engineering evidence.
- A product can have a verified identity while individual technical fields remain unverified.
- Conflicting values are retained for review rather than silently corrected.
- Existing prices remain illustrative demo values unless a real merchant offer is separately captured.
- Compatibility checks must not treat this review as a flight-safety certification.

The machine-readable companion is `src/lib/catalogue-quality.ts`.

## Catalogue summary

| ID | Category | Current identity | Identity status | Technical status | Product kind | Image | Price | Human review |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `frame5` | Frame | iFlight Nazgul Evoque F5 V2 | Verified | Partially verified | Standalone | Missing | Illustrative | Yes |
| `frame7` | Frame | Explorer 7 | Unverified demo | Unverified | Unknown | Missing | Illustrative | Yes |
| `frame3` | Frame | Cinewhoop 3-inch Frame | Unverified demo | Unverified | Unknown | Missing | Illustrative | Yes |
| `motors5` | Motors | T-Motor F60 PRO V family | **Conflicting variant** | **Conflicting** | Standalone | Partially verified | Illustrative | Yes |
| `motors7` | Motors | Long-Range 2806.5 1300KV Motor | Unverified demo | Unverified | Unknown | Missing | Illustrative | Yes |
| `motors3` | Motors | 1404 Cine Motor | Unverified demo | Unverified | Unknown | Missing | Illustrative | Yes |
| `fcF7` | Flight Controller | iFlight BLITZ F7 family | Partially verified | **Conflicting description** | Standalone FC in build model | Missing | Illustrative | Yes |
| `fcF4` | Flight Controller | Compact F4 Controller | Unverified demo | Unverified | Unknown | Missing | Illustrative | Yes |
| `esc55` | ESC | T-Motor F55A Pro II | Verified | **Conflicting minimum voltage** | Standalone | Verified exact-model image | Illustrative | Yes |
| `esc20` | ESC | BLHeli_S 20A ESC | Unverified demo | Unverified | Unknown | Missing | Illustrative | Yes |
| `props5` | Propellers | HQProp T3.5x3.0x3 | **Conflicting** | **Conflicting** | Standalone | Missing | Illustrative | Yes |
| `props7` | Propellers | 7x3.5 Tri-Blade | Unverified demo | Unverified | Unknown | Missing | Illustrative | Yes |
| `props3` | Propellers | Gemfan D76 5-Blade | Unverified exact match | Unverified | Standalone | Missing | Illustrative | Yes |
| `battery6` | Battery | CNHL Black Series 1500mAh 6S | **Conflicting rating** | **Conflicting** | Standalone | Missing | Illustrative | Yes |
| `battery6long` | Battery | Li-ion 6S 4000mAh Pack | Unverified demo | Unverified | Unknown | Missing | Illustrative | Yes |
| `battery4` | Battery | 4S 850mAh 100C LiPo | Unverified demo | Unverified | Unknown | Missing | Illustrative | Yes |
| `cameraFpv` | Camera | RunCam Phoenix 2 | Verified | Partially verified | Standalone | Verified exact-model image | Illustrative | No |
| `camera4k` | Camera | Action Camera 4K Module | Unverified demo | Unverified | Unknown | Missing | Illustrative | Yes |
| `receiver` | Receiver | TBS Crossfire Nano RX | Verified | Partially verified | Standalone | Verified exact-model image | Illustrative | No |
| `receiver2` | Receiver | Demo ELRS Receiver 2.4GHz | Unverified demo | Unverified | Unknown | Missing | Illustrative | Yes |

## Source-backed findings

### `frame5` — iFlight Nazgul Evoque F5 V2

Manufacturer source:
- https://shop.iflight.com/Evoque-F5-V2-Frame-Kit-Pro1887

The manufacturer page confirms the Evoque F5 V2 Frame Kit and lists:
- 16x16 mm motor mounting;
- 20x20 mm flight-stack mounting;
- separate F5X and F5D geometry;
- published geometry-dependent weight ranges.

The static `mount: "16x16"` is source-backed. The record does not identify F5X versus F5D, so physical dimensions and an exact weight should remain only partially verified.

### `motors5` — T-Motor F60 PRO V

Manufacturer source:
- https://store.tmotor.com/product/f60prov-fpv-motor.html

The manufacturer page lists distinct 1750KV, 1950KV, 2020KV, and 2550KV variants. The static record name includes “2020” while its spec says “1950 KV”. Those are different manufacturer variants.

The manufacturer also publishes different peak-current and weight values for the 1950KV and 2020KV versions. The current static `current: 38` does not match the accessible manufacturer peak-current value for either variant.

**Action:** do not pick a KV variant by inference. Preserve `motors5` and keep it conflicting/unverified until the intended variant is explicitly resolved.

### `fcF7` — iFlight BLITZ F7

Manufacturer sources:
- https://shop.iflight.com/product-cat123/BLITZ-F7-Flight-Controller-Pro1692?limit=15
- https://shop.iflight.com/BLITZ-F7-Stack-E55-4-IN-1-ESC-Pro1695

iFlight documents a standalone **BLITZ F7 V1.2 Flight Controller** and separately sells a **BLITZ F7 Stack** bundle containing the FC plus an E55 4-in-1 ESC.

The static catalogue places `fcF7` in the Flight Controller category and all builds select a separate ESC, so the current build architecture treats `fcF7` as a standalone FC. Its static spec text nevertheless says “Flight Controller + ESC Stack”.

**Action:** preserve the stable ID and Flight Controller category. Do not canonicalize the exact revision or technical connector/voltage fields until the intended standalone revision is confirmed.

### `esc55` — T-Motor F55A Pro II

Manufacturer source:
- https://store.tmotor.com/product/f55a-pro-v2-4in1-fpv-esc.html

The manufacturer source confirms:
- F55A Pro II identity;
- 4-in-1 ESC;
- 55 A rating;
- 3-6S support.

The current `escAmps: 55` and `maxVoltage: 6` agree with the manufacturer source. The static record stores `minVoltage: 4`, while the manufacturer source supports 3S, so the minimum-voltage field remains conflicting and is not treated as verified. The static `escInput: "8pin"` and weight used by the demo record were not established from the accessible source text in this review and remain unverified.

### `props5` — HQProp identity conflict

Manufacturer catalogue source:
- https://www.hqprop.com/c/35quot-0402

The static name is `HQProp T3.5x3.0x3`, which implies a 3.5-inch propeller, while the typed field is `propInches: 5`.

The accessible HQProp 3.5-inch catalogue contains T3.5 variants such as T3.5X3.5X3, T3.5X2.5X3, T3.5X2.2 and T3.5X2X3, but did not establish an exact T3.5X3.0X3 product in this review.

**Action:** do not change `propInches` to either 3.5 or 5 by inference. Preserve the stable demo record and keep it conflicting until the exact product is established.

### `battery6` — CNHL Black Series rating conflict

Manufacturer source:
- https://chinahobbyline.com/de/collections/cnhl-black-series-lipo-batteries/products/2-packs-cnhl-black-series-v2-0-1500mah-22-2v-6s-130c-lipo-battery-with-xt60-plug

The accessible current manufacturer product is **CNHL Black Series V2.0 1500mAh 6S 130C**, with 130C continuous / 260C burst and XT60.

The static record says **Black Series 1500mAh 6S 150C**. CNHL has other 1500mAh/6S products at 150C, but that does not prove the static Black Series record is one of them.

**Action:** keep the existing stable ID and demo values unchanged until the exact intended revision is resolved.

### `cameraFpv` — RunCam Phoenix 2

Manufacturer source:
- https://shop.runcam.com/runcam-phoenix-2/

The source confirms the exact RunCam Phoenix 2 identity, analog PAL/NTSC video, 5-36V power, 9 g weight, and 19 mm-class dimensions.

The existing image source is manufacturer-backed and is retained as an exact-model image. The current live product model cannot yet represent the camera's voltage range, dimensions, or interface details.

### `receiver` — TBS Crossfire Nano RX

Manufacturer source:
- https://www.team-blacksheep.com/products/prod:crossfire_nano_rx

The source confirms:
- exact TBS Crossfire Nano RX identity;
- CRSF signal format;
- 868-915 MHz range;
- 3.3-8.4V input;
- 0.5 g weight.

The static spec text mentions only 915 MHz, which is incomplete for the manufacturer-documented range. The current live product type has no typed receiver protocol/frequency/voltage fields, so these values remain source-backed review data rather than new compatibility inputs.

## Products remaining intentionally unverified

The following records are still generic demo identities or lacked an exact manufacturer match in this review:

- `frame7`
- `frame3`
- `motors7`
- `motors3`
- `fcF4`
- `esc20`
- `props7`
- `props3`
- `battery6long`
- `battery4`
- `camera4k`
- `receiver2`

They must remain available so existing builds do not break, but they must not be promoted to verified catalogue records without source-backed identity and technical data.

## Price and offer status

Every current static price remains **illustrative**.

Phase A does not create merchant offers from those numbers. Real EU offers must later retain:
- merchant identity;
- actual EUR currency or explicit source currency;
- EU region/market;
- source URL;
- stock status;
- checked timestamp;
- offer verification status.

No exchange rate, tax, shipping cost, or stock status should be invented.

## Image status

Exact-model manufacturer-backed images already present in the live catalogue:
- `cameraFpv` — RunCam Phoenix 2
- `receiver` — TBS Crossfire Nano RX

The `esc55` source points to the exact manufacturer product; its current image URL is a retailer-hosted photo, so the identity can be verified while image licensing/rehosting rights still remain separate.

The `motors5` image belongs to the F60 PRO V family, but the exact KV variant is unresolved, so it is not treated as exact-variant verification.

No missing image has been replaced or generated.

## Template wording cleanup

Templates use demo prices and illustrative performance metrics. They should therefore be described as illustrative starting points rather than “proven parts lists”.

Phase A only changes wording; it does not change template IDs, selections, prices, recommendations, or calculations.

## Exit criteria for Phase A

Phase A is considered complete when:

- all current stable products have a structured review record;
- every review distinguishes identity confidence from technical-field confidence;
- known conflicts are recorded without guessing a replacement value;
- existing build IDs remain intact;
- illustrative prices remain clearly non-market data;
- template wording no longer claims that demo combinations are proven;
- automated tests ensure every static product has exactly one quality-review record.

The next data-model phase should persist field-level evidence rather than treating product-level verification as sufficient.
