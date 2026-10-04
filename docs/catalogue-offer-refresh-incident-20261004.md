# Offer-refresh incident — 2026-10-04

## Observed production state (read-only audit)
- The last persisted offer-refresh run is Berlin local date 2026-10-02.
- That run checked 24 published offers: 17 successes and seven failures.
- Five iFlight Europe pages and one BSS Webshop page returned HTTP 429.
- The RCTech.de GEPRC frame page returned HTTP 200, but the parser could not verify both an exact-product EUR price and unambiguous stock data.
- The cron job remains active and its SQL invocations report `succeeded`; this means only that the SQL dispatched, not that the HTTP operation succeeded.
- The `net._http_response` entry for the 2026-10-04 Berlin midnight dispatch (2026-10-03 22:00 UTC) reported HTTP 500. The sanitized error was `PGRST303: JWT issued at future`, originating from an Edge Function admin REST request.
- The Vault records for `catalogue_project_url` and `catalogue_offer_refresh_token` exist. Their values were not read or modified.
- The project has an active modern default publishable API key. A modern **secret** key's presence in the Edge Function runtime has not yet been established.

## Code changes isolated on the fix branch

1. Shared `catalogue-admin-auth.ts` resolves `SUPABASE_SECRET_KEYS.default` for hosted catalogue import, image refresh, and offer refresh. Hosted workers fail with a clear configuration error rather than silently choosing a broken legacy JWT. The disposable local stack can still use its local service-role JWT.
2. Public catalogue runtime uses `SUPABASE_PUBLISHABLE_KEYS.default`; the disposable local stack retains its local anon-key fallback. Modern keys go on the `apikey` header only, not `Authorization: Bearer`.
3. Offer-refresh merchant requests are sequential within each merchant, with at most two merchants processed concurrently. An HTTP 403/429 opens a circuit breaker for that merchant for the remainder of the run. Skipped offers remain unchanged and their failure is auditable.
4. Regression tests cover hosted and local key resolution, malformed configuration, result ordering, 403/429 circuit breaking, unaffected merchants, and empty catalogues.

These changes were committed to `fix/offer-refresh-reliability-20261004` and subsequently deployed with explicit owner approval. No production migration, production secret change, manual apply refresh, offer change, mass import, or main merge has occurred.

## Approved rollout and remaining actions

The owner explicitly approved deployment of the four Edge Functions. The deployments and read-only smoke tests described below have been completed. A manual **apply** refresh, production data import, and merging branches remain outside that approval.

1. In Supabase project `rtwreynffguvqdcogahx`, open **Project Settings > API Keys**. Confirm an enabled modern **secret** API key named `default` exists; create one if absent. Modern publishable and secret keys are different types. Never paste either secret key into a chat, issue, source file, or PR.
2. Confirm the hosted Edge Function environment supplies `SUPABASE_SECRET_KEYS` (JSON object with the `default` key) and `SUPABASE_PUBLISHABLE_KEYS`. Supabase normally injects them for keys configured in the project. Keep the existing private Vault dispatch token unchanged.
3. Review/merge this fix branch to the intended source branch only after tests. With separate owner approval, deploy the four affected Edge Functions. Do not change `verify_jwt` or relax custom catalogue refresh/import/image tokens.
4. Run one authorized **dry-run** refresh first. Verify a successful admin REST read and that the result contains all 24 expected offers. Compare source-category coverage; do not apply guessed offers.
5. Run one explicitly approved apply refresh. Confirm a persisted Berlin-local daily run, counts in `catalogue_offer_refresh_checks`, and public runtime response. Investigate failed offers instead of marking stale observations fresh.
6. Inspect `cron.job_run_details` **and** the corresponding `net._http_response.status_code`; a cron SQL success alone is not evidence of an Edge Function success.
7. Establish an offer freshness limit and stale-price display policy before scaling the catalogue. Do not show old failed offers as newly checked.

## Merchant failures still requiring commercial/source work

Rate-limiting is a merchant access decision. The circuit breaker avoids repeated blocked requests; it does not bypass restrictions or make those six offers current. Prefer written access to official product feeds or APIs, or separately reviewed alternative EU retailers. RCTech parsing needs an exact-model authoritative feed or a verified, narrowly scoped parser update based on the **current** page. Do not infer stock from a purchase button or price from unrelated page text.

## Verification performed

The extended branch passed the GitHub CI suite, including Bun unit tests, Deno checks of all four Edge Functions, TypeScript and production build (run 37209182218). Targeted tests cover the merchant circuit breaker and bounded read-only retry of transient PGRST303 errors. Production deploys were verified after owner approval, with read-only post-deployment smoke tests.

## Deployment and smoke-test results — 2026-10-04

A first offer-refresh deployment (v10) still encountered `PGRST303 JWT issued at future` when called with a modern secret API key. This is consistent with [Supabase's documented internal clock-skew issue](https://github.com/supabase/supabase/issues/50651). We therefore added a narrowly scoped retry for **GET/HEAD only**; write requests are never automatically replayed.

The following functions are now **ACTIVE**, with their pre-existing `verify_jwt=false` configuration and existing custom authentication preserved:

| Function | Deployed version | Validation |
| --- | --- | --- |
| `catalogue-offer-refresh` | 11 | HTTP 200 dry-run; 24 targets, 17 verified, seven merchant failures |
| `catalogue-image-refresh` | 4 | Deployed; HTTP 401 for a request without the private token |
| `catalogue-runtime` | 3 | HTTP 200; `status=ready`, 24 products, `validation.ok=true` |
| `catalogue-import-runner` | 9 | Deployed; HTTP 401 for a request without the private token |

The dry-run and access-control checks performed **no product, offer, or import writes**. The database continued to contain 25 products (24 selectable), 25 offers, 40 staged import rows, and five persisted offer-refresh runs; the latest persisted run still has Berlin local date 2026-10-02. No migrations, main merge, manually applied price refresh, or mass import were performed.

**Next checks:** observe the next scheduled Berlin-midnight run and confirm both `cron.job_run_details` and its `net._http_response` result. Seven merchant observations still need supported feeds/permission or verified alternative sources: HTTP 429 for five iFlight Europe offers and one BSS Webshop offer, and an unverified exact-product price/stock pair at RCTech. Persistent PGRST303 after bounded retries warrants a Supabase support ticket with request timestamps/IDs; the client-side retry does not repair infrastructure clock skew.
