import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import heroDrone from "@/assets/hero-drone.png";
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
        <section className="relative isolate my-8 grid min-h-[28rem] overflow-hidden rounded-3xl bg-primary px-6 py-12 text-primary-foreground shadow-xl sm:my-12 sm:min-h-[34rem] sm:px-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-16">
          <div
            className="absolute -right-16 -top-20 -z-10 h-72 w-72 rounded-full border border-white/15 sm:h-96 sm:w-96"
            aria-hidden
          />
          <div
            className="absolute -bottom-32 left-1/3 -z-10 h-80 w-80 rounded-full border border-white/15"
            aria-hidden
          />
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold">
              Drone configurator · beta
            </span>
            <h1 className="mt-6 max-w-2xl font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Build the drone you actually want
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-primary-foreground/85 sm:text-lg">
              Your next drone starts here. Tell us how you want to build and
              we’ll guide you through it.
            </p>
            <Link
              to="/start"
              className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 font-semibold text-primary shadow-sm transition hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
            >
              Let’s build <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <img
            src={heroDrone}
            alt="A modern camera drone"
            width={1024}
            height={768}
            className="mx-auto mt-8 w-full max-w-lg rounded-3xl object-contain drop-shadow-2xl lg:mt-0"
          />
        </section>
      </main>
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        DroneCores — sample content for now, real parts and prices coming soon
      </footer>
    </div>
  );
}
