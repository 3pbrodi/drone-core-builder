import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft,
  LayoutTemplate,
  PackageSearch,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { OptionCard } from "@/components/OptionCard";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/start")({
  head: () => ({
    meta: [
      { title: "DroneCores — Choose how you want to build" },
      {
        name: "description",
        content:
          "Create a custom drone build, start from a template, get an AI suggestion, or browse ready-to-fly drones from DJI and other makers.",
      },
      { property: "og:title", content: "DroneCores — Choose how you want to build" },
      {
        property: "og:description",
        content:
          "Create a custom drone build, start from a template, get an AI suggestion, or browse ready-to-fly drones.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Start,
});

function Start() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-20 sm:px-6">
        <section aria-label="Ways to build your drone" className="pt-10 sm:pt-14">
          <Link
            to="/"
            className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-brand-deep active:scale-95"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Back
          </Link>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Choose how you want to start
          </h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            Every path is tappable — you can switch anytime.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 sm:gap-6">
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
