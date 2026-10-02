# P0 import reliability and reproducibility

## Production migration ledger reconciliation

The production migration ledger was inspected read-only on 2026-09-29. No
remote migration history was changed.

Repository migration filenames for the original catalogue foundation now use
the versions already recorded by production:

| Production version | Migration |
| --- | --- |
| 20260928144846 | catalogue_phase2 |
| 20260928144851 | catalogue_evidence_phase_b |
| 20260928144859 | catalogue_import_phase_c |
| 20260928144917 | camera_receiver_phase_e |
| 20260928144922 | evidence_first_catalogue_foundation |
| 20260928144930 | catalogue_review_promotion_workflow |
| 20260928150538 | catalogue_search_path_hardening |
| 20260928154500 | catalogue_fk_indexes |
| 20260928194713 | catalogue_public_snapshot_auto_sync |

For the first six entries the SQL stored in the live ledger matched the
repository file exactly. The search-path and FK-index migrations differed only
by repository comments. The public-snapshot repository migration additionally
contains the snapshot-table creation that already exists in production but was
not represented by its live migration statement. Keeping that creation in the
renamed migration is intentional: production skips the already-recorded
version, while a clean environment creates the snapshots and then installs the
same auto-sync behavior.

This avoids a future `db push` attempting to replay logically applied
foundation migrations, without using `migration repair`, rewriting the live
ledger, or resetting production.

## Edge Function reproducibility

`supabase/functions/catalogue-image-refresh/index.ts` is the exact source
retrieved from the currently active production function (version 3) during this
P0 work. It was not reconstructed from memory or an older copy.

The function has `verify_jwt=false` and therefore relies on its own
`x-catalogue-image-refresh-token` authentication before obtaining a
service-role/secret key and performing privileged image writes. Its apply mode
can demote an existing primary image and insert/update a verified primary image,
so this custom authentication remains security-critical. The token itself is
not stored in the repository.

No function was deployed and no production data was changed by this
reconciliation.

## Clean-environment verification

The import integration workflow starts a disposable local Supabase stack,
replays the repository migrations from zero, runs focused variant/importer
lint and unit tests, and then runs the importer reliability integration SQL.
This is the required proof that the reconciled migration chain can construct a
new environment independently of production.

Non-dry-run importer calls require an explicit stable `logicalRunId` (the
legacy `sourceRunId` request field remains accepted as an alias). The runner
does not invent a random write-run identity. Retries of the same logical run
therefore converge on the same durable run, chunk keys, manifest items, and
staging rows.

Fallback variant fingerprints no longer depend on array position when upstream
identity fields such as SKU, MPN, option labels, barcode, or variant labels are
available. Reordering manufacturer variants therefore does not create a new
upstream identity. A position is used only when the source exposes no stable
variant identity at all; those rows are explicitly marked as identity conflicts
and cannot auto-merge.

Canonical uniqueness and dedupe are category-aware. The canonical uniqueness
tuple also retains known SKU/MPN identity so materially distinct variants are
not rejected merely because their display model/variant labels coincide.
Likewise, an incoming row with the same explicit model/variant but conflicting
known SKU or MPN is a review conflict, never an automatic exact merge.
