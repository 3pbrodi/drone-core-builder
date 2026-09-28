# Daily offer refresh

DroneCores re-verifies published EU/EUR catalogue offers once per local day at **00:00 Europe/Berlin**.

## Flow

1. Supabase Cron runs at both UTC hours that can map to Berlin midnight (22:00 UTC during CEST, 23:00 UTC during CET).
2. An internal timezone guard proceeds only when the local Berlin time is exactly 00:00 and no run exists for that local date.
3. The protected `catalogue-offer-refresh` Edge Function loads only canonical, verified, selectable products with verified EU/EUR offers.
4. It fetches merchant product pages with bounded concurrency and verifies exact product identity before accepting price or availability.
5. Structured JSON-LD/schema.org data is preferred. Merchant-specific fallbacks are deliberately narrow.
6. An offer is updated only when the page yields a valid EUR price plus one of: `in_stock`, `out_of_stock`, `preorder`, or `backorder`.
7. Failed or ambiguous checks keep the previously verified offer unchanged and are recorded in the audit tables.
8. Existing public-catalogue triggers immediately propagate accepted price/stock changes to the Lovable read snapshots.

## Audit

Runs are stored in `catalogue_offer_refresh_runs`. Per-offer observations are stored in `catalogue_offer_refresh_checks`.

The refresh endpoint uses `verify_jwt=true` plus a private refresh token. Runtime configuration must provision these Supabase Vault secret names; values must never be committed:

- `catalogue_offer_refresh_token`
- `catalogue_project_url`
- `catalogue_publishable_key`

The current development catalogue was validated with a dry run and a full apply run across all 16 published offers before this workflow was enabled.
