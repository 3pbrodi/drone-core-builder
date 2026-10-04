# Step 9B.1 — legacy import cleanup and production audit (2026-10-04)

## Decision and authority

The DroneCores owner explicitly asked to implement Step 1: resolve the three outstanding importer reviews and audit/reconcile 24 older imported rows whose dedupe metadata was unresolved. The change deliberately touches only metadata in `public.catalogue_import_rows`. It does **not** promote products, merge unlike variants, update canonical specifications or source evidence, import new products, edit offers, deploy Edge Functions, alter secrets, or merge GitHub branches.

## Before the cleanup

- 40 total import rows: 24 originally published pilot/catal​ogue rows with `status=imported,dedupe_status=unresolved`; 12 previously rejected CNHL rows; three `needs_review` CNHL rows; one newer CNHL product already imported as an **unpublished candidate**, still `dedupe_status=new`.
- 25 catalogue product records: 24 published/selectable and one pending candidate; 25 retailer offers.
- Read-only audit: all 24 legacy rows' `proposed_product_id` match an existing verified, selectable canonical product. Exact category, model, variant, SKU, and normalized manufacturer also match. No second canonical product shares an identical manufacturer/category/model/variant combination. The iFlight XING2 2207 1750KV and 1855KV variants remain separate. No identity key belongs to multiple distinct products.

## Three CNHL cases (retained for reversibility)

| Historical row | Official source | Decision |
| --- | --- | --- |
| 45: 850mAh 11.1V 3S 30C JST | https://chinahobbyline.com/products/cnhl-850mah-11-1v-3s-30c-lipo-battery-with-t-plug | Excluded from this drone/FPV import: insufficient FPV-specific eligibility evidence, not an assertion that the battery cannot power a drone. The **official page confirms JST** despite its historic `t-plug` URL slug; do not automatically edit the connector. |
| 46: 2200mAh 7.4V 2S 30C T/Dean | https://chinahobbyline.com/products/cnhl-2200mah-7-4v-2s-30c-lipo-battery-with-t-plug | Excluded: original adapter eligibility failure; the official page primarily identifies RC cars/boats. |
| 47: 2200mAh 11.1V 3S 30C T/Dean | https://chinahobbyline.com/products/cnhl-2200mah-11-1v-3s-30c-lipo-battery-with-t-plug | Excluded: same eligibility failure; the importer has no SKU/MPN and the official page primarily identifies RC cars/boats. |

All three were **unpublished**, so exclusion changes no visible website product. Original raw source JSON and normalized technical fields are preserved. Existing validation errors are retained, an additional reason and structured reversible audit note are recorded, and the rows are marked `rejected`. A future explicitly reviewed source/compatibility finding may justify a new import attempt.

## Executed transaction

Script: `scripts/maintenance/reconcile_legacy_import_rows_20261004.sql`

1. Inside a single transaction, the script asserts **exactly 24** unchanged published legacy rows have one-to-one, same-ID, matching canonical products and checks for other exact model/variant identities or shared identity keys.
2. It separately asserts **exactly three** original ineligible CNHL rows are still awaiting review and do not have canonical products.
3. It classifies the 24 already imported legacy rows as `exact_match`, points `matched_product_id` to the **same original product ID**, sets `match_method=product_id` and confidence to 1, and records that this was retrospective reconciliation of the original successful import (no new product or dedupe merge).
4. It marks the three unsuitable CNHL rows `rejected` with review date, validation explanation, and structured audit details. Original identities, names, specification evidence, and source URLs are unchanged.
5. Any count or identity mismatch aborts the entire transaction. The script is a one-time production data correction, **not** a new schema migration; rerunning it against a different post-cleanup snapshot fails its guard.

## Rollback rehearsal and verification

The exact production script was executed with `COMMIT` replaced by `ROLLBACK`. It produced the expected temporary result: 24 imported/exact-match, one imported/new candidate, 15 rejected/new, zero unresolved and zero open reviews. An independent query **after rollback** confirmed the database remained unchanged: 24 unresolved, three awaiting review, zero matched metadata rows, 24 selectable products, 25 offers.

The guarded original script was then committed to the existing production Supabase project `rtwreynffguvqdcogahx`, followed by independent SQL verification:

| Post-commit check | Verified value |
| --- | ---: |
| Total import rows | 40 |
| Open import-row reviews | 0 |
| Unresolved historical imported rows | 0 |
| Legacy rows matched to their **own** canonical product with full-confidence ID | 24 |
| Rejected CNHL and previous rows | 15 = 12 prior + 3 reviewed |
| Newer imported, unpublished CNHL candidate (untouched) | 1 |
| Total products / selectable / unpublished candidates | 25 / 24 / 1 |
| Retail offers | 25 |
| Existing identity keys / shared identities / unresolved conflicts | 43 / 0 / 0 |

No source, candidate, canonical product, published listing, technical or identity evidence, merchant offer, scheduled job, or price was modified.

## Next action

Before the 100–200-item disposable importer pilot, explicitly keep the single newer CNHL candidate behind its existing identity/technical/offer review gates. The three excluded products are not eligible for automated promotion without new, verified FPV compatibility and offer evidence. Keep the incident-fix PR and this one-time maintenance script in version control before any subsequent large import.
