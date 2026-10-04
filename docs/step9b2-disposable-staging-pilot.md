# DroneCores Step 9B.2 — 100–200-product controlled staging pilot

## Scope and execution

Dedicated branch: `pilot/step9b2-disposable-130-products`.
[Live GitHub Actions pilot](https://github.com/3pbrodi/drone-core-builder/actions/runs/37213054912).

The **unchanged durable manufacturer importer** runs directly under Deno, connected only to a new disposable `supabase start` database with all 23 repository migrations and ten official manufacturer adapters from the repository's local bootstrap. It fetches current official manufacturer pages and stages parsed variants; it **does not copy, link to, write, authenticate to, or deploy to Production**.

Pilot source/eligible-row targets, chosen from the prior Step 9A read-only manufacturer audit:

| Official manufacturer | Category focus | Target |
| --- | --- | ---: |
| HQProp | Propellers | 45 |
| Foxeer | Cameras / propellers | 40 |
| Team BlackSheep | Crossfire receivers and other component categories | 30 |
| SpeedyBee | Flight controllers and ESCs | 17 |
| **Total** | | **132** |

These are sampling **targets**, not claims that real-time upstream APIs are currently reachable or that the sampled rows are verified products. Each source receives no more than 23 bounded importer invocations; source fetch concurrency is reduced to two and a 350 ms pacing delay is configured **only inside disposable staging**. Source 403/429/5xx responses, parse problems and timed-out source calls are recorded, not bypassed. The actual verified-input count may be lower. A successful 100–200-row pilot requires the final independent local SQL audit to prove the count.

### Staging-only safety

- The CLI must expose only the expected `http://127.0.0.1:54321` endpoint and **disposable** local service-role key. Any hosted Supabase access token, hosted API-key environment or unexpected database/migration state aborts the pilot.
- The repository migration/permission readiness assertions are rerun before the pilot. No production database, schema, Vault, scheduled jobs, branch merges, frontend deployments, merchant-offer updates or product publication occur.
- The importer runs with `dryRun=false` **only against local staging** and `createCandidates=false`. The purpose is to exercise durable manifests, native batch writes, validation and exact/probable/conflict/new dedupe; it must not create candidate products or trust automatically extracted technical specs.
- The final local assertion demands zero canonical/candidate products, selectable products, merchant offers, identity evidence, technical evidence and candidate-creation events. All staged input and audit output is retained as a downloadable GitHub Actions artifact for 30 days; local Docker databases are then destroyed without backup.
- Manufacturer page URLs, structured model/variant/category/SKU values and parse warnings are retained for subsequent review. Manufacturer images remain externally referenced and are **not** considered licensed for public reuse. No item becomes website-selectable without independently verified identity, technical evidence, merchant EU/EUR price and stock, and a separate owner-approved production promotion.
- Potential model/variant collisions are reported rather than silently collapsed. Different motor KV values, colors, connector variants and hardware revisions must remain distinct.

## Output and gates

The GitHub Actions artifact `step9b2-official-source-staging-evidence` contains `source-summary.json`, `category-summary.json`, `potential-variant-collisions.json`, `staged-validated-items.json`, `report.json`, `steps.jsonl`, `errors.jsonl` and pre/post local database safety snapshots. If a source fails, the partial staging findings are still retained and the job must fail its required 100–200-new-rows gate instead of inventing counts.

Once the pilot has finished, reconcile the exact counts and blockers from the workflow log and review artifact **before** planning the first manually verified subset for publication.
