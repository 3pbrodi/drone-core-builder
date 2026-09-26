import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type OptionRoute =
  | "/create-custom-build"
  | "/templates"
  | "/ai-build"
  | "/pre-built";

type OptionCardProps = {
  to: OptionRoute;
  icon: LucideIcon;
  step: string;
  title: string;
  description: string;
  cta: string;
};

export function OptionCard({
  to,
  icon: Icon,
  step,
  title,
  description,
  cta,
}: OptionCardProps) {
  return (
    <Link
      to={to}
      className="group flex min-h-[13rem] flex-col justify-between rounded-3xl border border-border bg-card p-6 text-left shadow-sm outline-none transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99] sm:p-8"
    >
      <div>
        <div className="flex items-center justify-between">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-secondary text-secondary-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
            <Icon className="h-6 w-6" aria-hidden />
          </span>
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {step}
          </span>
        </div>
        <h2 className="mt-5 font-display text-xl font-semibold tracking-tight text-card-foreground sm:text-2xl">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
          {description}
        </p>
      </div>
      <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary">
        {cta}
        <ArrowRight
          className="h-4 w-4 transition-transform group-hover:translate-x-1"
          aria-hidden
        />
      </span>
    </Link>
  );
}
