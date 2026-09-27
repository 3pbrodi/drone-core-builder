import { byId, categories, type BuildSelection, type Category, type Product } from "./build-data";

export type Check = { status: "compatible" | "incompatible" | "unknown"; messages: string[] };
export function evaluate(selection: BuildSelection) {
  const selected = Object.fromEntries(categories.map((c) => [c, byId[selection[c] ?? ""]])) as Partial<Record<Category, Product>>;
  const frame = selected.frame, motors = selected.motors, props = selected.propellers, battery = selected.battery;
  const fc = selected.flightController, esc = selected.esc;
  const warnings: string[] = [];
  const missing: string[] = [];
  const compare = (a: Product | undefined, b: Product | undefined, label: string, rule: (x: Product, y: Product) => boolean, detail: string) => {
    if (!a || !b) return;
    if (!rule(a, b)) warnings.push(`${label}: ${detail}`);
  };
  compare(frame, motors, "Frame / motors", (a,b) => !!a.mount && !!b.mount && a.mount === b.mount, "Motor mounting pattern does not fit the frame.");
  compare(frame, props, "Frame / propellers", (a,b) => !!a.frameInches && !!b.propInches && b.propInches <= a.frameInches, "Propellers exceed frame clearance.");
  compare(motors, props, "Motors / propellers", (a,b) => !!a.motorSize && !!b.propInches && (a.motorSize >= 2600 ? b.propInches >= 6 && b.propInches <= 7 : a.motorSize >= 2000 ? b.propInches >= 4 && b.propInches <= 5 : b.propInches <= 3), "Motor size is not rated for this propeller diameter in the demo data.");
  for (const [part, label] of [[motors,"Motors"],[esc,"ESC"],[fc,"Flight controller"]] as const) {
    if (battery && part && battery.voltage !== undefined) {
      if (part.minVoltage === undefined || part.maxVoltage === undefined) missing.push(`${label} voltage range is missing.`);
      else if (battery.voltage < part.minVoltage || battery.voltage > part.maxVoltage) warnings.push(`${label}: ${battery.voltage}S battery is outside supported ${part.minVoltage}–${part.maxVoltage}S range.`);
    }
  }
  compare(fc, esc, "Controller / ESC", (a,b) => !!a.connector && !!b.escInput && a.connector === b.escInput, "ESC plug does not match flight controller connector.");
  compare(motors, esc, "Motors / ESC", (a,b) => !!a.current && !!b.escAmps && a.current <= b.escAmps, "Motor peak current exceeds ESC rating.");
  const complete = categories.every((c) => !!selected[c]);
  const count = categories.filter((c) => !!selected[c]).length;
  const price = categories.reduce((sum,c) => sum + (selected[c]?.price ?? 0), 0);
  const enoughPerformance = !!(frame && motors && props && battery && esc);
  const weight = enoughPerformance ? Math.round(categories.reduce((sum,c) => sum + (selected[c]?.weight ?? 0), 0) + 80) : null; // demo wiring / assembly allowance
  const speed = enoughPerformance && weight && motors?.thrust && battery?.voltage && props?.propInches
    ? Math.round(Math.min(180, (motors.thrust * 4 / weight) * 12 + battery.voltage * 4 + props.propInches * 3)) : null;
  const score = complete && !warnings.length && !missing.length ? Math.max(1, Math.min(100, Math.round(70 + (motors?.thrust ?? 0) / 120 - (weight ?? 0) / 110 + (battery?.batteryMah ?? 0) / 900))) : null;
  const status: Check["status"] = warnings.length ? "incompatible" : !complete || missing.length ? "unknown" : "compatible";
  return { selected, count, price, weight, speed, score, status, warnings, missing, complete };
}
export function candidateCheck(selection: BuildSelection, category: Category, id: string) {
  const result = evaluate({ ...selection, [category]: id });
  return { status: result.status, messages: [...result.warnings, ...result.missing] };
}
