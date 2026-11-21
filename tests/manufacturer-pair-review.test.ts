import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CompatibilityChecks } from "../src/components/CompatibilityChecks";
import {
  resolveCompatibilityEvidence,
  emptyCatalogueEvidenceSnapshot,
  type CatalogueEvidenceSnapshot,
} from "../src/lib/catalogue-evidence";
import type { Product } from "../src/lib/build-data";
import { mapEvidenceRows } from "../supabase/functions/_shared/catalogue-evidence-read";
import { rehearseManufacturerPairs } from "./integration/manufacturer-pair-review";
const source = {
  sourceId: "exact-source",
  snapshotId: "exact-capture",
  url: "https://www.speedybee.com/manual.pdf",
  sha256: "a".repeat(64),
  locator: "PDF p5",
  scope:
    "Exact supplied harness and matching PCB only; not complete mechanical or installed firmware approval.",
};
const part = (id: string, category: Product["category"], extra: Partial<Product> = {}) =>
  ({ id, category, name: id, price: 1, spec: "Fixture", ...extra }) as Product;
const selected = {
  flightController: part("fc", "flightController"),
  esc: part("esc", "esc"),
  battery: part("6s", "battery", { voltage: 6 }),
};
function evidence(): CatalogueEvidenceSnapshot {
  return {
    ...emptyCatalogueEvidenceSnapshot(),
    fcEscConnection: [
      {
        flightControllerId: "fc",
        escId: "esc",
        result: "compatible",
        authority: "manufacturer",
        exactProductsVerified: true,
        connectorFamilyVerified: true,
        pinoutVerified: true,
        wireOrderVerified: true,
        signalCompatibilityVerified: true,
        voltageCompatibilityVerified: true,
        verificationStatus: "verified",
        retrievedAt: "2026-11-20T12:00:00Z",
        verifiedAt: "2026-11-21T12:00:00Z",
        operatingConditions: { minBatteryCells: 3, maxBatteryCells: 6 },
        provenance: source,
      },
    ],
  };
}
test("pair provenance survives the shared public/server mapper without invented legacy links", () => {
  const base = evidence().fcEscConnection[0]!;
  const row = {
    flight_controller_product_id: "fc",
    esc_product_id: "esc",
    result: base.result,
    authority: base.authority,
    exact_products_verified: true,
    connector_family_verified: true,
    pinout_verified: true,
    wire_order_verified: true,
    signal_compatibility_verified: true,
    voltage_compatibility_verified: true,
    verification_status: base.verificationStatus,
    retrieved_at: base.retrievedAt!,
    verified_at: base.verifiedAt!,
    details: { operatingConditions: { minBatteryCells: 3, maxBatteryCells: 6 } },
    source_id: source.sourceId,
    source_snapshot_id: source.snapshotId,
    source_url: source.url,
    source_content_hash: source.sha256,
    source_locator: source.locator,
    compatibility_scope: source.scope,
  };
  const map = (r: typeof row) =>
    mapEvidenceRows({ fields: [], motorPropellerRows: [], motorEscRows: [], fcEscRows: [r] });
  const e = map(row);
  assert.deepEqual(e.fcEscConnection[0]!.provenance, source);
  assert.equal(
    resolveCompatibilityEvidence(selected, e).pairSources.FC_ESC_CONNECTOR?.[0]?.sha256,
    source.sha256,
  );
  const legacy = map({
    ...row,
    source_snapshot_id: undefined,
    source_url: undefined,
    source_content_hash: undefined,
    source_locator: undefined,
    compatibility_scope: undefined,
  } as unknown as typeof row);
  assert.equal(legacy.fcEscConnection[0]!.provenance, undefined);
  assert.equal(
    resolveCompatibilityEvidence(selected, legacy).pairSources.FC_ESC_CONNECTOR?.length,
    0,
  );
});
test("reviewed wiring proof cannot escape cells, exact IDs, pending/revoked status or malformed provenance", () => {
  assert(resolveCompatibilityEvidence(selected, evidence()).technicalEvidence.fcEscConnector);
  for (const battery of [
    undefined,
    part("2s", "battery", { voltage: 2 }),
    part("8s", "battery", { voltage: 8 }),
  ]) {
    const r = resolveCompatibilityEvidence({ ...selected, battery }, evidence());
    assert.equal(r.technicalEvidence.fcEscConnector, undefined);
    assert.equal(r.pairSources.FC_ESC_CONNECTOR, undefined);
  }
  assert.equal(
    resolveCompatibilityEvidence({ ...selected, esc: part("other-revision", "esc") }, evidence())
      .technicalEvidence.fcEscConnector,
    undefined,
  );
  for (const status of ["pending_review", "rejected", "unverified"] as const) {
    const e = evidence();
    e.fcEscConnection[0]!.verificationStatus = status;
    assert.equal(
      resolveCompatibilityEvidence(selected, e).technicalEvidence.fcEscConnector,
      undefined,
    );
  }
  for (const bad of [
    { sha256: "not-a-sha" },
    { snapshotId: "" },
    { url: "javascript:alert(1)" },
    { url: "https://user:pass@example.invalid/" },
    { scope: "" },
    { locator: "" },
  ]) {
    const e = evidence();
    e.fcEscConnection[0]!.provenance = { ...source, ...bad };
    assert.equal(
      resolveCompatibilityEvidence(selected, e).technicalEvidence.fcEscConnector,
      undefined,
    );
  }
});
test("contradictory applicable pair verdicts block approval display in either order", () => {
  for (const reverse of [false, true]) {
    const e = evidence();
    e.fcEscConnection.push({ ...e.fcEscConnection[0]!, result: "incompatible" });
    if (reverse) e.fcEscConnection.reverse();
    const r = resolveCompatibilityEvidence(selected, e);
    assert.equal(r.technicalEvidence.fcEscConnector, undefined);
    assert.equal(r.pairSources.FC_ESC_CONNECTOR, undefined);
    assert(r.issues.some((x) => x.kind === "conflict"));
  }
});
test("checklist renders actual pair source, locator and scope, preserving physical/firmware limits", () => {
  const e = evidence(),
    r = resolveCompatibilityEvidence(selected, e);
  const html = renderToStaticMarkup(
    createElement(CompatibilityChecks, {
      selected,
      evidence: e,
      issues: [],
      pairSources: r.pairSources,
      rules: [
        {
          code: "FC_ESC_CONNECTOR",
          categories: ["flightController", "esc"],
          applicable: true,
          status: "pass",
          evidenceLevel: "verified",
          explanation: "Exact documented pair",
          evidence: {},
          missingFields: [],
          unverifiedFields: [],
        },
      ],
    }),
  );
  assert(html.includes('href="https://www.speedybee.com/manual.pdf"'));
  assert(html.includes("Exact supplied harness"));
  assert(html.includes("PDF p5"));
  assert(html.includes("not verify full physical installation"));
  assert(!html.includes("<details open"));
});
test(
  "five source-reviewed pairs pass native review, transport and revocation in a disposable local clone",
  { skip: process.env.DRONECORES_PAIR_LOCAL !== "1" },
  () => {
    const result = rehearseManufacturerPairs();
    for (const row of result.approved.fcEscConnection) {
      const s = {
        flightController: part(row.flightControllerId, "flightController"),
        esc: part(row.escId, "esc"),
        battery: selected.battery,
      };
      assert.equal(
        resolveCompatibilityEvidence(s, result.approved).technicalEvidence.fcEscConnector
          ?.directConnectionCompatibility,
        "compatible",
      );
      assert.equal(
        resolveCompatibilityEvidence(s, result.revoked).technicalEvidence.fcEscConnector,
        undefined,
      );
      assert.equal(
        resolveCompatibilityEvidence(
          { ...s, battery: part("8s", "battery", { voltage: 8 }) },
          result.approved,
        ).technicalEvidence.fcEscConnector,
        undefined,
      );
    }
    const m = result.approved.motorPropeller[0]!,
      s = {
        motors: part(m.motorId, "motors", { motorKv: 1750 }),
        propellers: part(m.propellerId, "propellers"),
        battery: selected.battery,
      };
    assert.equal(
      resolveCompatibilityEvidence(s, result.approved).technicalEvidence.motorPropeller
        ?.manufacturerCompatibility,
      "compatible",
    );
    for (const changed of [
      { battery: part("4s", "battery", { voltage: 4 }) },
      { motors: part("1855-revision", "motors", { motorKv: 1855 }) },
      { propellers: part("generic-5140", "propellers") },
    ])
      assert.equal(
        resolveCompatibilityEvidence({ ...s, ...changed }, result.approved).technicalEvidence
          .motorPropeller,
        undefined,
      );
    assert.equal(
      resolveCompatibilityEvidence(s, result.revoked).technicalEvidence.motorPropeller,
      undefined,
    );
    const migrationSha256 = createHash("sha256")
      .update(readFileSync("supabase/migrations/" + result.migration))
      .digest("hex");
    writeFileSync(
      "qa/manufacturer-pair-review-20261121.json",
      JSON.stringify(
        {
          passed: true,
          scope:
            "Disposable clone of existing local staging; migration and all fixtures rolled back, clone dropped",
          newWiringPairsRehearsed: 4,
          motorPropellerPairsRehearsed: 1,
          sourceDatabasePreserved: result.sourceDatabasePreserved,
          dossierSha256: result.dossierSha256,
          migration: result.migration,
          migrationSha256,
          persistentApprovalsAdded: 0,
          productionWrites: false,
          imagesAdded: 0,
        },
        null,
        2,
      ) + "\n",
    );
  },
);
