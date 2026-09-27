# DroneCores Catalogue Phase 2

Phase 2 prepares a PostgreSQL-backed catalogue for Supabase without changing the live configurator away from the Phase 1 static catalogue.

## Safety model

- The current UI still reads the synchronous static catalogue through `productCatalogue`.
- Supabase access exists only in `*.server.ts` modules.
- Secrets are read at call time from server environment variables.
- The database path is disabled unless `CATALOGUE_DATABASE_ENABLED=true`.
- Even when enabled, the server adapter falls back to static data unless the database passes exact parity against the current static catalogue.
- CSV imports are staged for review only. They never insert directly into canonical products.
- Canonical products default to `verification_status = unverified` and `selectable = false`.
- No remote Supabase migration or import is performed by this phase.

## Files

- `supabase/migrations/20260927190000_catalogue_phase2.sql` — tracked PostgreSQL schema.
- `src/lib/supabase-rest.server.ts` — server-only Supabase REST transport.
- `src/lib/catalogue-database.server.ts` — database-to-runtime catalogue mapping and parity fallback.
- `src/lib/catalogue-parity.ts` — compares a database snapshot with the current static catalogue.
- `src/lib/catalogue-import.ts` — CSV parsing and validation.
- `src/lib/catalogue-import.server.ts` — server-only staging writer.
- `docs/examples/catalogue-products.sample.csv` — clearly marked sample import format.
- `scripts/export-static-catalogue.ts` — exports the existing static products to the staging CSV format.
- `.env.example` — placeholder-only server environment configuration.

## Database schema

### Canonical data

`catalogue_manufacturers`
- Manufacturer identity and website.
- Verification status.

`catalogue_products`
- Stable text product ID.
- Manufacturer foreign key.
- Exact model and optional variant.
- Display name, category, MPN, manufacturer SKU.
- Summary, weight, lifecycle status.
- Verification and selectability are separate fields.
- Extra non-critical attributes can live in JSONB.

`catalogue_product_specs`
- One-to-one typed compatibility fields.
- Frame size and motor mounting pattern.
- Propeller diameter.
- Motor size code, stator dimensions, KV.
- Battery cell range.
- FC/ESC connector fields.
- Thrust, peak current, ESC amps.
- Battery cells/capacity/discharge rating.
- Video system and receiver protocol.
- Additional non-critical attributes in JSONB.

### Product images

`catalogue_product_images`
- Product foreign key.
- Image URL and source URL.
- Alt text.
- Exact-model verification flag.
- Verification status and provenance.
- Primary-image flag.
- License name and license URL where known.

Only verified exact-model images are exposed by the runtime view.

### Merchant offers

`catalogue_merchants`
- Retailer identity, website, country, verification status.

`catalogue_offers`
- Product and merchant foreign keys.
- Merchant SKU and product URL.
- Price and ISO currency.
- Stock status and region.
- Last-checked timestamp.
- Verification status.

Price/stock are intentionally separate from the canonical product.

### Source metadata

`catalogue_sources`
- Manual / CSV / XML / API / Shopify / manufacturer / retailer source type.
- Source URLs and licensing/terms metadata.
- Verification status.

`catalogue_product_sources`
- Product/source relationship.
- External product ID.
- Source URL and import timestamp.
- Verification status, raw hash and source metadata.

### Import staging

`catalogue_import_batches`
- One record per staged file/import run.

`catalogue_import_rows`
- Raw and normalized row data.
- Validation messages.
- Duplicate-product marker.
- Explicit review/import status.

The staging tables do not automatically promote rows into canonical products.

## Runtime database view

`catalogue_runtime_products` returns only products that are:

- `selectable = true`
- `verification_status = verified`
- not discontinued

It also selects only a verified exact-model image and a verified merchant offer.

The current website is **not yet connected to this view**. The Phase 2 server adapter can load it for parity checking, but the UI stays on static data until a later approved migration step.

## Environment variables

Copy `.env.example` to a local ignored file such as `.env.local` only when a Supabase project exists.

Required server-only variables:

```text
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
CATALOGUE_DATABASE_ENABLED=false
```

