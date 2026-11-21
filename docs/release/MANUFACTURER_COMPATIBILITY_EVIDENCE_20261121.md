# Manufacturer compatibility evidence: research follow-up, 2026-11-21

Baseline branch `feature/shared-drone-configurator`, audit commit `94f43e85a38005c321dd107dc984d15ff379fe00`. This completes the documentary follow-up within the defined research scope; it does not certify every assembled combination or installed firmware. Source facts are available for controlled review/integration. No production, staging, device flash or application runtime change was made.

## Result and scope

-89 requested source records:84 successful captures and5 unavailable requested URLs/paths. Incorrect ELRS/RP1/XR2 URLs were resolved through official links; the failed SpeedyBee AIO target spelling was resolved to the correct project-specific target. A requested Borg H7 upstream path remained unavailable; this is not proof of global lack of support.
-125 structured claims:104 source-supported,21 conditional. Source research concerns43 targeted products. All15 frame families and13 FC models were inspected; direct wiring/firmware research focused on documented stacks and relevant receiver/motor/propeller families. The133-row matrix identifies the other products as existing-evidence-only; no false claim of exhaustive research of every Cartesian pairing is made.
-7 pairing dossiers:5 exact SpeedyBee wiring pairs,1 GEPRC named stack pending pin trace,1 exact manufacturer motor/propeller configuration. Five wiring dossiers include4 additional pairs and one rechecked existing pair.
-6 scoped mechanical assessments and4 bench datasets. Every assembled-fit status remains conditional/not established.

Artifacts:

- `qa/manufacturer-compatibility-dossier-20261121.json`: original source URLs, actual retrieval times, SHA256 fingerprints, pinned upstream revisions, facts, conditions, contradictions and exact catalogue IDs.
- `qa/manufacturer-compatibility-coverage-20261121.csv`: all133 saved portfolio identities, coverage and remaining requirements.
- `qa/manufacturer-compatibility-pending-evidence-20261121.csv`:104 source-supported rows in the existing importer format, always pending native review. Conditional claims are excluded.
- `qa/manufacturer-compatibility-validation-20261121.json`: reproducible read-only verification receipt.

The catalogue basis is the previously saved133-product public snapshot, not a fresh production census. Source content was retrieved during this task. Raw manufacturer manuals, technical test charts and page captures are retained under `.private-backups/manufacturer-compatibility-20261121/`; they are not copied into product media or committed as full copyrighted documents. Technical charts were reviewed as evidence, not integrated as product images.

## Exact pairing evidence

