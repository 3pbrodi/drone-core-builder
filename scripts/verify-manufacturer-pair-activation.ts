/** Offline replay of independent read-only public API captures. No network or credentials. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const captures = resolve(
  process.env.MANUFACTURER_PAIR_CAPTURE_DIR ??
    ".private-backups/manufacturer-pair-activation-20261121",
);
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { fetchPublicCatalogueQuery } from "../src/lib/catalogue-public-query";
import { resolveCompatibilityEvidence } from "../src/lib/catalogue-evidence";
import { evaluateCompatibilityRules } from "../src/lib/build-calculations";
import { CompatibilityChecks } from "../src/components/CompatibilityChecks";
const read = (f: string) => JSON.parse(readFileSync(resolve(captures, f), "utf8"));
const plan = read("manifest.json"),
  raw = read("public-after-scoped.json"),
  legacy = read("public-after-legacy.json"),
  before = read("public-before.json");
let checks = 0;
const check = (condition: unknown, message: string) => {
  checks++;
  assert(condition, message);
};
const result = await fetchPublicCatalogueQuery(
  {
    mode: "ids",
    ids: raw.products.map((p: any) => p.id),
    withEvidence: true,
    withManufacturers: false,
  },
  "http://127.0.0.1/captured-query",
  async () => new Response(JSON.stringify(raw), { status: 200 }) as any,
);
check(
  result.status === "ready" && result.products.length === 12,
  "Existing app reader accepts actual captured response",
);
for (const p of before.products)
  assert.deepEqual(
    result.products.find((x) => x.id === p.id),
    p,
  );
checks += before.products.length;
const products = new Map(result.products.map((p) => [p.id, p]));
const battery = result.products.find((p) => p.category === "battery" && p.voltage === 6)!;
for (const item of plan.entries) {
  const selected: any =
    item.kind === "fc_esc_connection"
      ? {
          flightController: products.get(item.productIds[0]),
          esc: products.get(item.productIds[1]),
          battery,
        }
      : {
          motors: products.get(item.productIds[0]),
          propellers: products.get(item.productIds[1]),
          battery,
        };
  const resolved = resolveCompatibilityEvidence(selected, result.evidence);
  const code =
    item.kind === "fc_esc_connection" ? "FC_ESC_CONNECTOR" : "MOTOR_PROPELLER_SIZE_GUIDANCE";
  const rules = evaluateCompatibilityRules(
    selected,
    resolved.verification,
    resolved.technicalEvidence,
  );
  const rule = rules.find((r) => r.code === code)!;
  check(
    rule.status === "pass" && rule.evidenceLevel === "verified",
    "Actual native configurator pair check passes: " + item.dossierId,
  );
  const source = resolved.pairSources[code]?.[0];
  check(
    source?.sha256 === item.source.sha256 && source?.url === item.source.url,
    "Immutable manufacturer source retained",
  );
  check(source?.scope === item.scope, "Pair scope retained");
  const html = renderToStaticMarkup(
    createElement(CompatibilityChecks, {
      selected,
      evidence: result.evidence,
      issues: resolved.issues,
      pairSources: resolved.pairSources,
      rules,
    }),
  );
  check(html.includes(item.source.url), "Actual checklist includes correct manufacturer link");
  check(
    html.includes("Listed checks do not verify full physical installation"),
    "Physical-fit limitation remains",
  );
  const wrong = resolveCompatibilityEvidence(
    { ...selected, battery: { ...battery, voltage: item.kind === "fc_esc_connection" ? 2 : 4 } },
    result.evidence,
  );
  check(
    item.kind === "fc_esc_connection"
      ? !wrong.technicalEvidence.fcEscConnector
      : !wrong.technicalEvidence.motorPropeller,
    "Other battery conditions cannot reuse proof",
  );
  const missing = resolveCompatibilityEvidence(
    { ...selected, battery: undefined },
    result.evidence,
  );
  check(
    item.kind === "fc_esc_connection"
      ? !missing.technicalEvidence.fcEscConnector
      : !missing.technicalEvidence.motorPropeller,
    "Unknown battery conditions cannot reuse proof",
  );
  const swapped =
    item.kind === "fc_esc_connection"
      ? { ...selected, esc: { ...selected.esc, id: "synthetic-other-revision" } }
      : { ...selected, motors: { ...selected.motors, id: "synthetic-other-winding" } };
  const different = resolveCompatibilityEvidence(swapped, result.evidence);
  check(
    item.kind === "fc_esc_connection"
      ? !different.technicalEvidence.fcEscConnector
      : !different.technicalEvidence.motorPropeller,
    "Other revisions cannot reuse proof",
  );
  const revoked = {
    ...result.evidence,
    fcEscConnection: result.evidence.fcEscConnection.filter(
      (x) => x.flightControllerId !== item.productIds[0] || x.escId !== item.productIds[1],
    ),
    motorPropeller: result.evidence.motorPropeller.filter(
      (x) => x.motorId !== item.productIds[0] || x.propellerId !== item.productIds[1],
    ),
  };
  const withdrawn = resolveCompatibilityEvidence(selected, revoked);
  check(
    item.kind === "fc_esc_connection"
      ? !withdrawn.technicalEvidence.fcEscConnector
      : !withdrawn.technicalEvidence.motorPropeller,
    "Fresh revocation response removes pair proof",
  );
}
const oldSelected = {
  flightController: products.get("pilot-speedybee-f405-v4"),
  esc: products.get("pilot-speedybee-bls-55a"),
  battery,
};
check(
  resolveCompatibilityEvidence(oldSelected, result.evidence).technicalEvidence.fcEscConnector
    ?.directConnectionCompatibility === "compatible",
  "Existing V4/55A proof preserved",
);
for (const data of [legacy, raw]) {
  check(
    data.evidence.fcEscConnection.filter((x: any) => x.provenance).length === 4,
    "Both real API paths retain all four wiring sources",
  );
  check(
    data.evidence.motorPropeller[0].provenance?.sha256 ===
      plan.entries.find((x: any) => x.kind === "motor_propeller").source.sha256,
    "Both real API paths retain motor/propeller source",
  );
}
const receipt = {
  passed: true,
  checks,
  network:
    "Actual anonymous public captures replayed offline through shared reader/resolver/native rules/React checklist",
  publicProducts: legacy.products.length,
  scopedProducts: result.products.length,
  newWiringPairsVerified: 4,
  newMotorPropellerPairsVerified: 1,
  legacyPairPreserved: true,
  sourceLinksAndScopesVerified: true,
  wrongUnknownCellsOtherIdsAndRevocationRemainUnverified: true,
  fullMechanicalFitApproved: false,
  installedFirmwareApproved: false,
  websiteDeploymentPerformed: false,
};
writeFileSync(
  resolve(captures, "configurator-verification.json"),
  JSON.stringify(receipt, null, 2) + "\n",
);
console.log(JSON.stringify(receipt));
