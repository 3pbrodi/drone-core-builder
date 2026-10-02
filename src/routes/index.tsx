import { Link, createFileRoute } from "@tanstack/react-router";
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
      <main className="mx-auto grid min-h-[calc(100svh-61px)] w-full max-w-7xl flex-1 content-center items-center gap-4 px-4 py-4 sm:min-h-0 sm:content-normal sm:gap-12 sm:px-6 sm:pb-16 sm:pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:pt-20">
        <section className="order-2 sm:order-none">
          <p className="hidden text-sm font-bold uppercase tracking-[0.2em] text-primary sm:block">
            Build &amp; Configure Your Drone
          </p>
          <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight text-foreground sm:mt-6 sm:text-6xl lg:text-7xl">
            Build the drone you <span className="text-primary">actually</span> want
          </h1>
          <p className="mt-3 max-w-xl text-base leading-6 text-muted-foreground sm:mt-6 sm:text-xl sm:leading-relaxed">
            Your drone. Your way. Build it, customize it, or let us do the work.
          </p>
          <div className="mt-5 sm:mt-9">
            <Link
              to="/start"
              className="inline-flex min-h-[3.5rem] items-center gap-3 rounded-full bg-primary px-9 text-lg font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-brand-deep active:scale-95"
            >
              Let&apos;s Build
              <ArrowRight className="h-5 w-5" aria-hidden />
            </Link>
          </div>
          <p className="mt-6 hidden text-sm font-medium text-muted-foreground sm:block">
            No experience needed · Step-by-step guidance · Free to explore
          </p>
        </section>
        <section className="relative order-1 sm:order-none">
          <div
            className="absolute inset-10 rounded-full bg-primary/10 blur-3xl"
            aria-hidden
          />
          <img
            src={heroDrone}
            alt="A modern camera drone ready to be configured"
            width={1024}
            height={768}
            className="relative mx-auto h-[clamp(11rem,27svh,15rem)] w-full object-contain sm:h-auto sm:w-full"
          />
        </section>
      </main>
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        DroneCores — sample content for now, real parts and prices coming soon
      </footer>
    </div>
  );
}
