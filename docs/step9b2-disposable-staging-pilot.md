# DroneCores Step 9B.2 — 100–200-product controlled staging pilot

## Scope and execution

Dedicated branch: `pilot/step9b2-disposable-130-products`.
[Live GitHub Actions pilot](https://github.com/3pbrodi/drone-core-builder/actions/runs/37213054912).

The **unchanged durable manufacturer importer** runs directly under Deno, connected only to a new disposable `supabase start` database with all 23 repository migrations and ten official manufacturer adapters from the repository's local bootstrap. It fetches current official manufacturer pages and stages parsed variants; it **does not copy, link to, write, authenticate to, or deploy to Production**.

Pilot staging-row targets, calibrated using the initial real-source trial and prior Step 9A audit. Rows with missing SKU/MPN or image evidence are **preserved as needs_review**, not misrepresented as clean or verified:

| Official manufacturer | Category focus | Target |
| --- | --- | ---: |
| HQProp | Propellers | 65 |
| Foxeer | Cameras / propellers | 35 |
| Team BlackSheep | Crossfire receivers and other component categories | 30 |
| SpeedyBee | Flight controllers and ESCs | 17 |
| **Total** | | **147** |

These are sampling **targets**, not claims that real-time upstream APIs are currently reachable or that the sampled rows are verified products. Each source receives no more than 23 bounded importer invocations; source fetch concurrency is reduced to two and a 350 ms pacing delay is configured **only inside disposable staging**. Source 403/429/5xx responses, parse problems and timed-out source calls are recorded, not bypassed. The actual verified-input count may be lower. A successful 100–200-row pilot requires the final independent local SQL audit to prove the **total staged, identity-classified** count. Cleanly validated and review-required rows are reported separately, with review explanations. No review-required item counts as a publication-ready product.

### Staging-only safety

- The CLI must expose only the expected `http://127.0.0.1:54321` endpoint and **disposable** local service-role key. Any hosted Supabase access token, hosted API-key environment or unexpected database/migration state aborts the pilot.
- The repository migration/permission readiness assertions are rerun before the pilot. No production database, schema, Vault, scheduled jobs, branch merges, frontend deployments, merchant-offer updates or product publication occur.
- The importer runs with `dryRun=false` **only against local staging** and `createCandidates=false`. The purpose is to exercise durable manifests, native batch writes, validation and exact/probable/conflict/new dedupe; it must not create candidate products or trust automatically extracted technical specs.
- The final local assertion demands zero canonical/candidate products, selectable products, merchant offers, identity evidence, technical evidence and candidate-creation events. All staged input and audit output is retained as a downloadable GitHub Actions artifact for 30 days; local Docker databases are then destroyed without backup.
- Manufacturer page URLs, structured model/variant/category/SKU values and parse warnings are retained for subsequent review. Manufacturer images remain externally referenced and are **not** considered licensed for public reuse. No item becomes website-selectable without independently verified identity, technical evidence, merchant EU/EUR price and stock, and a separate owner-approved production promotion.
- Potential model/variant collisions are reported rather than silently collapsed. Different motor KV values, colors, connector variants and hardware revisions must remain distinct.

## Output and gates

The GitHub Actions artifact `step9b2-official-source-staging-evidence` contains `source-summary.json`, `category-summary.json`, `potential-variant-collisions.json`, `staged-validated-items.json`, `staged-review-required-items.json`, `review-reasons.json`, `report.json`, `steps.jsonl`, `errors.jsonl` and pre/post local database safety snapshots. If a source fails, the partial staging findings are still retained and the job must fail its required 100–200-new-rows gate instead of inventing counts.

Once the pilot has finished, reconcile the exact counts and blockers from the workflow log and review artifact **before** planning the first manually verified subset for publication.

## First live trial: source classification and bounded-sampling correction

The initial live pilot [run 37213054912](https://github.com/3pbrodi/drone-core-builder/actions/runs/37213054912) correctly exercised local manifests, staging, dedupe, and the no-publication security gates. It staged **228** records, exceeding the planned 100–200 range because it incorrectly stopped at *clean* rows only. HQProp: 53 clean. Team BlackSheep: 33 clean. Foxeer: 125 staged, all marked `needs_review`. SpeedyBee: 17 staged, all marked `needs_review`. The latter two mostly depend on manufacturer pages without a stable item SKU/MPN or complete product-image metadata, so the importer appropriately does not automatically certify them. Their exact warning breakdown was not retained by the original summary, hence the improved source-review artifact in this rerun. No product candidates, offers or product publications were created; no exact identity collisions were reported among the 86 clean rows. The first job failed **only** its strict staging-count quality gate, not its isolation and write-safety assertions.

The corrected [bounded rerun](https://github.com/3pbrodi/drone-core-builder/actions/runs/37213658740) stops by the number of new, stageable entries, regardless of whether they need further review. This preserves the intended 100–200 total without hiding the source-quality issues. The exact accepted rows, missing SKU/MPN warnings, unverified images, category distribution and same-model/variant ambiguities must be examined from the rerun artifact before any product promotion.

## Final live staging result — successful corrected run 37213658740

[Successful GitHub Actions run](https://github.com/3pbrodi/drone-core-builder/actions/runs/37213658740) | [Full pilot artifact](https://github.com/3pbrodi/drone-core-builder/actions/runs/37213658740/artifacts/11307617746)

The corrected workflow passed every step (Bash syntax, Deno typecheck, clean 23-migration database, ten-adapter bootstrap, manufacturer live staging, no-publication assertions, artifact archival, disposable environment teardown). In the disposable DB it created **four importer runs, 14 stage batches, and 171 real official-source import rows**, meeting the 100–200 requirement: **104 cleanly parsed and deduplicated as new, 67 marked needs_review**. No canonical product, candidate, offer, identity/spec evidence, publication event, or selectable product was created. Independent production checks after the test still showed 24 selectable products, 25 total catalogue product records, 25 offers and 40 production import rows; no production writes or deployment occurred.

| Source | Total staged | No import warnings | Needs review |
| --- | ---: | ---: | ---: |
| HQProp | 71 | 71 | 0 |
| Foxeer | 50 | 0 | 50 |
| Team BlackSheep | 33 | 33 | 0 |
| SpeedyBee | 17 | 0 | 17 |
| **Total** | **171** | **104** | **67** |

The **specific warnings** in the 67 review-required entries were: Foxeer 50 missing SKU/MPN (49 also missing discoverable manufacturer images); SpeedyBee 17 missing SKU/MPN. Missing SKU/MPN is a manufacturer/source-data limitation, not evidence that the product is fictitious; keep source-page identity and require independent variant confirmation before promotion. All 171 exported rows have a distinct importer-generated product key and nonempty exact source URL/category, but **distinct generated IDs do not prove distinct real-world products**.

Staged category distribution (clean / review): batteries 2/0, cameras 2/1, ESC 10/2, flight controllers 6/8, frames 0/3, motors 1/4, propellers 73/49, receivers 10/0. All eight categories appear in raw staging; however no frame was free of import warnings and propellers dominate this pilot. A larger or more balanced verified catalogue requires stronger frame and camera sources.

**Manual review findings — do not silently merge/promote**:

1. Foxeer/DALPROP lists two different manufacturer URLs under the same model and empty variant label: https://www.foxeer.com/dalprop-quadblade-q4040-propeller-g-83 and https://www.foxeer.com/dalprop-quadblade-q4040-propeller-g-85. They have separate importer IDs but identical category/manufacturer/model/variant identity. Keep both **unapproved**, investigate exact SKU/color/pack-size distinction and merge or retain only after official evidence.
2. The staged SpeedyBee URL https://www.speedybee.com/speedybee-carbon-fiber-arm-for-fs225-v2-frame-1-pcs/ is a **replacement arm**, not a complete frame. Flag it for exclusion from the current configurator's frame category; do not treat this raw row as an eligible finished frame. Review adapter accessory filtering separately before scaling.
3. Existing official-image source references are **not** a license to republish images. All exact-model image associations and technical specifications remain subject to human/source review; EU/EUR offers and current stock are also required before production publication.

The pilot database was intentionally destroyed without backup after saving the artifact. The artifact contains all 104 clean-row normalized payloads and all 67 review-required payloads **with exact validation reasons**, category and source summaries, the detected model/variant collision, import phase trace, and pre/post no-publication snapshots. The persistent output for the next review phase is the versioned test harness + archived GitHub artifact, not a second hosted Supabase project.
