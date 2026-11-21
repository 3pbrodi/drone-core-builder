import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { validateBuildCompatibility } from "../src/lib/compatibility-validation";
import { planAiBuild } from "../src/lib/ai-build-planner";
import { CompatibilityChecks } from "../src/components/CompatibilityChecks";
import { evaluateCompatibilityRules } from "../src/lib/build-calculations";
import { resolveCompatibilityEvidence } from "../src/lib/catalogue-evidence";
import { fixture, proofs } from "./integration/ai-build-fixture-data";
const prepare = () => {
  const { products } = fixture();
  const selected = Object.fromEntries(
    products.filter((p) => p.category !== "gps").map((p) => [p.category, p]),
  );
  return { products, selected, evidence: proofs(products) };
};
const provenance = (name: string) => ({
  sourceId: name,
  snapshotId: name + "-capture",
  url: `https://${name}.example.invalid/manual`,
  sha256: "a".repeat(64),
  locator: "PDF page5",
  scope:
    "Exact supplied harness,3–6S; installed firmware and complete physical fit are unverified.",
});

test("validation returns three explicit states, source-linked reasons and a limited verification scope", () => {
  const { selected, evidence } = prepare();
  let report = validateBuildCompatibility(selected, evidence);
  assert.equal(report.status, "verified-compatible");
  assert.equal(report.label, "Verified compatible");
  assert.equal(report.scope, "listed catalogue checks");
  assert(report.limitations.some((x) => x.includes("installed firmware")));
  const mount = report.checks.find((c) => c.code === "FRAME_MOTOR_MOUNT")!;
  assert(
    mount.sources.some(
      (s) =>
        s.url === "https://example.invalid/proof" &&
        s.field === "frame.mount" &&
        s.usage === "supports",
    ),
  );
  const bad = { ...selected, frame: { ...selected.frame!, mount: "30x30" } };
  const badProofs = proofs(Object.values(bad));
  report = validateBuildCompatibility(bad, badProofs);
  assert.equal(report.status, "verified-incompatible");
  assert.equal(report.label, "Verified incompatible");
  assert(
    report.checks.some(
      (c) =>
        c.code === "FRAME_MOTOR_MOUNT" &&
        c.status === "verified-incompatible" &&
        c.sources.length > 0,
    ),
  );
  const unknown = validateBuildCompatibility(bad, { ...badProofs, fields: [] });
  assert.equal(unknown.status, "unverified");
  assert.equal(unknown.label, "Unverified");
  assert(unknown.checks.some((c) => c.status === "unverified" && c.unverifiedFields.length > 0));
});
test("rejected, pending, wrong-association, invalid-date, wrong-unit and community rows are never cited as verified sources", () => {
  const { selected, evidence } = prepare();
  const original = evidence.fields.find(
    (f) => f.productId === selected.frame!.id && f.field === "mount",
  )!;
  for (const bad of [
    { verificationStatus: "pending_review" },
    { verificationStatus: "rejected" },
    { exactModelAssociation: false },
    { authority: "community" },
    { retrievedAt: "bad-date" },
    { verifiedAt: "2999-01-01T00:00:00Z" },
  ]) {
    const report = validateBuildCompatibility(selected, {
      ...evidence,
      fields: [
        ...evidence.fields,
        {
          ...original,
          ...bad,
          sourceId: "excluded",
          sourceUrl: "https://excluded.example.invalid",
        } as any,
      ],
    });
    assert(!report.checks.some((c) => c.sources.some((s) => s.sourceId === "excluded")));
    assert.equal(report.status, "verified-compatible");
  }
  const voltage = evidence.fields.find((f) => f.field === "voltage")!;
  const report = validateBuildCompatibility(selected, {
    ...evidence,
    fields: [
      ...evidence.fields,
      {
        ...voltage,
        unit: "V",
        sourceId: "wrong-unit",
        sourceUrl: "https://wrong-unit.example.invalid",
      },
    ],
  });
  assert(!report.checks.some((c) => c.sources.some((s) => s.sourceId === "wrong-unit")));
});
test("conflicting field sources stay disputed and affect only their relevant checks in either order", () => {
  const { selected, evidence } = prepare();
  const original = evidence.fields.find(
    (f) => f.productId === selected.frame!.id && f.field === "mount",
  )!;
  for (const reverse of [false, true]) {
    const fields = [
      ...evidence.fields,
      {
        ...original,
        value: "30x30",
        sourceId: "other-maker",
        sourceUrl: "https://other.example.invalid/drawing",
      },
    ];
    if (reverse) fields.reverse();
    const report = validateBuildCompatibility(selected, { ...evidence, fields });
    assert.equal(report.status, "unverified");
    assert(report.explanation.includes("Conflicting"));
    const mount = report.checks.find((c) => c.code === "FRAME_MOTOR_MOUNT")!;
    assert.equal(mount.status, "unverified");
    assert.equal(mount.sources.filter((s) => s.usage === "disputed").length, 2);
    assert.equal(
      report.checks.find((c) => c.code === "FRAME_PROPELLER_CLEARANCE")!.status,
      "verified-compatible",
    );
  }
});
test("applicable pair conflicts retain both source references; other cell contexts cannot contaminate supported evidence", () => {
  const { selected, evidence } = prepare();
  const first = {
    ...evidence.fcEscConnection[0]!,
    provenance: provenance("maker-a"),
    operatingConditions: { batteryCells: 6 },
  };
  const other = { ...first, result: "incompatible" as const, provenance: provenance("maker-b") };
  let report = validateBuildCompatibility(selected, {
    ...evidence,
    fcEscConnection: [first, other],
  });
  let wiring = report.checks.find((c) => c.code === "FC_ESC_CONNECTOR")!;
  assert.equal(wiring.status, "unverified");
  assert.equal(wiring.sources.filter((s) => s.usage === "disputed" && s.field === null).length, 2);
  report = validateBuildCompatibility(selected, {
    ...evidence,
    fcEscConnection: [first, { ...other, operatingConditions: { batteryCells: 4 } }],
  });
  wiring = report.checks.find((c) => c.code === "FC_ESC_CONNECTOR")!;
  assert.equal(wiring.status, "verified-compatible");
  assert(wiring.sources.some((s) => s.sourceId === "maker-a"));
  assert(!wiring.sources.some((s) => s.sourceId === "maker-b"));
  const wrong = validateBuildCompatibility(
    { ...selected, battery: { ...selected.battery!, voltage: 2 } },
    { ...evidence, fcEscConnection: [first] },
  );
  wiring = wrong.checks.find((c) => c.code === "FC_ESC_CONNECTOR")!;
  assert.equal(wiring.status, "unverified");
  assert(wiring.explanation.includes("battery conditions"));
  assert(wiring.sources.some((s) => s.sourceId === "maker-a" && s.usage === "reference"));
});
test("a known verified failure remains decisive despite an unrelated missing proof or source conflict", () => {
  const { selected, evidence } = prepare();
  const frame = evidence.fields.find(
    (f) => f.field === "mount" && f.productId === selected.frame!.id,
  )!;
  const report = validateBuildCompatibility(selected, {
    ...evidence,
    fcEscConnection: [
      {
        ...evidence.fcEscConnection[0]!,
        result: "incompatible",
        provenance: provenance("wiring-maker"),
        operatingConditions: { batteryCells: 6 },
      },
    ],
    fields: [...evidence.fields, { ...frame, value: "30x30", sourceId: "conflict" }],
  });
  assert.equal(report.status, "verified-incompatible");
  assert.equal(report.checks.find((c) => c.code === "FRAME_MOTOR_MOUNT")!.status, "unverified");
  assert.equal(
    report.checks.find((c) => c.code === "FC_ESC_CONNECTOR")!.status,
    "verified-incompatible",
  );
});
test("missing required and integrated-role coverage never become verified compatibility", () => {
  const { selected, evidence } = prepare();
  let report = validateBuildCompatibility({}, evidence);
  assert.equal(report.status, "unverified");
  assert(report.missingCategories.includes("frame"));
  const { esc, ...withoutEsc } = selected;
  report = validateBuildCompatibility(
    {
      ...withoutEsc,
      flightController: { ...selected.flightController!, integratedCategories: ["esc"] },
    },
    evidence,
  );
  assert.equal(report.status, "unverified");
  assert(
    report.checks.some((c) => c.code === "INTEGRATED_ESC_CURRENT" && c.status === "unverified"),
  );
  report = validateBuildCompatibility(selected, evidence, ["gps"]);
  assert.equal(report.status, "unverified");
  assert(report.missingCategories.includes("gps"));
});
test("source URLs are safe, legacy provenance gaps are explicit and the checklist stays collapsed", () => {
  const { selected, evidence } = prepare();
  const data = {
    ...evidence,
    fields: evidence.fields.map((f) => ({ ...f, sourceUrl: "javascript:alert(1)" })),
  };
  const report = validateBuildCompatibility(selected, data);
  assert(report.checks.every((c) => c.sources.every((s) => s.url === null)));
  assert(report.checks.find((c) => c.code === "FC_ESC_CONNECTOR")!.sourceReferenceUnavailable);
  const resolved = resolveCompatibilityEvidence(selected, data);
  const rules = evaluateCompatibilityRules(
    selected,
    resolved.verification,
    resolved.technicalEvidence,
  );
  const html = renderToStaticMarkup(
    createElement(CompatibilityChecks, {
      rules,
      selected,
      evidence: data,
      issues: resolved.issues,
      pairSources: resolved.pairSources,
      report,
    }),
  );
  assert(!html.includes('href="javascript:'));
  assert(html.includes("public source reference"));
  assert(!html.includes("<details open"));
  assert(html.includes('data-validation-status="verified-compatible"'));
  assert(html.includes("full physical installation"));
});
test("the AI plan returns the shared serializable validation report, preserving strict boolean and fresh revocation behavior", () => {
  const { products, evidence } = prepare();
  const plan = planAiBuild({ budget: 300, priorities: ["parkour"] }, products, evidence);
  assert.equal(plan.validation.status, "verified-compatible");
  assert.equal(plan.verified, true);
  assert.deepEqual(structuredClone(plan.validation), plan.validation);
  const fresh = planAiBuild({ budget: 300, priorities: ["parkour"] }, products, {
    ...evidence,
    fcEscConnection: [],
  });
  assert.equal(fresh.verified, false);
  assert.equal(fresh.validation.status, "unverified");
  assert(
    fresh.validation.checks.some((c) => c.code === "FC_ESC_CONNECTOR" && c.status === "unverified"),
  );
});
