import { runtimeRowToProduct, type RuntimeProductRow } from "./catalogue-runtime-product.ts";
export type RestReader = <T>(path: string) => Promise<T>;
// Advance by the number actually returned, even if the server caps our page size.
export async function readAllRows<T>(read: RestReader, path: string): Promise<T[]> {
  const rows: T[] = [];
  for (;;) {
    const page = await read<T[]>(`${path}${path.includes("?") ? "&" : "?"}limit=500&offset=${rows.length}`);
    if (!page.length) return rows;
    rows.push(...page);
  }
}
export async function loadRuntimeProducts<C extends string>(read: RestReader) {
  const rows = await readAllRows<RuntimeProductRow<C>>(read, "catalogue_public_runtime_products?select=*&order=id.asc");
  const products = []; const rejectedProductIds: string[] = [];
  for (const row of rows) { const product = runtimeRowToProduct(row); if(product) products.push(product); else rejectedProductIds.push(row?.id ?? "invalid"); }
  return { products, rejectedProductIds };
}
