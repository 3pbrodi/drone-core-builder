import { products, type Product } from "./build-data";
import {
  catalogueEvidenceSources,
  catalogueQualityById,
  catalogueQualityReviews,
  type CatalogueIdentityStatus,
  type CatalogueTechnicalStatus,
} from "./catalogue-quality";
import { staticCatalogueEvidenceSnapshot } from "./static-catalogue-evidence";

export type DemoSeedQualityStatus =
  "unverified" | "partially_verified" | "verified" | "conflicting";

export type DemoSeedLegacyIdentityStatus = "unverified" | "pending_review" | "verified";

export type DemoSeedSpecs = {
  frame_size_inches?: number;
  motor_mount_pattern?: string;
  propeller_diameter_inches?: number;
  motor_size_code?: number;
  min_battery_cells?: number;
  max_battery_cells?: number;
  connector?: string;
  esc_input?: string;
  thrust_grams?: number;
  esc_amps?: number;
  battery_cells?: number;
  battery_capacity_mah?: number;
  video_system?: string;
  camera_video_interface?: string;
  camera_min_voltage_v?: number;
  camera_max_voltage_v?: number;
  camera_width_mm?: number;
  camera_height_mm?: number;
  camera_depth_mm?: number;
  fc_camera_video_interfaces?: string[];
  fc_camera_power_voltages_v?: number[];
  receiver_protocol?: string;
  receiver_frequency_min_mhz?: number;
  receiver_frequency_max_mhz?: number;
  receiver_min_voltage_v?: number;
  receiver_max_voltage_v?: number;
  receiver_signal_interface?: string;
  receiver_width_mm?: number;
  receiver_height_mm?: number;
  receiver_depth_mm?: number;
  fc_receiver_signal_interfaces?: string[];
  fc_receiver_power_voltages_v?: number[];
  attributes: Record<string, unknown>;
};

export type CatalogueDemoSeedProduct = {
  id: string;
  category: Product["category"];
  displayName: string;
  provisionalModelLabel: string;
  specSummary: string;
  weightGrams: number;
  illustrativePriceEur: number;
  manufacturerLabel?: string;
  exactModelCandidate?: string;
  variantCandidate?: string;
  identityQualityStatus: DemoSeedQualityStatus;
  technicalQualityStatus: DemoSeedQualityStatus;
  legacyIdentityStatus: DemoSeedLegacyIdentityStatus;
  productKind: "standalone" | "bundle" | "unknown";
  humanReviewRequired: boolean;
  issues: string[];
  remediation: string[];
  specs: DemoSeedSpecs;
  image?: Product["image"];
  rawProduct: Product;
};

export type CatalogueDemoSeedEvidence = {
  productId: string;
  field: keyof Product;
  value: unknown;
  unit?: string | null;
  sourceId: string;
  sourceName: string;
  sourceKind: "manufacturer" | "retailer" | "manual";
  sourceUrl?: string | null;
  authority: "manufacturer" | "official_documentation" | "retailer" | "community" | "internal_demo";
  exactModelAssociation: boolean;
  verificationStatus: "pending_review" | "verified";
  retrievedAt?: string | null;
  verifiedAt?: string | null;
  conditions?: Record<string, unknown>;
  caveats?: string | null;
};

export type CatalogueDemoSeedManifest = {
  datasetKey: "dronecores-demo-seed-phase-a";
  reviewedAt: "2026-09-28T00:00:00Z";
  market: "EU";
  displayCurrency: "EUR";
  products: CatalogueDemoSeedProduct[];
  evidence: CatalogueDemoSeedEvidence[];
};

function qualityStatus(
  status: CatalogueIdentityStatus | CatalogueTechnicalStatus,
): DemoSeedQualityStatus {
  if (status === "partially-verified") return "partially_verified";
  return status;
}

function legacyIdentityStatus(status: CatalogueIdentityStatus): DemoSeedLegacyIdentityStatus {
  if (status === "verified") return "verified";
  if (status === "unverified") return "unverified";
  return "pending_review";
}

