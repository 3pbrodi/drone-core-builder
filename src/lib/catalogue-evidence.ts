import type { Product } from "./build-data";
import type {
  CompatibilityTechnicalEvidence,
  CompatibilityVerification,
  CurrentRatingType,
  SelectedProducts,
} from "./build-calculations";

export type EvidenceVerificationStatus = "unverified" | "pending_review" | "verified" | "rejected";

export type CatalogueEvidenceAuthority =
  "manufacturer" | "official_documentation" | "retailer" | "community" | "internal_demo";

export type CatalogueFieldEvidence = {
  productId: string;
  field: keyof Product;
  value: unknown;
  unit?: string | null;
  sourceId: string;
  sourceUrl?: string | null;
  authority: CatalogueEvidenceAuthority;
  exactModelAssociation: boolean;
  verificationStatus: EvidenceVerificationStatus;
  retrievedAt?: string | null;
  verifiedAt?: string | null;
  conditions?: Record<string, unknown>;
  caveats?: string | null;
};

export type CatalogueMotorPropellerEvidence = {
  motorId: string;
  propellerId: string;
  result: "compatible" | "incompatible";
  authority: CatalogueEvidenceAuthority;
  exactProductsVerified: boolean;
  verificationStatus: EvidenceVerificationStatus;
  retrievedAt?: string | null;
  verifiedAt?: string | null;
  operatingConditions: Record<string, unknown>;
};

export type CatalogueMotorEscCurrentEvidence = {
  motorId: string;
  escId: string;
  motorCurrentAmps: number;
  motorRatingType: CurrentRatingType;
  escCurrentAmps: number;
  escRatingType: CurrentRatingType;
  exactProductsVerified: boolean;
  ratingTypesVerified: boolean;
  motorOperatingConditionsVerified: boolean;
  verificationStatus: EvidenceVerificationStatus;
  retrievedAt?: string | null;
  verifiedAt?: string | null;
  operatingConditions: Record<string, unknown>;
};

export type CatalogueFcEscConnectionEvidence = {
  flightControllerId: string;
  escId: string;
  result: "compatible" | "incompatible";
  authority: CatalogueEvidenceAuthority;
  exactProductsVerified: boolean;
  connectorFamilyVerified: boolean;
  pinoutVerified: boolean;
  wireOrderVerified: boolean;
  signalCompatibilityVerified: boolean;
  voltageCompatibilityVerified: boolean;
  verificationStatus: EvidenceVerificationStatus;
  retrievedAt?: string | null;
  verifiedAt?: string | null;
};

export type CatalogueEvidenceSnapshot = {
  fields: CatalogueFieldEvidence[];
  motorPropeller: CatalogueMotorPropellerEvidence[];
  motorEscCurrent: CatalogueMotorEscCurrentEvidence[];
  fcEscConnection: CatalogueFcEscConnectionEvidence[];
};

export type ResolvedCompatibilityEvidence = {
  verification: CompatibilityVerification;
  technicalEvidence: CompatibilityTechnicalEvidence;
};

function sameEvidenceValue(actual: unknown, expected: unknown): boolean {
  if (Object.is(actual, expected)) return true;

  if (Array.isArray(actual) && Array.isArray(expected)) {
    return (
      actual.length === expected.length &&
      actual.every((value, index) => sameEvidenceValue(value, expected[index]))
    );
  }

  if (
    actual !== null &&
    expected !== null &&
    typeof actual === "object" &&
    typeof expected === "object"
  ) {
    const actualRecord = actual as Record<string, unknown>;
    const expectedRecord = expected as Record<string, unknown>;
    const actualKeys = Object.keys(actualRecord);
    const expectedKeys = Object.keys(expectedRecord);

    return (
      actualKeys.length === expectedKeys.length &&
      actualKeys.every((key) => sameEvidenceValue(actualRecord[key], expectedRecord[key]))
    );
  }

  return false;
}

function isVerifiedFieldEvidence(evidence: CatalogueFieldEvidence, product: Product) {
  return (
    evidence.productId === product.id &&
    evidence.verificationStatus === "verified" &&
    evidence.exactModelAssociation &&
    evidence.retrievedAt != null &&
    evidence.verifiedAt != null &&
    sameEvidenceValue(product[evidence.field], evidence.value)
  );
}

