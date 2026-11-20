import assert from "node:assert/strict";
import { test } from "node:test";
import { planAiBuild, parseAiRequirements } from "../src/lib/ai-build-planner";
import { loadAiBuildCatalogue } from "../src/lib/ai-build-catalogue";
import { selectionPriceSummary } from "../src/lib/configurator-selection";
import { productPurchaseQuantity } from "../src/lib/component-measurements";
import type { Product, Category } from "../src/lib/build-data";
import type { CatalogueEvidenceSnapshot } from "../src/lib/catalogue-evidence";
import { fixture, proofs } from "./integration/ai-build-fixture-data";
test("real-variant search completes a synthetic valid video build, counts packs and never overspends", () => {
  const { products } = fixture(),
    plan = planAiBuild({ budget: 300, priorities: ["parkour"] }, products, proofs(products));
  assert(plan.complete);
  assert(plan.verified);
  assert.equal(plan.selection.videoTransmitter, "synthetic-videoTransmitter");
  assert.equal(plan.price, 130);
  assert(plan.price <= 300);
  const selected = Object.fromEntries(
    products
      .filter((p) => Object.values(plan.selection).includes(p.id))
      .map((p) => [p.category, p]),
  );
  assert.equal(selectionPriceSummary(selected).drone, plan.price);
  assert.equal(productPurchaseQuantity({ ...products[1]!, weightBasis: undefined } as Product), 4);
  const poor = planAiBuild({ budget: 50, priorities: ["parkour"] }, products, proofs(products));
  assert(!poor.complete);
  assert(poor.price <= 50);
});
test("use case, preferred color and hard free-text constraints affect actual choices", () => {
  const { products, make } = fixture();
  const alternatives = [
    ...products.filter((p) => !["frame", "propellers"].includes(p.category)),
    make("frame", { id: "small", frameInches: 2.5, mount: "16x16" }),
    make("frame", { id: "large", frameInches: 7, mount: "16x16" }),
    make("propellers", { id: "small-prop", propInches: 2.5, packageQuantity: 4 }),
    make("propellers", { id: "large-prop", propInches: 7, packageQuantity: 4 }),
  ];
  const evidence = proofs(alternatives);
  assert.equal(
    planAiBuild({ budget: 300, priorities: ["beginner"] }, alternatives, evidence).selection.frame,
    "small",
  );
  assert.equal(
    planAiBuild({ budget: 300, priorities: ["range"] }, alternatives, evidence).selection.frame,
    "large",
  );
  const blue = make("frame", { id: "blue", variant: "Blue", frameInches: 5, mount: "16x16" }),
    colored = [...products, blue];
  assert.equal(
    planAiBuild({ budget: 300, priorities: [], color: "Sky Blue" }, colored, proofs(colored))
      .selection.frame,
    "blue",
  );
  const constrained = planAiBuild(
    { budget: 300, priorities: ["range"], wishes: "6S ELRS 2.5 inch" },
    alternatives,
    evidence,
  );
  assert.equal(constrained.selection.frame, "small");
  assert.equal(constrained.selection.propellers, "small-prop");
  assert(constrained.notes.some((n) => n.includes("Free-text review")));
});
test("unsupported claims, conflicts, missing package quantities and unverified hard constraints stay explicit", () => {
  const { products } = fixture();
  const e = proofs(products);
  assert.deepEqual(
    planAiBuild({ budget: 300, priorities: [], wishes: "4S and 6S" }, products, e).selection,
    {},
  );
  const noPack = products.map((p) =>
    p.category === "motors" ? ({ ...p, packageQuantity: undefined } as Product) : p,
  );
  assert(!planAiBuild({ budget: 300, priorities: [] }, noPack, proofs(noPack)).selection.motors);
  const unknown = planAiBuild(
    { budget: 300, priorities: [], wishes: "6S ELRS", color: "Arctic White" },
    products,
    { ...e, fields: [] },
  );
  assert(!unknown.complete);
  assert(!unknown.verified);
  assert(unknown.notes.some((n) => n.includes("not documented")));
  assert.equal(parseAiRequirements("no ELRS").protocol, undefined);
  assert.deepEqual(parseAiRequirements("no ELRS").blockedProtocols, ["elrs"]);
  const noCross = planAiBuild({ budget: 300, priorities: [], wishes: "Crossfire" }, products, e);
  assert(!noCross.selection.receiver);
});
test("known incompatible pairs are rejected; incomplete evidence never becomes verified compatibility", () => {
  const { products } = fixture();
  const e = proofs(products);
  e.fcEscConnection[0]!.result = "incompatible";
  assert(!planAiBuild({ budget: 300, priorities: [] }, products, e).complete);
  const partial = planAiBuild({ budget: 300, priorities: [] }, products, {
    ...proofs(products),
    fcEscConnection: [],
  });
  assert(partial.complete);
  assert(!partial.verified);
  assert(partial.notes.some((n) => n.includes("FC_ESC_CONNECTOR")));
});
test("documented installed mass is required for a mass limit and source color/time claims are not invented", () => {
  const { products } = fixture();
  const p = products.map((p) =>
    p.category === "motors" ? { ...p, weightBasis: "partial" as const } : p,
  );
  assert(
    !planAiBuild({ budget: 300, priorities: [], wishes: "under 250g" }, p, proofs(p)).complete,
  );
  const plan = planAiBuild(
    {
      budget: 300,
      priorities: [],
      wishes: "quiet 4K camera 30 minutes flight",
      color: "Forest Green",
    },
    products,
    proofs(products),
  );
  assert(plan.notes.some((n) => n.includes("Free-text review")));
  assert(plan.notes.some((n) => n.includes("not documented")));
  assert(plan.notes.some((n) => n.includes("not a measured flight-time")));
});
test("catalogue collection covers all pages and retrieves pair evidence across 100-ID chunk boundaries", async () => {
  const { make } = fixture(),
    rows = Array.from({ length: 151 }, (_, i) =>
      make(i === 0 ? "motors" : i === 150 ? "esc" : "frame", { id: "p" + i }),
    );
  let calls = 0;
  const idsCalls: string[][] = [];
  const result = await loadAiBuildCatalogue(async (q) => {
    calls++;
    let selected =
      q.mode === "ids"
        ? rows.filter((p) => q.ids!.includes(p.id))
        : rows.slice(((q.page ?? 1) - 1) * 50, (q.page ?? 1) * 50);
    if (q.mode === "ids") idsCalls.push(q.ids!);
    return {
      queryVersion: 1,
      source: "database",
      status: "ready",
      products: selected,
      total: q.mode === "ids" ? selected.length : 151,
      page: q.page ?? 1,
      pageSize: 50,
      hasMore: q.mode !== "ids" && (q.page ?? 1) * 50 < 151,
      rejectedProductIds: [],
      manufacturers: [],
      validation: {
        ok: true,
        missingCategories: [],
        duplicateProductIds: [],
        rejectedProductIds: [],
        invalidProductIds: [],
      },
      evidence: {
        fields: [],
        motorPropeller: [],
        fcEscConnection: [],
        motorEscCurrent:
          q.mode === "ids" && q.ids?.includes("p0") && q.ids.includes("p150")
            ? [{ motorId: "p0", escId: "p150" } as any]
            : [],
      },
    };
  });
  assert.equal(result?.products.length, 151);
  assert.equal(result?.evidence.motorEscCurrent.length, 1);
  assert(idsCalls.every((ids) => ids.length <= 100));
  assert(calls >= 7);
});
