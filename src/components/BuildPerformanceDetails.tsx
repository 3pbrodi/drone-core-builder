import type { BuildPerformanceEstimate } from "@/lib/build-performance-estimates";
import type { Product } from "@/lib/build-data";
const grams = (n: number) => `${Math.round(n)} g`;
export function BuildPerformanceDetails({
  estimate,
  catalogue,
}: {
  estimate: BuildPerformanceEstimate;
  catalogue: readonly Product[];
}) {
  const names = new Map(catalogue.map((p) => [p.id, p.name]));
  return (
    <details
      aria-label="Performance estimate details"
      className="mt-2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground"
    >
      <summary className="cursor-pointer font-medium">
        Estimate details · modeled, not measured
      </summary>
      <div className="mt-3 space-y-3">
        {estimate.takeoffGrams && (
          <p>
            Estimated takeoff weight: {grams(estimate.takeoffGrams.value)} (
            {grams(estimate.takeoffGrams.min)}–{grams(estimate.takeoffGrams.max)}).
          </p>
        )}
        <ul className="list-disc space-y-1 pl-4">
          {estimate.components.map((c) => (
            <li key={c.id}>
              <span className="font-medium text-foreground">{c.name}</span>: {grams(c.grams.value)}{" "}
              ·{" "}
              {c.method === "catalogue"
                ? "listed installed quantity"
                : c.method === "similar"
                  ? "estimated from similar components"
                  : "estimated from component class"}
              {c.referenceIds.length > 0 &&
                ` · references: ${c.referenceIds.map((id) => names.get(id) ?? id).join(", ")}`}
            </li>
          ))}
          <li>Estimated wiring and assembly: {grams(estimate.assemblyGrams.value)}.</li>
        </ul>
        {estimate.loadedRpm !== null && (
          <p>
            Modeled loaded speed: {estimate.loadedRpm.toLocaleString()} RPM ·{" "}
            {estimate.rotationsPerSecond} rotations/s. Estimated electrical demand:{" "}
            {estimate.batteryPowerWatts} W.
          </p>
        )}
        {estimate.speedKmh && (
          <p>
            Estimated maximum level-flight speed in still air: {estimate.speedKmh.value} km/h; model
            scenarios {estimate.speedKmh.min}–{estimate.speedKmh.max} km/h.
          </p>
        )}
        <ul className="list-disc space-y-1 pl-4">
          {[...estimate.missing, ...estimate.assumptions].map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </div>
    </details>
  );
}
