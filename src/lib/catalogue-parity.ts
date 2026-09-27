import type { Product } from "./build-data";

export type CatalogueParityMismatch = {
  id: string;
  field: string;
  expected: unknown;
  actual: unknown;
};

export type CatalogueParityResult = {
  ok: boolean;
  missingIds: string[];
  extraIds: string[];
  mismatches: CatalogueParityMismatch[];
};

const compatibilityFields = [
  "category",
  "name",
  "spec",
  "price",
  "weight",
  "frameInches",
  "mount",
  "propInches",
  "motorSize",
  "voltage",
  "minVoltage",
  "maxVoltage",
  "connector",
  "escInput",
  "thrust",
  "current",
  "escAmps",
  "batteryMah",
  "video",
  "cameraVideoInterface",
  "cameraMinVoltageV",
  "cameraMaxVoltageV",
  "cameraWidthMm",
  "cameraHeightMm",
  "cameraDepthMm",
  "fcCameraVideoInterfaces",
  "fcCameraPowerVoltagesV",
  "receiverProtocol",
  "receiverSignalInterface",
  "receiverFrequencyMinMhz",
  "receiverFrequencyMaxMhz",
  "receiverMinVoltageV",
  "receiverMaxVoltageV",
  "receiverWidthMm",
  "receiverHeightMm",
  "receiverDepthMm",
  "fcReceiverSignalInterfaces",
  "fcReceiverPowerVoltagesV",
] as const satisfies readonly (keyof Product)[];

function sameCatalogueValue(expected: unknown, actual: unknown): boolean {
  if (Object.is(expected, actual)) return true;

  if (Array.isArray(expected) && Array.isArray(actual)) {
    return (
      expected.length === actual.length &&
      expected.every((value, index) =>
        sameCatalogueValue(value, actual[index]),
      )
    );
  }

  return false;
}

export function compareCatalogueParity(
  referenceProducts: readonly Product[],
  candidateProducts: readonly Product[],
): CatalogueParityResult {
  const referenceById = new Map(referenceProducts.map((product) => [product.id, product]));
  const candidateById = new Map(candidateProducts.map((product) => [product.id, product]));

  const missingIds = referenceProducts
    .filter((product) => !candidateById.has(product.id))
    .map((product) => product.id);
  const extraIds = candidateProducts
    .filter((product) => !referenceById.has(product.id))
    .map((product) => product.id);
  const mismatches: CatalogueParityMismatch[] = [];

  for (const reference of referenceProducts) {
    const candidate = candidateById.get(reference.id);
    if (!candidate) continue;

    for (const field of compatibilityFields) {
      if (!sameCatalogueValue(reference[field], candidate[field])) {
        mismatches.push({
          id: reference.id,
          field,
          expected: reference[field],
          actual: candidate[field],
        });
      }
    }

    const expectedImage = reference.image?.src ?? null;
    const actualImage = candidate.image?.src ?? null;
    if (expectedImage !== actualImage) {
      mismatches.push({
        id: reference.id,
        field: "image.src",
        expected: expectedImage,
        actual: actualImage,
      });
    }
  }

  return {
    ok: missingIds.length === 0 && extraIds.length === 0 && mismatches.length === 0,
    missingIds,
    extraIds,
    mismatches,
  };
}
