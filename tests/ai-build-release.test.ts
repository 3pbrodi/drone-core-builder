import assert from "node:assert/strict";
import { test } from "node:test";
import { planAiBuild } from "../src/lib/ai-build-planner";
import { validateBuildCompatibility } from "../src/lib/compatibility-validation";
import { resolveCompatibilityEvidence } from "../src/lib/catalogue-evidence";
import { fixture, proofs } from "./integration/ai-build-fixture-data";
import { releaseScenario } from "./integration/ai-build-release-scenarios";
const setup = () => {
  const { products } = fixture();
  return { products, evidence: proofs(products) };
};
const selected = (products: ReturnType<typeof fixture>["products"]) =>
  Object.fromEntries(products.filter((p) => p.category !== "gps").map((p) => [p.category, p]));
test("release/valid: complete sourced build stays within budget and verifies only listed checks", () => {
  const data = setup(),
    before = structuredClone(data);
  const p = planAiBuild({ budget: 300, priorities: ["parkour"] }, data.products, data.evidence);
  assert(p.complete && p.verified);
  assert(p.price <= 300);
  assert.equal(p.validation.status, "verified-compatible");
  assert.equal(p.validation.scope, "listed catalogue checks");
  assert(p.validation.limitations.some((t) => t.includes("physical installation")));
  assert(p.validation.limitations.some((t) => t.includes("installed firmware")));
  assert.deepEqual(data, before);
});
test("release/wiring: confirmed pinout conflict is rejected; incomplete or lookalike wiring remains unverified", () => {
  const base = setup(),
    data = releaseScenario(base.products, base.evidence, "mismatched-wiring");
  const s = selected(data.products);
  const report = validateBuildCompatibility(s, data.evidence);
  assert.equal(report.status, "verified-incompatible");
  assert.equal(
    report.checks.find((c) => c.code === "FC_ESC_CONNECTOR")!.status,
    "verified-incompatible",
  );
  const plan = planAiBuild({ budget: 300, priorities: [] }, data.products, data.evidence);
  assert(!plan.complete && !plan.verified);
  assert(!(plan.selection.flightController && plan.selection.esc));
  for (const key of [
    "connectorFamilyVerified",
    "pinoutVerified",
    "wireOrderVerified",
    "signalCompatibilityVerified",
    "voltageCompatibilityVerified",
  ] as const) {
    const incomplete = structuredClone(base.evidence);
    incomplete.fcEscConnection[0]![key] = false;
    assert.equal(
      validateBuildCompatibility(selected(base.products), incomplete).checks.find(
        (c) => c.code === "FC_ESC_CONNECTOR",
      )!.status,
      "unverified",
    );
  }
  const lookalike = { ...s, esc: { ...s.esc!, id: "synthetic-other-esc-same-connector" } };
  assert.equal(
    resolveCompatibilityEvidence(lookalike, base.evidence).technicalEvidence.fcEscConnector,
    undefined,
  );
});
test("release/unsupported: absent or wrong-context pairing proof never becomes a verified match", () => {
  const base = setup(),
    data = releaseScenario(base.products, base.evidence, "unsupported-combination");
  let report = validateBuildCompatibility(selected(data.products), data.evidence);
  assert.equal(
    report.checks.find((c) => c.code === "MOTOR_PROPELLER_SIZE_GUIDANCE")!.status,
    "unverified",
  );
  const plan = planAiBuild({ budget: 300, priorities: [] }, data.products, data.evidence);
  assert(plan.complete && !plan.verified);
  const denied = structuredClone(base.evidence);
  denied.motorPropeller.forEach((p) => (p.result = "incompatible"));
  assert.equal(
    validateBuildCompatibility(selected(base.products), denied).checks.find(
      (c) => c.code === "MOTOR_PROPELLER_SIZE_GUIDANCE",
    )!.status,
    "verified-incompatible",
  );
  const unsupported = planAiBuild({ budget: 300, priorities: [] }, base.products, denied);
  assert(!unsupported.complete);
  assert(!(unsupported.selection.motors && unsupported.selection.propellers));
  const conditions = structuredClone(base.evidence);
  conditions.motorPropeller.forEach((p) => (p.operatingConditions = { batteryCells: 4 }));
  report = validateBuildCompatibility(selected(base.products), conditions);
  assert.equal(
    report.checks.find((c) => c.code === "MOTOR_PROPELLER_SIZE_GUIDANCE")!.status,
    "unverified",
  );
});
test("release/dimensions: missing measurements are reported explicitly and never filled with product facts", () => {
  const base = setup(),
    data = releaseScenario(base.products, base.evidence, "missing-dimensions"),
    before = structuredClone(data);
  const report = validateBuildCompatibility(selected(data.products), data.evidence);
  assert.equal(report.status, "unverified");
  for (const code of ["FRAME_MOTOR_MOUNT", "FRAME_PROPELLER_CLEARANCE"]) {
    const c = report.checks.find((c) => c.code === code)!;
    assert.equal(c.status, "unverified");
    assert(c.missingFields.length > 0);
  }
  const p = planAiBuild({ budget: 300, priorities: [] }, data.products, data.evidence);
  assert(!p.verified);
  assert.equal(p.validation.status, "unverified");
  assert.deepEqual(data, before);
  assert(
    data.products
      .filter((p) => p.category === "frame")
      .every((p) => p.frameInches === undefined && p.mount === undefined),
  );
  assert(
    data.products
      .filter((p) => p.category === "propellers")
      .every((p) => p.propInches === undefined),
  );
});
test("release/revocation: fresh missing, rejected, pending and unverified proofs cannot retain old approval", () => {
  const base = setup(),
    s = selected(base.products);
  assert.equal(validateBuildCompatibility(s, base.evidence).status, "verified-compatible");
  for (const mode of ["missing-wiring", "revoked-evidence"] as const) {
    const fresh = releaseScenario(base.products, base.evidence, mode);
    assert.equal(
      resolveCompatibilityEvidence(s, fresh.evidence).technicalEvidence.fcEscConnector,
      undefined,
    );
    const p = planAiBuild({ budget: 300, priorities: [] }, fresh.products, fresh.evidence);
    assert(p.complete && !p.verified);
    assert.equal(
      p.validation.checks.find((c) => c.code === "FC_ESC_CONNECTOR")!.status,
      "unverified",
    );
  }
  for (const status of ["pending_review", "unverified", "rejected"] as const) {
    const e = structuredClone(base.evidence);
    e.fcEscConnection.forEach((p) => {
      p.verificationStatus = status;
      p.verifiedAt = null;
    });
    assert.equal(resolveCompatibilityEvidence(s, e).technicalEvidence.fcEscConnector, undefined);
  }
  assert.equal(
    resolveCompatibilityEvidence(s, base.evidence).technicalEvidence.fcEscConnector
      ?.directConnectionCompatibility,
    "compatible",
  );
});
