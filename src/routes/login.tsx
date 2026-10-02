import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { z } from "zod";
import { LogoMark } from "@/components/SiteHeader";
import { MIN_PASSWORD_LENGTH, useAuth } from "@/lib/auth";

const searchSchema = z.object({
  redirect: z.enum(["/billing", "/create-custom-build"]).optional().catch(undefined),
  mode: z.enum(["signup"]).optional().catch(undefined),
});

export const Route = createFileRoute("/login")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Sign in — DroneCores" },
      { name: "description", content: "Sign in or create your DroneCores account to save and manage drone builds." },
      { property: "og:title", content: "Sign in — DroneCores" },
      { property: "og:description", content: "Sign in or create your DroneCores account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

type Mode = "signin" | "signup" | "forgot";
type Errors = { email?: string; password?: string; form?: string };

const inputCls =
  "h-12 w-full rounded-xl border border-input bg-background px-4 text-base text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30";

function LoginPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>(search.mode === "signup" ? "signup" : "signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  const switchMode = (m: Mode) => {
    setMode(m);
    setErrors({});
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next: Errors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = "Enter a valid email address.";
    if (!password) next.password = "Enter your password.";
    else if (mode === "signup" && password.length < MIN_PASSWORD_LENGTH)
      next.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    const res = mode === "signup" ? await signUp(email, password, name) : await signIn(email, password);
    setBusy(false);
    if (!res.ok) return setErrors({ form: res.error });
    navigate({ to: search.redirect ?? "/" });
  }

  const title = mode === "signup" ? "Create your account" : mode === "forgot" ? "Reset password" : "Welcome back";
  const subtitle =
    mode === "signup"
      ? "Start saving your drone builds."
      : mode === "forgot"
        ? "We'll help you get back into your account."
        : "Sign in to continue building.";

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-primary to-brand-deep p-12 text-primary-foreground lg:flex">
        <Link to="/" className="flex items-center gap-3">
          <span className="rounded-xl bg-primary-foreground/15 p-0.5"><LogoMark /></span>
          <span className="font-display text-xl font-bold">DroneCores</span>
        </Link>
        <div>
          <h2 className="font-display text-5xl font-bold leading-tight">
            YOUR Build.
            <br />
            EASY.
          </h2>
          <p className="mt-4 max-w-sm text-lg text-primary-foreground/80">
            Configure, check compatibility and save drone builds — all in one place.
          </p>
        </div>
        <p className="text-sm text-primary-foreground/70">Beginner friendly · Step-by-step guidance</p>
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-primary-foreground/10" />
      </aside>

      <main className="flex w-full flex-1 flex-col px-5 py-8 sm:px-10 lg:w-1/2">
        <Link to="/" className="flex items-center gap-3 lg:hidden">
          <LogoMark />
          <span className="font-display text-lg font-bold text-foreground">DroneCores</span>
        </Link>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{title}</h1>
          <p className="mt-2 text-muted-foreground">{subtitle}</p>

          {mode === "forgot" ? (
            <div className="mt-8 space-y-6">
              <p className="rounded-xl border border-border bg-muted p-4 text-sm text-foreground">
                Needs a connected backend and is not available in the demo yet.
              </p>
              <button onClick={() => switchMode("signin")} className="text-sm font-semibold text-primary hover:underline">
                Back to sign in
              </button>
            </div>
          ) : (
            <>
              <div className="mt-8 grid grid-cols-2 gap-3">
                {["Google", "GitHub"].map((p) => (
                  <button
                    key={p}
                    disabled
                    className="flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-background text-sm font-medium text-muted-foreground opacity-70"
                  >
                    {p}
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase text-secondary-foreground">
                      Soon
                    </span>
                  </button>
                ))}
              </div>
              <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                or continue with email
                <span className="h-px flex-1 bg-border" />
              </div>

              <form onSubmit={onSubmit} noValidate className="space-y-4">
                {mode === "signup" && (
                  <div>
                    <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-foreground">
                      Name <span className="text-muted-foreground">(optional)</span>
                    </label>
                    <input id="name" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} className={inputCls} autoComplete="name" />
                  </div>
                )}
                <div>
                  <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-foreground">Email</label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    maxLength={255}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputCls}
                    autoComplete="email"
                    placeholder="you@example.com"
                    aria-invalid={!!errors.email}
                  />
                  {errors.email && <p className="mt-1.5 text-sm text-destructive">{errors.email}</p>}
                </div>
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label htmlFor="password" className="text-sm font-medium text-foreground">Password</label>
                    {mode === "signin" && (
                      <button type="button" onClick={() => switchMode("forgot")} className="text-sm font-medium text-primary hover:underline">
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      id="password"
                      type={show ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`${inputCls} pr-12`}
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                      aria-invalid={!!errors.password}
                    />
                    <button
                      type="button"
                      onClick={() => setShow((v) => !v)}
                      aria-label={show ? "Hide password" : "Show password"}
                      className="absolute right-1 top-1 grid h-10 w-10 place-items-center rounded-lg text-muted-foreground hover:text-foreground"
                    >
                      {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {errors.password ? (
                    <p className="mt-1.5 text-sm text-destructive">{errors.password}</p>
                  ) : (
                    mode === "signup" && <p className="mt-1.5 text-xs text-muted-foreground">At least {MIN_PASSWORD_LENGTH} characters.</p>
                  )}
                </div>
                {errors.form && (
                  <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                    {errors.form}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={busy}
                  className="h-12 w-full rounded-full bg-primary text-base font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 active:scale-[0.98] disabled:opacity-60"
                >
                  {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                {mode === "signup" ? "Already have an account? " : "New to DroneCores? "}
                <button onClick={() => switchMode(mode === "signup" ? "signin" : "signup")} className="font-semibold text-primary hover:underline">
                  {mode === "signup" ? "Sign in" : "Create an account"}
                </button>
              </p>
            </>
          )}
        </div>

        <p className="mx-auto max-w-md rounded-xl bg-muted px-4 py-3 text-center text-xs text-muted-foreground">
          Demo mode: accounts are stored only in this browser and are not secure.
        </p>
      </main>
    </div>
  );
}
