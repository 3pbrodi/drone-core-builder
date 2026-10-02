import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function LogoMark({ invert = false }: { invert?: boolean }) {
  return (
    <span className={`grid h-9 w-9 place-items-center rounded-xl ${invert ? "bg-white text-primary" : "bg-primary text-primary-foreground"}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5" aria-hidden>
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

const NAV = [
  { to: "/", label: "Builds", exact: true },
  { to: "/templates", label: "Templates" },
  { to: "/ai-build", label: "AI build" },
  { to: "/billing", label: "Billing" },
] as const;

const navClass = "rounded-full px-3 py-2 text-sm font-medium transition-colors";
const activeProps = { className: "bg-secondary text-secondary-foreground" };
const inactiveProps = { className: "text-muted-foreground hover:text-foreground" };

export function SiteHeader() {
  const { user, status, signOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSignOut = async () => {
    setMenuOpen(false);
    signOut();
    await navigate({ to: "/", replace: true });
  };
  const initial = (user?.name || user?.email || "?").charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link to="/" className="flex shrink-0 items-center gap-3 rounded-xl active:scale-95">
          <LogoMark />
          <span className="font-display text-lg font-bold tracking-tight text-foreground">DroneCores</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
          {NAV.map((item) => (
            <Link key={item.to} to={item.to} activeOptions={{ exact: "exact" in item }} className={navClass} activeProps={activeProps} inactiveProps={inactiveProps}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {status === "signedIn" && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger aria-label="Account menu" className="grid h-10 w-10 place-items-center rounded-full bg-primary font-display text-sm font-bold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {initial}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <p className="truncate text-sm font-semibold text-foreground">{user.name}</p>
                  <p className="truncate text-xs font-normal text-muted-foreground">{user.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => navigate({ to: "/billing" })}>Billing</DropdownMenuItem>
                <DropdownMenuItem onSelect={handleSignOut}>Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : status === "signedOut" ? (
            <Link to="/login" className="hidden h-10 items-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 sm:inline-flex">Sign in</Link>
          ) : null}
          <button type="button" onClick={() => setMenuOpen((open) => !open)} aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} className="grid h-11 w-11 place-items-center rounded-xl border border-border text-foreground md:hidden">
            {menuOpen ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="border-t border-border bg-background px-4 py-3 md:hidden" aria-label="Mobile navigation">
          <div className="mx-auto flex max-w-6xl flex-col gap-1">
            {NAV.map((item) => (
              <Link key={item.to} to={item.to} onClick={() => setMenuOpen(false)} activeOptions={{ exact: "exact" in item }} className="rounded-xl px-4 py-3 text-base font-medium" activeProps={activeProps} inactiveProps={inactiveProps}>
                {item.label}
              </Link>
            ))}
            {status === "signedIn" ? (
              <button type="button" onClick={handleSignOut} className="rounded-xl px-4 py-3 text-left text-base font-medium text-muted-foreground">Sign out</button>
            ) : status === "signedOut" ? (
              <Link to="/login" onClick={() => setMenuOpen(false)} className="mt-2 rounded-full bg-primary px-4 py-3 text-center text-base font-semibold text-primary-foreground">Sign in</Link>
            ) : null}
          </div>
        </nav>
      )}
    </header>
  );
}
