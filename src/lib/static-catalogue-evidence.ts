import type { Product } from "./build-data";
import type { SelectedProducts } from "./build-calculations";
import {
  catalogueEvidenceSources,
  catalogueQualityById,
} from "./catalogue-quality";
import {
  emptyCatalogueEvidenceSnapshot,
  resolveCompatibilityEvidence,
  type CatalogueFieldEvidence,
} from "./catalogue-evidence";

const sourceById = new Map(
  catalogueEvidenceSources.map((source) => [source.id, source]),
);

function verifiedField(
  productId: string,
  field: keyof Product,
  value: string | number | boolean,
  sourceId: string,
  unit?: string,
): CatalogueFieldEvidence {
  const source = sourceById.get(sourceId);
  if (!source) {
    throw new Error(`Missing catalogue evidence source: ${sourceId}`);
  }

  const review = catalogueQualityById.get(productId);
  if (!review) {
    throw new Error(`Missing catalogue quality review: ${productId}`);
  }

  const timestamp = `${source.checkedAt}T00:00:00Z`;

  return {
    productId,
    field,
    value,
    ...(unit ? { unit } : {}),
    sourceId,
    sourceUrl: source.url ?? null,
    authority:
      source.sourceType === "manufacturer" ? "manufacturer" : "internal_demo",
    exactModelAssociation: source.exactModelAssociation,
    verificationStatus: "verified",
    retrievedAt: timestamp,
    verifiedAt: timestamp,
    conditions: {},
    caveats: null,
  };
}

const snapshot = emptyCatalogueEvidenceSnapshot();

snapshot.fields.push(
  verifiedField("frame5", "mount", "16x16", "iflight-evoque-f5-v2", "mm"),
  verifiedField("esc55", "escAmps", 55, "tmotor-f55a-pro-ii", "A"),
  verifiedField("esc55", "minVoltage", 3, "tmotor-f55a-pro-ii", "cells"),
  verifiedField("esc55", "maxVoltage", 6, "tmotor-f55a-pro-ii", "cells"),
  verifiedField("cameraFpv", "weight", 9, "runcam-phoenix-2", "g"),
  verifiedField("cameraFpv", "video", "analog", "runcam-phoenix-2"),
  verifiedField("receiver", "weight", 0.5, "tbs-crossfire-nano-rx", "g"),
);

export const staticCatalogueEvidenceSnapshot = snapshot;

export function resolveStaticCompatibilityEvidence(
  selected: SelectedProducts,
) {
  return resolveCompatibilityEvidence(selected, staticCatalogueEvidenceSnapshot);
}
