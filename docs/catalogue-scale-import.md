# Scalable catalogue ingestion

DroneCores can ingest large product feeds without bypassing the evidence-first
publication workflow.

## Batch path

Source adapter -> staging rows -> validation -> dedupe -> candidate/evidence
review -> canonical technical review -> verified EU/EUR offer -> published.

Supported adapter metadata covers CSV, normalized JSON/API feeds, Shopify,
manufacturer feeds, and retailer feeds. Adapter batches can contain hundreds of
rows and are inserted in bounded chunks.

## Dedupe rules

Each staged row is classified before candidate creation:

- `exact_match`: a stable product ID, exact source external ID, exact
  manufacturer + SKU, exact manufacturer + MPN, or exact manufacturer +
  category + model + variant identifies exactly one existing product.
- `probable_match`: no exact identity key matched, but manufacturer + category
  + model belongs to one or more existing variants. This is only a human-review
  hint and is never auto-merged.
- `conflict`: more than one existing product matches an exact identity key.
  Human review is mandatory; the importer does not silently choose one.
- `new`: no exact identity or model-family review hint matches. Only these rows
  may create a candidate.

The identity-key table intentionally allows the same key to point to multiple
products so bad legacy duplicates surface as conflicts rather than being hidden
by a uniqueness constraint.

Exact matches may be linked to the existing canonical product as an additional
source. Verified canonical specs are never overwritten automatically. Technical
evidence and offers continue through their dedicated evidence/review and
verified-offer workflows against the matched product ID.

## Publication safety

The existing Candidate -> Identity Evidence -> Canonical -> Technical Evidence
-> Technical Review -> verified EU/EUR offer -> Published gates remain
unchanged. A batch import therefore increases throughput without making
unverified products selectable.

## Images

Curated product-image rows require an exact-model association and retain the
source product page. Current catalogue images are external references to real
manufacturer or exact-product retailer imagery; generated imagery is not used.

## Official manufacturer full-catalogue adapters

The import runner supports resumable manufacturer crawls instead of repeatedly
processing only the first N products. Every run is bounded by the adapter's
`max_batch_size` and returns `nextCursor` plus `hasMore`.

Discovery modes currently used:

- `shopify_products_json`: RadioMaster and CNHL. The cursor is the Shopify page.
- `sitemap`: iFlight, RunCam, GEPRC, SpeedyBee, HQProp, Foxeer, and Tattu.
  The cursor is a stable offset into the sorted, de-duplicated product URL set.
- `category_html`: Team BlackSheep. Relevant official shop categories are
  crawled, product links are de-duplicated, and the cursor is an offset.

Active official manufacturer adapters cover iFlight, RadioMaster, RunCam, CNHL,
GEPRC, SpeedyBee, HQProp, Foxeer, Tattu, and Team BlackSheep. Adapter-specific
category and exclusion rules keep obvious accessories, chargers, replacement
parts, complete drones, and unrelated catalogue entries out of product staging.

The runner is dry-run by default. A non-dry run stages only category-eligible
products, runs exact/probable/conflict/new dedupe, and links exact identity
matches back to the existing canonical product as an additional source. It does
not overwrite verified canonical specifications. New rows become candidates
only when `createCandidates=true`; candidates remain behind the normal identity,
technical-evidence, offer, and publication gates.

Official manufacturer images may be captured as evidence references, but the
runner records them with `image_exact_model_verified=false` until the image is
reviewed. Automatically extracted technical evidence remains review-gated.
