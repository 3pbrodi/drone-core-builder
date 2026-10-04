# DroneCores Step 9B.3: 26-model source/identity verification pilot

**Scope:** QA research and isolated parser correction only. 23 rows from the completed 171-row manufacturer pilot plus three newly researched official-source parts to fill two **genuine batteries** and one missing frame. All eight component categories represented. No production imports, merges, runtime deployment, candidate promotion or offer mutations.

**Evidence/limitations:** Manufacturer pages and identified technical specifications are documented per item in the companion CSV, and the full 171-row annotated workbook/CSV remains in the owner's ChatGPT artifact. Manufacturer pages surfaced by web search may be cached, especially TBS; only a fresh per-offer EU merchant fetch plus exact variant comparison can establish live stock. No product is automatically approved. Manufacturer-image URLs do not establish license rights.

**Existing Production:** read-only exact-name comparison against all 24 published canonical products and the one pending CNHL candidate. In particular, exclude the already-published TBS Crossfire Nano RX (non-SE) and CNHL Black V2 1300mAh 6S from the new-product count. Do not mistake SpeedyBee F405 V4 FC for the separately sampled F405 AIO 40A.

## Mandatory corrected QA decisions

- Original battery category (two TBS grip pads) and single original warning-free motor (TBS ETHIX bearing) are **accessories**, not full components. Their absence is filled with additional official-source battery/motor candidates rather than pretending the original parse was good.
- Exactly eight accessory/bundle excludes documented from the 171-row archive: pilot IDs **93, 115, 129, 138, 148, 161, 163, 164**. Fixes remain in this isolated branch until end-to-end tested and reviewed.
- Seven source-ID groups are reused by distinct HQProp propeller titles, including source value `0760625794110` across five different models. Extracted numeric shop IDs/GTINs are not automatically unique manufacturer SKUs. The prior Foxeer DALPROP Q4040 g-83/g-85 source conflict also remains blocked pending SKU or color/pack proof.
- Correct an explicitly named standalone `4-in-1 ESC` falsely categorized as Flight Controller while preserving genuine integrated FC+ESC AIO products as their explicitly configured category.
- Different manufacturer/shop pack options must never be merged: SpeedyBee 1404 V2 vs V3 1-piece/4-piece, SpeedyBee Bee35 generic frame vs O4P-SE specific frame, SpeedyBee Master3X different head variants.
- Foxeer Razer Mini Standard source page remains inaccessible for reliable live parsing. Keep pending, do not invent SKU/revision or copy another Razer variant's data.
- Published products require manufacturer identity + exact source-backed mandatory specs + nonduplicated SKU/variant + licensed image (or no unauthorized image) + verified exact-match EU/EUR offer with **fresh** stock and timestamp + human approval. **0/26 fulfil all gates as of this audit.**

## EU offer lead findings (not production offers)

- Rotorama ETHIX P2 Pickle: EUR 3.69 indexed in-stock, supplier result crawled ~2 months earlier; recheck live before publication: https://www.rotorama.de/product/ethix-p2-pickle
- RCTech SpeedyBee 1404 4600KV: EUR 17.90, but retailer explicitly lists `SB-1404-V2-4600KV-1` and selected manufacturer SKU is `SB-1404-V3-4600KV-1`; **variant mismatch**: https://www.rctech.de/speedybee-1404-4600kv-fpv-motor
- RCTech Bee35 frame: EUR 49.90 generic `SB-BEE35FRM`; selected `SB-BEE35FRM-O4P-SE` requires exact variant proof. Indexed supplier availability conflicts between product/category views: https://www.rctech.de/speedybee-bee35-35-frame
- RCTech TBS Crossfire Nano RX SE: EUR 29.90, supplier SKU `TBS_CROSS_NANO_SE` and GTIN corresponding to source shop listing, indexed in-stock ~3 weeks prior; live recheck needed: https://www.rctech.de/tbs-crossfire-nano-rx-longrange-empfaenger-se
- Rotorama CNHL 1500mAh 4S 130C: EUR 20.09, **on the way**, not in stock, supplier sells a **single battery** whereas manufacturer source page selected here is a **2-pack**: https://www.rotorama.de/product/cnhl-black-series-1500mah-4s-130c

## Implemented in this branch

- `supabase/functions/_shared/catalogue-scope-quality.ts`: conservative semantic eligibility filter for accessories and unambiguous ESC category correction.
- `supabase/functions/catalogue-import-runner/index.ts`: applies filter before durable manifest eligibility. Scope-excluded accessories get the same eligibility rejection marker the current durable staging handler understands. Nothing is auto-promoted.
- `tests/catalogue-scope-quality.test.ts`: seven regression tests covering real pilot titles and false-positive controls.
- `qa/step9b3-shortlist-26.csv`: exact shortlist with archived row IDs, source URL, category and unresolved review gate.

**Automated validation:** [successful GitHub Actions run 37216126469](https://github.com/3pbrodi/drone-core-builder/actions/runs/37216126469) typechecked the importer and passed all seven regressions. Full manufacturer-crawl revalidation and the manual EU stock/image rights checks remain independent release blockers.

**Next step:** after review of the exact variants and legal/image + retailer sources, rebuild disposable Supabase from migrations, stage a small first subset, verify dedupe against a read-only snapshot of existing canonical records, and authorize production promotion separately. The draft branch must not be deployed as-is.
