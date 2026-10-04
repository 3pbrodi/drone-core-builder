# Step 9B.4: corrected isolated execution — PASS

**CI:** https://github.com/3pbrodi/drone-core-builder/actions/runs/37217845355  
**QA artifact:** https://github.com/3pbrodi/drone-core-builder/actions/runs/37217845355/artifacts/11308368863  
**Proposed draft PR:** https://github.com/3pbrodi/drone-core-builder/pull/6

The corrected QA fixture intentionally **does not** equate the TBS Lucid ESC's manufacturer-confirmed DShot300/600 *protocol* with the unrelated mandatory *connector family* field; that connector field is left NULL and blocked pending proper manufacturer pinout proof.

All steps PASSED on a fresh disposable localhost Supabase database reconstructed from all **23 repository migrations**; local importer Deno typecheck and all 7 accessory regression tests also passed. The archived original successful 171-row official-manufacturer pilot was downloaded through GitHub Actions, 7 exact-source archived items were reprocessed conservatively and one separately researched official CNHL Black Series V2 1300mAh **3S** XT60 battery was added.

## Machine-verified final local counts

| Audit | Final result |
|---|---:|
| First-pass source-traceable import rows | 8 |
| Distinct component categories | 8 |
| Local review candidates, all pending and nonselectable | 4 |
| Held import rows requiring variant/technical/stock review | 4 |
| Exact duplicate matches on a second new importer batch | 4 |
| Candidate identity evidence, **pending_review** only | 4 |
| Candidate technical field evidence, **pending_review** only | 12 |
| Public runtime or selectable products | **0** |
| Verified/unverified merchant offer records written | **0** |
| Images imported/reused without confirmed rights | **0** |

Each of the **four** candidate publication attempts was blocked by the real catalogue SQL publication gate. The gate reports identity-review, field-specific technical evidence and time-stamped verified EU/EUR offer requirements. This negative test proves that no incomplete product becomes visible; **it does not prove that any of the eight is eligible for Production promotion**. Live image rights, exact current retailer inventory, variant-specific merchant-SKU match and final manual approval are still independent prerequisites. For the unknown ESC connector, this corrected test records the missing field rather than fabricated evidence.

## Read-only Production identity/record check

Production project `rtwreynffguvqdcogahx` was accessed for **SELECT queries only**, before and after tests. A family-name scan finds existing CNHL Black V2 1300mAh **6S** (not new 3S), ordinary TBS Nano RX (not new SE receiver), TBS Diversity Nano RX (also distinct), and Foxeer Razer Mini **V3/HS1275** (not the sampled original Mini Standard family `HS1236`). Those are deliberately distinct; no automatic variant merge.

The independent post-test production record snapshot was unchanged: **25 total catalogue products, 24 selectable published, 25 offers and 40 pre-existing importer rows**. Zero new import reviews. The local Supabase Docker stack was destroyed with `supabase stop --no-backup` after the artifact upload. No merge, push to `main`, frontend deployment, Production import, Production SQL mutation, or modifications of existing production cron jobs.

**Next strict gate:** human review of all mandatory source-backed spec fields and product identities, licensed images or lawful no-image placeholders, exact variant and EU retailer price/availability recheck with timestamps, then a separate explicit Production approval. The 8-product check does not simulate paid checkout and cannot certify the frontend's eventual rendered cards; an additional preview acceptance test is needed once any product is genuinely approved.
