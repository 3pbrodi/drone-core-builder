import { describe, expect, test } from "bun:test";

import { products } from "../src/lib/build-data";
import {
  emptyCatalogueEvidenceSnapshot,
  resolveCompatibilityEvidence,
} from "../src/lib/catalogue-evidence";
import { resolveBuildSelection } from "../src/lib/catalogue-service";

function product(id: string) {
  const found = products.find((item) => item.id === id);
  if (!found) throw new Error(`Missing fixture product: ${id}`);
  return found;
}

const frame5 = product("frame5");
const motors5 = product("motors5");
const motors3 = product("motors3");
const props5 = product("props5");
const esc55 = product("esc55");
const fcF7 = product("fcF7");

describe("catalogue evidence resolver", () => {
  test("verified field evidence only applies to the exact product and exact stored value", () => {
    const selected = { frame: frame5 };
    const snapshot = emptyCatalogueEvidenceSnapshot();
    snapshot.fields.push({
      productId: frame5.id,
      field: "mount",
      value: frame5.mount,
      sourceId: "source-1",
      authority: "manufacturer",
      exactModelAssociation: true,
      verificationStatus: "verified",
      retrievedAt: "2026-09-28T00:00:00Z",
      verifiedAt: "2026-09-28T00:00:00Z",
    });

    const resolved = resolveCompatibilityEvidence(selected, snapshot);
    expect(resolved.verification.frame).toContain("mount");

    snapshot.fields[0] = {
      ...snapshot.fields[0]!,
      value: "different-value",
    };
    const mismatched = resolveCompatibilityEvidence(selected, snapshot);
    expect(mismatched.verification.frame).toBeUndefined();
  });

  test("unverified or non-exact field evidence is ignored", () => {
    const snapshot = emptyCatalogueEvidenceSnapshot();
    snapshot.fields.push(
      {
        productId: frame5.id,
        field: "mount",
        value: frame5.mount,
        sourceId: "source-1",
        authority: "manufacturer",
        exactModelAssociation: false,
        verificationStatus: "verified",
        retrievedAt: "2026-09-28T00:00:00Z",
        verifiedAt: "2026-09-28T00:00:00Z",
      },
      {
        productId: frame5.id,
        field: "frameInches",
        value: frame5.frameInches,
        sourceId: "source-2",
        authority: "manufacturer",
        exactModelAssociation: true,
        verificationStatus: "pending_review",
        retrievedAt: "2026-09-28T00:00:00Z",
        verifiedAt: null,
      },
    );

    const resolved = resolveCompatibilityEvidence({ frame: frame5 }, snapshot);
    expect(resolved.verification.frame).toBeUndefined();
  });

  test("motor-propeller evidence is bound to the exact pair and verified operating conditions", () => {
    const snapshot = emptyCatalogueEvidenceSnapshot();
    snapshot.motorPropeller.push({
      motorId: motors5.id,
      propellerId: props5.id,
      result: "compatible",
      authority: "manufacturer",
      exactProductsVerified: true,
      verificationStatus: "verified",
      retrievedAt: "2026-09-28T00:00:00Z",
      verifiedAt: "2026-09-28T00:00:00Z",
      operatingConditions: { batteryCells: 6 },
    });

    const resolved = resolveCompatibilityEvidence(
      { motors: motors5, propellers: props5 },
      snapshot,
    );
    expect(resolved.technicalEvidence.motorPropeller?.manufacturerCompatibility).toBe("compatible");

    const wrongMotor = resolveCompatibilityEvidence(
      { motors: motors3, propellers: props5 },
      snapshot,
    );
    expect(wrongMotor.technicalEvidence.motorPropeller).toBeUndefined();
  });

  test("motor-ESC current evidence requires exact values, continuous ratings, and verified conditions", () => {
    const snapshot = emptyCatalogueEvidenceSnapshot();
    snapshot.motorEscCurrent.push({
      motorId: motors5.id,
      escId: esc55.id,
      motorCurrentAmps: motors5.current!,
      motorRatingType: "continuous",
      escCurrentAmps: esc55.escAmps!,
      escRatingType: "continuous",
      exactProductsVerified: true,
      ratingTypesVerified: true,
      motorOperatingConditionsVerified: true,
      verificationStatus: "verified",
      retrievedAt: "2026-09-28T00:00:00Z",
      verifiedAt: "2026-09-28T00:00:00Z",
      operatingConditions: { batteryCells: 6, propeller: props5.id },
    });

    const resolved = resolveCompatibilityEvidence({ motors: motors5, esc: esc55 }, snapshot);
    expect(resolved.verification.motors).toContain("current");
    expect(resolved.verification.esc).toContain("escAmps");
    expect(resolved.technicalEvidence.motorEscCurrent).toBeDefined();

    snapshot.motorEscCurrent[0] = {
      ...snapshot.motorEscCurrent[0]!,
      escCurrentAmps: esc55.escAmps! + 1,
    };
    const mismatched = resolveCompatibilityEvidence({ motors: motors5, esc: esc55 }, snapshot);
    expect(mismatched.technicalEvidence.motorEscCurrent).toBeUndefined();
  });

  test("FC-ESC direct-connection evidence requires every verification dimension", () => {
    const snapshot = emptyCatalogueEvidenceSnapshot();
    snapshot.fcEscConnection.push({
      flightControllerId: fcF7.id,
      escId: esc55.id,
      result: "compatible",
      authority: "official_documentation",
      exactProductsVerified: true,
      connectorFamilyVerified: true,
      pinoutVerified: true,
      wireOrderVerified: true,
      signalCompatibilityVerified: true,
      voltageCompatibilityVerified: true,
      verificationStatus: "verified",
      retrievedAt: "2026-09-28T00:00:00Z",
      verifiedAt: "2026-09-28T00:00:00Z",
    });

    const resolved = resolveCompatibilityEvidence({ flightController: fcF7, esc: esc55 }, snapshot);
    expect(resolved.technicalEvidence.fcEscConnector?.directConnectionCompatibility).toBe(
      "compatible",
    );

    snapshot.fcEscConnection[0] = {
      ...snapshot.fcEscConnection[0]!,
      pinoutVerified: false,
    };
    const incomplete = resolveCompatibilityEvidence(
      { flightController: fcF7, esc: esc55 },
      snapshot,
    );
    expect(incomplete.technicalEvidence.fcEscConnector).toBeUndefined();
  });

  test("existing static selections resolve with no invented verification evidence", () => {
    const selected = resolveBuildSelection({
      frame: "frame5",
      motors: "motors5",
      flightController: "fcF7",
      esc: "esc55",
      propellers: "props5",
      battery: "battery6",
      camera: "cameraFpv",
      receiver: "receiver",
    });

    const resolved = resolveCompatibilityEvidence(selected, emptyCatalogueEvidenceSnapshot());
    expect(resolved.verification).toEqual({});
    expect(resolved.technicalEvidence).toEqual({});
  });
});