| Named parts | Documentary result | Limits |
| --- | --- | --- |
| F405 Mini + BLS35A Mini V2 | [Manufacturer manual](https://store-fhxxhuiq8q.mybigcommerce.com/product_images/img_SpeedyBee_F405_Mini_BLS_35A/SpeedyBee-f405-mini-stack-Manual-en.pdf), PDF p5: supplied SH1.0 eight-pin wiring diagram, signal names/order,3–6S and DShot300/600. | Matching hardware and supplied harness only; no arbitrary cable or as-flashed firmware approval. |
| F405 V3 + BLS50A | [Manufacturer manual](https://store-fhxxhuiq8q.mybigcommerce.com/product_images/img_SpeedyBee_F405_V3_Stack/SpeedyBee_f405_v3_stack_manual_en.pdf), p5: exact connector and direct-solder wiring. | Do not substitute V4/60A or a different harness simply because connectors look alike. |
| F405 V4 + BLS55A | [Manufacturer manual](https://store-fhxxhuiq8q.mybigcommerce.com/product_images/img_SpeedyBee_F405_V4_Stack/SpeedyBee_F405_V4_Stack_Manual_EN.pdf), p5: exact named stack rechecked. | This pair already existed in the saved runtime evidence; it is not counted as an additional new pair. |
| F405 V4 + BLS60A | [Manufacturer manual](https://store-fhxxhuiq8q.mybigcommerce.com/product_images/img_SpeedyBee_F405_V4_60A_Stack/manual/speedybee_f405v460a_stack_manual_en.pdf), p4: exact supplied-harness connection. | Different ESC revision/rating from the55A assembly. |
| F7 V3 + BL32 50A | [Manufacturer manual](https://store-fhxxhuiq8q.mybigcommerce.com/product_images/img_SpeedyBee_F7V3_Stack/SpeedyBee_F7V3_Stack_Manual_EN.pdf), p5: exact wiring/telemetry and connector diagram. | Wiring evidence is usable; conflicting firmware-layout text remains a separate hold. |
| GEP-F405-HD V3 + TAKER H60_BLS60A | [GEPRC named V2 stack](https://geprc.com/product/geprc-taker-f405-bls-60a-v2-stack/) explicitly names the components,3–6S and control protocols. | Additional full orientation/pin/cable trace review is needed before a native direct-wiring verdict. Stack branding alone does not set those flags. |
| XING2 2207 **1750KV** + NazgulF5 | [Manufacturer6S WTFPV BOM](https://shop.iflight.com/iflight-quads-cat25/freestyle-quads-cat29/Evoque-F5-V3-6S-WTFPV-Pro2401) names both; the [official prop page](https://iflight-rc.eu/products/nazgul-f5-tri-blade-prop) identifies NP10226. |6S manufacturer configuration only; not1855KV, generic5140 or an independent continuous-current rating. |

All native candidate records remain `pending_review` with no verified timestamp. A pure local rehearsal temporarily supplies reviewed status only in memory to test resolver behavior; it does not create an approval or change a stored product. Pending records are rejected by the actual resolver, and reviewed test records cannot be reused for different IDs or battery conditions.

## Mechanical findings

The [EvoqueF5V3 frame page](https://shop.iflight.com/Nazgul-Evoque-F5-V3-Frame-Kit-Pro2407) distinguishes motor mounting16mm from FC mounting20mm and gives a25mm stack-height limit. A30.5mm FC/ESC stack is therefore not documented as a direct fit on that named frame. The Mini tower's nominal20mm mounting and14.2mm height satisfy those two numerical constraints, but frame revision/SKU mapping, grommets, PCB footprint, wiring and screw engagement remain open.

The [Bee35 page](https://www.speedybee.com/speedybee-bee35-3-5-inch-frame/) lists several mounting pitches but explicitly recommends compact20mm towers/AIOs and discourages30.5mm towers because space is tight. Its19/20mm camera mounting and24mm equipment height are useful constraints, not blanket clearance approvals. Standard/Pro variants must remain separate.

Other primary-source frame findings are recorded by exact source ID in the dossier: Chimera7 ECO max21mm; EvoqueF6V2 max22mm and20mm FC pattern; EvoqueF7 max25mm with20/30.5mm options; Defender20Lite max9mm and25.5mm mounting. The14.2mm Mini stack is not a documented direct fit in the9mm Defender space. A7mm AIO still needs its36.5mm board envelope, hardware and wire clearance checked.

BETAFPV sources specify26mm FC mounting for Aquila20/Meteor65ProII/Meteor75ProII. Preserve26 literally; do not silently convert it to25.5 or infer incompatible/compatible grommet fit from pitch alone. Meteor battery-slot cross-section16.1×6.3mm is not complete battery retention/connector evidence.

Conditional cases remain explicit: AOS HS5 feature/spec text uses30.5 vs30mm; Chimera7 Pro V2's FC text uses30mm; Bee25 New Pro shares a generic table with older options; current maker metadata uses warehouse SKU aliases different from some saved identifiers. These require a dimensioned revision drawing or exact alias confirmation before promotion.

Exact HQ V1S/V2S pages distinguish hub dimensions despite equal nominal diameter/pitch: V1S hub13.2mm diameter/7mm thick, V2S12.8mm/6.5mm; both specify5mm bore. The XING1855 source drawing gives5mm shaft and13.5mm protrusion, but these numbers alone do not prove threaded engagement, nut retention or safe screw penetration.

**Complete mechanical fit still requires:** frame cavity/envelope and swept lens/prop clearance; hole/grommet/fastener tolerances; motor screw penetration/thread limits; wire/bend/USB access; battery dimensions, retention and connector; and exact adapter/assembly configuration. These are partner- and hardware-specific facts, not inferred from a nominal frame size.

## Firmware evidence

Official Betaflight definitions were pinned to commit `b7a0d26858c841484d2dace3499a7b5ffca00fc9`; raw-file SHA256 and Git blob SHA1 are retained. Definition existence proves a documented target, not that a firmware image has been built/flashed/tested on a particular unit.

| Catalogue controller | Documented target / outcome |
| --- | --- |
| SpeedyBee F405 Mini | SPEEDYBEEF405MINI, manufacturer and pinned upstream agree. |
| SpeedyBee F405 V3 | SPEEDYBEEF405V3, agree. |
| SpeedyBee F405 V4 | SPEEDYBEEF405V4, agree. |
| SpeedyBee F7 V3 | SPEEDYBEEF7V3, agree. |
| GEP-F405-HD V3 | GEPRCF405, agree. |
| SpeedyBee F745 AIO | Maker prints a spaced target label; upstream Betaflight uses **SPEEDYBEE_F745_AIO**. Do not strip spaces and select the INAV-style spelling automatically. Hardware/project mapping remains conditional. |
| BLITZ F745 / Mini F745 | Manufacturer uses IFLIGHT_BLITZ_F7_AIO; current upstream definition exists. Size/revision and ArduPilot variants must still be matched separately. |
| BLITZ H7 Pro | IFLIGHT_BLITZ_H7_PRO is documented and present upstream. |
| BLITZ F7 V1.2 | Manufacturer-qualified IFRC/IFLIGHT_BLITZ_F722 matches an upstream target; saved SKU alias needs revision reconciliation. |
| Borg H7 | IFLIGHT_BORG_H7 is maker-reported; the requested pinned upstream path was unavailable. No universal incompatibility or support conclusion follows. |
| HGLRC F4058S V2.1 | HGLRC_F405_S is visually confirmed in the branded manual and exists upstream; original-maker JSON confirms model/SKU. Mirrored manual/revision association remains conditional. |
| HGLRC H74312S | HGLRC_H743_PRO has the same source checks, with exact V1/PCB confirmation still needed. |

[Official ExpressLRS instructions](https://www.expresslrs.org/quick-start/binding/) require matching TX/RX major versions and distinguish SPI-specific constraints. [UART configuration](https://www.expresslrs.org/quick-start/receivers/configuring-fc/) must match the actual wired port and CRSF setup. Manufacturer-advertised defaults differ: RP1V2 lists2.4, RP3V2 lists3.0, RP4TD lists3.3.0 and [XR2 lists3.5.1](https://radiomasterrc.com/products/xr2-nano-2-4ghz-expresslrs-receiver). These are advertised factory states, not measurements of a user's devices. Actual band, domain, target and installed version must be read before a binding verdict.

[Official Betaflight RPM-filtering guidance](https://betaflight.com/docs/wiki/guides/current/DSHOT-RPM-Filtering) distinguishes plain DShot capability from firmware providing bidirectional telemetry. BLHeli_S/Bluejay and BLHeli32/version conditions must not be collapsed into a single yes/no label. No automatic flash/update command is prepared here.

## Motor test tables and conflicts

Three EMAX manufacturer charts were visually transcribed at their original25.2V/16.8V test conditions. They establish measured HQ5×4.3×3-family test points, including max28.8A/36.4A/34.5A for1700/1900/2400KV respectively. They do **not** name V1S or V2S and do not establish a continuous motor rating/test duration. Thus six possible winding/revision mappings remain blocked; none becomes native motor-current approval.

The XING1855 report names GF51466 at24.0V, reaching a source-labeled35.08A peak. That tested propeller is not the catalogue NazgulF5. The chart's other generic5140 label is not silently assigned to a branded SKU. Bench maxima and operating voltage are preserved without rewriting product values or calibrating the whole flight model from unrelated assemblies.

Other holds:

- SpeedyBee stack pages contain generic AIO text; variant-specific tables/manuals govern.
- Mini overview stack mass13.5g disagrees with the sum of separately listed FC/ESC masses; stack mass is held and not used to overwrite products.
- F7 BL32 narrative conflicts with J-H-50 layout text. Keep the layout/flash target unresolved until a device readout or corrected maker document is available.
- Existing separately documented HGLRC DShot600-as-connector corrections remain outside this audit's amendment scope. Refer to `qa/complete28-existing-esc-correction-plan-20261116.json`; DShot is a protocol, not physical connector proof. No production repair is claimed here.

## Controlled integration and audit closure

The research pass is documented and reproducible. The125 claims and7 dossiers are **not** a claim that all133 products or complete builds now have verified assembly compatibility. Existing catalogue release classifications are unchanged; a missing assembly relation does not delete or reclassify an otherwise approved standalone product.

The104-row CSV passes the existing syntax/unit importer and remains pending review. Most new dotted physical/firmware keys are proposed evidence keys with no typed runtime mapping today. Before activating them, map them into the existing specifications/technical-attributes and proof transport, extend the shared validators/checks and preserve these source hashes, variant constraints and conflict holds. Pair source IDs/URLs also need the scoped transport change identified in the previous audit. CSV validity is not publication or schema support.

Next concrete integration scope:4 additional native wiring pairs plus the one1750KV/NazgulF5 manufacturer6S pairing, after native review and exact revision/source reference checks; retain the existing V4/55A proof. Keep GEPRC pin trace, motor-current assertions, firmware-layout contradictions and conditional physical fits held. Test activation/revocation locally before any production request.

For remaining hardware-dependent closure, collect only relevant device metadata: PCB/revision and FC target/version, ESC hardware layout/firmware version, RX/TX target/major version/band/domain, plus assembled clearance and fastener dimensions. Manufacturer clarification is needed for the F7 layout line, ambiguous mount pitches, legacy SKU aliases and generic test-prop revisions/durations. Public research cannot read a purchased device's installed state.

Verification: the read-only verifier checks the133-row portfolio, source references and archived SHA256/Git blob hashes, importer pending gates, exact ID/cell conditions, bench power arithmetic and all conditional holds. The receipt records its actual assertion count. Typecheck passed. No application code changed, so the existing UI build/browser suite was not rerun for this documentary packet.

```sh
node --import tsx scripts/verify-manufacturer-compatibility-audit.ts
# With protected captures available:
node --import tsx scripts/verify-manufacturer-compatibility-audit.ts --archives
node_modules/.bin/tsc --noEmit
```

Rollback: revert only this documentary/script commit after preserving later work. No database reversal, product withdrawal or import replay is involved. Do not delete or rewrite earlier native receipts or source evidence.