function demoSpecs(product: Product): DemoSeedSpecs {
  return {
    ...(product.frameInches !== undefined ? { frame_size_inches: product.frameInches } : {}),
    ...(product.mount !== undefined ? { motor_mount_pattern: product.mount } : {}),
    ...(product.propInches !== undefined ? { propeller_diameter_inches: product.propInches } : {}),
    ...(product.motorSize !== undefined ? { motor_size_code: product.motorSize } : {}),
    ...(product.minVoltage !== undefined ? { min_battery_cells: product.minVoltage } : {}),
    ...(product.maxVoltage !== undefined ? { max_battery_cells: product.maxVoltage } : {}),
    ...(product.connector !== undefined ? { connector: product.connector } : {}),
    ...(product.escInput !== undefined ? { esc_input: product.escInput } : {}),
    ...(product.thrust !== undefined ? { thrust_grams: product.thrust } : {}),
    ...(product.escAmps !== undefined ? { esc_amps: product.escAmps } : {}),
    ...(product.voltage !== undefined ? { battery_cells: product.voltage } : {}),
    ...(product.batteryMah !== undefined ? { battery_capacity_mah: product.batteryMah } : {}),
    ...(product.video !== undefined ? { video_system: product.video } : {}),
    ...(product.cameraVideoInterface !== undefined
      ? { camera_video_interface: product.cameraVideoInterface }
      : {}),
    ...(product.cameraMinVoltageV !== undefined
      ? { camera_min_voltage_v: product.cameraMinVoltageV }
      : {}),
    ...(product.cameraMaxVoltageV !== undefined
      ? { camera_max_voltage_v: product.cameraMaxVoltageV }
      : {}),
    ...(product.cameraWidthMm !== undefined ? { camera_width_mm: product.cameraWidthMm } : {}),
    ...(product.cameraHeightMm !== undefined ? { camera_height_mm: product.cameraHeightMm } : {}),
    ...(product.cameraDepthMm !== undefined ? { camera_depth_mm: product.cameraDepthMm } : {}),
    ...(product.fcCameraVideoInterfaces !== undefined
      ? { fc_camera_video_interfaces: product.fcCameraVideoInterfaces }
      : {}),
    ...(product.fcCameraPowerVoltagesV !== undefined
      ? { fc_camera_power_voltages_v: product.fcCameraPowerVoltagesV }
      : {}),
    ...(product.receiverProtocol !== undefined
      ? { receiver_protocol: product.receiverProtocol }
      : {}),
    ...(product.receiverFrequencyMinMhz !== undefined
      ? { receiver_frequency_min_mhz: product.receiverFrequencyMinMhz }
      : {}),
    ...(product.receiverFrequencyMaxMhz !== undefined
      ? { receiver_frequency_max_mhz: product.receiverFrequencyMaxMhz }
      : {}),
    ...(product.receiverMinVoltageV !== undefined
      ? { receiver_min_voltage_v: product.receiverMinVoltageV }
      : {}),
    ...(product.receiverMaxVoltageV !== undefined
      ? { receiver_max_voltage_v: product.receiverMaxVoltageV }
      : {}),
    ...(product.receiverSignalInterface !== undefined
      ? { receiver_signal_interface: product.receiverSignalInterface }
      : {}),
    ...(product.receiverWidthMm !== undefined
      ? { receiver_width_mm: product.receiverWidthMm }
      : {}),
    ...(product.receiverHeightMm !== undefined
      ? { receiver_height_mm: product.receiverHeightMm }
      : {}),
    ...(product.receiverDepthMm !== undefined
      ? { receiver_depth_mm: product.receiverDepthMm }
      : {}),
    ...(product.fcReceiverSignalInterfaces !== undefined
      ? { fc_receiver_signal_interfaces: product.fcReceiverSignalInterfaces }
      : {}),
    ...(product.fcReceiverPowerVoltagesV !== undefined
      ? { fc_receiver_power_voltages_v: product.fcReceiverPowerVoltagesV }
      : {}),
    attributes: {
      seedValueSemantics:
        "Demo values are unverified unless matching verified field evidence exists.",
      ...(product.current !== undefined
        ? {
            demoMotorCurrentAmps: product.current,
            demoMotorCurrentRatingType: "unknown",
          }
        : {}),
    },
  };
}

