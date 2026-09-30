import { describe, expect, test } from "bun:test";
import {
  enumerateJsonLdProductVariants,
  enumerateShopifyProductVariants,
  requireStableLogicalRunId,
} from "../supabase/functions/_shared/catalogue-import-core";

describe("manufacturer variant identity", () => {
  test("enumerates every Shopify variant with upstream product and variant identity", () => {
    const variants = enumerateShopifyProductVariants(
      {
        id: 100,
        title: "XING2 2207",
        handle: "xing2-2207",
        variants: [
          { id: 1001, title: "1855KV", sku: "X2-1855" },
          { id: 1002, title: "1960KV", sku: "X2-1960" },
        ],
      },
      "https://example.test",
    );

    expect(variants).toHaveLength(2);
    expect(variants.map((item) => item.upstreamItemId)).toEqual([
      "shopify:variant:1001",
      "shopify:variant:1002",
    ]);
    expect(variants.map((item) => item.upstreamParentProductId)).toEqual([
      "shopify:product:100",
      "shopify:product:100",
    ]);
    expect(variants.map((item) => item.variant)).toEqual(["1855KV", "1960KV"]);
    expect(variants.map((item) => item.manufacturerSku)).toEqual(["X2-1855", "X2-1960"]);
  });

  test("preserves repeated Shopify SKUs but marks them as conflicting identities", () => {
    const variants = enumerateShopifyProductVariants(
      {
        id: 200,
        title: "Receiver",
        handle: "receiver",
        variants: [
          { id: 2001, title: "915 MHz", sku: "RX-SAME" },
          { id: 2002, title: "2.4 GHz", sku: "RX-SAME" },
        ],
      },
      "https://example.test",
    );

    expect(variants.map((item) => item.manufacturerSku)).toEqual(["RX-SAME", "RX-SAME"]);
    expect(variants[0]?.identityConflicts).toContain("repeated_manufacturer_sku");
    expect(variants[1]?.identityConflicts).toContain("repeated_manufacturer_sku");
    expect(variants[0]?.upstreamItemId).not.toBe(variants[1]?.upstreamItemId);
  });

  test("uses deterministic fingerprints when Shopify variant IDs are missing", () => {
    const product = {
      id: 300,
      title: "Battery",
      handle: "battery",
      variants: [
        { title: "XT60 / 1300mAh", sku: "", option1: "XT60", option2: "1300mAh" },
        { title: "XT30 / 1300mAh", sku: "", option1: "XT30", option2: "1300mAh" },
      ],
    };

    const first = enumerateShopifyProductVariants(product, "https://example.test");
    const second = enumerateShopifyProductVariants(product, "https://example.test");

    expect(first.map((item) => item.upstreamItemId)).toEqual(
      second.map((item) => item.upstreamItemId),
    );
    expect(new Set(first.map((item) => item.upstreamItemId)).size).toBe(2);
    expect(first.every((item) => item.upstreamVariantId === null)).toBe(true);
  });

  test("keeps missing-ID Shopify variant fingerprints stable when variant order changes", () => {
    const first = enumerateShopifyProductVariants(
      {
        id: 301,
        title: "Battery",
        handle: "battery",
        variants: [
          { title: "XT60", sku: "BAT-XT60", position: 1 },
          { title: "XT30", sku: "BAT-XT30", position: 2 },
        ],
      },
      "https://example.test",
    );
    const reordered = enumerateShopifyProductVariants(
      {
        id: 301,
        title: "Battery",
        handle: "battery",
        variants: [
          { title: "XT30", sku: "BAT-XT30", position: 1 },
          { title: "XT60", sku: "BAT-XT60", position: 2 },
        ],
      },
      "https://example.test",
    );

    const bySku = (items: typeof first) =>
      Object.fromEntries(items.map((item) => [item.manufacturerSku, item.upstreamItemId]));
    expect(bySku(reordered)).toEqual(bySku(first));
  });

  test("requires an explicit stable logical run ID for write-mode callers", () => {
    expect(requireStableLogicalRunId("  importer-2026-09-30  ")).toBe("importer-2026-09-30");
    expect(() => requireStableLogicalRunId("")).toThrow();
    expect(() => requireStableLogicalRunId("x".repeat(201))).toThrow();
  });

  test("enumerates JSON-LD ProductGroup variants instead of collapsing the group", () => {
    const html = `
      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "ProductGroup",
        "name": "Motor 2207",
        "productGroupID": "motor-2207",
        "hasVariant": [
          {"@type":"Product","@id":"motor-2207-1750","name":"Motor 2207 1750KV","sku":"M1750","model":"1750KV"},
          {"@type":"Product","@id":"motor-2207-1950","name":"Motor 2207 1950KV","sku":"M1950","model":"1950KV"}
        ]
      }
      </script>
    `;

    const variants = enumerateJsonLdProductVariants(html, "https://example.test/motor");
    expect(variants).toHaveLength(2);
    expect(variants.map((item) => item.manufacturerSku)).toEqual(["M1750", "M1950"]);
    expect(variants.map((item) => item.variant)).toEqual([
      "1750KV / Motor 2207 1750KV",
      "1950KV / Motor 2207 1950KV",
    ]);
    expect(new Set(variants.map((item) => item.upstreamItemId)).size).toBe(2);
  });

  test("marks repeated JSON-LD MPNs across materially different variants", () => {
    const html = `
      <script type="application/ld+json">
      {
        "@type":"ProductGroup",
        "name":"Camera",
        "productGroupID":"cam",
        "hasVariant":[
          {"@type":"Product","@id":"cam-a","name":"Camera Analog","mpn":"CAM-1","model":"Analog"},
          {"@type":"Product","@id":"cam-hd","name":"Camera HD","mpn":"CAM-1","model":"HD"}
        ]
      }
      </script>
    `;
    const variants = enumerateJsonLdProductVariants(html, "https://example.test/camera");
    expect(variants.every((item) => item.identityConflicts.includes("repeated_mpn"))).toBe(true);
  });
});