function pushVerifiedField(
  verification: CompatibilityVerification,
  category: Product["category"],
  field: keyof Product,
) {
  const current = verification[category] ?? [];
  if (!current.includes(field)) {
    verification[category] = [...current, field];
  }
}

export function resolveCompatibilityEvidence(
  selected: SelectedProducts,
  snapshot: CatalogueEvidenceSnapshot,
): ResolvedCompatibilityEvidence {
  const verification: CompatibilityVerification = {};

  for (const product of Object.values(selected)) {
    if (!product) continue;
    for (const fieldEvidence of snapshot.fields) {
      if (isVerifiedFieldEvidence(fieldEvidence, product)) {
        pushVerifiedField(verification, product.category, fieldEvidence.field);
      }
    }
  }

  const technicalEvidence: CompatibilityTechnicalEvidence = {};
  const motors = selected.motors;
  const propellers = selected.propellers;
  const esc = selected.esc;
  const flightController = selected.flightController;

  if (motors && propellers) {
    const pair = snapshot.motorPropeller.find(
      (item) =>
        item.motorId === motors.id &&
        item.propellerId === propellers.id &&
        item.verificationStatus === "verified" &&
        item.exactProductsVerified &&
        item.retrievedAt != null &&
        item.verifiedAt != null &&
        Object.keys(item.operatingConditions).length > 0 &&
        (item.authority === "manufacturer" || item.authority === "official_documentation"),
    );

    if (pair) {
      technicalEvidence.motorPropeller = {
        motorId: pair.motorId,
        propellerId: pair.propellerId,
        manufacturerCompatibility: pair.result,
        manufacturerEvidenceVerified: true,
        operatingConditionsVerified: true,
      };
    }
  }

  if (motors && esc) {
    const currentEvidence = snapshot.motorEscCurrent.find(
      (item) =>
        item.motorId === motors.id &&
        item.escId === esc.id &&
        item.verificationStatus === "verified" &&
        item.exactProductsVerified &&
        item.ratingTypesVerified &&
        item.motorOperatingConditionsVerified &&
        item.retrievedAt != null &&
        item.verifiedAt != null &&
        item.motorRatingType === "continuous" &&
        item.escRatingType === "continuous" &&
        Object.keys(item.operatingConditions).length > 0 &&
        Object.is(motors.current, item.motorCurrentAmps) &&
        Object.is(esc.escAmps, item.escCurrentAmps),
    );

    if (currentEvidence) {
      pushVerifiedField(verification, "motors", "current");
      pushVerifiedField(verification, "esc", "escAmps");
      technicalEvidence.motorEscCurrent = {
        motorId: currentEvidence.motorId,
        escId: currentEvidence.escId,
        motorRatingType: currentEvidence.motorRatingType,
        escRatingType: currentEvidence.escRatingType,
        ratingTypesVerified: true,
        motorOperatingConditionsVerified: true,
      };
    }
  }

  if (flightController && esc) {
    const connection = snapshot.fcEscConnection.find(
      (item) =>
        item.flightControllerId === flightController.id &&
        item.escId === esc.id &&
        item.verificationStatus === "verified" &&
        item.exactProductsVerified &&
        item.connectorFamilyVerified &&
        item.pinoutVerified &&
        item.wireOrderVerified &&
        item.signalCompatibilityVerified &&
        item.voltageCompatibilityVerified &&
        item.retrievedAt != null &&
        item.verifiedAt != null &&
        (item.authority === "manufacturer" || item.authority === "official_documentation"),
    );

    if (connection) {
      technicalEvidence.fcEscConnector = {
        flightControllerId: connection.flightControllerId,
        escId: connection.escId,
        directConnectionCompatibility: connection.result,
        connectorFamilyVerified: true,
        pinoutVerified: true,
        wireOrderVerified: true,
        signalCompatibilityVerified: true,
        voltageCompatibilityVerified: true,
      };
    }
  }

  return { verification, technicalEvidence };
}

export const emptyCatalogueEvidenceSnapshot = (): CatalogueEvidenceSnapshot => ({
  fields: [],
  motorPropeller: [],
  motorEscCurrent: [],
  fcEscConnection: [],
});
