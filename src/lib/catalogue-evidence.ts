import type { Product } from "./build-data";
import type {
  CompatibilityTechnicalEvidence,
  CompatibilityRuleCode,
  CompatibilityVerification,
  CurrentRatingType,
  SelectedProducts,
} from "./build-calculations";

export type EvidenceVerificationStatus = "unverified" | "pending_review" | "verified" | "rejected";

export type CatalogueEvidenceAuthority =
  "manufacturer" | "official_documentation" | "retailer" | "community" | "internal_demo";

export type CatalogueEvidenceJson =
  | null
  | boolean
  | number
  | string
  | CatalogueEvidenceJson[]
  | { [key: string]: CatalogueEvidenceJson };

export type CatalogueEvidenceObject = { [key: string]: CatalogueEvidenceJson };

export type CatalogueFieldEvidence = {
  productId: string;
  field: keyof Product;
  value: CatalogueEvidenceJson;
  unit?: string | null;
  sourceId: string;
  sourceUrl?: string | null;
  authority: CatalogueEvidenceAuthority;
  exactModelAssociation: boolean;
  verificationStatus: EvidenceVerificationStatus;
  retrievedAt?: string | null;
  verifiedAt?: string | null;
  conditions?: CatalogueEvidenceObject;
  caveats?: string | null;
};

export type CataloguePairSource = {
  sourceId: string;
  snapshotId: string;
  url: string;
  sha256: string;
  locator: string;
  scope: string;
};

export type CatalogueMotorPropellerEvidence = {
  provenance?: CataloguePairSource | undefined;
  motorId: string;
  propellerId: string;
  result: "compatible" | "incompatible";
  authority: CatalogueEvidenceAuthority;
  exactProductsVerified: boolean;
  verificationStatus: EvidenceVerificationStatus;
  retrievedAt?: string | null;
  verifiedAt?: string | null;
  operatingConditions: CatalogueEvidenceObject;
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
  operatingConditions: CatalogueEvidenceObject;
};

