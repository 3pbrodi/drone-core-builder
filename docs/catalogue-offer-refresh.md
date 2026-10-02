# Daily offer refresh

DroneCores re-verifies published EU/EUR catalogue offers once per local day at **00:00 Europe/Berlin**.

## Flow

1. Supabase Cron runs at both UTC hours that can map to Berlin midnight (22:00 UTC during CEST, 23:00 UTC during CET).
2. An internal timezone guard proceeds only when the local Berlin time is exactly 00:00 and no run exists for that local date.
3. Cron calls the `catalogue-offer-refresh` Edge Function with a private high-entropy refresh token stored in Supabase Vault.
4. The Edge Function validates only the token hash and uses Supabase's automatically provisioned server-side secret key for database access. No privileged refresh RPC is exposed through the public Data API.
5. Only canonical, verified, selectable products with verified EU/EUR offers are checked.
6. Merchant pages are fetched with bounded concurrency and exact product identity is verified before accepting price or availability.
7. Structured JSON-LD/schema.org data is preferred. Merchant-specific fallbacks are deliberately narrow.
8. An offer is updated only when the page yields a valid EUR price plus one of: `in_stock`, `out_of_stock`, `preorder`, or `backorder`.
9. Failed or ambiguous checks keep the previously verified offer unchanged and are recorded in the audit tables.
10. Existing public-catalogue triggers immediately propagate accepted price/stock changes to the Lovable read snapshots.

## Audit and secrets

Runs are stored in `catalogue_offer_refresh_runs`. Per-offer observations are stored in `catalogue_offer_refresh_checks`. Both tables are private and RLS-protected.

Runtime configuration must provision these Supabase Vault secret names; values must never be committed:

- `catalogue_offer_refresh_token`
- `catalogue_project_url`

The token itself is never committed to the Edge Function; only its SHA-256 hash is stored there. The Supabase database secret key is supplied automatically to hosted Edge Functions and never stored in the repository.

The current development catalogue was validated with both a dry run and a full apply run across all 16 published offers after the hardened architecture was enabled.
