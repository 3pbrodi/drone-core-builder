import assert from "node:assert/strict";
import { test } from "node:test";
import { fixture, proofs } from "./integration/ai-build-fixture-data";
import { planAiBuild } from "../src/lib/ai-build-planner";
import {
  estimateBuildPerformance,
  estimateComponentMass,
} from "../src/lib/build-performance-estimates";
import type { Product } from "../src/lib/build-data";
const selected = (products: Product[]) =>
  Object.fromEntries(products.filter((p) => p.category !== "gps").map((p) => [p.category, p]));

test("larger budget buys useful motor performance, without paying for an identical expensive variant", () => {
  const { products, make } = fixture();
  const pool = [
    ...products.filter((p) => p.category !== "motors"),
    make("motors", {
      ...products.find((p) => p.category === "motors")!,
      id: "economy",
      current: 3,
    }),
    make("motors", {
      ...products.find((p) => p.category === "motors")!,
      id: "performance",
      current: 30,
      price: 45,
    }),
    make("motors", {
      ...products.find((p) => p.category === "motors")!,
      id: "overpriced",
      current: 30,
      price: 55,
    }),
  ];
  const before = JSON.stringify(pool),
    e = proofs(pool);
  const low = planAiBuild({ budget: 150, priorities: ["parkour"] }, pool, e),
    high = planAiBuild({ budget: 300, priorities: ["parkour"] }, pool, e);
  assert.equal(low.selection.motors, "economy");
  assert.equal(high.selection.motors, "performance");
  assert(high.price > low.price && high.price <= 300 && low.price <= 150);
  assert(high.performance.thrustToWeight! > low.performance.thrustToWeight!);
  assert.equal(JSON.stringify(pool), before);
});
test("range profile considers complete-build endurance and battery mass within budget", () => {
  const { products, make } = fixture();
  const pool = [
    ...products,
    make("battery", {
      ...products.find((p) => p.category === "battery")!,
      id: "endurance",
      batteryMah: 3000,
      weight: 200,
      price: 70,
    }),
  ];
  const low = planAiBuild({ budget: 160, priorities: ["range"] }, pool, proofs(pool));
  const high = planAiBuild({ budget: 230, priorities: ["range"] }, pool, proofs(pool));
  assert.notEqual(low.selection.battery, "endurance");
  assert.equal(high.selection.battery, "endurance");
  assert(high.price <= 230);
  assert(high.performance.hoverMinutes! > low.performance.hoverMinutes!);
});
test("mass donors match category, size and material, normalize installed quantity and preserve source data", () => {
  const { make } = fixture();
  const p = make("motors", {
    id: "partial",
    motorSize: 2207,
    name: "Aluminum motor",
    weight: 20,
    weightBasis: "partial",
  });
  const peers = [
    make("motors", { id: "matching", motorSize: 2207, name: "Aluminum motor", weight: 33 }),
    make("motors", { id: "wrong-material", motorSize: 2207, name: "Carbon motor", weight: 60 }),
    make("motors", { id: "wrong-size", motorSize: 802, name: "Aluminum motor", weight: 2 }),
    make("camera", { id: "wrong-category", weight: 33 }),
  ];
  const before = JSON.stringify(p),
    mass = estimateComponentMass(p, peers);
  assert.equal(mass.method, "similar");
  assert.equal(mass.grams.value, 132);
  assert.deepEqual(mass.referenceIds, ["matching"]);
  assert(mass.grams.min >= 80 && mass.grams.max > 132);
  assert.equal(JSON.stringify(p), before);
  const noWeight = { ...p, weight: 0 };
  const fallback = estimateComponentMass(noWeight, []);
  assert.equal(fallback.method, "class");
  assert(fallback.grams.min > 0 && fallback.grams.max > fallback.grams.value);
  const prop = make("propellers", {
      id: "partial-prop",
      propInches: 5,
      weight: 1,
      weightBasis: "partial",
    }),
    pack = make("propellers", {
      id: "pack",
      propInches: 5,
      weight: 16,
      weightBasis: "per_package",
      weightUnitQuantity: 4,
      packageQuantity: 4,
    });
  assert.equal(estimateComponentMass(prop, [pack]).grams.value, 16);
  const camera = make("camera", {
    id: "partial-camera",
    weight: 0,
    weightBasis: "partial",
    cameraWidthMm: 14,
  });
  const wrongAxis = make("camera", { id: "height-only", cameraHeightMm: 14, weight: 12 });
  const sameAxis = make("camera", { id: "width-match", cameraWidthMm: 14, weight: 7 });
  assert.deepEqual(estimateComponentMass(camera, [wrongAxis, sameAxis]).referenceIds, [
    "width-match",
  ]);
});
test("estimated takeoff mass includes assembly and unknown weights, excludes pilot gear, and stays separate from facts", () => {
  const { products, make } = fixture();
  const parts = selected(products);
  parts.motors = { ...parts.motors!, weightBasis: "partial" };
  const before = JSON.stringify(parts),
    e = estimateBuildPerformance(parts, products);
  assert(
    e.takeoffGrams && e.takeoffGrams.value > e.components.reduce((s, c) => s + c.grams.value, 0),
  );
  assert(e.takeoffGrams.min < e.takeoffGrams.max);
  assert(e.components.some((c) => c.method !== "catalogue"));
  const withPilot = estimateBuildPerformance(
    { ...parts, radioTransmitter: make("radioTransmitter", { weight: 900 }) },
    products,
  );
  assert.deepEqual(e.takeoffGrams, withPilot.takeoffGrams);
  assert.equal(JSON.stringify(parts), before);
  assert.equal(
    estimateBuildPerformance({ ...parts, battery: undefined }, products).takeoffGrams,
    null,
  );
});
test("speed responds to loaded RPM, mass and battery power, with explicit uncertainty and missing-input handling", () => {
  const { products } = fixture();
  const parts = selected(products),
    base = estimateBuildPerformance(parts, products);
  assert(
    base.speedKmh &&
      base.speedKmh.min <= base.speedKmh.value &&
      base.speedKmh.max >= base.speedKmh.value,
  );
  assert.equal(base.rotationsPerSecond, Math.round(base.loadedRpm! / 60));
  assert(base.batteryPowerWatts! > 0);
  const slower = estimateBuildPerformance(
    { ...parts, motors: { ...parts.motors!, motorKv: 1000 } },
    products,
  );
  assert(slower.speedKmh!.value < base.speedKmh.value);
  const heavy = estimateBuildPerformance(
    { ...parts, frame: { ...parts.frame!, weight: 2200 } },
    products,
  );
  assert(!heavy.speedKmh || heavy.speedKmh.value < base.speedKmh.value);
  const weak = estimateBuildPerformance(
    { ...parts, battery: { ...parts.battery!, spec: "1C discharge" } },
    products,
  );
  assert(!weak.speedKmh || weak.speedKmh.value < base.speedKmh.value);
  assert.equal(estimateBuildPerformance(parts, products, true).speedKmh, null);
  assert.equal(
    estimateBuildPerformance({ ...parts, motors: { ...parts.motors!, motorKv: NaN } }, products)
      .speedKmh,
    null,
  );
  assert(base.assumptions.some((s) => s.includes("pitch is missing")));
  assert(base.assumptions.some((s) => s.includes("No measured airflow")));
  const explicit = estimateBuildPerformance(
    { ...parts, propellers: { ...parts.propellers!, spec: "5 x 4.3 x 3" } },
    products,
  );
  assert(explicit.assumptions.some((s) => s.includes("Pitch taken from explicit")));
});
