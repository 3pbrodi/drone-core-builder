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
    expect(runtimeProducts.find((product) => product.category === "camera")?.stockStatus)
      .toBe("out_of_stock");
  });

  test("fails closed when a component category is missing", () => {
    const withoutReceiver = runtimeProducts.filter(
      (product) => product.category !== "receiver",
    );
    const validation = validateRuntimeCatalogue(withoutReceiver);

    expect(validation.ok).toBe(false);
    expect(validation.missingCategories).toEqual(["receiver"]);
  });

  test("rebases legacy template IDs onto available verified runtime products", () => {
    const catalogue = createProductCatalogue(runtimeProducts);
    const rebased = rebaseBuildSelectionToCatalogue(
      {
        frame: "frame5",
        motors: "motors5",
        flightController: "fcF7",
        esc: "esc55",
        propellers: "props5",
        battery: "battery6",
        camera: "cameraFpv",
        receiver: "receiver",
      },
      catalogue,
    );

    for (const category of categories) {
      expect(rebased[category]).toBe(`runtime-${category}`);
    }
  });

  test("preserves an already-valid runtime selection", () => {
    const catalogue = createProductCatalogue(runtimeProducts);
    const selection = Object.fromEntries(
      categories.map((category) => [category, `runtime-${category}`]),
    );
    const rebased = rebaseBuildSelectionToCatalogue(selection, catalogue);

    expect(rebased).toEqual(selection);
  });
});
