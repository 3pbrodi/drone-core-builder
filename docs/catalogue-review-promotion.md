# DroneCores Catalogue Review / Promotion Workflow

This workflow turns researched product data into a production-eligible catalogue product without allowing staged or demo data to become trusted automatically.

## States

1. **Staging** — imported CSV/product evidence is parsed and stored for review only.
2. **Candidate** — a staged real product gets a database record with `record_class = candidate`. It is not selectable.
3. **Canonical identity** — exact manufacturer/model identity has been reviewed against exact-model manufacturer or official evidence.
4. **Technical review complete** — every publication-required technical field has verified evidence whose value exactly matches the stored canonical field.
5. **Offer reviewed** — at least one reviewed EU/EUR merchant offer exists.
6. **Published** — only now can `selectable = true` and the product enter the runtime catalogue.

Demo products use `record_class = demo_seed` and never bypass these gates.

## Product import to candidate

Product CSV files continue through `stageCatalogueProductCsv()`.

A reviewed staging row can then be converted with:

`createCatalogueCandidateFromImport()`

The database copies normalized identity/spec fields into a `candidate` record, creates a quality-review record, preserves the import audit trail, and keeps the product non-selectable.

## Identity review

Exact identity evidence is staged with:

`stageCatalogueIdentityEvidence()`

The evidence must name the manufacturer, exact model/variant, source URL, authority, retrieval time, and whether the source is confirmed to describe the exact model.

`verifyCatalogueIdentityEvidence()` only accepts exact-model manufacturer or official-documentation evidence. Approval also updates the reviewed identity labels and verifies the manufacturer entity.

`promoteCatalogueIdentity()` then changes a reviewed `candidate` or eligible `demo_seed` to `canonical`. The database trigger independently re-checks the same blockers, so a direct table update cannot bypass the identity gate.

## Technical evidence review

Specification evidence CSV continues through `stageCatalogueSpecEvidenceCsv()`.

A reviewed staging row is moved into the evidence table with:

`acceptCatalogueSpecEvidenceFromImport()`

`verifyCatalogueSpecEvidence()` verifies a field only when:

- it describes the exact model;
- authority is manufacturer or official documentation;
- a retrieval timestamp exists;
- the evidence value exactly matches the currently stored product field.

A source-backed value that conflicts with the stored value cannot be marked verified.

## Required publication fields

`catalogue_category_field_requirements` defines the minimum source-backed fields needed before a product can be published.

The required set is category-specific and follows the current compatibility system. For example, a frame currently requires verified `frameInches` and `mount`; a camera requires its video interface and voltage range; an FC additionally requires the camera/receiver interfaces and power rails used by the current rules.

Pair evidence remains separate. Motor/propeller, motor/ESC-current, and FC/ESC direct-connection claims are not inferred merely because both products are individually published.

`completeCatalogueTechnicalReview()` succeeds only when every required stored value has matching verified evidence and the product has no unresolved conflicting review state.

## EU/EUR offer review

`addVerifiedEuOffer()` records an explicitly reviewed merchant offer with:

- merchant name;
- HTTPS product URL;
- EUR price;
- EU region;
- stock status;
- last-checked timestamp;
- reviewer and optional notes.

The current workflow deliberately has no guessed currency conversion and no demo-price promotion.

## Publication

`publishCatalogueProduct()` runs only after:

- canonical verified identity;
- completed technical review;
- no pending human review;
- matching verified evidence for every required technical field;
- at least one verified EU/EUR offer with a check timestamp.

The database trigger enforces the publication gate even if code attempts to set `selectable = true` directly.

`unpublishCatalogueProduct()` can remove a product from the runtime catalogue without deleting its evidence or audit history.

## Audit trail

`catalogue_promotion_events` records candidate creation, evidence approvals, canonical identity promotion, technical-review completion, EU-offer verification, publication, and unpublication with reviewer labels and timestamps.

## Current limitations

- The remote Supabase database is still not activated by this branch.
- There is no browser admin page yet; the workflow is exposed as server functions/RPCs for future admin tooling or controlled automation.
- Offer freshness has no maximum age policy yet.
- Image review is still separate and is not a hard publication requirement.
- Pair-level compatibility evidence is still reviewed separately from product publication.

## Recommended operating model

For the first real catalogue products:

1. research an exact product from manufacturer documentation;
2. stage the product;
3. create a candidate;
4. attach and approve exact identity evidence;
5. promote identity to canonical;
6. stage and verify each required technical field;
7. complete the technical review;
8. review a real EU/EUR retailer offer;
9. publish;
10. run compatibility and runtime checks before enabling the database-backed catalogue globally.
