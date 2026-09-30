import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import heroDrone from "@/assets/hero-drone.png";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DroneCores — YOUR Build. EASY." },
      {
        name: "description",
        content:
          "Design your own drone step by step — pick a template, let AI suggest parts, or build from scratch. No experience needed.",
      },
      { property: "og:title", content: "DroneCores — YOUR Build. EASY." },
      {
        property: "og:description",
        content:
          "Design your own drone step by step — pick a template, let AI suggest parts, or build from scratch.",
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
      <main className="mx-auto grid w-full max-w-7xl flex-1 items-center gap-12 px-4 pb-16 pt-10 sm:px-6 sm:pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:pt-20">
        <section>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-primary">
            Build &amp; Configure Your Drone
          </p>
          <h1 className="mt-6 font-display text-5xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-6xl lg:text-7xl">
            YOUR Build.
            <br />
            EASY.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
            Configure your own drone step by step — from the first part to the
            finished build. For filming, racing or just for fun.
          </p>
          <div className="mt-9">
            <a
              href="/start"
              className="inline-flex min-h-[3.5rem] items-center gap-3 rounded-full bg-primary px-9 text-lg font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-brand-deep active:scale-95"
            >
              Let&apos;s Build
              <ArrowRight className="h-5 w-5" aria-hidden />
            </a>
          </div>
          <p className="mt-6 text-sm font-medium text-muted-foreground">
            No experience needed · Step-by-step guidance · Free to explore
          </p>
        </section>
        <section className="relative">
          <div
            className="absolute inset-10 rounded-full bg-primary/10 blur-3xl"
            aria-hidden
          />
          <div className="relative overflow-hidden rounded-3xl border border-border bg-secondary shadow-2xl shadow-primary/10">
            <img
              src={heroDrone}
              alt="A modern camera drone ready to be configured"
              width={1024}
              height={768}
              className="h-full w-full object-cover"
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
