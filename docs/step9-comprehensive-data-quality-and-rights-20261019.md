# DroneCores — Step 9: source and Production-data quality hardening

**Status as of 19 October 2026, 22:15 Berlin.** Technical QA implementation tested. **No new product formally verified or publicly released. No Production writes, deployment or merge.**

## Critical current findings (read-only Production audit)

- **25** catalogue products, **24** selectable/public, **25** offers and **40** historical import rows.
- **24 images** marked `verified` and exact-model-associated in Production currently have **no recorded `license_name` or `license_url`**. Exact-model image matching does NOT prove any right to copy, hotlink, or commercially redisplay those photographs. They may have legitimate permissions elsewhere, but those are **not documented** in the database. No such licenses were fabricated.
- Exactly **1** merchant offer is older than 7 days: La Caméra Embarquée listing for the Tattu R-Line V5.0 1550mAh 6S 150C, checked 2026-09-28 (previously EUR 46.90/in stock, **not current**). The offer is already marked `unverified`; do not portray it as fresh verified inventory.
- The Production `catalogue_runtime_products` SQL selects an image if `exact_model_verified=true` and `verification_status='verified'`, without requiring photo license. It similarly prefers `verified` EUR offers without mandatory <=24h freshness. Both require legal/data-quality gating before growing the catalogue.

## Changes prepared and tested only in the isolated QA branch

- `src/lib/catalogue-source-title.ts`: skips generic TBS SHOP heading, chooses matching manufacturer product heading, and refuses a different critical variant (6S/8S, regular RX/SE, motor size/KV) as an exact title match. Used in `tests/integration/step8-audit-37-official-pages.ts`. **36/37** manufacturer-source titles now have a plausible *review hint* rather than only 13/37; no human verification is created.
- `qa/step9-seven-source-backed-handoff.json`: seven high-signal product families with **35 researched technical claim references**, exact model/SKU/GTIN/pack distinctions, unresolved motor/frame options, a fixed-wing single CCW prop that must not masquerade as a multirotor set, and the Lucid ESC contradictory RCTech inventory. All have `HOLD` release status.
- `src/lib/catalogue-evidence-reconciliation.ts`: requires a fresh HTTPS exact merchant product page, price, SKU/GTIN and variant/pack evidence; contradictory `in_stock` versus `out_of_stock` between actual product and same-SKU category card blocks manual review clearance. Search-index excerpts are not live evidence.
- `supabase/functions/catalogue-image-refresh/index.ts` QA proposal now rejects `mode=apply` (409): og:image and image HTTP fetchability are **not a photo license**, so an automated copy cannot become verified. Dry-run research still works.
- `supabase/migrations/20261019230000_catalogue_runtime_licensed_images_and_fresh_offers.sql` QA-only **snapshot-row guard**, not a direct `catalogue_runtime_products` view replacement. On eventual *approved* deployment, a public row's image is nulled unless matching exact model has a documented license name and HTTPS license URL; outdated/undated merchant offer data are cleared from new snapshot writes. The initial guard would also redact the **24 existing photos**. **DO NOT DEPLOY before explicit owner confirmation of that public appearance change**, and note that 24-hour expiration without snapshot refresh needs a read-time freshness check (also prepared for service/Edge read paths in this branch).
- The migration runs in a disposable database; it is not installed on Production.

## Most important blockers, despite green tests

1. **Image copyright/reuse:** the 24 existing public photos and all new manufacturer/seller photos lack database-recorded usage grants. Commercial image reuse requires a genuine rightsholder permission or valid license. The existing licensed **Lucide ImageOff** fallback can render no-photo cards; user still has not explicitly approved neutral product icons as a public policy. No third-party images should be rehosted.
2. **Manufacturer identity and technical evidence:** manufacturer pages have been corroborated, but `human_verified=false` for all 37 research leads and original four candidates. 31/37 legacy records lack category-required technical fields. Exact SpeedyBee variant/pack and multirotor-vs-airplane class require manual source-level review.
3. **Price and inventory:** cached euro prices are not a guarantee. The RCTech Lucid 6S ESC detail/category stock signals conflict; keep it on hold until reconciled by recent direct evidence or merchant confirmation. CNHL 3S direct price 14.39 EUR was observed but stock not conclusively parsed. HQProp P2, TBS Nano RX SE and Lucid have earlier direct offer observations, but observations expire and never substitute merchant/variant reviewer attestation.
4. **Release rights and schema:** the Step 7 owner/media/review RLS migration and this read-path/photo/image-refresh proposal remain unmerged, unapplied. A human owner must explicitly authorize named products, photo-icon policy and Production schema rollout. Tests must not counterfeit that permission.

## Run evidence

- **[Step 9 all-green GitHub CI 39317587313](https://github.com/3pbrodi/drone-core-builder/actions/runs/39317587313)**: 31 Bun tests passed, source + Edge Deno checks and frontend build, 37 official manufacturer-page auditable source checks, and fresh disposable Supabase licensing/freshness SQL test. No Production API write.
- Previous **[Step 8 isolated 37-row import run 39311228978](https://github.com/3pbrodi/drone-core-builder/actions/runs/39311228978)**: 37 historical source rows all as `needs_review`; 0 promoted products, offers, images or runtime products.
- Baseline Production unaffected: 25 total catalogue records, 24 selectable, 25 offers; the proposed new public-image guard is *not* deployed.

## Next actions for actual verified published products

1. Obtain explicit public media policy choice: neutral Lucide icon for 24 already-published undocumented photos and future products **or** documented rightsholder licenses. Do not silently change website photos.
2. Resolve concrete exact variants and the 13 first-pilot mandatory technical values; independently sign off manufacturer pages/manual excerpts. Vendor-issued SKU must not be conflated with GTIN.
3. Recheck and review fresh direct EU shop offers for CNHL 3S, HQProp P2 4-pack, Nano RX SE and Lucid 6S. Stock conflicts and out-of-stock leads remain blocked.
4. Review and approve schema/runtime/image-refresh safety changes as a single controlled rollout, then authorize Product-by-Product publication.
5. Expand beyond the 171 originally unbalanced manufacturer-source leads (122 propeller rows and **no true battery** in the 37 balanced subset). Prioritize authenticated battery, frame, camera and motor sources and record component type before technical compatibility checks.

**Decision:** Infrastructure and release-safety preparation: **PASS**. Complete image rights, owner authorization, fresh seller attestations, and fully human-verified new products: **NOT YET READY**.
