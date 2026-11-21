import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { planAiBuild } from "../src/lib/ai-build-planner";
import { validateBuildCompatibility } from "../src/lib/compatibility-validation";
import { AiBuildReviewNotice } from "../src/components/AiBuildReviewNotice";
import { fixture, proofs } from "./integration/ai-build-fixture-data";
function wiring() {
  const { products, make } = fixture();
  const fc = make("flightController", {
    ...products.find((p) => p.category === "flightController")!,
    id: "verified-fc",
    price: 20,
  });
  const esc = make("esc", {
    ...products.find((p) => p.category === "esc")!,
    id: "verified-esc",
    price: 20,
  });
  const pool = [...products, fc, esc],
    e = proofs(pool);
  e.fcEscConnection = e.fcEscConnection.filter(
    (p) => p.flightControllerId === fc.id && p.escId === esc.id,
  );
  return { pool, e, fc, esc };
}
test("a narrow beam recovers an exact verified FC/ESC pair that requires changing both parts", () => {
  const { pool, e, fc, esc } = wiring();
  const p = planAiBuild({ budget: 300, priorities: ["parkour"] }, pool, e, 1);
  assert(p.complete && p.verified);
  assert.equal(p.selection.flightController, fc.id);
  assert.equal(p.selection.esc, esc.id);
  assert(p.price <= 300);
  assert.equal(
    p.validation.checks.find((c) => c.code === "FC_ESC_CONNECTOR")!.status,
    "verified-compatible",
  );
});
test("a narrow beam recovers an exact motor/propeller pair with the selected operating conditions", () => {
  const { products, make } = fixture();
  const motor = make("motors", {
    ...products.find((p) => p.category === "motors")!,
    id: "verified-motor",
    price: 20,
  });
  const prop = make("propellers", {
    ...products.find((p) => p.category === "propellers")!,
    id: "verified-prop",
    price: 20,
  });
  const pool = [...products, motor, prop],
    e = proofs(pool);
  e.motorPropeller = e.motorPropeller.filter(
    (p) => p.motorId === motor.id && p.propellerId === prop.id,
  );
  e.motorPropeller.forEach(
    (p) => (p.operatingConditions = { batteryCells: 6, motorKv: motor.motorKv! }),
  );
  const p = planAiBuild({ budget: 350, priorities: [] }, pool, e, 1);
  assert(p.complete && p.verified);
  assert.equal(p.selection.motors, motor.id);
  assert.equal(p.selection.propellers, prop.id);
});
test("pending, future, wrong-authority and wrong-cell pairing hints cannot gain verified preference", () => {
  for (const change of [
    { verificationStatus: "pending_review" },
    { verifiedAt: "2999-01-01T00:00:00Z" },
    { authority: "community" },
    { operatingConditions: { batteryCells: 4 } },
  ]) {
    const { pool, e, fc, esc } = wiring();
    e.fcEscConnection = e.fcEscConnection.map(
      (p) => ({ ...p, operatingConditions: { batteryCells: 6 }, ...change }) as any,
    );
    const p = planAiBuild({ budget: 300, priorities: [], wishes: "6S" }, pool, e, 1);
    assert(p.complete && !p.verified);
    assert.notEqual(p.selection.flightController, fc.id);
    assert.notEqual(p.selection.esc, esc.id);
    assert.equal(
      p.validation.checks.find((c) => c.code === "FC_ESC_CONNECTOR")!.status,
      "unverified",
    );
  }
});
test("pair upgrades cannot reintroduce field conflicts or accept contradictory verified pair verdicts", () => {
  let { pool, e, fc } = wiring();
  const field = e.fields.find((f) => f.productId === fc.id && f.field === "minVoltage")!;
  e.fields.push({ ...field, value: 8, sourceId: "conflicting-maker" });
  let p = planAiBuild({ budget: 300, priorities: [] }, pool, e, 1);
  assert.notEqual(p.selection.flightController, fc.id);
  assert(!p.verified);
  ({ pool, e } = wiring());
  e.fcEscConnection.push({ ...e.fcEscConnection[0]!, result: "incompatible" });
  p = planAiBuild({ budget: 300, priorities: [] }, pool, e, 1);
  assert.notEqual(p.selection.flightController, "verified-fc");
  assert(!p.verified);
});
test("verified pair recovery respects the whole-build budget and permits stale/out-of-stock parts", () => {
  const { pool, e, fc, esc } = wiring();
  const unavailable = pool.map((p) =>
    p.id === fc.id || p.id === esc.id ? { ...p, stockStatus: "out_of_stock" as const } : p,
  );
  const p = planAiBuild({ budget: 300, priorities: [] }, unavailable, e, 1);
  assert(p.complete && p.verified);
  assert.equal(p.selection.flightController, fc.id);
  assert.equal(p.selection.esc, esc.id);
  const expensive = pool.map((p) => (p.id === fc.id || p.id === esc.id ? { ...p, price: 100 } : p)),
    facts = proofs(expensive);
  facts.fcEscConnection = e.fcEscConnection;
  const limited = planAiBuild({ budget: 150, priorities: [] }, expensive, facts, 1);
  assert(limited.complete && !limited.verified);
  assert(limited.price <= 150);
});
test("input order does not change the verified choice, and live review notice exposes unresolved checks", () => {
  const { pool, e } = wiring();
  const first = planAiBuild({ budget: 300, priorities: [] }, pool, e, 1);
  const second = planAiBuild(
    { budget: 300, priorities: [] },
    [...pool].reverse(),
    { ...e, fields: [...e.fields].reverse(), fcEscConnection: [...e.fcEscConnection].reverse() },
    1,
  );
  assert.deepEqual(second.selection, first.selection);
  assert.equal(
    renderToStaticMarkup(createElement(AiBuildReviewNotice, { validation: first.validation })),
    "",
  );
  const selected = Object.fromEntries(
    pool.filter((p) => Object.values(first.selection).includes(p.id)).map((p) => [p.category, p]),
  );
  const report = validateBuildCompatibility(selected, { ...e, fcEscConnection: [] });
  const html = renderToStaticMarkup(createElement(AiBuildReviewNotice, { validation: report }));
  assert(html.includes('data-ai-selection-warning="unverified"'));
  assert(html.includes("unverified check"));
  assert(html.includes("Controller–ESC wiring"));
  assert(html.includes('href="#compatibility-checklist"'));
});
