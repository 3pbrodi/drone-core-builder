import assert from "node:assert/strict";
import { test } from "node:test";
import { fixture, proofs } from "./integration/ai-build-fixture-data";
import { resolveCompatibilityEvidence } from "../src/lib/catalogue-evidence";
import { planAiBuild } from "../src/lib/ai-build-planner";
import type { Product } from "../src/lib/build-data";
const choose = (products: Product[]) =>
  Object.fromEntries(products.filter((p) => p.category !== "gps").map((p) => [p.category, p]));

test("field evidence rejects invalid/future dates, community/demo authority and incompatible declared units", () => {
  const { products } = fixture(),
    selected = choose(products),
    base = proofs(products),
    row = base.fields.find((f) => f.field === "voltage")!;
  for (const bad of [
    { retrievedAt: "not-a-date" },
    { verifiedAt: "2999-01-01T00:00:00Z" },
    { authority: "community" as const },
    { authority: "internal_demo" as const },
    { unit: "V" },
  ]) {
    const e = { ...base, fields: [{ ...row, ...bad }] };
    assert(!resolveCompatibilityEvidence(selected, e).verification.battery?.includes("voltage"));
  }
  assert(
    resolveCompatibilityEvidence(selected, {
      ...base,
      fields: [{ ...row, unit: "cells" }],
    }).verification.battery?.includes("voltage"),
  );
});
test("conflicting verified field values fail closed in either order and exclude only affected AI variants", () => {
  const { products, make } = fixture(),
    selected = choose(products),
    e = proofs(products),
    row = e.fields.find((f) => f.productId === selected.frame.id && f.field === "mount")!;
  const conflict = { ...row, value: "30x30", sourceId: "other-maker-proof" };
  for (const fields of [
    [...e.fields, conflict],
    [conflict, ...e.fields],
  ]) {
    const resolved = resolveCompatibilityEvidence(selected, { ...e, fields });
    assert(!resolved.verification.frame?.includes("mount"));
    assert(resolved.issues.some((i) => i.kind === "conflict"));
    const replacement = make("frame", { ...selected.frame, id: "valid-frame" }),
      pool = [...products, replacement];
    const valid = proofs([replacement]);
    const plan = planAiBuild({ budget: 300, priorities: [] }, pool, {
      ...e,
      fields: [...fields, ...valid.fields],
    });
    assert.equal(plan.selection.frame, "valid-frame");
    assert(plan.complete);
  }
});
test("motor/propeller evidence follows actual cell conditions and distinguishes applicable conflicting verdicts", () => {
  const { products } = fixture(),
    selected = choose(products),
    e = proofs(products);
  e.motorPropeller[0]!.operatingConditions = { batteryCells: 6 };
  assert.equal(
    resolveCompatibilityEvidence(selected, e).technicalEvidence.motorPropeller
      ?.manufacturerCompatibility,
    "compatible",
  );
  const other = resolveCompatibilityEvidence(
    { ...selected, battery: { ...selected.battery!, voltage: 4 } },
    e,
  );
  assert.equal(other.technicalEvidence.motorPropeller, undefined);
  assert(other.issues.some((i) => i.kind === "conditions"));
  assert.equal(
    resolveCompatibilityEvidence({ ...selected, battery: undefined }, e).technicalEvidence
      .motorPropeller,
    undefined,
  );
  e.motorPropeller.push({
    ...e.motorPropeller[0]!,
    result: "incompatible",
    operatingConditions: { batteryCells: 4 },
  });
  assert.equal(
    resolveCompatibilityEvidence(selected, e).technicalEvidence.motorPropeller
      ?.manufacturerCompatibility,
    "compatible",
  );
  e.motorPropeller.push({ ...e.motorPropeller[0]!, result: "incompatible" });
  for (const rows of [e.motorPropeller, [...e.motorPropeller].reverse()]) {
    const r = resolveCompatibilityEvidence(selected, { ...e, motorPropeller: rows });
    assert.equal(r.technicalEvidence.motorPropeller, undefined);
    assert(r.issues.some((i) => i.kind === "conflict"));
  }
  e.motorPropeller = [{ ...e.motorPropeller[0]!, operatingConditions: { arbitrary: true } }];
  assert.equal(
    resolveCompatibilityEvidence(selected, e).technicalEvidence.motorPropeller,
    undefined,
  );
});
test("continuous-current evidence requires exact propeller/cells and conflicting current ratings remain blocked", () => {
  const { products } = fixture(),
    selected = choose(products),
    e = proofs(products),
    row = e.motorEscCurrent[0]!;
  row.operatingConditions = { batteryCells: 6, propeller: selected.propellers.id };
  assert(resolveCompatibilityEvidence(selected, e).technicalEvidence.motorEscCurrent);
  assert.equal(
    resolveCompatibilityEvidence(
      { ...selected, propellers: { ...selected.propellers!, id: "other-variant" } },
      e,
    ).technicalEvidence.motorEscCurrent,
    undefined,
  );
  assert.equal(
    resolveCompatibilityEvidence({ ...selected, battery: { ...selected.battery!, voltage: 4 } }, e)
      .technicalEvidence.motorEscCurrent,
    undefined,
  );
  e.motorEscCurrent.push({ ...row, motorCurrentAmps: row.motorCurrentAmps + 1 });
  const resolved = resolveCompatibilityEvidence(selected, e);
  assert.equal(resolved.technicalEvidence.motorEscCurrent, undefined);
  assert(resolved.issues.some((i) => i.kind === "conflict"));
});
test("FC/ESC contradictory wiring never becomes a first-row pass, and native AI rejects the disputed pair", () => {
  const { products } = fixture(),
    selected = choose(products),
    e = proofs(products);
  e.fcEscConnection.push({ ...e.fcEscConnection[0]!, result: "incompatible" });
  for (const rows of [e.fcEscConnection, [...e.fcEscConnection].reverse()]) {
    const snapshot = { ...e, fcEscConnection: rows },
      resolved = resolveCompatibilityEvidence(selected, snapshot);
    assert.equal(resolved.technicalEvidence.fcEscConnector, undefined);
    assert(resolved.issues.some((i) => i.kind === "conflict"));
    const plan = planAiBuild({ budget: 300, priorities: [] }, products, snapshot);
    assert(!plan.complete && !plan.verified);
  }
});
test("AI prefers supported compatibility over higher modeled motor performance and cheaper price", () => {
  const { products, make } = fixture();
  const pool = [
    ...products.filter((p) => p.category !== "motors"),
    make("motors", {
      ...products.find((p) => p.category === "motors")!,
      id: "supported",
      current: 3,
      price: 25,
    }),
    make("motors", {
      ...products.find((p) => p.category === "motors")!,
      id: "faster-unverified",
      current: 30,
      price: 10,
    }),
  ];
  const e = proofs(pool);
  e.motorPropeller = e.motorPropeller.filter((r) => r.motorId === "supported");
  e.motorEscCurrent = e.motorEscCurrent.filter((r) => r.motorId === "supported");
  const plan = planAiBuild({ budget: 300, priorities: ["parkour"] }, pool, e);
  assert.equal(plan.selection.motors, "supported");
  assert(plan.complete && plan.verified);
  const unknown = planAiBuild({ budget: 300, priorities: ["parkour"] }, pool, {
    ...e,
    motorPropeller: [],
    motorEscCurrent: [],
  });
  assert(unknown.complete && !unknown.verified);
});
test("battery-first planning preserves an exact supported pair that a size heuristic alone would reject", () => {
  const { products } = fixture();
  const pool = products.map((p) =>
    p.category === "frame"
      ? { ...p, frameInches: 2.5 }
      : p.category === "propellers"
        ? { ...p, propInches: 2.5 }
        : p,
  );
  const e = proofs(pool);
  e.motorPropeller.forEach((row) => (row.operatingConditions = { batteryCells: 6 }));
  e.motorEscCurrent.forEach(
    (row) =>
      (row.operatingConditions = {
        batteryCells: 6,
        propeller: pool.find((p) => p.category === "propellers")!.id,
      }),
  );
  const plan = planAiBuild(
    { budget: 300, priorities: ["beginner"], wishes: "6S 2.5 inch" },
    pool,
    e,
  );
  assert(plan.complete && plan.verified);
});

test("integrated ESC claims do not gain a false verified rating or outrank fully checked separate parts", () => {
  const { products, make } = fixture();
  const aio = make("flightController", {
    ...products.find((p) => p.category === "flightController")!,
    id: "aio-without-current-proof",
    integratedCategories: ["esc"],
    price: 1,
  });
  const pool = [...products, aio],
    e = proofs(pool),
    plan = planAiBuild({ budget: 300, priorities: [] }, pool, e);
  assert.notEqual(plan.selection.flightController, aio.id);
  assert(plan.verified);
  const only = [
    ...pool.filter(
      (p) => p.category !== "esc" && (p.category !== "flightController" || p.id === aio.id),
    ),
  ];
  const partial = planAiBuild({ budget: 300, priorities: [] }, only, proofs(only));
  assert(partial.complete && !partial.verified);
  assert(partial.notes.some((n) => n.includes("INTEGRATED_ESC_CURRENT")));
});
