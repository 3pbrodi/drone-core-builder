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

These changes were committed only to `fix/offer-refresh-reliability-20261004`. No production migration, production secret change, Edge deployment, manual refresh, offer change, or main merge has occurred.

## Required approval and production rollout

**Do not deploy before explicit owner approval.**

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

The shared helper modules passed strict TypeScript checking in an isolated local test harness. Nine targeted Node tests passed. The complete repository Bun suite, Deno Edge Function checks, CI integration workflow, and the hosted deployment remain outstanding and must be run before a production rollout.
