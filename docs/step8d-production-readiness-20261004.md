# DroneCores Step 8D — Production identity, backup access and migration readiness

**Assessed:** 2026-10-04 · **Decision: NOT READY FOR STEP 9** · **Production access: READ ONLY.**
Verification branch: `verification/step8d-production-readiness-20261003`. Parent: Step 8 `95c475a5f3f0363fb4164e52f013bcf25c4411c9`. Step 7D `c83170fef31e7eef75d2ac556a5e84f2dab4ccda`, Step 7C `fc9644b5c0a2d3c563da20a98ef81471e55331a8`. Historical migrations, Production and all established branches remain untouched.

## 1. Git and migration starting point
The verified Step 8 branch has 24 migration files including the exact historical `20261002190436_auth_billing_foundation.sql`. Current Production's read-only ledger has **20** applied versions (first 19 catalogue migrations plus that auth migration). The four missing repository files in the already proven local execution order are:
1. `20260929175500_component_category_enum.sql`
2. `20260929175600_component_category_architecture.sql`
3. `20260929184414_p0_import_reliability.sql`
4. `20261002180345_catalogue_internal_service_role_usage.sql`

Remote GitHub cannot establish a developer's local workstation branch, HEAD or uncommitted worktree. The dedicated Step 8D verification branch starts at the immutable Step 8 HEAD. This step does not merge or reset anything.

## 2. Supabase project identity: UNRESOLVED (BLOCKING)
The connected Management API positively identifies `rtwreynffguvqdcogahx` as active project **Dronecores catalogue dev**, organization `yiiodqrhmamqqqzblytt`, region `eu-west-3`, database host `db.rtwreynffguvqdcogahx.supabase.co`, PostgreSQL **17.6.1.166**. The sole project listed through the current authenticated connection is this Production project.

The repository's actual `supabase/config.toml` contains `krjwlyfxziqxdotdhjea` (20 characters). The uploaded Step 8D instructions abbreviate this as `krjwlyfxziqxdotdhje` (19 characters); the 19-character string is **not** the actual configured identifier or a valid full project ref. Reading the actual 20-character project ref through the available Management API returns **permission denied**. We cannot establish whether it belongs to another account, a defunct project or an environment artifact; no evidence permits assuming the two refs are aliases. The two configured/verified refs **do not match**.

Minimum action: a project owner independently identifies `krjwlyfxziqxdotdhjea` in the account and project history (or confirms it is obsolete), then verifies the intended Production hostname and project reference from the Supabase Dashboard. No `supabase link`, config mutation or remote CLI command is authorized by Step 8D.

## 3. Current backup/export access: INSUFFICIENT (BLOCKING)
Connected Supabase organization plan: **Free**. The documented automatic daily backup entitlement applies to Pro, Team and Enterprise. PITR has not been demonstrated or enabled. The available connector provides read-only `SELECT` queries and project/Edge metadata but **does not provide a full logical export, database credentials, a complete backup endpoint, or a verified downloadable backup**. We did not request, print or expose any credential.

**Real Production export obtained: NO. Real Production restore performed: NO.** No available record proves a consistent recoverable export for `public`, `catalogue_internal`, customized `auth`, `storage`, the migration ledger, role/grant state, cron and other project-specific objects. The prior synthetic dump and schema snapshots are expressly NOT Production backups.

Minimum action: an authorized database operator obtains a secure read-only database connection **outside chat and public CI**, uses a version-compatible `pg_dump`/approved platform procedure, encrypts and stores the complete backup outside GitHub, verifies its digest, checks inclusion of custom Auth triggers/migration ledger/grants and captures non-database Edge code/configuration, secret-name inventory and Storage contents as required. Do not assume a default `supabase db dump` includes managed schemas, role definitions, data or Storage blobs. **Never restore into Production.**

## 4. Restored Production state and real-data rehearsal: NOT EXECUTED (BLOCKING)
A full actual Production export was unavailable, so no real isolated database could be restored. Neither real restored data fingerprints nor a 20→24 migration on actual restored Production rows exists. It would be misleading to call the previous disposable synthetic database an actual restored Production environment.

