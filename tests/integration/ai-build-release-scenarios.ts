/** Synthetic inputs only; never writes to a database or calls a remote endpoint. */
import type { Product } from "../../src/lib/build-data";
import type { CatalogueEvidenceSnapshot } from "../../src/lib/catalogue-evidence";
export const releaseModes = [
  "complete",
  "missing-wiring",
  "mismatched-wiring",
  "unsupported-combination",
  "missing-dimensions",
  "revoked-evidence",
] as const;
export type ReleaseMode = (typeof releaseModes)[number];
export function releaseScenario(
  products: readonly Product[],
  evidence: CatalogueEvidenceSnapshot,
  mode: ReleaseMode,
) {
  const data = structuredClone({ products: [...products], evidence });
  if (mode === "mismatched-wiring")
    data.evidence.fcEscConnection.forEach((r) => {
      r.result = "incompatible";
    });
  if (mode === "missing-wiring") data.evidence.fcEscConnection = [];
  if (mode === "unsupported-combination") data.evidence.motorPropeller = [];
  if (mode === "revoked-evidence")
    data.evidence.fcEscConnection.forEach((r) => {
      r.verificationStatus = "rejected";
      r.verifiedAt = null;
    });
  if (mode === "missing-dimensions") {
    const omitted = new Map<string, Set<string>>();
    for (const p of data.products) {
      if (p.category === "frame") {
        delete p.frameInches;
        delete p.mount;
        omitted.set(p.id, new Set(["frameInches", "mount"]));
      }
      if (p.category === "propellers") {
        delete p.propInches;
        omitted.set(p.id, new Set(["propInches"]));
      }
    }
    data.evidence.fields = data.evidence.fields.filter(
      (r) => !omitted.get(r.productId)?.has(r.field),
    );
  }
  return data;
}
