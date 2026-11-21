/** Read-only dossier/CSV/source verification. No database clients or network calls. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { validateCatalogueSpecEvidenceCsv } from "../src/lib/catalogue-evidence-import";
import {
  emptyCatalogueEvidenceSnapshot,
  resolveCompatibilityEvidence,
} from "../src/lib/catalogue-evidence";
import type { Product } from "../src/lib/build-data";
const file = "qa/manufacturer-compatibility-dossier-20261121.json";
const raw = readFileSync(file),
  d = JSON.parse(raw.toString());
const sources = new Map<string, any>(d.sources.map((s: any) => [s.id, s]));
const products = new Map<string, any>(d.products.map((p: any) => [p.id, p]));
let checks = 0;
const check = (condition: unknown, message: string) => {
  checks++;
  assert(condition, message);
};
check(d.schemaVersion === 1 && d.products.length === 133, "Pinned portfolio/schema changed.");
check(products.size === d.products.length && sources.size === d.sources.length, "Duplicate IDs.");
check(
  d.activeNativeApprovalsAdded === 0 && !d.productionWrites && !d.newProductImageAssociations,
  "Audit cannot publish/import data or media.",
);
for (const p of d.products) {
  check(
    p.completeMechanicalFit === "not_established",
    "No complete assembled-fit guarantee is documented.",
  );
  check(
    ["unknown", "not_applicable_to_passive_component"].includes(p.installedFirmware),
    "Manufacturer text is not an installed firmware readout.",
  );
}
for (const c of d.claims) {
  check(
    products.has(c.productId) && c.nativeVerificationStatus === "pending_review",
    "Unknown product or premature approval.",
  );
  check(
    ["source_supported", "conditional", "conflict", "missing"].includes(c.researchStatus),
    "Unknown research status.",
  );
  check(c.sourceIds.length > 0 && c.locator.length > 0, "Missing provenance locator.");
  for (const id of c.sourceIds)
    check(
      sources.get(id)?.status === "captured" && /^[a-f0-9]{64}$/.test(sources.get(id)?.sha256),
      "Missing/failed/invalid source.",
    );
}
const csv = validateCatalogueSpecEvidenceCsv(
  readFileSync("qa/manufacturer-compatibility-pending-evidence-20261121.csv", "utf8"),
);
check(
  csv.invalidRows.length === 0,
  "Pending CSV failed existing importer validation: " + JSON.stringify(csv.invalidRows),
);
check(
  csv.validRows.length ===
    d.claims.filter((c: any) => c.researchStatus === "source_supported").length,
  "CSV/claim counts differ.",
);
for (const row of csv.validRows) {
  check(row.data.verificationStatus === "pending_review", "CSV must remain pending.");
  check(row.reviewIssues.length > 0, "Existing native-review gate is required.");
}
let wiring = 0,
  motorProp = 0;
for (const pair of d.pairDossiers) {
  check(
    pair.productIds.every((id: string) => products.has(id)) &&
      pair.sourceIds.every((id: string) => sources.get(id)?.status === "captured"),
    "Pair identity/source missing.",
  );
  check(pair.nativeReviewStatus === "pending_review", "Pair cannot be silently approved.");
  if (!pair.nativeCandidate) continue;
  const c = pair.nativeCandidate,
    snapshot = emptyCatalogueEvidenceSnapshot();
  check(
    c.verificationStatus === "pending_review" && c.verifiedAt === null,
    "Pair must stay pending.",
  );
  // Minimal identity-only local test objects, never imported product records.
  const part = (id: string) => ({ id, category: products.get(id).category, name: id }) as Product;
  if (pair.kind === "fc_esc_connection") {
    wiring++;
    snapshot.fcEscConnection = [c];
    const selected = { flightController: part(c.flightControllerId), esc: part(c.escId) };
    check(
      !resolveCompatibilityEvidence(selected, snapshot).technicalEvidence.fcEscConnector,
      "Pending wiring proof was trusted.",
    );
    snapshot.fcEscConnection = [{ ...c, verificationStatus: "verified", verifiedAt: d.createdAt }];
    check(
      resolveCompatibilityEvidence(selected, snapshot).technicalEvidence.fcEscConnector
        ?.directConnectionCompatibility === "compatible",
      "Source-scoped wiring rehearsal failed.",
    );
    check(
      !resolveCompatibilityEvidence(
        { ...selected, esc: { ...selected.esc, id: "synthetic-wrong-esc" } },
        snapshot,
      ).technicalEvidence.fcEscConnector,
      "Wiring proof reused for another ESC.",
    );
  } else if (pair.kind === "motor_propeller_configuration") {
    motorProp++;
    snapshot.motorPropeller = [c];
    const selected = {
      motors: { ...part(c.motorId), motorKv: 1750 },
      propellers: part(c.propellerId),
      battery: {
        id: "synthetic-audit-6s-context",
        category: "battery",
        name: "Local condition only",
        voltage: 6,
      } as Product,
    };
    check(
      !resolveCompatibilityEvidence(selected, snapshot).technicalEvidence.motorPropeller,
      "Pending motor proof was trusted.",
    );
    snapshot.motorPropeller = [{ ...c, verificationStatus: "verified", verifiedAt: d.createdAt }];
    check(
      resolveCompatibilityEvidence(selected, snapshot).technicalEvidence.motorPropeller
        ?.manufacturerCompatibility === "compatible",
      "Manufacturer6S configuration rehearsal failed.",
    );
    check(
      !resolveCompatibilityEvidence(
        { ...selected, battery: { ...selected.battery, voltage: 4 } },
        snapshot,
      ).technicalEvidence.motorPropeller,
      "6S proof reused for4S.",
    );
  }
}
check(wiring === 5 && motorProp === 1, "Unexpected candidate coverage.");
for (const b of d.benchMeasurements) {
  check(
    b.continuousRatingEstablished === false && b.testDurationSeconds === null,
    "Bench maxima cannot become continuous ratings.",
  );
  check(
    b.mappingStatus !== "exact_catalogue_pair_verified",
    "Ambiguous bench propeller cannot become exact native evidence.",
  );
  for (const point of b.points) {
    check(
      point.currentA > 0 &&
        point.thrustG > 0 &&
        Math.abs(point.powerW - b.voltageV * point.currentA) < 0.2,
      "Bench transcription power/current/voltage mismatch.",
    );
  }
}
check(
  d.benchMeasurements.filter((b: any) => b.mappingStatus === "blocked_exact_propeller_revision")
    .length === 3,
  "HQ revision holds were lost.",
);
check(
  d.mechanicalAssessments.every(
    (m: any) => m.status !== "fully_verified" && m.unresolved.length > 0,
  ),
  "Partial mechanical checks must stay conditional.",
);
check(
  d.documentConflicts.some((c: any) => c.id === "f7-esc-firmware-layout") &&
    d.documentConflicts.some((c: any) => c.id === "aio-target-alias"),
  "Known firmware contradictions were dropped.",
);
const withArchives = process.argv.includes("--archives");
if (withArchives) {
  for (const s of d.sources) {
    if (s.status !== "captured") continue;
    const bytes = readFileSync(resolve(s.privateRawPath));
    check(createHash("sha256").update(bytes).digest("hex") === s.sha256, "Changed capture " + s.id);
    if (s.gitBlobSha)
      check(
        createHash("sha1")
          .update(Buffer.from(`blob ${bytes.length}\0`))
          .update(bytes)
          .digest("hex") === s.gitBlobSha,
        "Changed upstream blob " + s.id,
      );
  }
}
const receipt = {
  passed: true,
  checks,
  dossierSha256: createHash("sha256").update(raw).digest("hex"),
  portfolioProducts: products.size,
  sourceRecords: d.sources.length,
  capturedSources: d.sources.filter((s: any) => s.status === "captured").length,
  claims: d.claims.length,
  pendingCsvRows: csv.validRows.length,
  wiringPairCandidates: wiring,
  motorPropConfigurationCandidates: motorProp,
  archiveHashesChecked: withArchives,
  nativeApprovalsAdded: 0,
  productionWrites: false,
};
writeFileSync(
  "qa/manufacturer-compatibility-validation-20261121.json",
  JSON.stringify(receipt, null, 2) + "\n",
);
console.log(JSON.stringify(receipt));