Do not use a `VITE_` prefix for either secret value. Do not commit real values.

`SUPABASE_SECRET_KEY` is privileged and must stay server-side. Phase 2 does not use a browser Supabase key.

## Migration workflow

Preferred workflow:

1. Keep schema changes in `supabase/migrations`.
2. Test migrations against a local Supabase/Postgres environment.
3. Commit the migration file.
4. Only after explicit approval, link the repository to a remote Supabase project.
5. Apply tracked migrations with the Supabase CLI using `supabase db push`.

Do not make ad-hoc remote schema changes in the Table Editor once tracked migrations are in use.

No remote migration has been applied by Phase 2.

## If you are working only from an iPad

You can create the Supabase project in Safari now, but you do not need to apply the migration yet.

1. Open the Supabase website and sign in/create an account.
2. Create a new project inside your organization.
3. Choose the free option if offered and do not enable paid add-ons.
4. Pick a project name such as `dronecores-catalogue`.
5. Generate a strong database password and save it in your password manager.
6. Choose a nearby project region.
7. Wait for the project to finish provisioning.
8. In the project's Connect/API settings, locate:
   - Project URL
   - server Secret key
9. Store them only in a secure environment/secrets manager. Do **not** paste them into GitHub source files or chat.
10. Leave `CATALOGUE_DATABASE_ENABLED=false` until schema migration and parity verification have been completed.

For an iPad-only workflow, stop there until there is an approved terminal/Codespaces/deployment environment available to apply the tracked migration. This keeps the repository migration history authoritative instead of manually changing the remote database.

## CSV product import format

The sample is in:

`docs/examples/catalogue-products.sample.csv`

Required columns:

- `id`
- `category`
- `display_name`

Supported optional fields include manufacturer/model identifiers, compatibility fields, image provenance, and source metadata. The validator rejects unknown columns, malformed IDs, invalid categories, bad numeric fields, invalid battery ranges, duplicate product IDs inside the same CSV, and inconsistent image-verification claims.

The validator also produces review issues for incomplete identity/compatibility information.

### Stable IDs

IDs must contain only letters, numbers, `.`, `_`, `:`, or `-`, begin with an alphanumeric character, and remain stable after publication.

### Review process

1. Parse and validate the CSV.
2. Detect duplicates within the file.
3. On the server, check product IDs already present in canonical products.
4. Create an import batch.
5. Store every row in staging.
6. Invalid rows become `rejected`.
7. Valid rows with missing manufacturer/model/compatibility/image verification or duplicate canonical IDs become `needs_review`.
8. Fully valid rows can become `validated`.
9. **No row becomes a canonical/selectable product automatically.**
10. A later approved review/promotion tool will be required to move verified records into canonical tables.

## Migrating the existing static catalogue

The existing static products remain the source of truth for the live site.

Export them locally with:

```sh
bun run catalogue:export-static > dronecores-static-products.csv
```

The exporter:

- preserves stable product IDs;
- preserves existing names, summaries, weights, prices-independent technical compatibility fields and image URLs;
- does not invent manufacturer/model identifiers;
- does not mark any image as database-verified;
- labels provenance as the Phase 1 static demo catalogue.

The resulting CSV is intended for staging/review, not direct publication.

Current demo prices are not exported as verified merchant offers because the Phase 1 values are illustrative and are not verified live retailer data. Merchant offers must be added and verified separately before database parity can succeed.

## Parity gate

`catalogue-database.server.ts` can compare a database runtime snapshot against the static catalogue.

Parity currently requires:

- the same stable product IDs with no missing or extra selectable products;
- matching categories, names, summaries, price, weight and compatibility-critical fields;
- matching current primary image URLs.

If parity fails, or Supabase is unavailable, the server snapshot returns the static catalogue instead.

The live UI does not call the database snapshot yet, so Phase 2 cannot change customer-visible behaviour.

## Deliberately not included in Phase 2

- No remote Supabase project connection.
- No remote migration execution.
- No production-data import.
- No retailer scraping.
- No external product API.
- No Shopify integration.
- No automatic staging-to-production promotion.
- No AI recommendation changes.
- No visual changes.
