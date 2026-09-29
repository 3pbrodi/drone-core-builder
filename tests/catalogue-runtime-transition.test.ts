import { describe, expect, test } from "bun:test";
import { categories, type Product } from "../src/lib/build-data";
import {
  createProductCatalogue,
  rebaseBuildSelectionToCatalogue,
} from "../src/lib/catalogue-service";
import { validateRuntimeCatalogue } from "../src/lib/catalogue-runtime";

const runtimeProducts: Product[] = categories.map((category, index) => ({
  id: `runtime-${category}`,
  category,
  name: `Runtime ${category}`,
  spec: "Verified runtime fixture",
  price: 10 + index,
  weight: 20 + index,
  stockStatus: category === "camera" ? "out_of_stock" : "in_stock",
}));

describe("verified runtime catalogue cutover", () => {
  test("accepts complete category coverage including out-of-stock products", () => {
    const validation = validateRuntimeCatalogue(runtimeProducts);
    expect(validation.ok).toBe(true);
    expect(validation.missingCategories).toEqual([]);
    expect(runtimeProducts.find((product) => product.category === "camera")?.stockStatus).toBe(
      "out_of_stock",
    );
  });
  test("fails closed when a component category is missing", () => {
    const validation = validateRuntimeCatalogue(
      runtimeProducts.filter((product) => product.category !== "receiver"),
    );
    expect(validation.ok).toBe(false);
    expect(validation.missingCategories).toEqual(["receiver"]);
  });
  test("does not replace legacy template IDs with arbitrary first-in-category products", () => {
    const catalogue = createProductCatalogue(runtimeProducts);
    expect(
      rebaseBuildSelectionToCatalogue({ frame: "frame5", motors: "motors5" }, catalogue),
    ).toEqual({});
  });
  test("semantically rebases legacy IDs when typed runtime fields preserve intent", () => {
    const catalogue = createProductCatalogue([
      ...runtimeProducts,
      {
        id: "runtime-frame-5-match",
        category: "frame",
        name: "Verified five inch",
        spec: "5 inch",
        price: 50,
        weight: 100,
        frameInches: 5,
        mount: "16x16",
      },
    ]);
    expect(rebaseBuildSelectionToCatalogue({ frame: "frame5" }, catalogue).frame).toBe(
      "runtime-frame-5-match",
    );
  });
  test("preserves an already-valid runtime selection", () => {
    const catalogue = createProductCatalogue(runtimeProducts);
    const selection = Object.fromEntries(
      categories.map((category) => [category, `runtime-${category}`]),
    );
    expect(rebaseBuildSelectionToCatalogue(selection, catalogue)).toEqual(selection);
  });
});
