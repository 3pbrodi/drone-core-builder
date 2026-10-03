import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Check, LockKeyhole } from "lucide-react";
import { useAuth, MIN_PASSWORD_LENGTH } from "@/lib/auth";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Set a new password — DroneCores" }] }),
  component: ResetPasswordPage,
});

function BrandMark() {
  return (
    <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-primary">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5" aria-hidden>
        <circle cx="5" cy="5" r="2.5" /><circle cx="19" cy="5" r="2.5" />
        <circle cx="5" cy="19" r="2.5" /><circle cx="19" cy="19" r="2.5" />
        <rect x="9.5" y="9.5" width="5" height="5" rx="1.5" />
        <path d="M7 7l3 3M17 7l-3 3M7 17l3-3M17 17l-3-3" />
      </svg>
    </span>
  );
}

function ResetPasswordPage() {
  const navigate = useNavigate();
  const { status, passwordRecovery, updatePassword, finishPasswordRecovery } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }
    setBusy(true);
    const result = await updatePassword(password);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    finishPasswordRecovery();
    setComplete(true);
  }

  return (
    <div className="min-h-screen bg-white text-foreground lg:flex">
      <aside className="relative hidden min-h-screen w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-[#2e6be6] to-[#2a3fb0] p-12 text-white lg:flex xl:p-16">
        <Link to="/" className="relative z-10 flex items-center gap-3">
          <BrandMark />
          <span className="font-display text-lg font-bold">DroneCores</span>
        </Link>
        <div className="relative z-10 max-w-xl">
          <h1 className="font-display text-5xl font-bold leading-[1.12] xl:text-6xl">Secure your account.</h1>
          <p className="mt-5 text-lg leading-7 text-white/85">Choose a new password to get back to building.</p>
        </div>
        <p className="relative z-10 text-xs text-white/70">© 2026 DroneCores</p>
        <div aria-hidden className="pointer-events-none absolute -bottom-36 -right-20 h-[34rem] w-[34rem] rounded-full border border-white/10" />
      </aside>

      <main className="flex min-h-screen w-full flex-col bg-white px-6 py-8 sm:px-10 md:items-center md:justify-center md:bg-brand-soft md:px-8 lg:w-1/2 lg:bg-white lg:px-12">
        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10 md:py-0">
          <Link to="/" className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground"><BrandMark /></span>
            <span className="font-display text-lg font-bold">DroneCores</span>
          </Link>
          <section className="w-full rounded-3xl border border-transparent bg-white p-0 md:border-border md:p-12 md:shadow-xl lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
            <header>
              <h2 className="font-display text-[30px] font-bold leading-10 sm:text-[32px]">Set a new password</h2>
              <p className="mt-2 text-base text-muted-foreground">Use at least {MIN_PASSWORD_LENGTH} characters.</p>
            </header>

            {complete ? (
              <div className="mt-8 space-y-5">
                <p role="status" className="rounded-xl border border-success/30 bg-success/10 p-4 text-sm">Your password has been updated.</p>
                <button type="button" onClick={() => void navigate({ to: "/login", replace: true })} className="h-12 w-full rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Continue to sign in</button>
              </div>
            ) : status === "loading" ? (
              <p role="status" className="mt-8 text-sm text-muted-foreground">Checking your reset link…</p>
            ) : !passwordRecovery ? (
              <div className="mt-8 space-y-5">
                <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                  This password reset link is invalid or has expired. Request a new one from the sign-in page.
                </p>
                <Link to="/login" className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Back to sign in</Link>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="mt-8 space-y-5">
                <div>
                  <label htmlFor="new-password" className="mb-2 block text-sm font-medium">New password</label>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                    <input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-12 w-full rounded-xl border border-input bg-background pl-11 pr-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-ring/30" required minLength={MIN_PASSWORD_LENGTH} />
                  </div>
                </div>
                <div>
                  <label htmlFor="confirm-password" className="mb-2 block text-sm font-medium">Confirm new password</label>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                    <input id="confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="h-12 w-full rounded-xl border border-input bg-background pl-11 pr-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-ring/30" required minLength={MIN_PASSWORD_LENGTH} />
                  </div>
                </div>
                {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
                <button type="submit" disabled={busy} className="h-12 w-full rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60">
                  {busy ? "Please wait…" : "Update password"}
                </button>
              </form>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
