/** Offline release check of an existing saved public catalogue. Never fetches live data. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { planAiBuild, type AiBuildAnswers } from "../../src/lib/ai-build-planner";
import { resolveCompatibilityEvidence } from "../../src/lib/catalogue-evidence";
const path = process.env.AI_RELEASE_SNAPSHOT;
if (!path)
  throw new Error("Set AI_RELEASE_SNAPSHOT to the existing local public-catalogue capture.");
const bytes = readFileSync(path),
  snapshot = JSON.parse(bytes.toString());
assert.equal(snapshot.status, "ready");
assert(Array.isArray(snapshot.products) && snapshot.evidence);
assert.equal(new Set(snapshot.products.map((p: any) => p.id)).size, snapshot.products.length);
const before = JSON.stringify(snapshot);
globalThis.fetch = (async () => {
  throw new Error("Offline snapshot release checks forbid network requests.");
}) as typeof fetch;
const answers: AiBuildAnswers[] = [
  { budget: 400, priorities: ["beginner"] },
  { budget: 800, priorities: ["parkour"] },
  { budget: 900, priorities: ["footage"] },
  { budget: 1200, priorities: ["range"] },
];
const results = answers.map((input) => {
  const plan = planAiBuild(input, snapshot.products, snapshot.evidence);
  assert(plan.price <= input.budget);
  assert.notEqual(plan.validation.status, "verified-incompatible");
  const chosen = Object.fromEntries(
    Object.entries(plan.selection).map(([category, id]) => {
      const p = snapshot.products.find((p: any) => p.id === id);
      assert(p && p.category === category);
      return [category, p];
    }),
  );
  assert(
    !resolveCompatibilityEvidence(chosen, snapshot.evidence).issues.some(
      (i) => i.kind === "conflict",
    ),
  );
  assert.equal(plan.verified, plan.complete && plan.validation.status === "verified-compatible");
  return {
    priorities: input.priorities,
    budget: input.budget,
    lastRecordedTotal: plan.price,
    complete: plan.complete,
    verified: plan.verified,
    status: plan.validation.status,
    selectedProducts: Object.keys(plan.selection).length,
    unresolvedChecks: plan.validation.checks
      .filter((c) => c.status === "unverified")
      .map((c) => c.code),
    missingCategories: plan.validation.missingCategories,
  };
});
assert.equal(JSON.stringify(snapshot), before, "Planner changed source facts or observation dates");
const receipt = {
  passed: true,
  captureFileSha256: createHash("sha256").update(bytes).digest("hex"),
  products: snapshot.products.length,
  results,
  inputFactsAndTimestampsUnchanged: true,
  offlineOnly: true,
  productionReads: false,
  productionWrites: false,
  fullMechanicalFitApproved: false,
  installedFirmwareApproved: false,
};
writeFileSync(
  "qa/ai-build-snapshot-release-20261121.json",
  JSON.stringify(receipt, null, 2) + "\n",
);
console.log(JSON.stringify(receipt));
