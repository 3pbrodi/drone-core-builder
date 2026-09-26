import { createFileRoute } from "@tanstack/react-router";
import {
  LayoutTemplate,
  PackageSearch,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import heroDrone from "@/assets/hero-drone.png";
import { OptionCard } from "@/components/OptionCard";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DroneCores — Build the drone you actually want" },
      {
        name: "description",
        content:
          "Create a custom drone build, start from a template, get an AI suggestion, or browse ready-to-fly drones from DJI and other makers.",
      },
      { property: "og:title", content: "DroneCores — Build the drone you actually want" },
      {
        property: "og:description",
        content:
          "Create a custom drone build, start from a template, get an AI suggestion, or browse ready-to-fly drones.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-20 sm:px-6">
        <section className="grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
              Drone configurator · beta
            </span>
            <h1 className="mt-5 font-display text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Build the drone you <span className="text-primary">actually</span> want
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Pick a path below — start from scratch, use a proven template, let AI
              suggest parts, or browse ready-to-fly drones. No experience needed.
            </p>
          </div>
          <div className="relative">
            <div
              className="absolute inset-8 rounded-full bg-primary/10 blur-3xl"
              aria-hidden
            />
            <img
              src={heroDrone}
              alt="A modern camera drone floating against a clean background"
              width={1024}
              height={768}
              className="relative mx-auto w-full max-w-lg rounded-3xl object-contain drop-shadow-xl"
            />
          </div>
        </section>

        <section aria-label="Ways to build your drone">
          <h2 className="font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            Choose how you want to start
          </h2>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">
            Every path is tappable — you can switch anytime.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 sm:gap-6">
            <OptionCard
              to="/create-custom-build"
              icon={SlidersHorizontal}
              step="Path 1"
              title="Create Custom Build"
              description="Pick every part yourself — frame, motors, camera, battery — with plain-English explanations for each one."
              cta="Start building"
            />
            <OptionCard
              to="/templates"
              icon={LayoutTemplate}
              step="Path 2"
              title="Choose Template"
              description="Start from a proven build for filming, racing, or freestyle — then tweak it to make it yours."
              cta="Browse templates"
            />
            <OptionCard
              to="/ai-build"
              icon={Sparkles}
              step="Path 3"
              title="AI Build"
              description="Describe what you want to do with your drone in one sentence, and get a suggested parts list."
              cta="Ask the AI"
            />
            <OptionCard
              to="/pre-built"
              icon={PackageSearch}
              step="Path 4"
              title="Pre-Built Drones"
              description="Rather not build? Compare ready-to-fly drones from DJI, Autel, Skydio and other makers."
              cta="Compare drones"
            />
          </div>
        </section>
      </main>
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        DroneCores — sample content for now, real parts and prices coming soon
      </footer>
    </div>
  );
}
