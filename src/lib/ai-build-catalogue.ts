import type { Product } from "./build-data";
import type { CatalogueQuery } from "../../supabase/functions/_shared/catalogue-query";
import type { PublicCatalogueResult } from "./catalogue-public-query";
import { mergeComponentEvidence } from "./component-product-filters";
import type { CatalogueEvidenceSnapshot } from "./catalogue-evidence";

/** All product pages and exact-ID evidence; no 1000-row cutoff or demo fallback. */
export async function loadAiBuildCatalogue(
  read: (query: CatalogueQuery) => Promise<PublicCatalogueResult>,
  active: () => boolean = () => true,
) {
  const found = new Map<string, Product>();
  for (let page = 1; page <= 100000; page++) {
    if (!active()) return null;
    const result = await read({
      mode: "page",
      page,
      withEvidence: false,
      withManufacturers: false,
    });
    for (const p of result.products) found.set(p.id, p);
    if (!result.hasMore) break;
    if (page === 100000) throw new Error("Catalogue pagination did not finish.");
  }
  let evidence: CatalogueEvidenceSnapshot = {
    fields: [],
    motorPropeller: [],
    motorEscCurrent: [],
    fcEscConnection: [],
  };
  const products = new Map<string, Product>(),
    ids = [...found.keys()];
  const exact = async (subset: string[]) => {
    if (!active()) return false;
    const result = await read({
      mode: "ids",
      ids: subset,
      withEvidence: true,
      withManufacturers: false,
    });
    for (const p of result.products) products.set(p.id, p);
    evidence = mergeComponentEvidence(evidence, result.evidence);
    return true;
  };
  for (let offset = 0; offset < ids.length; offset += 100)
    if (!(await exact(ids.slice(offset, offset + 100)))) return null;
  // Fetch both sides together: pair evidence can cross the original page/ID chunks.
  for (const [left, right] of [
    ["motors", "propellers"],
    ["motors", "esc"],
    ["flightController", "esc"],
  ]) {
    const l = [...products.values()].filter((p) => p.category === left).map((p) => p.id),
      r = [...products.values()].filter((p) => p.category === right).map((p) => p.id);
    for (let i = 0; i < l.length; i += 50)
      for (let j = 0; j < r.length; j += 50)
        if (!(await exact([...l.slice(i, i + 50), ...r.slice(j, j + 50)]))) return null;
  }
  return { products: [...products.values()], evidence };
}
