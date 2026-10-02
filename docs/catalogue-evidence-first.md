# DroneCores Evidence-First Catalogue

This document describes the catalogue architecture after the Phase A data-quality review.

The live website still uses the static catalogue. The database remains disabled by default and no remote Supabase project is changed by this work.

## Core model

DroneCores now separates four concepts that must not be conflated:

1. **Demo seed data** — the current 20 products used to keep Custom Build, AI Build, Templates, stable IDs, and regression tests working.
2. **Canonical product identity** — a reviewed manufacturer + exact model/variant identity suitable for a real catalogue.
3. **Technical evidence** — source-backed evidence for individual fields or exact component pairs.
4. **Merchant offers** — current regional price/stock data, kept separate from product identity and engineering specifications.

A value can therefore exist in a demo seed without being treated as verified evidence.

## Demo seed versus canonical catalogue

`catalogue_products.record_class` is either:

- `demo_seed` — temporary compatibility/demo data; never eligible for the production runtime catalogue.
- `canonical` — reviewed product data that may later become selectable after all promotion gates are satisfied.

The 20 current static products are migrated as `demo_seed`.

Their stable IDs remain unchanged.

The demo records preserve:
- current display names;
- current summaries;
- current static technical values;
- current images as review-only image records;
- exact raw static product snapshots in the import audit trail;
- the current illustrative EUR prices in the quality-review table.

They do **not** create merchant offers.

## Phase A quality review

`catalogue_product_quality_reviews` persists the Phase A review separately from canonical product verification.

It records:

- identity quality: `unverified`, `partially_verified`, `verified`, or `conflicting`;
- technical quality with the same four states;
- standalone / bundle / unknown product kind;
- reviewed manufacturer/model/variant labels when available;
- review issues and remediation notes;
- whether human review is still required;
- illustrative demo price and currency;
- review dataset and timestamp.

This means a verified product identity does not imply that every technical field is verified.

## Promotion gate

A product cannot become `selectable = true` unless all of the following are true:

- `record_class = canonical`;
- a manufacturer is linked;
- `identity_status = verified`;
- `identity_verified_at` is present;
- product-level `verification_status = verified`.

Compatibility-critical technical fields still require their own evidence.

Promotion is intentionally a later explicit review action. Importing or seeding data never promotes a product automatically.

## Field evidence

`catalogue_spec_evidence` remains the source of truth for field-level provenance.

Evidence contains:

- product ID;
- field key and value;
- unit / semantics;
- source and source URL;
- authority;
- exact-model association;
- verification state;
- retrieval and verification timestamps;
- operating conditions and caveats.

The production-facing `catalogue_verified_spec_evidence` view now exposes verified evidence only for canonical products with verified identity.

Evidence attached to a `demo_seed` remains review material and cannot silently make the demo product production-ready.

## Pair evidence

The existing Phase B pair tables remain the path for technical checks that cannot be proven from one product record alone:

- motor + propeller manufacturer operating evidence;
- motor + ESC comparable current evidence;
- FC + ESC direct-connection evidence.

The current 20 demo products do not seed any pair-level compatibility claims.

## Current 20 products

The seed is generated from the actual static catalogue plus the Phase A review:

```sh
bun run catalogue:export-demo-seed > supabase/seeds/catalogue-demo-seed.sql
```

The generated seed is intended for local/dev/staging use.

It is deliberately safe to rerun:
- it updates records only while they remain `demo_seed`;
- it does not downgrade a product that has already been promoted to `canonical`;
- it creates no real merchant offers;
- it does not invent manufacturer specs, rating semantics, pair evidence, or prices.

Ambiguous motor current values are preserved in the raw seed/audit data and spec attributes, but are **not** normalized into the database's `peak_current_amps` field because the current demo data do not establish that rating type.

## EU / EUR market policy

The future runtime catalogue is EU-focused.

`catalogue_runtime_products` only considers merchant offers that are:

- verified;
- currency `EUR`;
- region `EU`.

Illustrative demo prices never enter this view.

The server adapter also rejects runtime rows unless the product is canonical and its selected offer is EU/EUR.

Offer freshness is not yet enforced because no maximum offer age has been approved. Database runtime activation must remain disabled until a freshness policy and real verified EU merchant data exist.

## Review queue

`catalogue_product_review_queue` surfaces:

- all demo seeds;
- products still requiring human review;
- unresolved identity or technical conflicts.

This is the intended working set for gradually replacing the temporary 20-product demo catalogue with real canonical products.

## Review / promotion workflow

The controlled review and promotion flow is implemented in
`supabase/migrations/20260929010000_catalogue_review_promotion_workflow.sql`
and exposed server-side through `src/lib/catalogue-promotion.server.ts`.

See `docs/catalogue-review-promotion.md` for the complete staged-product-to-publication process.

## Recommended next data phase

Use the review workflow to populate the real catalogue incrementally:

1. choose a real manufacturer/model/variant;
2. create or promote the canonical identity;
3. attach source-backed field evidence;
4. resolve conflicts explicitly;
5. add exact pair evidence where required;
6. add verified EU/EUR merchant offers separately;
7. only then mark a product selectable.

The live configurator should continue using the static fallback until a later approved runtime activation passes parity and evidence checks.
