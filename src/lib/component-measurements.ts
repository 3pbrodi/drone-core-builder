import type { Product } from "./build-data";

/** Existing configurator is a quad: quantities are explicit build requirements,
 * not manufacturer specifications or sales-pack sizes. */
export function installedQuantity(product: Product): number {
  return product.category === "motors" || product.category === "propellers" ? 4 : 1;
}
export function productPurchaseQuantity(product: Product): number {
  if (product.packageQuantity && product.packageQuantity > 0) return Math.ceil(installedQuantity(product) / product.packageQuantity);
  return 1; // Existing demo/legacy set prices; the AI excludes unknown motor/prop pack counts.
}
export function installedComponentWeight(product: Product): number | null {
  // A per-item basis describes quantity, not installation completeness.
  // Legacy reviewed receivers explicitly exclude their supplied antennas.
  if (/\b(?:without|excluding)\s+(?:the\s+)?antennas?\b/i.test(product.weightScope ?? "")) return null;
  if (!product.weightBasis) {
    if (product.offer && (product.category === "motors" || product.category === "propellers")) return null;
    return product.weight;
  }
  if (product.weightBasis === "partial" || !product.weightUnitQuantity) return null;
  if (product.weightBasis === "installed_set" && product.weightUnitQuantity !== installedQuantity(product)) return null;
  if (product.weightBasis === "per_package" && product.weightUnitQuantity !== product.packageQuantity) return null;
  return product.weight * installedQuantity(product) / product.weightUnitQuantity;
}
export function productWeightLabel(product: Product): string {
  if (!product.weightBasis) return `${product.weight} g`;
  const basis = product.weightBasis === "per_item" ? "per item" : product.weightBasis === "per_package" ? `per ${product.weightUnitQuantity}-item pack` : product.weightBasis === "installed_set" ? `per ${product.weightUnitQuantity}-item installed set` : "partial component mass";
  return `${product.weight} g · ${basis} · ${product.weightScope}`;
}
