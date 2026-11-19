import { runtimeRowToProduct, type RuntimeProductRow } from "./catalogue-runtime-product.ts";
import { readAllRows, type RestReader } from "./catalogue-runtime-read.ts";

export const CATALOGUE_PAGE_SIZE = 50;
export type CatalogueQuery = {
  mode?: "page" | "ids";
  q?: string; category?: string; manufacturer?: string; stock?: string;
  sort?: string; page?: number; ids?: string[]; selectedIds?: string[];
  withEvidence?: boolean; withManufacturers?: boolean;
};
export type CountedReader = <T>(path: string) => Promise<{ rows: T[]; total: number }>;
const categories = ["frame", "motors", "flightController", "esc", "propellers", "battery", "camera", "receiver", "videoTransmitter", "gps", "buzzer", "antenna", "powerAccessory", "optionalModule", "radioTransmitter", "fpvGoggles", "batteryCharger", "chargingAccessory"];
const stocks = ["in_stock", "out_of_stock", "preorder", "backorder", "unknown"];

export function quoteFilter(value: string): string {
  return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}
export function inFilter(ids: readonly string[]): string {
  return `in.(${ids.map(quoteFilter).join(",")})`;
}
export function normalizeIds(input: unknown): string[] {
  if (input === undefined) return [];
  if (!Array.isArray(input) || input.length > 100 || input.some(id => typeof id !== "string" || !id.trim() || id.length > 200))
    throw new Error("Expected at most 100 nonempty product IDs.");
  return [...new Set(input as string[])];
}
export function normalizeCatalogueQuery(query: CatalogueQuery): CatalogueQuery {
  if (!query || typeof query !== "object") throw new Error("Invalid catalogue query.");
  if (query.mode && !["page", "ids"].includes(query.mode)) throw new Error("Invalid catalogue mode.");
  if (query.category && !categories.includes(query.category)) throw new Error("Invalid catalogue category.");
  if (query.stock && !stocks.includes(query.stock)) throw new Error("Invalid stock filter.");
  return { mode: "page", ...query, page: Math.min(100000, Math.max(1, Math.floor(Number(query.page) || 1))),
    q: String(query.q ?? "").replace(/[^\p{L}\p{N} ._:-]/gu, "").trim().slice(0, 150),
    manufacturer: String(query.manufacturer ?? "").trim().slice(0, 150),
    ids: normalizeIds(query.ids), selectedIds: normalizeIds(query.selectedIds) };
}

export function cataloguePageParams(query: CatalogueQuery, nowMs = Date.now()): URLSearchParams {
  const q = normalizeCatalogueQuery(query);
  const params = new URLSearchParams({ select: "*", order: q.sort === "price_asc" ? "price_amount.asc,id.asc" : q.sort === "price_desc" ? "price_amount.desc,id.asc" : "display_name.asc,id.asc",
    record_class: "eq.canonical", currency: "eq.EUR", offer_region: "eq.EU", price_amount: "gt.0", weight_grams: "gte.0" });
  if (q.category) params.set("category", `eq.${q.category}`);
  // A top-level eq value is literal (unlike values inside in/logic lists).
  // URLSearchParams escapes punctuation; extra quotes would become part of it.
  if (q.manufacturer) params.set("manufacturer_name", `eq.${q.manufacturer}`);
  const conditions = [`last_checked_at.lte.${new Date(nowMs).toISOString()}`];
  if (q.q) {
    const term = q.q.replaceAll("_", "\\_");
    conditions.push(`or(display_name.ilike.*${term}*,manufacturer_name.ilike.*${term}*,model.ilike.*${term}*,manufacturer_sku.ilike.*${term}*,mpn.ilike.*${term}*)`);
  }
  const cutoff = new Date(nowMs - 86400000).toISOString();
  if (q.stock === "unknown") conditions.push(`or(stock_status.eq.unknown,last_checked_at.lt.${cutoff},last_checked_at.is.null,offer_last_check_failed.eq.true)`);
  else if (q.stock) {
    params.set("stock_status", `eq.${q.stock}`);
    conditions.push(`last_checked_at.gte.${cutoff}`, "offer_last_check_failed.not.is.true");
  }
  params.set("and", `(${conditions.join(",")})`);
  return params;
}

/** Offset is based on examined rows, including rejected records, not output size. */
export async function readCataloguePage<C extends string>(read: CountedReader, query: CatalogueQuery) {
  const q = normalizeCatalogueQuery(query), page = q.page!, pageSize = CATALOGUE_PAGE_SIZE;
  const params = cataloguePageParams(q), start = (page - 1) * pageSize;
  const rows: RuntimeProductRow<C>[] = [];
  let total = 0;
  do {
    params.set("limit", String(pageSize - rows.length));
    params.set("offset", String(start + rows.length));
    const result = await read<RuntimeProductRow<C>>(`catalogue_public_runtime_products?${params}`);
    if (!Number.isSafeInteger(result.total) || result.total < 0) throw new Error("Catalogue count unavailable.");
    total = result.total;
    if (!result.rows.length) break;
    rows.push(...result.rows);
  } while (rows.length < pageSize && start + rows.length < total);
  const products = rows.map(row => runtimeRowToProduct(row)).filter((p): p is NonNullable<typeof p> => p !== null);
  return { products, page, pageSize, total, hasMore: start + rows.length < total,
    rejectedProductIds: rows.filter(row => !products.some(p => p.id === row?.id)).map(row => row?.id ?? "invalid") };
}

export async function readCatalogueIds<C extends string>(read: RestReader, ids: readonly string[]) {
  if (!ids.length) return [];
  const params = new URLSearchParams({ select: "*", id: inFilter(ids), order: "id.asc" });
  const rows = await readAllRows<RuntimeProductRow<C>>(read, `catalogue_public_runtime_products?${params}`);
  return rows.map(row => runtimeRowToProduct(row)).filter((p): p is NonNullable<typeof p> => p !== null);
}
