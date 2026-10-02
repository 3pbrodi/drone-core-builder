import { describe, expect, test } from "bun:test";

import { products } from "../src/lib/build-data";
import { catalogueDemoSeedManifest } from "../src/lib/catalogue-demo-seed";

describe("evidence-first demo seed manifest", () => {
  test("migrates all 20 static products with stable IDs and EU/EUR demo pricing", () => {
    const productIds = products.map((product) => product.id).sort();
    const seedIds = catalogueDemoSeedManifest.products.map((product) => product.id).sort();

    expect(seedIds).toEqual(productIds);
    expect(seedIds).toHaveLength(20);
    expect(catalogueDemoSeedManifest.market).toBe("EU");
    expect(catalogueDemoSeedManifest.displayCurrency).toBe("EUR");

    for (const product of catalogueDemoSeedManifest.products) {
      expect(product.illustrativePriceEur).toBeGreaterThanOrEqual(0);
    }
  });

  test("generic source-free demo products do not gain manufacturer or exact-model identity", () => {
    for (const product of catalogueDemoSeedManifest.products) {
      if (product.identityQualityStatus !== "unverified") continue;
      expect(product.manufacturerLabel).toBeUndefined();
      expect(product.exactModelCandidate).toBeUndefined();
      expect(product.legacyIdentityStatus).toBe("unverified");
    }
  });

  test("known Phase A conflicts remain conflicts instead of being normalized away", () => {
    const byId = new Map(
      catalogueDemoSeedManifest.products.map((product) => [product.id, product]),
    );

    for (const id of ["motors5", "props5", "battery6"]) {
      expect(byId.get(id)?.identityQualityStatus).toBe("conflicting");
      expect(byId.get(id)?.technicalQualityStatus).toBe("conflicting");
    }

    expect(byId.get("frame5")?.identityQualityStatus).toBe("partially_verified");
    expect(byId.get("frame5")?.technicalQualityStatus).toBe("conflicting");
    expect(byId.get("receiver")?.technicalQualityStatus).toBe("conflicting");
  });

  test("ambiguous demo motor current is preserved raw but is not normalized as a peak rating", () => {
    const motors = catalogueDemoSeedManifest.products.find((product) => product.id === "motors5");
    expect(motors?.rawProduct.current).toBeDefined();
    expect(
      (motors?.specs as Record<string, unknown> | undefined)?.peak_current_amps,
    ).toBeUndefined();
    expect(motors?.specs.attributes.demoMotorCurrentAmps).toBe(motors?.rawProduct.current);
    expect(motors?.specs.attributes.demoMotorCurrentRatingType).toBe("unknown");
  });

  test("field evidence is only marked verified when exact-model association is sufficient", () => {
    const frameMount = catalogueDemoSeedManifest.evidence.find(
      (item) => item.productId === "frame5" && item.field === "mount",
    );
    expect(frameMount?.exactModelAssociation).toBe(false);
    expect(frameMount?.verificationStatus).toBe("pending_review");

    for (const evidence of catalogueDemoSeedManifest.evidence) {
      if (evidence.verificationStatus !== "verified") continue;
      expect(evidence.exactModelAssociation).toBe(true);
      expect(evidence.retrievedAt).toBeTruthy();
      expect(evidence.verifiedAt).toBeTruthy();
    }
  });

  test("the seed carries no pair-level compatibility claims", () => {
    // Pair evidence is deliberately not inferred from the 20 demo products.
    // The existing static evidence snapshot contains only field evidence.
    expect(catalogueDemoSeedManifest.evidence.length).toBeGreaterThan(0);
  });
});
