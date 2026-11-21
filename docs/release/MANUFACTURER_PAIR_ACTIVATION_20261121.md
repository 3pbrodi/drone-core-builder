# Five manufacturer pairings activated — 2026-11-21

Completed the user's instruction to implement preflight, permission verification and bounded production activation in order. Project `rtwreynffguvqdcogahx` now has **five FC/ESC wiring proofs** (one original plus four new) and **one motor/propeller proof**. There are still **134 product records / 133 selectable products**. No product import, withdrawal, price/specification change, image integration, auth/billing change or public website deployment occurred.

This supersedes the pending-production state in `MANUFACTURER_PAIR_REVIEW_20261121.md`. The original research dossier and its 104 pending field claims were not promoted wholesale. Full assembled mechanical fit and installed firmware are not approved.

## Steps completed

1. **Schema comparison:** the four native/public pair layouts and the snapshot-refresh function matched the locally tested baseline exactly. The single additive migration was applied with fresh schema/function guards and bounded lock/statement timeouts. The snapshot-refresh function itself was preserved.
2. **Permissions:** production's existing `service_role` has BYPASSRLS, schema access, table access and event-sequence usage. Actual read-only role switching confirmed access before changes. After migration, that role could execute the security-invoker review RPC; `anon` and `authenticated` could not. No production role, grant or policy workaround was needed.
3. **Activation:** five primary source captures and five pending pair records were inserted, then explicitly approved through `catalogue_review_pair_evidence` in one transaction under `service_role`. Product/source/identity preimages were locked and checked. Atomic before/after SHA256 guards passed for all products, offers, images, specs, field proofs, identities, source registries and motor/current proofs. Two existing manufacturer registries were reused. Existing captures, proofs and the V4/55A pairing were retained. Native review event IDs: **1820–1824**.

| Dossier | Approved design relation | Conditions |
| --- | --- | --- |
| `wiring-mini35` | F405 Mini + BLS35A Mini V2 | Exact named hardware, manufacturer-supplied harness, 3–6S |
| `wiring-v3-50` | F405 V3 + BLS50A | Exact named hardware, manufacturer-supplied harness, 3–6S |
| `wiring-v4-60` | F405 V4 + BLS60A | Exact named hardware, manufacturer-supplied harness, 3–6S |
| `wiring-f7-50` | F7 V3 + BL32 50A wiring | Same harness/3–6S scope; contradictory firmware-layout text stays held |
| `xing1750-nazgulf5` | XING2 2207 **1750KV** + NazgulF5 | Manufacturer **6S** configuration; not another KV, generic propeller or continuous-current approval |

All seven associated captured source files (five primary plus two supporting motor/propeller references) were rehashed before application. The five primary capture rows retain their actual 2026-11-21 16:51/16:55 retrieval times and original SHA256 values. Approval time is separate; no price/stock observation date was refreshed.

## Runtime integration discovered during preflight

Deployed `catalogue-runtime` v4 discarded pair provenance and FC/ESC operating conditions in its response mapper. Activating the database records alone would therefore have lost important scope information in the configurator. The bounded activation included a catalogue-reader deployment to **v5**, bundle SHA256 `7f7fdeaaffb4cd9eb7654c4a64c7492b00ea5617f5195435ffdd50f0e2153cfe`.

Only two bundle files changed: the previously tested `_shared/catalogue-evidence-read.ts` and the runtime entrypoint's legacy evidence mapping, which now calls that same mapper. The other eight deployed dependencies were byte-identical. Existing public access (`verify_jwt=false`), CORS, methods, cache settings and product mapping were preserved. The feature-branch entrypoint is reconciled from the actual deployed v4 source, which matched the preserved local file, so the already-running pagination/query behavior is retained rather than overwritten by the branch's older entrypoint. Unrelated local work remains preserved.

Actual v5 source was read back and matched the tested ten-file bundle. Before pair activation, the updated live reader returned identical affected products and old evidence. After activation, both legacy GET and exact-ID query GET returned all five wiring proofs and the motor/propeller proof with correct source URLs/hashes/locators/scopes and cell constraints. Existing site readers consume them without a public website deployment.

## Verification and limits

