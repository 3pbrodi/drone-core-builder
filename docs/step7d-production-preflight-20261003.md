# DroneCores Step 7D — READ-ONLY Production preflight (2026-10-03)

**Production:** `rtwreynffguvqdcogahx` / PostgreSQL 17.6 / Free organization. **No Production writes, migrations, imports, deployments or secret changes were performed.**

## Recorded baseline and repeat

{"counts":{"products":25,"candidates":1,"offers":25,"identityEvidence":25,"technicalEvidence":98,"importBatches":5,"importRows":40,"sourceLinks":0,"authUsers":0,"migrations":20},"cron":[{"name":"catalogue-offer-refresh-midnight-berlin","active":true,"schedule":"0 22,23 * * *"}]}

Independent read-only before/after checks found no differences. Four catalogue Edge Functions remain v2/v9/v3/v8.

## Seven full function comparisons

The machine-readable file [seven original, repository and currently installed SQL definitions](evidence/step7d-seven-function-comparison-20261003.json) contains full SQL, signatures, return types, volatility, invoker/definer, search_path, ACLs, body references, function MD5 and a normalized source-level comparison. All seven differences consist of formatting, whitespace or comments outside string literals. No pending migration recreates these functions.

## Actual data and four pending migrations

The full [anonymized 25-product compatibility report](evidence/step7d-production-compatibility-20261003.json) stores row-wise SHA-256 product identifiers, valid category and identity-group tests, spec/offer/evidence/source-link counts and relationship tests. Zero new canonical identity collisions, manufacturer-SKU or manufacturer-MPN duplicate groups, cross-product identity key collisions, source-link duplicates or orphaned relational records were found. There are 43 identity-key rows and zero existing product source links.

The 25 products consist of 24 canonical and one candidate. Eight omit SKU, 24 omit MPN and 15 omit variant, all permitted by the pending index. All 25 have existing specs and offers; there are 25 identity and 98 technical evidence rows. All 40 import rows remain valid: 16 `new` and 24 `unresolved`. The latter need an explicit legacy import disposition before any real Production upgrade. No new run/manifest tables exist yet in Production.

The category enum adds 10 values to the existing eight. Architecture defaults existing integrated/included category arrays to empty; 22 new nullable technical columns and six CHECK constraints produce zero existing-row conflicts. The migration will rebuild the current 24-row public runtime snapshot. P0 replaces the old product identity unique index with the category-aware six-component tuple and adds nullable run references to existing batches/rows. The service role already has required private-schema USAGE, and the final grant is idempotent.

## Auth, permissions, project identity and backup

Seven auth/billing tables, eleven policies and four triggers are installed; only `plans` has three records, and `auth.users` has zero. No foreign key crosses between auth/billing and catalogue. Private `catalogue_internal` USAGE is available only to `service_role` (without CREATE); PUBLIC, anon and authenticated are blocked.

`supabase/config.toml` contains `krjwlyfxziqxdotdhjea`; only `rtwreynffguvqdcogahx` is accessible through the connected Supabase account. The origin of the other ref is not verified. The original config ref was introduced on 2026-09-28 and still exists. **No remote CLI migration command is safe with this ambiguity.**

The organization is on Free. Automatic paid-plan daily backups and PITR are not verified/available as an entitlement; no current restorable logical backup has been demonstrated. Before considering migration, create and restore-verify an authorized logical dump containing database roles/schema/data and the schema migration ledger, and separately preserve Edge Function source/configuration, secret inventories (not secret values in Git) and any non-database Storage objects.

## Actual execution blockers

1. Unknown ownership/target of the repo config ID; require explicit project-target verification.
2. No independently verified restorable pre-migration backup; no established PITR fallback on current Free plan.
3. A reviewed CLI strategy must safely handle four missing migration versions older than applied auth foundation (Step7C simulated the SQL locally, not a real remote CLI push).
4. Clarify handling of 24 unresolved legacy import rows and the expected snapshot refresh/index-replacement maintenance window.

**This report does not authorize Production migrations or suggest running `supabase db push`.** The existing Step7C replay and new Step7D isolated CI suite succeeded; a real restored Production-data rehearsal is still recommended.
