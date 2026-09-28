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

- `exact_match`: stable product ID, source external ID, manufacturer SKU, or
  MPN identifies exactly one existing product.
- `probable_match`: normalized manufacturer + category + model + variant
  matches one product. Human review is required.
- `conflict`: more than one canonical product matches. Human review is
  mandatory; the importer does not silently choose one.
- `new`: no existing identity matches. Only these rows may create a candidate.

The identity-key table intentionally allows the same key to point to multiple
products so bad legacy duplicates surface as conflicts rather than being hidden
by a uniqueness constraint.

Exact matches may be linked to an existing canonical product as an additional
source, but they never overwrite verified canonical specs automatically.

## Publication safety

The existing Candidate -> Identity Evidence -> Canonical -> Technical Evidence
-> Technical Review -> verified EU/EUR offer -> Published gates remain
unchanged. A batch import therefore increases throughput without making
unverified products selectable.

## Images

Curated product-image rows require an exact-model association and retain the
source product page. Current catalogue images are external references to real
manufacturer or exact-product retailer imagery; generated imagery is not used.
