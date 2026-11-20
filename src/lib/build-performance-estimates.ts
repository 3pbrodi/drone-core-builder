import type { Product } from "./build-data";
import { droneMountedCategoryIds } from "./component-categories";
import { installedComponentWeight, installedQuantity } from "./component-measurements";
import {
  fulfillmentProductForCategory,
  requiredCategoriesForSelection,
  type SelectedProductMap,
} from "./configurator-selection";

/** Display/design estimates only. Never write these into products or compatibility evidence. */
export type EstimateRange = { value: number; min: number; max: number };
export type ComponentMassEstimate = {
  id: string;
  name: string;
  grams: EstimateRange;
  method: "catalogue" | "similar" | "class";
  referenceIds: string[];
};
export type BuildPerformanceEstimate = {
  takeoffGrams: EstimateRange | null;
  components: ComponentMassEstimate[];
  assemblyGrams: EstimateRange;
  speedKmh: EstimateRange | null;
  loadedRpm: number | null;
  rotationsPerSecond: number | null;
  batteryPowerWatts: number | null;
  hoverMinutes: number | null;
  thrustToWeight: number | null;
  assumptions: string[];
  missing: string[];
};
const positive = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;
const range = (value: number, uncertainty: number): EstimateRange => ({
  value,
  min: value * (1 - uncertainty),
  max: value * (1 + uncertainty),
});
const description = (p: Product) => [p.name, p.variant, p.spec].join(" ");
function material(p: Product) {
  const s = description(p).toLowerCase();
  return [
    "carbon fiber",
    "carbon fibre",
    "carbon",
    "polycarbonate",
    "nylon",
    "aluminium",
    "aluminum",
    "tpu",
  ]
    .find((m) => s.includes(m))
    ?.replace("carbon fiber", "carbon")
    .replace("carbon fibre", "carbon")
    .replace("aluminium", "aluminum");
}
function dimensions(p: Product): number[] {
  switch (p.category) {
    case "frame":
      return positive(p.frameInches) ? [p.frameInches] : [];
    case "propellers":
      return positive(p.propInches) ? [p.propInches] : [];
    case "motors":
      return positive(p.motorSize) ? [Math.floor(p.motorSize / 100), p.motorSize % 100] : [];
    case "battery":
      return positive(p.voltage) && positive(p.batteryMah) ? [p.voltage, p.batteryMah] : [];
    case "camera":
      return [p.cameraWidthMm ?? 0, p.cameraHeightMm ?? 0, p.cameraDepthMm ?? 0];
    case "receiver":
      return [p.receiverWidthMm ?? 0, p.receiverHeightMm ?? 0, p.receiverDepthMm ?? 0];
    default:
      return (p.mount?.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
  }
}
function classMass(p: Product, inches: number): number {
  const q = installedQuantity(p),
    size = Math.max(1, Math.min(12, inches));
  switch (p.category) {
    case "frame":
      return 120 * (size / 5) ** 2;
    case "motors": {
      const d = dimensions(p);
      return q * (d.length === 2 ? 33 * (d[0]! / 22) ** 2 * (d[1]! / 7) : 33 * (size / 5) ** 2);
    }
    case "propellers":
      return q * 3.8 * ((p.propInches ?? size) / 5) ** 2.3;
    case "battery":
      return (
        ((p.batteryMah ?? (size <= 3 ? 650 : size >= 6 ? 3000 : 1300)) / 1000) *
        (p.voltage ?? (size <= 3 ? 3 : 6)) *
        3.7 *
        (/li.?ion/i.test(p.batteryChemistry ?? "") ? 5.3 : 7)
      );
    case "flightController":
      return p.integratedCategories?.includes("esc") ? 14 : 8;
    case "esc":
      return 15;
    case "camera":
      return 8;
    case "receiver":
      return 2;
    case "videoTransmitter":
      return 10;
    case "antenna":
      return 3;
    case "gps":
      return 8;
    case "buzzer":
      return 3;
    case "powerAccessory":
      return 8;
    default:
      return 15;
  }
}
export function estimateComponentMass(
  p: Product,
  catalogue: readonly Product[],
  inches = 5,
): ComponentMassEstimate {
  const documented = installedComponentWeight(p);
  if (positive(documented))
    return {
      id: p.id,
      name: p.name,
      grams: range(documented, 0),
      method: "catalogue",
      referenceIds: [],
    };
  const dims = dimensions(p),
    mat = material(p);
  const rankedPeers = catalogue
    .filter(
      (other) =>
        other.id !== p.id &&
        other.category === p.category &&
        positive(installedComponentWeight(other)),
    )
    .map((other) => {
      const otherDims = dimensions(other),
        sameShape = dims.length > 0 && dims.length === otherDims.length;
      const shared = dims
        .map((n, i) => [n, otherDims[i]!] as const)
        .filter(([a, b]) => positive(a) && positive(b));
      const distance =
        sameShape && shared.length
          ? shared.reduce((sum, [a, b]) => sum + Math.abs(Math.log(a / b)), 0) / shared.length
          : 1;
      // Known dissimilar dimensions are not a suitable mass donor.
      return {
        other,
        distance,
        score:
          distance +
          (mat && material(other) && mat !== material(other) ? 2 : 0) +
          (p.category === "battery" &&
          p.batteryChemistry &&
          other.batteryChemistry !== p.batteryChemistry
            ? 1
            : 0),
      };
    })
    .filter((row) => row.distance <= 0.35)
    .sort((a, b) => a.score - b.score || a.other.id.localeCompare(b.other.id));
  const peers = rankedPeers
    .filter((row) => row.score <= (rankedPeers[0]?.score ?? 0) + 0.25)
    .slice(0, 3);
  const masses = peers.map(({ other }) => installedComponentWeight(other)!).sort((a, b) => a - b);
  const lowerBound =
    positive(p.weight) && positive(p.weightUnitQuantity)
      ? (p.weight * installedQuantity(p)) / p.weightUnitQuantity
      : 0;
  const value = Math.max(
    masses.length ? masses[Math.floor(masses.length / 2)]! : classMass(p, inches),
    lowerBound * 1.1,
  );
  const grams = range(value, masses.length ? 0.3 : 0.5);
  grams.min = Math.max(grams.min, lowerBound);
  return {
    id: p.id,
    name: p.name,
    grams,
    method: masses.length ? "similar" : "class",
    referenceIds: peers.map((row) => row.other.id),
  };
}
function nominalCellVolts(chemistry = "") {
  return /lihv/i.test(chemistry) ? 3.8 : /li.?ion/i.test(chemistry) ? 3.6 : 3.7;
}

/** Simplified steady, level-flight model in still air, SI units internally.
 * KV*V gives unloaded RPM. Loaded RPM and prop coefficients are assumptions;
 * thrust, shaft power, hover loss, drag and pitch impose independent ceilings.
 */
export function estimateBuildPerformance(
  selected: SelectedProductMap,
  catalogue: readonly Product[] = [],
  incompatible = false,
): BuildPerformanceEstimate {
  const inches = selected.frame?.frameInches ?? selected.propellers?.propInches ?? 5;
  const mounted = [
    ...new Map(
      droneMountedCategoryIds
        .flatMap((c) => (selected[c] ? [selected[c]!] : []))
        .map((p) => [p.id, p]),
    ).values(),
  ];
  const components = mounted.map((p) => estimateComponentMass(p, catalogue, inches));
  const componentMass = components.reduce((sum, c) => sum + c.grams.value, 0);
  const assemblyGrams = range(Math.max(8, 10 + 3 * inches) + componentMass * 0.04, 0.5);
  const complete = requiredCategoriesForSelection(selected).every((c) => Boolean(selected[c]));
  const takeoffGrams = complete
    ? {
        value: componentMass + assemblyGrams.value,
        min: components.reduce((sum, c) => sum + c.grams.min, 0) + assemblyGrams.min,
        max: components.reduce((sum, c) => sum + c.grams.max, 0) + assemblyGrams.max,
      }
    : null;
  const result: BuildPerformanceEstimate = {
    takeoffGrams,
    components,
    assemblyGrams,
    speedKmh: null,
    loadedRpm: null,
    rotationsPerSecond: null,
    batteryPowerWatts: null,
    hoverMinutes: null,
    thrustToWeight: null,
    assumptions: [
      "Includes estimated wiring, fasteners and mounting allowance; excludes unselected payloads. Not a measured takeoff mass.",
    ],
    missing: [],
  };
  if (components.some((c) => c.method !== "catalogue"))
    result.assumptions.push(
      "Missing/partial installed masses use similar-size, same-category catalogue peers (matching material preferred), otherwise a broad component-class model.",
    );
  if (!complete) {
    result.missing.push(
      "Complete the required drone components to estimate takeoff mass and performance.",
    );
    return result;
  }
  if (incompatible) {
    result.missing.push(
      "Resolve known compatibility conflicts before estimating flight performance.",
    );
    return result;
  }
  const motor = selected.motors,
    prop = selected.propellers,
    battery = selected.battery;
  const esc = fulfillmentProductForCategory(selected, "esc");
  if (!positive(motor?.motorKv)) result.missing.push("Motor KV is missing.");
  if (!positive(prop?.propInches)) result.missing.push("Propeller diameter is missing.");
  if (!positive(battery?.voltage) || !positive(battery?.batteryMah))
    result.missing.push("Battery cell count or capacity is missing.");
  if (result.missing.length || !takeoffGrams) return result;
  const kv = motor!.motorKv!,
    diameter = prop!.propInches! * 0.0254,
    cells = battery!.voltage!,
    ah = battery!.batteryMah! / 1000;
  const volts = cells * nominalCellVolts(battery!.batteryChemistry);
  const cMatch = description(battery!).match(/\b(\d+(?:\.\d+)?)\s*C\b/i);
  const discharge = cMatch
    ? Number(cMatch[1])
    : /li.?ion/i.test(battery!.batteryChemistry ?? "")
      ? 8
      : 35;
  const batteryAmps = ah * discharge;
  const controllerAmps = positive(esc?.escAmps) ? 4 * esc.escAmps : Infinity;
  const motorAmps = positive(motor!.current) ? 4 * motor!.current : Infinity;
  const amps = Math.min(batteryAmps, controllerAmps, motorAmps);
  // Only explicitly written diameter x pitch text is read; ambiguous model codes are not parsed.
  const pitchMatch = description(prop!).match(
    /\b(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)(?:\s*[x×]\s*\d+)?\b/i,
  );
  const explicitPitch =
    pitchMatch && Math.abs(Number(pitchMatch[1]) - prop!.propInches!) < 0.1
      ? Number(pitchMatch[2]) * 0.0254
      : null;
  const pitch = explicitPitch ?? diameter * 0.7;
  const rho = 1.225,
    rotors = 4,
    area = rotors * Math.PI * (diameter / 2) ** 2,
    g = 9.80665;
  const dragArea = 0.012 * (inches / 5) ** 2;
  function solve(
    massGrams: number,
    load: number,
    ct: number,
    cp: number,
    drag: number,
    slip: number,
    powerFactor: number,
  ) {
    const shaftEfficiency = 0.75,
      voltage = volts * 0.9;
    const electricalPower = voltage * amps * powerFactor;
    const n = Math.min(
      (kv * voltage * load) / 60,
      ((electricalPower * shaftEfficiency) / (rotors * cp * rho * diameter ** 5)) ** (1 / 3),
    );
    const thrust = rotors * ct * rho * n * n * diameter ** 4;
    const weight = (massGrams / 1000) * g;
    const hoverShaft = (1.25 * weight ** 1.5) / Math.sqrt(2 * rho * area);
    const shaftPower = rotors * cp * rho * n ** 3 * diameter ** 5;
    const horizontal = Math.sqrt(Math.max(0, thrust ** 2 - weight ** 2));
    const dragCeiling = Math.sqrt((2 * horizontal) / (rho * drag));
    const powerCeiling = Math.cbrt(
      (2 * Math.max(0, shaftPower * 0.65 - hoverShaft)) / (rho * drag),
    );
    const pitchCeiling = n * pitch * slip;
    return {
      speed: Math.min(dragCeiling, powerCeiling, pitchCeiling) * 3.6,
      n,
      thrustToWeight: thrust / weight,
      power: shaftPower / shaftEfficiency,
      hoverElectrical: hoverShaft / shaftEfficiency + 5,
    };
  }
  const mid = solve(takeoffGrams.value, 0.75, 0.1, 0.05, dragArea, 0.75, 1);
  const low = solve(takeoffGrams.max, 0.65, 0.08, 0.065, dragArea * 1.5, 0.6, 0.75);
  const high = solve(takeoffGrams.min, 0.85, 0.12, 0.04, dragArea * 0.65, 0.85, 1);
  result.loadedRpm = Math.round(mid.n * 60);
  result.rotationsPerSecond = Math.round(mid.n);
  result.batteryPowerWatts = Math.round(mid.power);
  result.thrustToWeight = mid.thrustToWeight;
  if (mid.thrustToWeight > 1 && mid.speed > 0) {
    result.speedKmh = {
      value: Math.round(mid.speed),
      min: Math.floor(Math.min(low.speed, mid.speed)),
      max: Math.ceil(Math.max(high.speed, mid.speed)),
    };
    result.hoverMinutes = ((volts * ah * 0.8) / mid.hoverElectrical) * 60;
  } else
    result.missing.push(
      "The assumed power/thrust model cannot support steady level flight at this mass.",
    );
  result.assumptions.push(
    `Still air at 1.225 kg/m³; modeled loaded RPM (65–85% of KV × loaded voltage), 10% voltage sag, 75% motor/ESC efficiency.`,
    `Propeller thrust/power coefficients CT 0.08–0.12, CP 0.04–0.065; assumed drag area ${dragArea.toFixed(4)} m² with −35/+50% variation. No measured airflow or wind data.`,
    explicitPitch
      ? "Pitch taken from explicit diameter × pitch product text; aerodynamic slip remains modeled."
      : "Propeller pitch is missing: assumes 70% of diameter; aerodynamic slip and power remain modeled.",
    cMatch
      ? `Uses the stated ${discharge}C discharge label as an upper bound, not measured battery output.`
      : `Battery discharge rating missing: assumes ${discharge}C; power is a model estimate, not a verified product rating.`,
    "Speed interval is an engineering scenario range, not a measured maximum or statistical confidence interval. Hover endurance is a design comparison, not a range guarantee.",
  );
  return result;
}
