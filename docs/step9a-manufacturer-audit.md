# Step 9A — official manufacturer catalogue readiness

Run started 2026-10-04 from the isolated branch `audit/step9a-manufacturer-dry-runs`:
[GitHub Actions audit run](https://github.com/3pbrodi/drone-core-builder/actions/runs/37210207750).

## Scope and hard safety limits

- All ten existing official manufacturer adapters run against a fresh **disposable local Supabase database** populated exclusively from repository migrations and the repository's official-source bootstrap. Production URL, production tokens, and hosted secret API keys are not supplied.
- Each supplier is initially sampled through at most **three cursor pages of 30 upstream entries** (subject to smaller feeds). This is a bounded first-pass audit, **not yet a certified complete enumeration**. A partial source must retain `hasMore`/cursor information.
- All requests use `dryRun=true`; no `createCandidates`, writes to staging/product/offer/evidence tables, approvals, publishing, branch merge, website deploy, or paid API access.
- The test explicitly fails if any durable catalogue product, offer, staging row, import run, or evidence is created even inside disposable staging. It writes diagnostic report files only.
- Treat 403/429/5xx blocks as failed/inconclusive official-source tests. Never bypass manufacturer restrictions or report guessed product data as verified.

## Initial production metadata snapshot (read-only)

All ten manufacturer adapters are active. Their latest stored `dry_run_completed` status is dated 2026-09-29. Their configured category rules span all eight website component categories.

| Website category | Configured source count | Dedicated source where available |
| --- | ---: | --- |
| battery | 5 | CNHL, Tattu |
| camera | 5 | RunCam, Foxeer |
| esc | 4 | SpeedyBee |
| flightController | 4 | SpeedyBee |
| frame | 4 | iFlight, GEPRC |
| motors | 4 | iFlight, GEPRC |
| propellers | 5 | HQProp |
| receiver | 4 | RadioMaster |

**Configured coverage is not evidence that an official source is reachable or that a product is correctly parsed.** Cross-category adapters may discover unrelated products, which must be excluded by the category, exact-model, and content rules.

## Result interpretation

The workflow retains `step9a-results/report.md` and `step9a-results/pages.jsonl` as a GitHub Actions artifact for 30 days. The report distinguishes upstream URL counts, stageable possible variants, skipped entries, parser failures, the recorded next cursor, and incomplete or blocked sources. None of these counts equal the number of publishable products. All source records, identity fields, technical specifications, variant distinctions, official evidence URLs, imagery rights, and verified EU/EUR offers must pass the existing evidence-first review before any publication.

The next phase after source readiness is an isolated **100–200-product pilot in disposable staging** with stable dedupe fingerprints and explicit reviewer sign-off. The existing 24 published products and production offers remain untouched until separately approved.