If secure export access becomes available, restore into a genuinely disposable, isolated PostgreSQL/Supabase environment with compatible versions and extensions. Compare a fresh read-only Production baseline with the restored copy: all row counts, per-table hashes of stable original fields, all original 25 product identifiers, 43 identity keys, 24 public/runtime published identifiers and offer selection, evidence, old importer rows, Auth/Billing records, migration ledger and private ACLs. Record immutable before/after evidence in **private storage only**; do not publish actual product or user row exports in GitHub. Require the independently verified original 20-version ledger before applying exactly four missing migration files to the restored copy using the locally proven `--include-all` path. Require row-level before/after fingerprints and an explained diff for every changed object (expected/unexpected/unresolved). Missing or unexplained data is a hard stop.

The Step 7C + Step 8 local tests already demonstrate historic-schema reconstruction, four original SQL migrations and a real **local** CLI 20→24 upgrade of a **synthetic** 25-product dataset, synthetic `pg_dump`/restore and unmodified original-column hashes. Their CI evidence is at https://github.com/3pbrodi/drone-core-builder/actions/runs/37128494830. These previous successes **cannot** satisfy the real-copy requirement.

## 5. Newly verified, live READ-ONLY Production baseline
Re-measured 2026-10-04, not merely copied from Step 8. Counts: 25 catalogue products, 1 candidate, 24 published runtime rows, 25 offers, 25 identity evidence, 98 technical evidence, 0 product/source links, 5 import batches, 40 import rows (16 `new`, 24 `unresolved`, 0 `failed`), 43 identity keys, 0 new-six-part-identity collision groups. Eight current category ENUM values; future new optional/pilot values exist only in the pending migrations. No `catalogue_import_runs` or `catalogue_import_run_items` in Production. Auth/Billing: 0 `auth.users`, 0 profiles, 3 plans, 0 subscriptions, payment methods, invoices, usage counters or saved builds. Storage: 0 buckets, 0 object metadata rows. Private-schema ACL: `service_role` USAGE yes / CREATE no; `anon` and `authenticated` USAGE no. Cron: active `catalogue-offer-refresh-midnight-berlin` at `0 22,23 * * *`. Active catalogue Edge versions: runtime v2, offer refresh v9, image refresh v3, importer v8.

New **restored** state: NOT AVAILABLE; all real-restore before/after fingerprints: NOT AVAILABLE. Counts are read-only live observations, **not** an export or restore.

## 6. Compatibility, private schema and historical import safety
Step 7D's prior full Production read-only product check found zero model-variant/sku/mpn collisions, broken offer/evidence/import relationships or cross-product key collisions. Today's limited current check again finds zero six-field identity collisions, and the current 25-product counts remain unchanged. This is not a substitute for applying the SQL to a complete restored real dataset.

Expected post-migration ACL: `service_role` USAGE yes, CREATE no; `anon`, `authenticated`, PUBLIC no schema access. Step 7C and Step 8 isolated tests showed the final GRANT is idempotent, but no actual real-copy Step 8D rerun was possible.

Operational treatment of **24 legacy `unresolved` import rows**: freeze as historical rows, never automatically retry/promote or convert into P0 runs. Preserve all 5 batches/40 rows. Require a documented per-row disposition and an approved responsible reviewer **before later importer resumption**. This default quarantine approach is documented; per-row review is still outstanding.

## 7. Rollback and importer readiness
A live Production migration has **not** happened. PostgreSQL transaction rollback covers only changes in an open transaction; earlier successful migrations may already have committed if a later step fails. Reverse migrations (notably enum/index changes) do not have a proven safe automatic rollback. The primary future rollback is an independently **tested complete real Production export/restore**. This is currently untested and BLOCKING. A prior synthetic data-only restore cannot prove recoverability of live Production.

