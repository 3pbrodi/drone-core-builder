# Manufacturer pair review integration — 2026-11-21

Baseline `4f3379049cb032f6902f6d7e64cd05b762802b77`, branch `feature/shared-drone-configurator`. This implements the next bounded review/transport step from the manufacturer audit. No hosted database, production approval, product import, image association or deployment changed.

## Implemented

The existing FC/ESC and motor/propeller tables retain their roles. One additive migration adds a captured-source reference, URL, SHA256, locator and compatibility scope to each native/public pair table. Native/public column order remains aligned with the existing snapshot-refresh function; no replacement public reader, catalogue architecture or broad migration replay is needed. Public RLS and SELECT-only grants remain intact. Existing unchanged native verified proofs remain backward compatible; new approvals need captured provenance and explicit review.

`catalogue_review_pair_evidence(kind, id, decision, reviewer, notes, expected_fingerprint)` is a security-invoker RPC, executable only by `service_role` (and the database owner). It uses a row lock plus the SHA256 of the current `to_jsonb(row)::text` preimage. It rejects stale preimages, missing review notes, unsupported kinds, wrong product categories/identities, withdrawn identity proofs, unverified/non-primary sources, mismatched capture URLs/hashes/timestamps and invalid battery ranges. Direct approval without its current review event is rejected. Private `catalogue_promotion_events` records the decision and original fingerprint under the existing `technical_review_completed` action, with a `pair-evidence-review:` JSON payload. Reviewer information is not added to public pair rows.

Referenced source snapshots become immutable. Changing approved pair content returns it to pending review and refreshes the public snapshot. Source status/kind/base-URL changes, product identity/variant/package changes, or edits/deletion of identity evidence withdraw pair approval. Restoring a source does not silently reactivate an approval. Native review documents a source-backed design relation; it does not inspect an assembled drone or installed firmware.

The shared mapper carries source provenance in both server and public-fallback paths. The shared resolver binds new wiring evidence to its documented battery range; missing/out-of-range batteries remain unverified. Exact IDs and existing motor KV/cell conditions remain mandatory. Malformed provenance cannot verify a pair. Conflicting applicable verified verdicts still block the selected combination in the shared resolver; native review does not automatically adjudicate contradictory documents. The collapsed checklist displays actual pair-source links, locators and scope alongside existing physical-fit/firmware limitations. No new maximum-current or full-fit assertion is enabled.

## Rehearsed scope

| Dossier | Local native review |
| --- | --- |
| `wiring-mini35` | F405 Mini + BLS35A Mini V2; supplied harness, 3–6S |
| `wiring-v3-50` | F405 V3 + BLS50A; supplied harness, 3–6S |
| `wiring-v4-60` | F405 V4 + BLS60A; supplied harness, 3–6S |
| `wiring-f7-50` | F7 V3 + BL32 50A wiring only; supplied harness, 3–6S; firmware-layout contradiction remains held |
| `xing1750-nazgulf5` | XING2 2207 **1750KV** + NazgulF5, manufacturer **6S** configuration |

The existing V4/55A proof is not replaced or counted as new. GEPRC pin tracing, HQ prop revisions, continuous-current evidence, ambiguous mount pitches, legacy SKU aliases, full mechanical fit and installed-device firmware remain outside approval scope. The 104-field research CSV remains pending and is not bulk-imported.

The source dossier is immutable at SHA256 `030d072a859cd098a1dfef386c5ac50286cfaf80e5b2bd738a227d5eea23cca9`. Real captured source bytes were rehashed during the rehearsal. Product/identity rows used only as missing exact-ID fixtures were explicitly synthetic and never represented as new production approvals.

## Verification and environment limits

- Twelve focused source/mapper/renderer and existing AI compatibility cases passed. The native case then passed after correcting a local test-access mismatch; 13 distinct cases passed across these runs. Typecheck and build passed. See `qa/manufacturer-pair-review-20261121.json`.
- The initial native test exposed that the existing review-room `service_role` is a placeholder with **no BYPASSRLS**. Its invoker call could not see pending rows. The RPC was kept security-invoker. The successful test uses service-role-only policies **inside the disposable clone** to emulate privileged catalogue access; no cluster role or persistent staging policy was changed. Actual hosted role access has not been inspected here and must be checked before rollout.
- The clone is a logical copy inside the existing `dronecores_catalogue_staging` container. Its name is random, all changes are transactional and rolled back, and the clone is dropped in `finally`. Local pg_cron/pg_net workers remain running; their extensions plus vault are excluded from the clone, and no outbound/scheduler path is invoked. This is native SQL/shared-reader verification, not a live PostgREST/Edge deployment test.
- The source staging schema, relevant product/source/snapshot/pair/event rows and sequence values are fingerprinted before/after and remained identical. The migration is **not persistently applied**, even locally. No migration history entry was created.
- Negative checks cover pending public exclusion, direct approval, stale preimages, capture immutability, changed hashes, source withdrawal, explicit revocation, edited identity/variant withdrawal, wrong part IDs/cells/KV, malformed provenance and conflicting verdicts. SQL checks verify RPC ACLs, public-table RLS and SELECT-only public access. A full hosted Supabase advisory scan and browser replay were not performed; the checklist was tested by actual React rendering.

```sh
# Uses only the existing local container; no credentials or production URL.
DRONECORES_PAIR_LOCAL=1 \
DRONECORES_PAIR_ARCHIVES=/path/to/workspace-with-protected-captures \
node --import tsx --test tests/manufacturer-pair-review.test.ts tests/ai-compatibility-audit.test.ts
node_modules/.bin/tsc --noEmit
CATALOGUE_LOCAL_ONLY=true node_modules/.bin/vite build
```

`DRONECORES_PAIR_ARCHIVES` is optional for clones without protected raw captures; when supplied it must contain the dossier's `.private-backups/...` paths. No captured copyrighted manuals/images or database dump is written to repository artifacts. The native test is opt-in and cannot target a hosted database.

## Controlled next action and rollback

Before any hosted application, compare this single migration with the then-current production schema (including matching native/public columns and snapshot-refresh definitions); inspect actual service-role access and run scoped database advisors. Do not replay all local migrations. Prepare a manifest binding these five exact dossier IDs to actual product/identity preimages, source registry IDs, capture rows and pending pair IDs, checking existing pair duplicates/conflicts. Preserve the original captured timestamps and source hashes. Approve only the reviewed exact records through the native RPC, then verify the actual public API and selected-build reader. Applying this schema and activating these five proofs requires a separate explicit production instruction; current feature-branch code alone activates none of them.

For evidence withdrawal after a future authorized activation, reread each row, obtain its current fingerprint and call the same RPC with decision `revoke`. It leaves products, offers, captures and review history intact and removes the pair from the public snapshot. Do not delete/replay product imports. For application rollback, revert only this feature commit while preserving later work. Additive columns can remain; do not drop provenance or rewrite source history. Removing the migration's guards would require a separately reviewed schema rollback, not automatic reversal during an evidence withdrawal.
