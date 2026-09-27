import { describe, expect, test } from "bun:test";

import { products } from "../src/lib/build-data";
import {
  catalogueEvidenceSources,
  catalogueQualityById,
  catalogueQualityReviews,
} from "../src/lib/catalogue-quality";

describe("Phase A catalogue quality registry", () => {
  test("covers every static product exactly once without changing stable IDs", () => {
    const productIds = products.map((product) => product.id);
    const reviewIds = catalogueQualityReviews.map((review) => review.productId);

    expect(new Set(productIds).size).toBe(productIds.length);
    expect(new Set(reviewIds).size).toBe(reviewIds.length);
    expect(reviewIds.sort()).toEqual(productIds.sort());
  });

  test("review categories match the live catalogue and prices remain illustrative", () => {
    for (const product of products) {
      const review = catalogueQualityById.get(product.id);
      expect(review).toBeDefined();
      expect(review?.category).toBe(product.category);
      expect(review?.priceStatus).toBe("illustrative");
    }
  });

  test("every referenced source exists and external evidence uses HTTPS", () => {
    const sourcesById = new Map(catalogueEvidenceSources.map((source) => [source.id, source]));

    for (const review of catalogueQualityReviews) {
      for (const sourceId of review.sourceIds) {
        const source = sourcesById.get(sourceId);
        expect(source).toBeDefined();
        if (source?.url) {
          expect(source.url.startsWith("https://")).toBe(true);
        }
      }
    }
  });

  test("known ambiguous demo records stay conflicting instead of being silently corrected", () => {
    expect(catalogueQualityById.get("props5")?.identityStatus).toBe("conflicting");
    expect(catalogueQualityById.get("motors5")?.identityStatus).toBe("conflicting");
    expect(catalogueQualityById.get("battery6")?.identityStatus).toBe("conflicting");
    expect(catalogueQualityById.get("fcF7")?.technicalStatus).toBe("conflicting");
  });

  test("source-backed exact identities remain separate from technical completeness", () => {
    expect(catalogueQualityById.get("frame5")?.identityStatus).toBe("verified");
    expect(catalogueQualityById.get("frame5")?.technicalStatus).toBe("partially-verified");
    expect(catalogueQualityById.get("cameraFpv")?.identityStatus).toBe("verified");
    expect(catalogueQualityById.get("receiver")?.identityStatus).toBe("verified");
  });

  test("generic demo products remain available but explicitly unverified", () => {
    for (const id of [
      "frame7",
      "frame3",
      "motors7",
      "motors3",
      "fcF4",
      "esc20",
      "props7",
      "battery6long",
      "battery4",
      "camera4k",
      "receiver2",
    ]) {
      expect(catalogueQualityById.get(id)?.identityStatus).toBe("unverified");
    }
  });
});