export type CatalogueFcEscConnectionEvidence = {
  provenance?: CataloguePairSource | undefined;
  operatingConditions?: CatalogueEvidenceObject | undefined;
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
  issues: CompatibilityEvidenceIssue[];
  pairSources: Partial<Record<CompatibilityRuleCode, CataloguePairSource[]>>;
  pairReviewSources: Partial<
    Record<
      CompatibilityRuleCode,
      (CataloguePairSource & {
        retrievedAt: string | null;
        verifiedAt: string | null;
      })[]
    >
  >;
};
export type CompatibilityEvidenceIssue = {
  kind: "conflict" | "conditions";
  field?: keyof Product;
  productIds: string[];
  message: string;
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

const primaryAuthority = (authority: CatalogueEvidenceAuthority) =>
  authority === "manufacturer" || authority === "official_documentation";
function validPairProvenance(row: { provenance?: CataloguePairSource | undefined }) {
  if (row.provenance === undefined) return true; // Existing native verified proofs remain supported.
  const p = row.provenance;
  try {
    const url = new URL(p.url);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      [p.sourceId, p.snapshotId, p.locator, p.scope].every(
        (v) => typeof v === "string" && v.trim() !== "",
      ) &&
      /^[a-f0-9]{64}$/.test(p.sha256)
    );
  } catch {
    return false;
  }
}
const positive = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;
function validDates(row: { retrievedAt?: string | null; verifiedAt?: string | null }, now: number) {
  return [row.retrievedAt, row.verifiedAt].every(
    (stamp) =>
      typeof stamp === "string" &&
      stamp.trim() !== "" &&
      Number.isFinite(Date.parse(stamp)) &&
      Date.parse(stamp) <= now + 300000,
  );
}
const units: Partial<Record<keyof Product, readonly string[]>> = {
  weight: ["g", "gram", "grams"],
  frameInches: ["in", "inch", "inches", "″", '"'],
  propInches: ["in", "inch", "inches", "″", '"'],
  voltage: ["s", "cell", "cells"],
  minVoltage: ["s", "cell", "cells"],
  maxVoltage: ["s", "cell", "cells"],
  motorKv: ["kv", "rpm/v"],
  current: ["a", "amp", "amps"],
  escAmps: ["a", "amp", "amps"],
  batteryMah: ["mah"],
  cameraMinVoltageV: ["v", "volt", "volts"],
  cameraMaxVoltageV: ["v", "volt", "volts"],
  receiverMinVoltageV: ["v", "volt", "volts"],
  receiverMaxVoltageV: ["v", "volt", "volts"],
  deviceMinVoltageV: ["v", "volt", "volts"],
  deviceMaxVoltageV: ["v", "volt", "volts"],
  receiverFrequencyMinMhz: ["mhz"],
  receiverFrequencyMaxMhz: ["mhz"],
  vtxFrequencyMinMhz: ["mhz"],
  vtxFrequencyMaxMhz: ["mhz"],
  antennaFrequencyMinMhz: ["mhz"],
  antennaFrequencyMaxMhz: ["mhz"],
  cameraWidthMm: ["mm"],
  cameraHeightMm: ["mm"],
  cameraDepthMm: ["mm"],
  receiverWidthMm: ["mm"],
  receiverHeightMm: ["mm"],
  receiverDepthMm: ["mm"],
};
export function isCredibleCatalogueFieldEvidence(row: CatalogueFieldEvidence, now: number) {
  return (
    row.verificationStatus === "verified" &&
    row.exactModelAssociation &&
    typeof row.sourceId === "string" &&
    row.sourceId.trim() !== "" &&
    (primaryAuthority(row.authority) || row.authority === "retailer") &&
    validDates(row, now) &&
    (row.unit == null ||
      !units[row.field] ||
      (typeof row.unit === "string" &&
        units[row.field]!.includes(row.unit.trim().toLowerCase()))) &&
    !(typeof row.value === "number" && !Number.isFinite(row.value))
  );
}
/** Conditions are selection constraints, not merely a nonempty object. No fuzzy IDs. */
function conditionsMatch(
  conditions: CatalogueEvidenceObject,
  selected: SelectedProducts,
  requirePropeller: boolean,
) {
  if (!conditions || typeof conditions !== "object" || Array.isArray(conditions)) return false;
  const cells = selected.battery?.voltage;
  if (!positive(cells)) return false;
  const exact = conditions["batteryCells"];
  const minimum = conditions["minBatteryCells"],
    maximum = conditions["maxBatteryCells"];
  if (exact !== undefined) {
    if (!positive(exact) || exact !== cells) return false;
  } else if (
    !positive(minimum) ||
    !positive(maximum) ||
    minimum > maximum ||
    cells < minimum ||
    cells > maximum
  )
    return false;
  if (minimum !== undefined && (!positive(minimum) || cells < minimum)) return false;
  if (maximum !== undefined && (!positive(maximum) || cells > maximum)) return false;
  const propeller = conditions["propeller"],
    propellerId = conditions["propellerId"],
    propellers = conditions["propellers"];
  if (
    requirePropeller &&
    propeller === undefined &&
    propellerId === undefined &&
    propellers === undefined
  )
    return false;
  if (propeller !== undefined && propeller !== selected.propellers?.id) return false;
  if (propellerId !== undefined && propellerId !== selected.propellers?.id) return false;
  if (
    propellers !== undefined &&
    (!Array.isArray(propellers) ||
      !propellers.every((p) => typeof p === "string") ||
      !propellers.includes(selected.propellers?.id ?? ""))
  )
    return false;
  if (conditions["motorKv"] !== undefined && conditions["motorKv"] !== selected.motors?.motorKv)
    return false;
  return true;
}
function pushVerifiedField(
  verification: CompatibilityVerification,
  category: Product["category"],
  field: keyof Product,
) {
  const current = verification[category] ?? [];
  if (!current.includes(field)) verification[category] = [...current, field];
}
export function resolveCompatibilityEvidence(
  selected: SelectedProducts,
  snapshot: CatalogueEvidenceSnapshot,
  now = Date.now(),
): ResolvedCompatibilityEvidence {
  const verification: CompatibilityVerification = {},
    technicalEvidence: CompatibilityTechnicalEvidence = {},
    issues: CompatibilityEvidenceIssue[] = [];
  const pairSources: ResolvedCompatibilityEvidence["pairSources"] = {};
  const pairReviewSources: ResolvedCompatibilityEvidence["pairReviewSources"] = {};
  const reviewSources = (
    rows: {
      provenance?: CataloguePairSource | undefined;
      retrievedAt?: string | null;
      verifiedAt?: string | null;
    }[],
  ) =>
    rows.flatMap((row) =>
      row.provenance
        ? [
            {
              ...row.provenance,
              retrievedAt: row.retrievedAt ?? null,
              verifiedAt: row.verifiedAt ?? null,
            },
          ]
        : [],
    );
  for (const product of Object.values(selected)) {
    if (!product) continue;
    const groups = new Map<keyof Product, CatalogueFieldEvidence[]>();
    for (const row of snapshot.fields)
      if (row && row.productId === product.id && isCredibleCatalogueFieldEvidence(row, now)) {
        const rows = groups.get(row.field) ?? [];
        rows.push(row);
        groups.set(row.field, rows);
      }
    for (const [field, rows] of groups) {
      if (rows.some((row) => !sameEvidenceValue(product[field], row.value))) {
        issues.push({
          kind: "conflict",
          productIds: [product.id],
          field,
          message: `${product.name}: verified ${String(field)} evidence disagrees with the catalogue or another verified source.`,
        });
      } else pushVerifiedField(verification, product.category, field);
    }
  }
  function consistent<T>(
    rows: T[],
    value: (row: T) => unknown,
    productIds: string[],
    label: string,
  ): T | undefined {
    if (rows.length && rows.some((row) => !sameEvidenceValue(value(rows[0]!), value(row)))) {
      issues.push({
        kind: "conflict",
        productIds,
        message: `Conflicting verified ${label} evidence; this combination requires review.`,
      });
      return undefined;
    }
    return rows[0];
  }
  const motors = selected.motors,
    propellers = selected.propellers,
    esc = selected.esc,
    flightController = selected.flightController;
  if (motors && propellers) {
    const exact = snapshot.motorPropeller.filter(
      (item) =>
        item &&
        item.motorId === motors.id &&
        item.propellerId === propellers.id &&
        item.verificationStatus === "verified" &&
        item.exactProductsVerified &&
        validDates(item, now) &&
        primaryAuthority(item.authority) &&
        validPairProvenance(item),
    );
    const applicable = exact.filter((item) =>
      conditionsMatch(item.operatingConditions, selected, false),
    );
    pairReviewSources.MOTOR_PROPELLER_SIZE_GUIDANCE = reviewSources(
      applicable.length ? applicable : exact,
    );
    if (exact.length && !applicable.length)
      issues.push({
        kind: "conditions",
        productIds: [motors.id, propellers.id],
        message:
          "Motor/propeller test evidence does not establish compatibility for the selected battery conditions.",
      });
    const pair = consistent(
      applicable,
      (row) => row.result,
      [motors.id, propellers.id],
      "motor/propeller",
    );
    if (pair) {
      pairSources.MOTOR_PROPELLER_SIZE_GUIDANCE = applicable.flatMap((row) =>
        row.provenance ? [row.provenance] : [],
      );
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
    const exact = snapshot.motorEscCurrent.filter(
      (item) =>
        item &&
        item.motorId === motors.id &&
        item.escId === esc.id &&
        item.verificationStatus === "verified" &&
        item.exactProductsVerified &&
        item.ratingTypesVerified &&
        item.motorOperatingConditionsVerified &&
        validDates(item, now) &&
        item.motorRatingType === "continuous" &&
        item.escRatingType === "continuous" &&
        positive(item.motorCurrentAmps) &&
        positive(item.escCurrentAmps),
    );
    const applicable = exact.filter((item) =>
      conditionsMatch(item.operatingConditions, selected, true),
    );
    if (exact.length && !applicable.length)
      issues.push({
        kind: "conditions",
        productIds: [motors.id, esc.id],
        message:
          "Motor/ESC current evidence requires matching selected battery and exact propeller conditions.",
      });
    const current = consistent(
      applicable,
      (row) => [row.motorCurrentAmps, row.escCurrentAmps],
      [motors.id, esc.id],
      "continuous-current",
    );
    if (
      current &&
      (!Object.is(motors.current, current.motorCurrentAmps) ||
        !Object.is(esc.escAmps, current.escCurrentAmps))
    )
      issues.push({
        kind: "conflict",
        productIds: [motors.id, esc.id],
        message: "Verified current evidence disagrees with the selected catalogue current ratings.",
      });
    if (
      current &&
      !issues.some(
        (issue) =>
          issue.kind === "conflict" &&
          issue.productIds.some((id) => id === motors.id || id === esc.id),
      ) &&
      Object.is(motors.current, current.motorCurrentAmps) &&
      Object.is(esc.escAmps, current.escCurrentAmps)
    ) {
      pushVerifiedField(verification, "motors", "current");
      pushVerifiedField(verification, "esc", "escAmps");
      technicalEvidence.motorEscCurrent = {
        motorId: current.motorId,
        escId: current.escId,
        motorRatingType: current.motorRatingType,
        escRatingType: current.escRatingType,
        ratingTypesVerified: true,
        motorOperatingConditionsVerified: true,
      };
    }
  }
  if (flightController && esc) {
    const rows = snapshot.fcEscConnection.filter(
      (item) =>
        item &&
        item.flightControllerId === flightController.id &&
        item.escId === esc.id &&
        item.verificationStatus === "verified" &&
        item.exactProductsVerified &&
        item.connectorFamilyVerified &&
        item.pinoutVerified &&
        item.wireOrderVerified &&
        item.signalCompatibilityVerified &&
        item.voltageCompatibilityVerified &&
        validDates(item, now) &&
        primaryAuthority(item.authority) &&
        validPairProvenance(item),
    );
    const applicable = rows.filter(
      (item) =>
        (item.operatingConditions === undefined && !item.provenance) ||
        conditionsMatch(item.operatingConditions!, selected, false),
    );
    pairReviewSources.FC_ESC_CONNECTOR = reviewSources(applicable.length ? applicable : rows);
    if (rows.length && !applicable.length)
      issues.push({
        kind: "conditions",
        productIds: [flightController.id, esc.id],
        message:
          "FC/ESC supplied-harness evidence requires the documented selected battery conditions.",
      });
    const connection = consistent(
      applicable,
      (row) => row.result,
      [flightController.id, esc.id],
      "FC/ESC wiring",
    );
    if (connection) {
      pairSources.FC_ESC_CONNECTOR = applicable.flatMap((row) =>
        row.provenance ? [row.provenance] : [],
      );
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
  return { verification, technicalEvidence, issues, pairSources, pairReviewSources };
}

export const emptyCatalogueEvidenceSnapshot = (): CatalogueEvidenceSnapshot => ({
  fields: [],
  motorPropeller: [],
  motorEscCurrent: [],
  fcEscConnection: [],
});
