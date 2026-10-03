# DroneCores — Step 8: Production migration execution PLAN (no production execution)

**Date:** 2026-10-03. **Decision:** NOT READY. **Production project:** \`rtwreynffguvqdcogahx\`. **Verification only:** \`verification/step8-production-migration-plan-20261003\`.

This is an operator-reviewed **plan and disposable rehearsal**. No Production SQL writes, migrations, project linking, Edge Function deployments, cron changes, secret changes, product imports, backup-restore operations against Production, or changes to main / feature / Step7D are authorized by this document.

## A. Git State

Step7D base \`c83170fef31e7eef75d2ac556a5e84f2dab4ccda\`. The Step8 branch adds only isolated CI, synthetic local-only data, local CLI tests, and documentation. Historical 24 migrations and repository \`supabase/config.toml\` are unchanged.

## B. Production Project Identity

Read-only Supabase project lookup positively identifies \`rtwreynffguvqdcogahx\` as "Dronecores catalogue dev", organization \`yiiodqrhmamqqqzblytt\`, PostgreSQL 17.6, region \`eu-west-3\`, status ACTIVE_HEALTHY. \`supabase/config.toml\` instead contains \`krjwlyfxziqxdotdhjea\`, first introduced in Git on 2026-09-28. The connected account lists only the known Production ref and denies inspection of \`krjwlyfxziqxdotdhjea\`. They must **not** be assumed to be aliases. **Production target remains explicitly addressable only by verified project reference; repository-local project configuration must not be used as an implicit Production target.**

A future explicitly authorized operator must independently validate the database hostname and project-ref in the Supabase Dashboard, use a **fresh temporary CLI checkout**, confirm the exact target from \`supabase migration list\`, and use a full \`--db-url\` derived from independently verified connection details. Never use an implicit \`--linked\` or an unverified locally cached \`supabase/.branches\` target; avoid changing this repository's config to resolve uncertainty.

## C. Backup Capability

Organization plan Free. Supabase's automatic daily backups cover Pro/Team/Enterprise; Free should make its own logical exports. PITR is a paid option and is not verified for this project. The accessible Supabase connector supports SELECTs and project metadata but does **not** expose a complete SQL dump / database credential / verified backup list. No backup entitlement or restorable archive was proven.

The backup must be encrypted at rest with restricted access, off the GitHub repository, capture its SHA-256/byte count/UTC MVCC snapshot, and be restored on a **separate disposable environment** by an independent operator before any Production upgrade.

## D. Backup/Export Result

**Production backup could not be created in Step 8.** A structural snapshot, Production read-only data counts, historical migration SQL, and anonymized product compatibility report already exist in Step7C/Step7D; none is a full Production backup. An optional **synthetic-only** ephemeral \`pg_dump\` made by Step8 CI contains no Production records and cannot substitute for one.

**Required full backup specification:** use a verified **read-only database connection** and a native \`pg_dump --format=custom\` covering all applicable user-created schemas, including \`public\`, \`catalogue_internal\`, \`auth\` customizations, \`storage\` metadata, \`supabase_migrations\` and appropriate \`cron\` configuration. Also capture a separate verified schema-only export, data-only export, migration history data and role/grant definitions. Test whether required managed-schema objects, extension-owned objects, custom Auth triggers, role memberships and secrets-dependent functions are included; \`supabase db dump\` by default omits auth/storage/extension-managed schemas and role/data content, so a default schema dump is **not sufficient**. Never commit the dump; role exports must exclude password material. The complete original 20 migration ledger entries, all product / offer / evidence / import / identity / review / promotion tables and seven Auth/Billing tables must be recoverable.

**Outside the database:** secure copies of the deployed Edge Function code/version checksums and environment configuration, an inventory of secret names (values only in the secure credential manager), Storage object contents (currently zero buckets/objects, but recheck), cron job schedule and protected job command, project configuration, frontend release/rollback reference, monitoring and vendor-side integration configuration. Database dumps contain Storage **metadata**, not blob contents.

## E. Restore Result

**No actual Production data restore was possible:** no full Production dump/credential and no second hosted project, and the current model container has neither Docker nor a local Supabase CLI. GitHub Actions can instead start **disposable local** Supabase; Step7C successfully reproduced Production's **schema**, including 19 original stored catalogue migration SQL bodies, original auth migration, and documented local-only compatibility patches. Step8 adds a synthetic 25-record local test and CLI rehearsal. Clearly distinguish synthetic data-only export validation from a full Production backup/restore; no Production user data is uploaded to GitHub.

Future required acceptance: decrypt and validate archive digest, restore a full logical copy to isolated PostgreSQL with appropriate compatible extensions/roles, then prove all objects and all existing data/fingerprints against a fresh read-only Production baseline. Until this is done, full restore readiness is **BLOCKED**.

## F. Restored Production Baseline

No restored real Production baseline exists. Actual read-only Production at Step8 start: PostgreSQL 17.6; 20 migration versions; 25 products including 1 candidate; 25 offers; 25 identity evidence; 98 technical evidence; 5 import batches; 40 import rows; 0 product source links; 0 auth users; 3 plans; 0 stored builds/payment records; no P0 run/manifest tables; 24 public verified runtime snapshot rows; existing 8 categories. Confirm all of these on a future **real** restored database, plus 28 catalogue tables, public views and five snapshot tables, ACLs, RLS, function hashes, triggers, cron and storage metadata.

The current anonymous public GitHub evidence includes only sanitized aggregate counts and pseudonymous SHA-256 product keys; it does not constitute a Production database export.

## G. Four-Migration Rehearsal

Step7C **already passed** application of all four original SQL migration files on the reconstructed local historical Production schema in order: \`20260929175500_component_category_enum\`, \`20260929175600_component_category_architecture\`, \`20260929184414_p0_import_reliability\`, \`20261002180345_catalogue_internal_service_role_usage\`. Step8 independently checks the CLI's handling of **older missing versions**, ideally on the same disposable 20-version history with a 25-product synthetic dataset. No Production migration is executed.

After every step capture migration ledger, schema snapshot, indexes, 18 categories, grants, all existing row counts, fingerprints of **preexisting columns**, constraints and RLS, cron/Edge compatibility. Avoid treating expected new columns or snapshot rows rebuilt by SQL as unexpected data loss.

## H. Data Preservation

Step7D read-only Production preflight found zero canonical 6-part identity collisions, manufacturer-SKU or manufacturer-MPN duplicates, evidence/orphaned FK records or source link duplicates across current 25 products; 43 identity keys were present. The Step8 synthetic dataset mirrors **aggregate shape only** (25 products, 1 candidate, 25 offers, 25 identity, 98 technical evidence, 5 batches, 40 rows with 16 new / 24 unresolved; SKU/MPN/variant absence mimics Production). It has synthetic test identifiers, not real product names, offers, verification status or published snapshot data. On the actual restored Production copy, compute per-record stable fingerprints of the original columns **before** upgrade and compare after each migration for all tables, including Auth/Billing and migration ledger exceptions. Preserve a private exception manifest for any expected changes.

## I. Identity/Index Rehearsal

P0 first checks for duplicate \`(manufacturer_id,category,lower(trim(model)),lower(trim(coalesce(variant,''))),lower(trim(coalesce(manufacturer_sku,''))),lower(trim(coalesce(mpn,''))))\` tuples, then drops old \`catalogue_products_manufacturer_model_variant_unique\` and \`catalogue_products_manufacturer_category_model_variant_unique\` when present, creating \`catalogue_products_manufacturer_category_identity_unique\`. There are zero collisions in the observed Production dataset and Step7C's SQL replay passed. Lock/index creation duration and plan must be measured on the future real restored copy. On failure, abort; do not hand-edit Production duplicates during the change window.

## J. Snapshot Rehearsal

The architecture migration expands \`catalogue_runtime_products\` and five public snapshot tables and executes \`DELETE\` + \`INSERT ... SELECT\` for public runtime snapshot. Real Production currently has 24 public runtime rows. The synthetic Step8 fixture intentionally has \`pending_review\` products, so zero synthetic public runtime rows are expected and **this does not establish that all 24 actual Product IDs would survive**. The real restored data test must compare sorted ID lists, category, published/identity status, offer URL, EUR/EU selection, spec values, and per-row fingerprints before and after. Stop if one of the 24 differs unexpectedly.

## K. Import History Transition

Existing five Production batches and 40 rows are not deleted by P0; \`import_run_id\`/manifest references are nullable on historical batches/rows. Existing status distribution is \`new=16\`, \`unresolved=24\`. The default operational plan is **freeze** these as historical legacy imports, do not automatically promote/convert any of them into new P0 manifests; create new importer logical-run IDs only for later independently authorized imports. Before resumption, review the 24 unresolved cases and log a separate explicit decision per row. Never automatically retry them as new products.

## L. Remote Migration Order

1. Preconditions and explicit approval for the separately scheduled execution, verified Production target and independently tested restorable backup.
2. Freeze import job traffic, pause scheduled offer refresh **only during the separately authorized future window**, capture counts, public snapshot fingerprint and active DB connections.
3. Against the **explicitly verified database URL**, review read-only \`supabase migration list\` and a real \`supabase db push --include-all --dry-run --db-url "$VERIFIED_PROD_DB_URL"\`. Abort unless **exactly four** outstanding versions are shown; all existing 20 history versions must remain applied and original auth SQL unchanged.
4. Only after explicit signoff and a valid completed backup restore rehearsal, run the separately approved \`supabase db push --include-all --db-url "$VERIFIED_PROD_DB_URL"\` from a verified immutable checkout with exactly the 24 reviewed canonical migration files (no seed, no custom roles).
5. Verify ledger 24 versions and every detailed postcondition before re-enabling work. No automatic history repair. \`supabase migration repair\` **only** changes ledger state, not SQL; do not use it to mark pending migrations applied in advance.

These are future **operator instructions**, NOT executable permission in Step8. The old version timestamps are intentionally ordered before already-applied \`20261002190436_auth_billing_foundation\`; CLI \`--include-all\` is intended for missing older versions. A local-only CLI dry-run and application is required before remote use.

## M. CLI/Dry-Run Validation

Use pinned Supabase CLI v2.118.0 and capture \`supabase db push --help\`, \`supabase migration up --help\`, \`supabase migration repair --help\`, \`supabase db dump --help\`; use \`supabase db push --local --include-all --dry-run\` against **only** 127.0.0.1:54322. Confirm no mutation of migration history in dry-run; verify the proposed list contains exactly four old versions. Then (disposable-only) run \`supabase db push --local --include-all --yes\`, require 24 ledger versions and unchanged original-column fingerprints. This is **not** a dry-run against Production; no Production credentials are passed to GitHub Actions.

If either command does not meet all assertions, the future remote sequence is blocked until analyzed.

## N. Maintenance Window

A later approved change window must have one named database operator, one independent validator and a tested on-call rollback owner; stop applications and importer ingestion that write the affected tables; identify in-flight jobs, connections and cron; pin frontend and Edge Function versions; verify explicit project ref and backup success/digest **before** any database change. Take two consecutive read-only baseline snapshots and transaction/lock/long-query health. In the window execute migration-by-migration with DB log and RLS/index/identity checkpoints; verify new P0 tables and 18 category values. Post-upgrade verify the 25 products, 1 candidate, 25 offers, 25 identity, 98 technical, 5 batches, 40 legacy rows, 24 public runtime products, zero accidental publication and exact versions/permissions. Resume ingress **only** after independent go-ahead. No duration estimate is justified by synthetic CI timings; measure on a restored actual-size copy before scheduling.

## O. Rollback Strategy

- **Failed in-flight transaction:** PostgreSQL can roll back the failing transaction, but a CLI multi-migration sequence may have already committed prior migrations. Check the ledger and schema at the failure boundary; freeze writes.
- **Reverse migrations:** not provided or tested. The enum extension and index/function transitions do not have a verified generic reverse SQL. Do not invent one.
- **Full restore (primary):** not presently available; must first be demonstrated using a complete, encrypted logical backup restored to an independent disposable database, including managed Auth customizations and migration history. A destructive Production restore also loses valid writes made after the backup; freeze external writes and preserve pending queue offsets.
- **Frontend rollback:** pin previous immutable build and environment config; rollback separately only if the original frontend remains compatible with the altered schema.
- **Edge Function rollback:** preserve deployed code/version metadata. No Edge Function is changed in Step8; future rollback must restore only if an independently approved later deployment changes it.

Abort on any unexpected migration, altered Production identity, missing restorable backup, duplicate key violation, RLS privilege increase, deleted published snapshot row, record fingerprint mismatch or auth/cron/edge change.

## P. Failure Scenarios

| Scenario | Detection / immediate action | Recovery |
|---|---|---|
| Migration fails mid-way | CLI nonzero, record last committed ledger version, freeze writers | Rollback current transaction if open; restore verified backup if partial committed changes cannot be safely resumed |
| Duplicate blocks unique index | Preflight group duplicates and CREATE INDEX SQLSTATE 23505 | Stop before dropping old index; investigate only on restored copy |
| CHECK constraint fails | SQLSTATE 23514, report offending rows | Abort and correct separate future plan, never ad hoc Production edits |
| Function creation conflicts | SQL error, dependency/DDL diff | Stop; compare exact source, roles and search_path on copied schema |
| History mismatch | Dry-run/ledger differs from exact expected four | Do not run push or repair; reconcile read-only first |
| Snapshot differs | Compare expected 24 published IDs/offer selection and fingerprints | Keep traffic frozen; rollback transaction or restore full backup |
| Partially existing P0 objects | Catalog/constraints mismatch preflight | Stop, investigate provenance before running IF NOT EXISTS DDL |
| Existing USAGE grant | Preflight TRUE and service role lacks CREATE | Final GRANT should be idempotent; verify after, no privilege broadening |
| Old frontend on new schema | Frozen frontend smoke test on restored copy | Hold cutover; roll back app or DB according to tested compatibility |
| Migration passes, post-check fails | Independent after-state checklist diff | Keep services frozen; invoke tested full restore if not correctable safely |

Only a **local synthetic** scenario subset can be exercised in Step8. Remaining failure rows are incident procedures, **not** claimed executed tests.

## Q. Production Before/After Verification

READ-ONLY query before and after Step8 must compare complete migration versions, core table counts, categories, grants, seven Auth/Billing counts, project metadata, Edge Function version/checksum, cron name/schedule/active status and storage buckets/objects. Any unexpected drift halts preparation; no remediation writes are authorized.

## R. Test Results

Step7C's original Production-history schema reconstruction and four SQL migrations passed. Step7D's seven normalized function comparisons, actual 25-product data/identity preflight and local 24-migration/Auth/P0 tests passed. Step8 adds a dedicated disposable local CLI test; its GitHub Actions evidence, status and any failures must be reviewed separately. No Step8 test touches a hosted project. The Step7C 25k load test is not repeated.

## S. Blocking Issues

1. Repository project ID belongs to an unverified/inaccessible project; do not implicitly target Production.
2. **No complete Production backup created, and no independently tested real Production restore.** No PITR on current Free plan is verified.
3. No upgrade test against a complete **real** Production data copy; local synthetic test cannot establish full data preservation or 24-row snapshot equality.
4. Future remote CLI dry-run requires verified database URL and separate approval; local-only proof does not imply the production run is approved.
5. Legacy unresolved 24 rows need a written operational disposition; application maintenance/freeze owner, pre/post checks and tested rollback have not yet been signed off.

## T. Final Migration Readiness

**NOT READY.** Known local schema compatibility and actual Production read-only constraint checks support further planning, **not** authorization to execute. A real Production export + independent restoration with exact row-level comparison, explicit verified target and reviewed operator checklist are hard gates.

## U. Exact Recommended Next Step

Keep Step8 and all earlier verification branches unmerged. A designated project owner independently confirms the second project ID and grants a secure **read-only** channel for a complete Production logical export (without sharing credentials in chat). A database operator generates a complete encrypted dump directly to private storage, tests a full restore **locally or on an already-authorized isolated environment** and compares row hashes / all 24 public runtime IDs. A second operator reviews the pinned CLI \`--include-all --dry-run\` output against exactly the four planned migration versions. Only after these gates are documented should a separately approved Production change request be drafted. Step8 itself performs no Production migration.