- Recovered-environment native five-pair regression passed. The exact prepared activation and rollback SQL also passed in a disposable local clone using the ten real production identity preimages and parent fixtures. The review-room's non-BYPASSRLS stub required clone-only policies, including public-cache reads; the initial empty-cache assertion was a local-role visibility issue, not a failed native approval. The corrected exact packet passed. Persistent staging data and sequence fingerprints remained unchanged; clones were dropped.
- The actual old/new runtime handlers passed **42** loopback-only mocked-REST checks across both API shapes, preserving product/field payloads while carrying scope and rejecting wrong-cell reuse. No runtime test read production directly.
- Separate anonymous read-only HTTP probes confirmed **133** products in the real legacy API and all **12** requested components (ten affected parts, a real 6S battery, and the original BLS55A) in the scoped response. Those captures passed **61** offline checks through the existing application reader, shared resolver, native compatibility rules and React checklist. All five new relations give the intended verified listed-rule result; other/unknown battery conditions, different IDs and fresh revocation responses cannot reuse them. The old V4/55A proof still works. This is actual API plus shared configurator logic/rendering verification; an authenticated Lovable/browser session was not exercised.
- Independent post-commit SQL confirmed original product/offer/image hashes, original V4/55A row and snapshot-refresh function unchanged; five native review events and five captured-source rows exist. No additional product became selectable and none was removed. The isolated feature-branch typecheck and build passed; log fingerprints are in the QA receipt. Website deployment remains out of scope.

QA: `qa/manufacturer-pair-activation-20261121.json`. Full guarded SQL, production preimages, runtime v4 rollback bundle, actual API captures and detailed receipts are protected under `.private-backups/manufacturer-pair-activation-20261121/`. No credentials, product photographs or full copyrighted manuals were added to repository artifacts.

Security advisors before/after retained the same 26 intentional private-table RLS-without-policy informational findings and the pre-existing [pg_net-in-public warning](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public). Service-role-only private access was confirmed; no public policies were added. Performance advisors report three existing import-table foreign keys without indexes and unused-index information, including the newly created pair indexes before meaningful workload. No new pair foreign key lacks an index. See [foreign-key advice](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys) and [unused-index advice](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index); these unrelated indexes/extensions were not changed.

## Migration continuity — do not replay

The tool recorded the applied migration as **`20261121203933_catalogue_pair_evidence_review`**; production now has **38** migrations. The tested repository source remains `supabase/migrations/20261121201229_catalogue_pair_evidence_review.sql`, SHA256 `5bc4be67716e3ec2e7091e3723108353f5c166cdab5b938933bcdcd2badcb2fb`. The executed query adds preflight/timeouts and schema-cache notification, SHA256 `cfa30b205bf5bc1ef8430e7845032fa03a3e516326a59987fcfcdb15e0a42ece`. This is an explicit source-to-production mapping, not an unapplied second migration. No history repair/rename was performed. Existing older local/production version differences remain date-qualified history. Never bulk-push all local migrations or reapply the 201229 source merely because its filename differs from the server version. Preserve this mapping and inspect the current schema before future rollout.

## Reproduction and rollback

The following replays are offline and require the protected captures; no hosted URL/key is used by them:

```sh
MANUFACTURER_PAIR_CAPTURE_DIR=/path/to/.private-backups/manufacturer-pair-activation-20261121 \
node --import tsx tests/integration/manufacturer-pair-runtime.ts
MANUFACTURER_PAIR_CAPTURE_DIR=/path/to/.private-backups/manufacturer-pair-activation-20261121 \
node --import tsx scripts/verify-manufacturer-pair-activation.ts
node_modules/.bin/tsc --noEmit
CATALOGUE_LOCAL_ONLY=true node_modules/.bin/vite build
```

A future authorized evidence rollback must use only the five evidence IDs in the QA receipt: reread each exact row, verify its source capture/batch and current state, compute SHA256 of `to_jsonb(row)::text`, and call the native RPC with decision `revoke`. The protected `rollback.sql` was rehearsed locally and not executed in production. Re-read the public projection afterward. Keep all products, offers, captures and review history; do not replay imports or delete records. Existing API caching is public max-age30/s-maxage60 seconds; verify withdrawal with an uncached read or after that TTL.

For a reader rollback, first withdraw these five proofs, then redeploy the protected exact v4 bundle with its existing JWT setting. Rolling back the reader while leaving new proofs active would discard their conditions and is unsafe. The additive schema can stay; removing its guards or modifying migration history needs separate review. Git rollback should revert only the scoped implementation after preserving later work, never force-push.

Unresolved requirements remain exact assembled clearances/fasteners, installed FC/ESC/TX/RX firmware metadata, GEPRC pin tracing, ambiguous mount/revision aliases and continuous-current test evidence. Their prior holds remain effective; five catalogue pairing approvals do not establish flight readiness.
