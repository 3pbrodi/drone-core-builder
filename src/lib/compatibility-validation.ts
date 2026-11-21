import { categoryMetadata, type Category } from "./component-categories";
import type { Product } from "./build-data";
import {
  evaluateCompatibilityRules,
  type CompatibilityRuleResult,
  type SelectedProducts,
} from "./build-calculations";
import {
  fulfillmentProductForCategory,
  requiredCategoriesForSelection,
} from "./configurator-selection";
import { compatibilityCoverageGaps } from "./compatibility-coverage";
import {
  isCredibleCatalogueFieldEvidence,
  resolveCompatibilityEvidence,
  type CatalogueEvidenceSnapshot,
  type CompatibilityEvidenceIssue,
  type ResolvedCompatibilityEvidence,
} from "./catalogue-evidence";

export type CompatibilityValidationStatus =
  "verified-compatible" | "verified-incompatible" | "unverified";
export const compatibilityValidationLabels: Record<CompatibilityValidationStatus, string> = {
  "verified-compatible": "Verified compatible",
  "verified-incompatible": "Verified incompatible",
  unverified: "Unverified",
};
export type CompatibilityValidationSource = {
  sourceId: string;
  url: string | null;
  field: string | null;
  usage: "supports" | "reference" | "disputed";
  retrievedAt: string | null;
  verifiedAt: string | null;
  scope: string | null;
  locator: string | null;
  sha256: string | null;
};
export type CompatibilityValidationCheck = {
  code: string;
  label: string;
  status: CompatibilityValidationStatus;
  explanation: string;
  missingFields: string[];
  unverifiedFields: string[];
  issues: CompatibilityEvidenceIssue[];
  sources: CompatibilityValidationSource[];
  sourceReferenceUnavailable: boolean;
};
export type CompatibilityValidation = {
  status: CompatibilityValidationStatus;
  label: string;
  scope: "listed catalogue checks";
  explanation: string;
  complete: boolean;
  missingCategories: Category[];
  issues: CompatibilityEvidenceIssue[];
  checks: CompatibilityValidationCheck[];
  counts: Record<CompatibilityValidationStatus, number>;
  limitations: string[];
};
const labels: Record<string, string> = {
  FRAME_MOTOR_MOUNT: "Frame–motor mounting",
  FRAME_PROPELLER_CLEARANCE: "Frame–propeller clearance",
  MOTOR_PROPELLER_SIZE_GUIDANCE: "Motor–propeller pairing",
  BATTERY_MOTOR_VOLTAGE: "Battery–motor voltage",
  BATTERY_ESC_VOLTAGE: "Battery–ESC voltage",
  BATTERY_FC_VOLTAGE: "Battery–controller voltage",
  FC_ESC_CONNECTOR: "Controller–ESC wiring",
  MOTOR_ESC_CURRENT: "Motor–ESC continuous current",
  CAMERA_FC_VIDEO_INTERFACE: "Camera video interface",
  CAMERA_FC_POWER: "Camera power",
  RECEIVER_FC_SIGNAL_INTERFACE: "Receiver signal interface",
  RECEIVER_FC_POWER: "Receiver power",
  RADIO_RECEIVER_PROTOCOL: "Radio–receiver protocol",
  GOGGLES_VIDEO_SYSTEM: "Goggles video system",
  BATTERY_CHARGER: "Battery–charger pairing",
  CHARGING_ACCESSORY_CONNECTOR: "Charging connector",
  VTX_CAMERA_INTERFACE: "Camera–video transmitter interface",
  VTX_ANTENNA: "Video transmitter–antenna pairing",
  GPS_FC_INTEGRATION: "GPS connection",
  BUZZER_FC_INTEGRATION: "Buzzer connection",
};
function sourceUrl(raw?: string | null): string | null {
  try {
    const u = new URL(raw ?? "");
    return ["https:", "http:"].includes(u.protocol) && !u.username && !u.password ? u.href : null;
  } catch {
    return null;
  }
}
function issueApplies(
  issue: CompatibilityEvidenceIssue,
  rule: CompatibilityRuleResult,
  selected: SelectedProducts,
) {
  return (
    issue.productIds.every((id) => rule.categories.some((c) => selected[c]?.id === id)) &&
    (!issue.field ||
      rule.categories.some(
        (c) =>
          Object.hasOwn(rule.evidence, `${c}.${issue.field}`) ||
          [...rule.missingFields, ...rule.unverifiedFields].includes(`${c}.${issue.field}`),
      ))
  );
}
/** Describe existing rule decisions; no new compatibility math or relaxed evidence gates. */
export function createCompatibilityValidation(
  selected: SelectedProducts,
  snapshot: CatalogueEvidenceSnapshot,
  resolved: ResolvedCompatibilityEvidence,
  rules: readonly CompatibilityRuleResult[],
  required: readonly Category[] = requiredCategoriesForSelection(selected),
  now = Date.now(),
): CompatibilityValidation {
  const checks: CompatibilityValidationCheck[] = rules
    .filter((r) => r.applicable)
    .map((rule) => {
      const issues = resolved.issues.filter((i) => issueApplies(i, rule, selected));
      const disputed = issues.some((i) => i.kind === "conflict");
      const status: CompatibilityValidationStatus = disputed
        ? "unverified"
        : rule.evidenceLevel === "verified" && rule.status === "pass"
          ? "verified-compatible"
          : rule.evidenceLevel === "verified" && rule.status === "fail"
            ? "verified-incompatible"
            : "unverified";
      const pairCheck = [
        "FC_ESC_CONNECTOR",
        "MOTOR_PROPELLER_SIZE_GUIDANCE",
        "MOTOR_ESC_CURRENT",
      ].includes(rule.code);
      const fields = snapshot.fields.filter(
        (row) =>
          isCredibleCatalogueFieldEvidence(row, now) &&
          rule.categories.some(
            (category) =>
              selected[category]?.id === row.productId &&
              (Object.hasOwn(rule.evidence, `${category}.${row.field}`) ||
                [...rule.missingFields, ...rule.unverifiedFields].includes(
                  `${category}.${row.field}`,
                )) &&
              (resolved.verification[category]?.includes(row.field) ||
                issues.some(
                  (i) =>
                    i.kind === "conflict" &&
                    i.field === row.field &&
                    i.productIds.includes(row.productId),
                )),
          ),
      );
      const sources: CompatibilityValidationSource[] = fields.map((row) => ({
        sourceId: row.sourceId,
        url: sourceUrl(row.sourceUrl),
        field: `${selectedCategory(row.productId)}.${row.field}`,
        usage: issues.some(
          (i) =>
            i.kind === "conflict" && i.field === row.field && i.productIds.includes(row.productId),
        )
          ? "disputed"
          : pairCheck
            ? "reference"
            : "supports",
        retrievedAt: row.retrievedAt ?? null,
        verifiedAt: row.verifiedAt ?? null,
        scope: null,
        locator: null,
        sha256: null,
      }));
      for (const row of resolved.pairReviewSources[rule.code] ?? [])
        sources.push({
          sourceId: row.sourceId,
          url: sourceUrl(row.url),
          field: null,
          usage: disputed ? "disputed" : status === "unverified" ? "reference" : "supports",
          retrievedAt: row.retrievedAt,
          verifiedAt: row.verifiedAt,
          scope: row.scope,
          locator: row.locator,
          sha256: row.sha256,
        });
      const unique = [...new Map(sources.map((s) => [JSON.stringify(s), s])).values()];
      const explanation = [
        rule.explanation,
        ...issues.map((i) => i.message),
        ...(status === "unverified" && rule.advisoryOutcome === "fail"
          ? ["This advisory mismatch has not been verified as an incompatibility."]
          : []),
      ].join(" ");
      return {
        code: rule.code,
        label: labels[rule.code] ?? rule.code.replaceAll("_", " "),
        status,
        explanation,
        missingFields: [...rule.missingFields],
        unverifiedFields: [...rule.unverifiedFields],
        issues,
        sources: unique,
        sourceReferenceUnavailable: !unique.some((s) => s.url && (!pairCheck || s.field === null)),
      };
    });
  function selectedCategory(id: string) {
    return Object.values(selected).find((p) => p?.id === id)?.category ?? "product";
  }
  for (const gap of compatibilityCoverageGaps(selected))
    checks.push({
      code: gap.code,
      label: gap.code.replaceAll("_", " "),
      status: "unverified",
      explanation: gap.explanation,
      missingFields: [],
      unverifiedFields: [],
      issues: [],
      sources: [],
      sourceReferenceUnavailable: true,
    });
  const missingCategories = [
    ...new Set([...requiredCategoriesForSelection(selected), ...required]),
  ].filter((c) => !fulfillmentProductForCategory(selected, c));
  const counts: CompatibilityValidation["counts"] = {
    "verified-compatible": 0,
    "verified-incompatible": 0,
    unverified: 0,
  };
  for (const c of checks) counts[c.status]++;
  const status: CompatibilityValidationStatus =
    counts["verified-incompatible"] > 0
      ? "verified-incompatible"
      : missingCategories.length ||
          !checks.length ||
          counts.unverified > 0 ||
          resolved.issues.length
        ? "unverified"
        : "verified-compatible";
  const explanation =
    status === "verified-incompatible"
      ? `${counts["verified-incompatible"]} listed check(s) confirm an incompatibility using verified evidence.`
      : status === "verified-compatible"
        ? "All applicable listed catalogue checks pass using verified evidence."
        : [
            missingCategories.length
              ? `Missing components: ${missingCategories.map((c) => categoryMetadata[c].label).join(", ")}.`
              : "",
            counts.unverified
              ? `${counts.unverified} listed check(s) need evidence or review.`
              : "",
            resolved.issues.some((i) => i.kind === "conflict")
              ? "Conflicting sources remain unresolved."
              : "",
            !checks.length ? "Select components to evaluate compatibility." : "",
          ]
            .filter(Boolean)
            .join(" ");
  return {
    status,
    label: compatibilityValidationLabels[status],
    scope: "listed catalogue checks",
    explanation,
    complete: missingCategories.length === 0,
    missingCategories,
    issues: [...resolved.issues],
    checks,
    counts,
    limitations: [
      "Listed checks do not verify full physical installation or flight readiness.",
      "Complete mechanical fit and installed firmware remain unverified.",
    ],
  };
}
export function validateBuildCompatibility(
  selected: SelectedProducts,
  snapshot: CatalogueEvidenceSnapshot,
  required?: readonly Category[],
  now = Date.now(),
): CompatibilityValidation {
  const resolved = resolveCompatibilityEvidence(selected, snapshot, now);
  return createCompatibilityValidation(
    selected,
    snapshot,
    resolved,
    evaluateCompatibilityRules(selected, resolved.verification, resolved.technicalEvidence),
    required,
    now,
  );
}
