import { normalizeCatalogueQuery, readCatalogueIds, readCataloguePage, type CatalogueQuery, type CountedReader } from "./catalogue-query.ts";
import { readAllRows, type RestReader } from "./catalogue-runtime-read.ts";
import { mapEvidenceRows, readEvidenceRows } from "./catalogue-evidence-read.ts";

export async function loadCatalogueQuery<C extends string>(counted: CountedReader, read: RestReader, input: CatalogueQuery) {
  const query = normalizeCatalogueQuery(input);
  const page = query.mode === "ids"
    ? { products: await readCatalogueIds<C>(read, query.ids!), page: 1, pageSize: 50, total: 0, hasMore: false, rejectedProductIds: [] as string[] }
    : await readCataloguePage<C>(counted, query);
  if (query.mode === "ids") page.total = page.products.length;
  const evidenceIds = query.withEvidence === false ? [] : [...new Set([...page.products.map(p => p.id), ...query.selectedIds!])];
  const [raw, names] = await Promise.all([
    readEvidenceRows(read, evidenceIds),
    query.withManufacturers ? readAllRows<{ manufacturer_name: string }>(read, "catalogue_public_manufacturers?select=manufacturer_name&order=manufacturer_name.asc") : Promise.resolve([]),
  ]);
  return { ...page, queryVersion: 1 as const, source: "database" as const, status: "ready" as const,
    manufacturers: names.map(row => row.manufacturer_name), evidence: mapEvidenceRows(raw),
    validation: { ok: true, missingCategories: [], duplicateProductIds: [], rejectedProductIds: page.rejectedProductIds, invalidProductIds: [] } };
}
