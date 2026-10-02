import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Check, Eye, EyeOff, LockKeyhole, Mail, UserRound } from "lucide-react";
import { z } from "zod";
import { LogoMark } from "@/components/SiteHeader";
import { MIN_PASSWORD_LENGTH, useAuth } from "@/lib/auth";

const searchSchema = z.object({
  redirect: z.enum(["/billing", "/create-custom-build"]).optional().catch(undefined),
  mode: z.enum(["signup"]).optional().catch(undefined),
});

export const Route = createFileRoute("/login")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({ meta: [{ title: "Sign in — DroneCores" }] }),
  component: LoginPage,
});

type Mode = "signin" | "signup" | "forgot";
type FormErrors = { name?: string; email?: string; password?: string; form?: string };

function LoginPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>(search.mode === "signup" ? "signup" : "signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [busy, setBusy] = useState(false);

  const switchMode = (next: Mode) => {
    setMode(next);
    setErrors({});
  };

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: FormErrors = {};
    if (mode === "signup" && name.trim().length > 100) next.name = "Use 100 characters or fewer.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = "Enter a valid email address.";
    if (!password) next.password = "Enter your password.";
    else if (mode === "signup" && password.length < MIN_PASSWORD_LENGTH) {
      next.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    }
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    const result = mode === "signup" ? await signUp(email, password, name) : await signIn(email, password);
    setBusy(false);
    if (!result.ok) {
      setErrors({ form: result.error });
      return;
    }
    await navigate({ to: search.redirect ?? "/", replace: true });
  }

  const title = mode === "signup" ? "Create your account" : mode === "forgot" ? "Reset password" : "Welcome back";
  const subtitle = mode === "signup" ? "Create an account to continue building." : "Sign in to continue building your drones.";

  return (
    <div className="min-h-screen bg-white text-foreground lg:flex">
      <aside className="relative hidden min-h-screen w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-[#2e6be6] to-[#2a3fb0] p-12 text-white lg:flex xl:p-16">
        <Link to="/" className="relative z-10 flex items-center gap-3">
          <LogoMark />
          <span className="font-display text-lg font-bold">DroneCores</span>
        </Link>
        <div className="relative z-10 max-w-xl">
          <h1 className="font-display text-5xl font-bold leading-[1.12] xl:text-6xl">
            Build the drone you&apos;ve always wanted.
          </h1>
          <p className="mt-5 text-lg leading-7 text-white/85">
            Configure, compare and order custom drones. No experience needed.
          </p>
          <ul className="mt-8 space-y-4 text-sm text-white/95">
            {[
              "Custom, template and AI-assisted builds",
              "Catalog of drones from major brands",
              "Save and share your configurations",
            ].map((item) => (
              <li key={item} className="flex items-center gap-3">
                <Check className="h-5 w-5 shrink-0" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative z-10 text-xs text-white/70">© 2026 DroneCores</p>
        <div aria-hidden className="pointer-events-none absolute -bottom-36 -right-20 h-[34rem] w-[34rem] rounded-full border border-white/10" />
        <div aria-hidden className="pointer-events-none absolute bottom-16 right-20 h-32 w-32 rounded-3xl border border-white/10" />
      </aside>

      <main className="flex min-h-screen w-full flex-col bg-white px-6 py-8 sm:px-10 md:items-center md:justify-center md:bg-brand-soft md:px-8 lg:w-1/2 lg:bg-white lg:px-12">
        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10 md:max-w-[560px] md:py-0 lg:max-w-[400px] lg:flex-none">
          <Link to="/" className="mb-8 flex items-center gap-3 lg:hidden">
            <LogoMark />
            <span className="font-display text-lg font-bold">DroneCores</span>
          </Link>
          <section className="w-full rounded-3xl border border-transparent bg-white p-0 sm:p-1 md:border-border md:p-12 md:shadow-xl lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
            <header>
              <h2 className="font-display text-[30px] font-bold leading-10 sm:text-[32px]">{title}</h2>
              <p className="mt-2 text-base text-muted-foreground">{subtitle}</p>
            </header>

            {mode === "forgot" ? (
              <div className="mt-8 space-y-5">
                <p role="status" className="rounded-xl border border-border bg-muted p-4 text-sm">
                  Needs a connected backend and is not available in the demo yet.
                </p>
                <button type="button" onClick={() => switchMode("signin")} className="text-sm font-semibold text-primary hover:underline">
                  Back to sign in
                </button>
              </div>
            ) : (
              <>
                <div className="mt-8 grid grid-cols-1 gap-3">
                  {["Google", "GitHub"].map((provider) => (
                    <button key={provider} type="button" disabled className="flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-white px-4 text-sm font-medium text-muted-foreground opacity-70">
                      <span>Continue with {provider}</span>
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase text-secondary-foreground">Soon</span>
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
                      <label htmlFor="name" className="mb-2 block text-sm font-medium">Name <span className="font-normal text-muted-foreground">(optional)</span></label>
                      <div className="relative">
                        <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                        <input id="name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} className="h-12 w-full rounded-xl border border-input bg-background pl-11 pr-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-ring/30" placeholder="Your name" aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "name-error" : undefined} />
                      </div>
                      {errors.name && <p id="name-error" className="mt-1 text-sm text-destructive">{errors.name}</p>}
                    </div>
                  )}
                  <div>
                    <label htmlFor="email" className="mb-2 block text-sm font-medium">Email</label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                      <input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="h-12 w-full rounded-xl border border-input bg-background pl-11 pr-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-ring/30" placeholder="you@example.com" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "email-error" : undefined} />
                    </div>
                    {errors.email && <p id="email-error" className="mt-1 text-sm text-destructive">{errors.email}</p>}
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <label htmlFor="password" className="text-sm font-medium">Password</label>
                      {mode === "signin" && <button type="button" onClick={() => switchMode("forgot")} className="text-xs font-medium text-primary hover:underline">Forgot password?</button>}
                    </div>
                    <div className="relative">
                      <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                      <input id="password" type={showPassword ? "text" : "password"} autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} className="h-12 w-full rounded-xl border border-input bg-background pl-11 pr-12 text-base outline-none focus:border-primary focus:ring-2 focus:ring-ring/30" placeholder="Enter your password" aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? "password-error" : undefined} />
                      <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:bg-muted">
                        {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                      </button>
                    </div>
                    {errors.password && <p id="password-error" className="mt-1 text-sm text-destructive">{errors.password}</p>}
                  </div>
                  {errors.form && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{errors.form}</p>}
                  <button type="submit" disabled={busy} className="mt-2 h-12 w-full rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60">
                    {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
                  </button>
                </form>
                <p className="mt-6 text-center text-sm text-muted-foreground">
                  {mode === "signup" ? "Already have an account?" : "Don’t have an account?"}{" "}
                  <button type="button" onClick={() => switchMode(mode === "signup" ? "signin" : "signup")} className="font-semibold text-primary hover:underline">
                    {mode === "signup" ? "Sign in" : "Create one"}
                  </button>
                </p>
              </>
            )}
          </section>
          <p className="mt-8 text-center text-xs leading-5 text-muted-foreground">
            Demo mode: accounts stay in this browser. No real account or payment is created.
          </p>
        </div>
        <p className="mx-auto mt-6 max-w-[400px] text-center text-[11px] leading-4 text-muted-foreground">
          By continuing, you agree to DroneCores’ Terms of Service and Privacy Policy.
        </p>
      </main>
    </div>
  );
}
