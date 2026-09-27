import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Gauge, Battery, Video } from "lucide-react";
import { PageShell } from "@/components/PageShell";

export const Route = createFileRoute("/templates")({
  head: () => ({
    meta: [
      { title: "Choose a Template — DroneCores" },
      {
        name: "description",
        content:
          "Start from a proven drone build for filming, racing, or freestyle — then tweak it to make it yours.",
      },
      { property: "og:title", content: "Choose a Template — DroneCores" },
      {
        property: "og:description",
        content:
          "Start from a proven drone build for filming, racing, or freestyle — then tweak it to make it yours.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TemplatesPage,
});

type Template = {
  id: string;
  name: string;
  level: string;
  style: "Cinematic" | "Racing" | "Freestyle" | "Long Range";
  blurb: string;
  flightTime: string;
  topSpeed: string;
  camera: string;
  price: number;
};

const TEMPLATES: Template[] = [
  {
    id: "cinematic",
    name: "Cinematic 4K Cruiser",
    level: "Beginner",
    style: "Cinematic",
    blurb: "Smooth, stable and quiet — the easy way to get beautiful travel and landscape footage.",
    flightTime: "22 min",
    topSpeed: "54 km/h",
    camera: "4K/60 stabilized",
    price: 620,
  },
  {
    id: "racer",
    name: "Backyard Racer",
    level: "Intermediate",
    style: "Racing",
    blurb: "Small, light and seriously quick. Built for tight turns and friendly competition.",
    flightTime: "6 min",
    topSpeed: "160 km/h",
    camera: "Analog FPV",
    price: 480,
  },
  {
    id: "freestyle",
    name: "FPV Freestyle Rig",
    level: "Intermediate",
    style: "Freestyle",
    blurb: "Balanced power for flips, dives and gap shots. The classic freestyle setup.",
    flightTime: "8 min",
    topSpeed: "130 km/h",
    camera: "HD FPV + recorder",
    price: 560,
  },
  {
    id: "longrange",
    name: "Long-Range Explorer",
    level: "Advanced",
    style: "Long Range",
    blurb: "Big battery, efficient motors and GPS — built for flying far and mapping wide areas.",
    flightTime: "35 min",
    topSpeed: "90 km/h",
    camera: "4K + GPS mapping",
    price: 840,
  },
];

function TemplatesPage() {
  const [budgetFilter, setBudgetFilter] = useState<"all" | "under500" | "500to700" | "700plus">("all");
  const [styleFilter, setStyleFilter] = useState<"all" | Template["style"]>("all");
  const filteredTemplates = TEMPLATES.filter((template) => {
    const budgetMatches =
      budgetFilter === "all" ||
      (budgetFilter === "under500" && template.price < 500) ||
      (budgetFilter === "500to700" && template.price >= 500 && template.price <= 700) ||
      (budgetFilter === "700plus" && template.price > 700);
    const styleMatches = styleFilter === "all" || template.style === styleFilter;
    return budgetMatches && styleMatches;
  });

  return (
    <PageShell
      eyebrow="Path 2"
      title="Choose Template"
      description="Each template is an illustrative starting point. Open one and you can adjust any part before you build."
    >
      <section className="mb-5 grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:grid-cols-2">
        <div>
          <div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold text-foreground">Budget</span><button type="button" onClick={() => setBudgetFilter("all")} className="min-h-9 rounded-lg px-2 text-xs font-semibold text-primary hover:bg-secondary">Skip</button></div>
          <label className="sr-only" htmlFor="template-budget-filter">Budget</label>
          <select
            id="template-budget-filter"
            value={budgetFilter}
            onChange={(event) => setBudgetFilter(event.target.value as typeof budgetFilter)}
            className="mt-1.5 min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
          >
            <option value="all">All budgets</option>
            <option value="under500">Under €500</option>
            <option value="500to700">€500–€700</option>
            <option value="700plus">Over €700</option>
          </select>
        </div>
        <div>
          <div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold text-foreground">Flight Style</span><button type="button" onClick={() => setStyleFilter("all")} className="min-h-9 rounded-lg px-2 text-xs font-semibold text-primary hover:bg-secondary">Skip</button></div>
          <label className="sr-only" htmlFor="template-style-filter">Flight Style</label>
          <select
            id="template-style-filter"
            value={styleFilter}
            onChange={(event) => setStyleFilter(event.target.value as typeof styleFilter)}
            className="mt-1.5 min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
          >
            <option value="all">All styles</option>
            <option value="Cinematic">Cinematic</option>
            <option value="Racing">Racing</option>
            <option value="Freestyle">Freestyle</option>
            <option value="Long Range">Long Range</option>
          </select>
        </div>
      </section>
      <div className="grid gap-5 sm:grid-cols-2">
        {filteredTemplates.map((template) => (
          <article
            key={template.id}
            className="flex flex-col rounded-3xl border border-border bg-card p-6 shadow-sm transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 sm:p-7"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
                {template.level}
              </span>
              <span className="font-display text-lg font-bold text-foreground">
                Est. €{template.price.toFixed(2).replace(".", ",")}
              </span>
            </div>
            <h2 className="mt-4 font-display text-xl font-semibold tracking-tight text-foreground">
              {template.name}
            </h2>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
              {template.blurb}
            </p>
            <dl className="mt-5 grid grid-cols-3 gap-2 rounded-2xl bg-muted p-3 text-center">
              <div>
                <dt className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                  <Battery className="h-3.5 w-3.5" aria-hidden /> Est. flight
                </dt>
                <dd className="mt-0.5 text-sm font-semibold text-foreground">
                  {template.flightTime}
                </dd>
              </div>
              <div>
                <dt className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                  <Gauge className="h-3.5 w-3.5" aria-hidden /> Est. speed
                </dt>
                <dd className="mt-0.5 text-sm font-semibold text-foreground">
                  {template.topSpeed}
                </dd>
              </div>
              <div>
                <dt className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                  <Video className="h-3.5 w-3.5" aria-hidden /> Camera
                </dt>
                <dd className="mt-0.5 text-sm font-semibold text-foreground">
                  {template.camera}
                </dd>
              </div>
            </dl>
            <Link
              to="/create-custom-build"
              search={{ source: "template", template: template.id as "cinematic" | "racer" | "freestyle" | "longrange" }}
              className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98]"
            >
              Use this template
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </article>
        ))}
      </div>
      {filteredTemplates.length === 0 && <p className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">No template matches those filters. Try another budget or flight style.</p>}
    </PageShell>
  );
}