function sourceKind(sourceType: "manufacturer" | "retailer" | "internal") {
  if (sourceType === "internal") return "manual" as const;
  return sourceType;
}

export function buildCatalogueDemoSeedManifest(): CatalogueDemoSeedManifest {
  const sourceById = new Map(catalogueEvidenceSources.map((source) => [source.id, source]));

  const seedProducts = products.map((product) => {
    const review = catalogueQualityById.get(product.id);
    if (!review) {
      throw new Error(`Missing Phase A quality review for demo product ${product.id}.`);
    }

    return {
      id: product.id,
      category: product.category,
      displayName: product.name,
      provisionalModelLabel: product.name,
      specSummary: product.spec,
      weightGrams: product.weight,
      illustrativePriceEur: product.price,
      ...(review.manufacturer ? { manufacturerLabel: review.manufacturer } : {}),
      ...(review.exactModel ? { exactModelCandidate: review.exactModel } : {}),
      ...(review.variant ? { variantCandidate: review.variant } : {}),
      identityQualityStatus: qualityStatus(review.identityStatus),
      technicalQualityStatus: qualityStatus(review.technicalStatus),
      legacyIdentityStatus: legacyIdentityStatus(review.identityStatus),
      productKind: review.productKind,
      humanReviewRequired: review.humanReviewRequired,
      issues: [...review.issues],
      remediation: [...review.remediation],
      specs: demoSpecs(product),
      ...(product.image ? { image: product.image } : {}),
      rawProduct: product,
    } satisfies CatalogueDemoSeedProduct;
  });

  const evidence = staticCatalogueEvidenceSnapshot.fields.map((field) => {
    const source = sourceById.get(field.sourceId);
    if (!source) {
      throw new Error(
        `Missing Phase A evidence source ${field.sourceId} for ${field.productId}.${String(field.field)}.`,
      );
    }

    const canBeVerified =
      field.verificationStatus === "verified" &&
      field.exactModelAssociation &&
      field.retrievedAt != null &&
      field.verifiedAt != null;

    return {
      productId: field.productId,
      field: field.field,
      value: field.value,
      ...(field.unit !== undefined ? { unit: field.unit } : {}),
      sourceId: field.sourceId,
      sourceName: source.sourceName,
      sourceKind: sourceKind(source.sourceType),
      ...(field.sourceUrl !== undefined ? { sourceUrl: field.sourceUrl } : {}),
      authority: field.authority,
      exactModelAssociation: field.exactModelAssociation,
      verificationStatus: canBeVerified ? "verified" : "pending_review",
      ...(field.retrievedAt !== undefined ? { retrievedAt: field.retrievedAt } : {}),
      ...(canBeVerified && field.verifiedAt !== undefined ? { verifiedAt: field.verifiedAt } : {}),
      ...(field.conditions !== undefined ? { conditions: field.conditions } : {}),
      ...(field.caveats !== undefined ? { caveats: field.caveats } : {}),
    } satisfies CatalogueDemoSeedEvidence;
  });

  if (seedProducts.length !== catalogueQualityReviews.length) {
    throw new Error("Demo seed product count does not match the Phase A quality review count.");
  }

  return {
    datasetKey: "dronecores-demo-seed-phase-a",
    reviewedAt: "2026-09-28T00:00:00Z",
    market: "EU",
    displayCurrency: "EUR",
    products: seedProducts,
    evidence,
  };
}

export const catalogueDemoSeedManifest = buildCatalogueDemoSeedManifest();
