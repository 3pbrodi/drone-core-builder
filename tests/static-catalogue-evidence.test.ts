import { describe, expect, test } from "bun:test";

import { presets } from "../src/lib/build-data";
import { candidateCheck, evaluate } from "../src/lib/build-calculations";
import { resolveBuildSelection } from "../src/lib/catalogue-service";
import {
  resolveStaticCompatibilityEvidence,
  staticCatalogueEvidenceSnapshot,
} from "../src/lib/static-catalogue-evidence";

describe("reviewed static compatibility evidence", () => {
  test("only source-backed fields are marked verified", () => {
    const selected = resolveBuildSelection({
      frame: "frame5",
      esc: "esc55",
      camera: "cameraFpv",
      receiver: "receiver",
    });

    const evidence = resolveStaticCompatibilityEvidence(selected);

    expect(evidence.verification.frame).toContain("mount");
    expect(evidence.verification.esc).toContain("escAmps");
    expect(evidence.verification.esc).not.toContain("minVoltage");
    expect(evidence.verification.esc).toContain("maxVoltage");
    expect(evidence.verification.camera).toContain("weight");
    expect(evidence.verification.camera).toContain("video");
    expect(evidence.verification.receiver).toBeUndefined();
    expect(evidence.verification.motors).toBeUndefined();
    expect(evidence.technicalEvidence).toEqual({});
  });

  test("conflicting demo records have no fabricated verified field evidence", () => {
    const conflictingIds = new Set(["motors5", "props5", "battery6"]);
    for (const item of staticCatalogueEvidenceSnapshot.fields) {
      expect(conflictingIds.has(item.productId)).toBe(false);
    }
  });

  test("existing template remains potentially compatible rather than becoming falsely verified", () => {
    const selected = resolveBuildSelection(presets.racer.selection);
    const evidence = resolveStaticCompatibilityEvidence(selected);
    const result = evaluate(selected, evidence.verification, evidence.technicalEvidence);

    expect(result.complete).toBe(true);
    expect(result.status).toBe("potentially-compatible");
    expect(result.price).toBeGreaterThan(0);
  });

  test("candidate checks resolve evidence for the proposed exact selection", () => {
    const selected = resolveBuildSelection({
      frame: "frame5",
      motors: "motors5",
      esc: "esc55",
    });
    const candidate = selected.motors;
    if (!candidate) throw new Error("Expected motors5 fixture");

    const evidence = resolveStaticCompatibilityEvidence(selected);
    const result = candidateCheck(
      selected,
      "motors",
      candidate,
      evidence.verification,
      evidence.technicalEvidence,
    );

    expect(result.status).toBe("potentially-compatible");
    expect(
      result.rules.some(
        (rule) => rule.evidenceLevel === "heuristic" || rule.evidenceLevel === "unverified",
      ),
    ).toBe(true);
  });
});
