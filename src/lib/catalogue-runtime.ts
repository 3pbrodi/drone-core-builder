import { categories, type Category, type Product } from "./build-data";

export type RuntimeCatalogueValidation = {
  ok: boolean;
  missingCategories: Category[];
  duplicateProductIds: string[];
  rejectedProductIds: string[];
  invalidProductIds: string[];
};

export function validateRuntimeCatalogue(
  products: readonly Product[],
  rejectedProductIds: readonly string[] = [],
): RuntimeCatalogueValidation {
  const ids = new Set<string>();
  const duplicateProductIds = new Set<string>();
  const invalidProductIds: string[] = [];

  for (const product of products) {
    if (ids.has(product.id)) duplicateProductIds.add(product.id);
    ids.add(product.id);

    if (
      !Number.isFinite(product.price) ||
      product.price < 0 ||
      !Number.isFinite(product.weight) ||
      product.weight < 0
    ) {
      invalidProductIds.push(product.id);
    }
  }

  const missingCategories = categories.filter(
    (category) => !products.some((product) => product.category === category),
  );

  return {
    ok:
      products.length > 0 &&
      missingCategories.length === 0 &&
      duplicateProductIds.size === 0 &&
      rejectedProductIds.length === 0 &&
      invalidProductIds.length === 0,
    missingCategories,
    duplicateProductIds: [...duplicateProductIds],
    rejectedProductIds: [...rejectedProductIds],
    invalidProductIds,
  };
}