If authorized real restoration becomes available, test: (A) transaction failure before commit, (B) entire actual backup restore to another isolated environment, (C) failure after each of the four migration boundaries, (D) resume/abort after interrupted migration, comparing version ledger and original row fingerprints. Never use `migration repair` to pretend SQL executed. After the isolated upgrade, run existing P0 claim/recovery/idempotency, dedupe, candidate and publication-gate regression tests **without performing a large real manufacturer import**. Prove no accidental publication and correct private ACL.

## 8. Remaining blockers and minimum next actions
| Area | Classification | Minimum next action |
|---|---|---|
| Verified Production project and observed live schema/20-version ledger | RESOLVED | Reconfirm immediately before future work |
| Repository configured second project reference | BLOCKING | Independently identify full 20-character ref / intended environment and confirm target |
| Complete Production logical export | BLOCKING | Secure approved read-only connection; obtain full encrypted export off-repository |
| Restore of real Production data | BLOCKING | Independently restore real export; compare full schema/data, IDs, ACL, ledger |
| Four migrations on actual restored data | BLOCKING | From real restored 20-version state apply exactly four; compare immutable row hashes |
| Real 24-row published snapshot preservation | BLOCKING | Compare public IDs/selection and snapshot hashes on real restored copy |
| Fully tested real-data rollback | BLOCKING | Prove complete backup restore, migration-failure recovery and operational ownership |
| 24 old unresolved importer records | BLOCKING for import resumption | Freeze historical rows; record per-row decisions before imports resume |
| Local 20→24 CLI/synthetic restore and prior local Auth/P0 regression | RESOLVED (LOCAL ONLY) | Keep tests as evidence; never mislabel as real Production |
| Maintenance and remote CLI `--include-all --dry-run` | BLOCKING for actual cutover | Separate future explicit approval, independent target check and verified backups |
| Existing RLS/private ACL and seven historical function-text differences | RESOLVED for prior local audits | Reverify on actual real restored copy when available |

**Decision: NOT READY FOR STEP 9.** A successful Step 8D cannot be claimed without a real complete Production backup, independently restored live-data copy, successful 20→24 migration on that copy, exact published-row preservation and tested recovery. No Production migration is authorized, even if later prerequisites become available without a new explicit approval.


## 9. Final repeat checks and exact Step 8D CI results

Completed isolated CI run: https://github.com/3pbrodi/drone-core-builder/actions/runs/37195786245 — **SUCCESS** on executable verification commit `256c2c43cbeaf0f342a62b5c19678698ed5f6a57`, Supabase CLI v2.118.0. All steps passed: Git branch/history integrity, original auth migration MD5 and 24-file checks; `bun install --frozen-lockfile`, `bun test`, explicit component/category and importer-variant tests, targeted ESLint, Deno function check, `bunx tsc --noEmit`, `bun run build`; fresh disposable local 24-migration Supabase reset; prior-tested local schema audit; synthetic-user auth trigger and owner-RLS; manufacturer bootstrap twice and catalogue readiness; P0 claims/rollback/idempotency integration; local logs archive; complete `supabase stop --no-backup` cleanup. `git diff --check HEAD^ HEAD` passed with fetch-depth 2. No GitHub hosted Production credentials or remote DB target were used.

The independent read-only Production recheck **after** local CI exactly matched the start-of-Step8D results: 20 migrations, 25 products, 1 candidate, 24 runtime, 25 offers, 25 identity evidence, 98 technical evidence, 5 batches/40 rows (16 new/24 unresolved), 0 auth users, 3 plans, no P0 run/manifest, private USAGE for service_role only, active unchanged cron and active Edge v2/v9/v3/v8. No GitHub Pages push, no Production writes, no merge. Main's latest independently observed SHA was `3c9419da1a8a2e7e3bf45d37d2ec86977da314eb`; it was not modified in this step. Feature HEAD remained `bc0dec0e3551c966fae842c04fb414806671bfad`, and Step 8 HEAD remained `95c475a5f3f0363fb4164e52f013bcf25c4411c9`.

This final report update changes **documentation only** after the passed executable-code CI commit. **NOT READY FOR STEP 9:** the exact same critical real-Production backup, independently restored copy, real-data four-migration rehearsal, 24-row snapshot preservation and actual rollback proof remain unavailable.
