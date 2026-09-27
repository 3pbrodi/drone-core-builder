import { Link } from "@tanstack/react-router";

export function LogoMark() {
  return (
    <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className="h-5 w-5"
        aria-hidden
      >
        <circle cx="5" cy="5" r="2.5" />
        <circle cx="19" cy="5" r="2.5" />
        <circle cx="5" cy="19" r="2.5" />
        <circle cx="19" cy="19" r="2.5" />
        <rect x="9.5" y="9.5" width="5" height="5" rx="1.5" />
        <path d="M7 7l3 3M17 7l-3 3M7 17l3-3M17 17l-3-3" />
      </svg>
    </span>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-3 rounded-xl active:scale-95">
          <LogoMark />
          <span className="font-display text-lg font-bold tracking-tight text-foreground">
            DroneCores
          </span>
        </Link>
        <span className="rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
          Beginner friendly
        </span>
      </div>
    </header>
  );
}
