import { describe, expect, test } from "bun:test";

import { money, productPriceLabel, type Product } from "../src/lib/build-data";

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "availability-test",
    category: "camera",
    name: "Availability Test Camera",
    spec: "Test fixture",
    price: 42.5,
    weight: 10,
    ...overrides,
  };
}

describe("product availability price labels", () => {
  test("shows the EUR price for products that are not explicitly out of stock", () => {
    expect(productPriceLabel(product({ stockStatus: "in_stock" }))).toBe(money(42.5));
    expect(productPriceLabel(product({ stockStatus: "unknown" }))).toBe(money(42.5));
    expect(productPriceLabel(product())).toBe(money(42.5));
  });

  test("replaces the price with Out of Stock without making the product unselectable", () => {
    const unavailable = product({ stockStatus: "out_of_stock" });

    expect(productPriceLabel(unavailable)).toBe("Out of Stock");
    expect(unavailable.id).toBe("availability-test");
  });

  test("preorder and backorder keep their verified offer price", () => {
    expect(productPriceLabel(product({ stockStatus: "preorder" }))).toBe(money(42.5));
    expect(productPriceLabel(product({ stockStatus: "backorder" }))).toBe(money(42.5));
  });
});
