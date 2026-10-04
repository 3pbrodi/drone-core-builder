# Step 9B.4 — eight exact-source product promotion candidates, disposable QA only

## Scope

Eight category-balanced components: **seven traceable normalized inputs from the successful 171-item disposable manufacturer pilot** (immutable artifact, GitHub Actions run `37213658740`) and **one additionally researched official CNHL Black Series V2 1300mAh 3S XT60 one-pack**. These are authentic manufacturer products, not fabricated inventory, but their latest live availability and image rights require independent checking.

The eight component categories are each represented exactly once. Four have exact-variant EU offer **leads** and are eligible for an **unpublished local candidate test**, not public release.

| Type | Exact official-source selection | EU offer lead (research snapshot) | QA decision |
| --- | --- | --- | --- |
| Propellers | HQProp ETHIX P2 Pickle, 5.1×2.9×3, 2CW+2CCW | Rotorama Czech shop, €3.69, indicated stock (indexed ~2 months earlier) | Candidate seed, stock recheck |
| Receiver | TBS Crossfire Nano RX **SE**, includes Immortal-T V2 | RCTech Germany, €29.90, specific SE SKU `TBS_CROSS_NANO_SE`, indicated stock (index ~3 weeks earlier) | Candidate seed, never merge with regular Nano RX |
| ESC | TBS Lucid **6S** 60A 4-in-1 ESC, AM32 | RCTech Germany, €59.90, specific `TBS_LUCID_ESC`, indexed ~1 week earlier | Candidate seed; do not merge with 8S |
| Battery | CNHL Black Series V2 1300mAh **3S** 130C XT60, **one pack**, stock code `1301303BK` | Rotorama Czech shop, €14.39, 1×3S, indicated stock ~3 weeks earlier | Candidate seed; distinct from published CNHL 6S |
| Flight controller | TBS Lucid H7 (quad FC), 2–8S, STM32H743 | RCTech €69.90: search index said in stock ~2 days earlier but retrieved page also said **out of stock** | Hold until live stock verification; never substitute H7 Wing |
| Frame | SpeedyBee Bee35 O4P-SE 3.5\" frame, official SKU `SB-BEE35FRM-O4P-SE` | RCTech generic Bee35 frame €49.90 `SB-BEE35FRM` | Hold: mismatch of frame variant |
| Motor | SpeedyBee Master3X 1507 3600KV **1-piece**, official SKU `SB-1507-3600KV-1` | German n-Factory item lists **four-motor package** at €71.95 as a **component of a larger kit**, NOT standalone single | Hold: incompatible pack/offer |
| Camera | Foxeer Mini Standard Razer 1200TVL, family SKU `HS1236` | Manufacturer reports **out of stock**, selectable 4:3/16:9 and 1.8/2.1mm lens options, no exact EU listing | Hold: choose documented optical variant and find valid EU offer |

**Identity correction:** archived pilot's 13-digit TBS/HQProp numeric shop fields are treated as *GTIN/source references*, not guaranteed exclusive manufacturer SKUs. Neither repeated GTINs nor shared product-page parent IDs are safe automatic exact-variant identifiers. The exact TBS SE GTIN and RCTech SE merchant match numerically after dropping the archival leading zero.

**Image rights:** no manufacturer-hosted image is copied or staged as a publishable product image. Visual rights are unresolved; a neutral licensed placeholder is acceptable if the future publication policy permits it. Product images from old importer artifacts are not proof of usage rights.

## Executable isolated integration

The new GitHub Actions workflow `.github/workflows/step9b4-isolated-qa.yml` runs on the dedicated QA branch. It downloads the source proof artifact using GitHub's *own* read-only Actions token, sets up **local only** Supabase from all repository migrations and the existing local official-source bootstrap, and generates eight test rows from the original normalized records plus a separately identified CNHL research row.

- Four source-backed candidate seeds are permitted by the test only. They receive **pending_review** (not verified) identity evidence and selectively copied, independently researched technical field evidence. Merchant data remains research metadata: **no catalogue offer rows** are inserted.
- Four other normalized source rows are staged and immediately flagged `needs_review` for meaningful unresolved blocker reasons. Their candidate creation is not attempted.
- The script runs the database's existing production-matched `catalogue_run_import_dedupe` and `catalogue_create_candidate_from_deduped_import` functions only on disposable localhost, then attempts publication for each candidate. Each attempt **must** produce a `Publication blocked:` error.
- It stages the **same eight identities again** in a separate batch. The four created candidate IDs must match exactly and must **not** generate duplicate products. Four held variants remain open, with no automatic promotions.
- Final safety assertions require eight original rows, four pending candidates, four held rows, eight represented categories, zero public runtime results, **zero selectable products and zero merchant offers**, four exact replay matches, zero automatically verified identity/spec evidence, and no manufacturer images.
- Archive only local reports and destroy the database without backup. The check against existing Production products is separately READ-ONLY; the CI pipeline receives **no Production credentials, URLs, Vault secrets, images, offers or user data**.

The current public promotion function does not independently establish an image reuse license; the QA uses no images to avoid falsely passing such a gate. Publication also needs real time-stamped matching merchant-stock evidence, an explicitly reviewed variant ID, manufacturer's required fields and owner approval. There is **no permission** here for Production publication.

Initial isolated integration run: https://github.com/3pbrodi/drone-core-builder/actions/runs/37217607166

Source and exact-variant offer research snapshots: `qa/step9b4-eight-source-offer-evidence.json`. The maintained human-friendly XLSX/CSV decision tables are attached to the ChatGPT session rather than included as GitHub private production data.

## Completed first local integration and corrected connector semantics

[First successful disposable run 37217607166](https://github.com/3pbrodi/drone-core-builder/actions/runs/37217607166) passed its entire 17-step job including archived manufacturer fixture download, importer regression tests, 23 local migrations, original local official-adapter bootstrap, eight source-backed staging records, exactly four **unverified/nonselectable** local candidate creations, negative publication tests for all four, cross-run duplicate replay, QA artifact archival and local database teardown.

The machine-readable SQL audit confirmed **8 initial import rows / 8 component categories / 4 unpublished candidates / 4 held rows / 4 matched exact identities on second import / 0 published / 0 public runtime / 0 offers / 4 pending identity evidence / 13 pending (not verified) specification evidence**, with nonempty publication blockers for all four candidate IDs. All assertions passed.

A subsequent audit detected one overly optimistic schema mapping: **DShot300/600 is a signal protocol, not an ESC connector family**. The isolated research fixture now records DShot **only** as documentation and explicitly flags the connector family as unevidenced. This removes one unverified required-field input rather than making up connector data. The strict publication gate remains blocked without its separate reviewed evidence. [Corrected rerun 37217845355](https://github.com/3pbrodi/drone-core-builder/actions/runs/37217845355).

An independent, strictly read-only Production snapshot after the first successful test showed the unchanged **25 total products, 24 published/selectable products, 25 offers, 40 existing import rows and 0 outstanding importer reviews**. No Production data/DDL/Edge Function/UI/workflows/secret changes were performed by the pilot.
