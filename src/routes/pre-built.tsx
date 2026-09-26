import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plane } from "lucide-react";
import { PageShell } from "@/components/PageShell";

export const Route = createFileRoute("/pre-built")({
  head: () => ({
    meta: [
      { title: "Pre-Built Drones — DroneCores" },
      {
        name: "description",
        content:
          "Compare ready-to-fly drones from DJI, Autel, Skydio and other makers — filter by brand.",
      },
      { property: "og:title", content: "Pre-Built Drones — DroneCores" },
      {
        property: "og:description",
        content:
          "Compare ready-to-fly drones from DJI, Autel, Skydio and other makers — filter by brand.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PreBuiltPage,
});

type Drone = {
  name: string;
  brand: "DJI" | "Autel" | "Skydio" | "HOVERAir";
  price: number;
  weight: string;
  camera: string;
  bestFor: string;
};

const DRONES: Drone[] = [
  {
    name: "DJI Mini 4 Pro",
    brand: "DJI",
    price: 759,
    weight: "249 g",
    camera: "4K/60 HDR",
    bestFor: "Beginners and travel",
  },
  {
    name: "DJI Air 3S",
    brand: "DJI",
    price: 1099,
    weight: "724 g",
    camera: "Dual 4K/60",
    bestFor: "Long flights and sunsets",
  },
  {
    name: "DJI Avata 2",
    brand: "DJI",
    price: 999,
    weight: "377 g",
    camera: "4K/60 FPV",
    bestFor: "Immersive FPV flying",
  },
  {
    name: "Autel EVO Lite+",
    brand: "Autel",
    price: 1149,
    weight: "835 g",
    camera: "6K/30",
    bestFor: "Low-light video",
  },
  {
    name: "Skydio 2+",
    brand: "Skydio",
    price: 1099,
    weight: "775 g",
    camera: "4K/60",
    bestFor: "Hands-free subject tracking",
  },
  {
    name: "HOVERAir X1",
    brand: "HOVERAir",
    price: 349,
    weight: "192 g",
    camera: "2.7K selfie",
    bestFor: "Pocket selfies",
  },
];

const BRANDS = ["All", "DJI", "Autel", "Skydio", "HOVERAir"] as const;

function PreBuiltPage() {
  const [brand, setBrand] = useState<(typeof BRANDS)[number]>("All");

  const visible =
    brand === "All" ? DRONES : DRONES.filter((drone) => drone.brand === brand);

  return (
    <PageShell
      eyebrow="Path 4"
      title="Pre-Built Drones"
      description="Rather not build? These ready-to-fly drones come fully assembled — filter by brand to compare."
    >
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by brand">
        {BRANDS.map((brandName) => (
          <button
            key={brandName}
            type="button"
            onClick={() => setBrand(brandName)}
            aria-pressed={brand === brandName}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition-all active:scale-95 ${
              brand === brandName
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
            }`}
          >
            {brandName}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((drone) => (
          <article
            key={drone.name}
            className="flex flex-col rounded-3xl border border-border bg-card p-6 shadow-sm transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10"
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
                <Plane className="h-3.5 w-3.5" aria-hidden />
                {drone.brand}
              </span>
              <span className="font-display text-lg font-bold text-foreground">
                ${drone.price}
              </span>
            </div>
            <h2 className="mt-4 font-display text-lg font-semibold tracking-tight text-foreground">
              {drone.name}
            </h2>
            <dl className="mt-3 flex-1 space-y-1.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Weight</dt>
                <dd className="font-medium text-foreground">{drone.weight}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Camera</dt>
                <dd className="font-medium text-foreground">{drone.camera}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Best for</dt>
                <dd className="text-right font-medium text-foreground">{drone.bestFor}</dd>
              </div>
            </dl>
            <button
              type="button"
              className="mt-5 inline-flex items-center justify-center rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98]"
            >
              View details
            </button>
          </article>
        ))}
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Sample lineup and prices for now — the real store comparison comes later.
      </p>
    </PageShell>
  );
}
