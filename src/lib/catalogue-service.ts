import {
  categories,
  products,
  type BuildSelection,
  type Category,
  type Product,
} from "./build-data";

export interface ProductCatalogueService {
  getAllProducts(): readonly Product[];
  getProductsByCategory(category: Category): readonly Product[];
  getProductById(id: string): Product | undefined;
  getProductsByIds(ids: readonly string[]): Product[];
}

class StaticProductCatalogueService implements ProductCatalogueService {
  private readonly allProducts: readonly Product[];
  private readonly productsById: ReadonlyMap<string, Product>;
  private readonly productsByCategory: ReadonlyMap<Category, readonly Product[]>;

  constructor(sourceProducts: readonly Product[]) {
    this.allProducts = [...sourceProducts];
    this.productsById = new Map(sourceProducts.map((product) => [product.id, product]));

    this.productsByCategory = new Map(
      categories.map((category) => [
        category,
        sourceProducts.filter((product) => product.category === category),
      ]),
    );
  }

  getAllProducts() {
    return this.allProducts;
  }

  getProductsByCategory(category: Category) {
    return this.productsByCategory.get(category) ?? [];
  }

  getProductById(id: string) {
    return this.productsById.get(id);
  }

  getProductsByIds(ids: readonly string[]) {
    return ids.flatMap((id) => {
      const product = this.getProductById(id);
      return product ? [product] : [];
    });
  }
}

export const productCatalogue: ProductCatalogueService =
  new StaticProductCatalogueService(products);

export function resolveBuildSelection(
  selection: BuildSelection,
  catalogue: ProductCatalogueService = productCatalogue,
): Partial<Record<Category, Product>> {
  return Object.fromEntries(
    categories.map((category) => {
      const id = selection[category];
      return [category, id ? catalogue.getProductById(id) : undefined];
    }),
  ) as Partial<Record<Category, Product>>;
}

export function normalizeBuildSelection(
  selection: BuildSelection,
  catalogue: ProductCatalogueService = productCatalogue,
): BuildSelection {
  const normalized: BuildSelection = {};

  for (const category of categories) {
    const id = selection[category];
    if (!id) continue;

    const product = catalogue.getProductById(id);
    if (product?.category === category) {
      normalized[category] = id;
    }
  }

  return normalized;
}
