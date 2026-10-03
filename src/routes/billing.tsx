import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { AlertTriangle, Check, Download, Pencil, Plus, Sparkles, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { SiteHeader } from "@/components/SiteHeader";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth";
import {
  PLAN_LIMITS,
  PLAN_PRICES,
  useBilling,
  type BillingInterval,
  type BillingRecord,
  type DemoInvoice,
  type PlanId,
} from "@/lib/billing";

export const Route = createFileRoute("/billing")({
  head: () => ({
    meta: [
      { title: "Billing — DroneCores" },
      { name: "description", content: "Manage your DroneCores plan, payment method, and demo invoices." },
    ],
  }),
  component: BillingPage,
});

const PLAN_NAMES: Record<PlanId, string> = { free: "Free", pro: "Pro", team: "Team" };
const PLAN_COPY: Record<PlanId, string> = {
  free: "Get started with DroneCores.",
  pro: "For hobbyists and small builders.",
  team: "For clubs and small companies.",
};

function money(value: number) {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(value);
}

function dateLabel(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function usageValue(value: number, limit: number) {
  return Number.isFinite(limit) ? `${value} / ${limit}` : `${value} / Unlimited`;
}

function UsageMeter({ label, value, limit }: { label: string; value: number; limit: number }) {
  const percent = Number.isFinite(limit) ? (limit === 0 ? 0 : Math.min(100, (value / limit) * 100)) : 100;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-foreground">{label}</span>
        <span className="shrink-0 text-muted-foreground">{usageValue(value, limit)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-secondary" role="meter" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={Number.isFinite(limit) ? limit : undefined}>
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function BillingPage() {
  return (
    <RequireAuth>
      <BillingContent />
    </RequireAuth>
  );
}

function BillingContent() {
  const { user } = useAuth();
  const { billing, changePlan, cancelSubscription, resumeSubscription, addDemoCard, removeCard, updateBillingEmail } = useBilling();
  const [interval, setInterval] = useState<BillingInterval>("monthly");
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [email, setEmail] = useState("");
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);

  if (!billing || !user) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading your billing…</div>;
  }

  const usage = billing.usage;
  const limits = PLAN_LIMITS[billing.plan];
  const endLabel = dateLabel(billing.periodEndAt);

  function selectPlan(plan: PlanId) {
    if (plan === billing.plan && (plan === "free" || interval === billing.interval)) return;
    if (plan === "free") {
      setCancelOpen(true);
      return;
    }
    if (!billing.card) {
      setNotice({ type: "error", message: "Add the demo VISA card before choosing a paid plan." });
      return;
    }
    if (changePlan(plan, interval)) {
      setNotice({ type: "success", message: `${PLAN_NAMES[plan]} plan selected. This is a demo; no payment was processed.` });
    }
  }

  function startEmailEdit() {
    setEmail(billing.billingEmail);
    setEmailError("");
    setEditingEmail(true);
  }

  function saveEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      setEmailError("Enter a valid email address.");
      return;
    }
    updateBillingEmail(normalized);
    setEditingEmail(false);
    setNotice({ type: "success", message: "Billing email updated." });
  }

  return (
    <div className="min-h-screen bg-brand-soft/70">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Billing</h1>
            <p className="mt-1 text-sm text-muted-foreground">Manage your plan, payment method and invoices.</p>
          </div>
        </div>

        <div className="mb-5 flex items-start gap-3 rounded-xl border border-primary/20 bg-white px-4 py-3 text-sm text-foreground shadow-sm">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          <p><strong>Demo mode:</strong> no real payments are processed.</p>
        </div>
        {notice && (
          <div role={notice.type === "error" ? "alert" : "status"} className={`mb-5 flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${notice.type === "error" ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
            <span className="flex items-center gap-2">{notice.type === "success" ? <Check className="h-4 w-4" aria-hidden /> : <AlertTriangle className="h-4 w-4" aria-hidden />}{notice.message}</span>
            <button type="button" aria-label="Dismiss notice" onClick={() => setNotice(null)} className="shrink-0 opacity-75 hover:opacity-100"><X className="h-4 w-4" aria-hidden /></button>
          </div>
        )}

        <section aria-label="Current plan and usage" className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="rounded-full bg-primary px-3 py-1 text-[11px] font-bold text-primary-foreground">Current plan</span>
              {billing.cancelAtPeriodEnd && <span className="text-xs font-semibold text-destructive">Cancellation scheduled</span>}
            </div>
            <h2 className="font-display text-2xl font-bold">{PLAN_NAMES[billing.plan]} plan</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {billing.plan === "free" ? "€0.00 / month" : `${money(billing.interval === "yearly" ? PLAN_PRICES[billing.plan].yearlyMonthly : PLAN_PRICES[billing.plan].monthly)} / month`}
              {billing.plan !== "free" && billing.interval === "yearly" ? ` · billed ${money(PLAN_PRICES[billing.plan].yearlyTotal)} yearly` : ""}
            </p>
            <div className="mt-4 rounded-xl bg-brand-soft p-3 text-xs text-muted-foreground">
              {billing.cancelAtPeriodEnd ? `Your plan remains active until ${endLabel}.` : billing.plan === "free" ? "Your Free plan is active." : `Next demo renewal: ${endLabel}.`}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {billing.plan !== "free" && !billing.cancelAtPeriodEnd && (
                <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
                  <AlertDialogTrigger asChild><button type="button" className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted">Cancel subscription</button></AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancel your subscription?</AlertDialogTitle>
                      <AlertDialogDescription>Your {PLAN_NAMES[billing.plan]} plan will stay active until {endLabel}. After that, your account returns to Free. You can resume before then.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep plan</AlertDialogCancel>
                      <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { cancelSubscription(); setNotice({ type: "success", message: `Subscription will end on ${endLabel}.` }); }}>Cancel at period end</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              {billing.cancelAtPeriodEnd && <button type="button" onClick={() => { resumeSubscription(); setNotice({ type: "success", message: "Your subscription has been resumed." }); }} className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90">Resume subscription</button>}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-bold">Usage this month</h2>
              <span className="text-xs text-muted-foreground">Resets {dateLabel(billing.periodEndAt)}</span>
            </div>
            <div className="space-y-4">
              <UsageMeter label="AI builds" value={usage.aiBuilds} limit={limits.aiBuilds} />
              <UsageMeter label="Saved builds" value={usage.savedBuilds} limit={limits.savedBuilds} />
              <UsageMeter label="Parts list exports" value={usage.exports} limit={limits.exports} />
            </div>
          </div>
        </section>

        <section className="mt-7" aria-labelledby="plans-heading">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="plans-heading" className="font-display text-xl font-bold">Choose your plan</h2>
              <p className="mt-1 text-sm text-muted-foreground">Upgrade, downgrade or cancel at any time.</p>
            </div>
            <div className="inline-flex w-fit items-center gap-1 rounded-xl border border-border bg-white p-1 text-xs shadow-sm" role="group" aria-label="Billing interval">
              <button type="button" aria-pressed={interval === "monthly"} onClick={() => setInterval("monthly")} className={`rounded-lg px-3 py-2 font-semibold ${interval === "monthly" ? "bg-secondary text-secondary-foreground" : "text-muted-foreground"}`}>Monthly</button>
              <button type="button" aria-pressed={interval === "yearly"} onClick={() => setInterval("yearly")} className={`rounded-lg px-3 py-2 font-semibold ${interval === "yearly" ? "bg-secondary text-secondary-foreground" : "text-muted-foreground"}`}>Yearly <span className="ml-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-700">Save 20%</span></button>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {(["free", "pro", "team"] as const).map((plan) => {
              const current = billing.plan === plan;
              const price = plan === "free" ? 0 : interval === "yearly" ? PLAN_PRICES[plan].yearlyMonthly : PLAN_PRICES[plan].monthly;
              const featureLines = [
                `${PLAN_LIMITS[plan].aiBuilds} AI builds / month`,
                `${PLAN_LIMITS[plan].savedBuilds === Infinity ? "Unlimited" : PLAN_LIMITS[plan].savedBuilds} saved builds`,
                `${PLAN_LIMITS[plan].exports === Infinity ? "Unlimited" : PLAN_LIMITS[plan].exports} parts list exports`,
                plan === "free" ? "Community support" : plan === "pro" ? "Email support" : "Priority support",
              ];
              return (
                <article key={plan} className={`relative flex flex-col rounded-2xl border bg-white p-5 shadow-sm ${plan === "pro" ? "border-primary ring-1 ring-primary/20" : "border-border"}`}>
                  {current && <span className="absolute right-4 top-4 rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold text-primary-foreground">Current plan</span>}
                  {plan === "team" && <span className="absolute right-4 top-4 rounded-full bg-secondary px-2.5 py-1 text-[10px] font-bold text-secondary-foreground">Best for teams</span>}
                  <h3 className="font-display text-lg font-bold">{PLAN_NAMES[plan]}</h3>
                  <p className="mt-1 min-h-10 pr-16 text-xs text-muted-foreground">{PLAN_COPY[plan]}</p>
                  <p className="mt-3 font-display text-3xl font-bold">{money(price)}<span className="font-sans text-xs font-normal text-muted-foreground"> / month</span></p>
                  {plan !== "free" && interval === "yearly" && <p className="mt-1 text-[11px] text-muted-foreground">{money(PLAN_PRICES[plan].yearlyTotal)} billed yearly</p>}
                  {plan === "free" && <p className="mt-1 text-[11px] text-muted-foreground">Free forever</p>}
                  <button type="button" disabled={current && (plan === "free" || interval === billing.interval)} onClick={() => selectPlan(plan)} className={`mt-4 h-10 w-full rounded-lg px-3 text-sm font-semibold transition-colors disabled:cursor-default ${current ? "border border-border bg-muted text-muted-foreground" : plan === "team" ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border border-border text-foreground hover:bg-muted"}`}>
                    {current ? "Current plan" : plan === "free" ? "Cancel subscription" : plan === "pro" && billing.plan === "team" ? "Switch to Pro" : `Upgrade to ${PLAN_NAMES[plan]}`}
                  </button>
                  <ul className="mt-5 space-y-3 border-t border-border pt-4 text-xs text-muted-foreground">
                    {featureLines.map((feature) => <li key={feature} className="flex gap-2"><Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden /><span>{feature}</span></li>)}
                  </ul>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mt-7 rounded-2xl border border-border bg-white p-5 shadow-sm sm:p-6" aria-labelledby="payment-heading">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div><h2 id="payment-heading" className="font-display text-lg font-bold">Payment method</h2><p className="mt-1 text-xs text-muted-foreground">Demo payment details only. No real card is stored.</p></div>
          </div>
          {billing.card ? (
            <div className="flex flex-col gap-3 rounded-xl border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-12 place-items-center rounded-md border border-border text-[10px] font-bold italic text-primary">VISA</span>
                <div><p className="text-sm font-semibold">Visa ending in 4242 <span className="ml-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-secondary-foreground">Default</span></p><p className="text-xs text-muted-foreground">Expires 12/30 · demo card</p></div>
              </div>
              <button type="button" disabled={billing.plan !== "free"} onClick={() => { if (removeCard()) setNotice({ type: "success", message: "Demo card removed." }); }} className="self-start text-xs font-semibold text-destructive disabled:cursor-not-allowed disabled:opacity-40 sm:self-auto" title={billing.plan !== "free" ? "Cancel your subscription before removing the card." : undefined}>Remove</button>
            </div>
          ) : (
            <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-dashed border-border p-4 sm:flex-row sm:items-center">
              <p className="text-sm text-muted-foreground">No demo card added.</p>
              <button type="button" onClick={() => { addDemoCard(); setNotice({ type: "success", message: "Demo VISA ending in 4242 added." }); }} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted"><Plus className="h-4 w-4" aria-hidden />Add demo card</button>
            </div>
          )}
          <div className="mt-5 border-t border-border pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-xs font-semibold">Billing email</p>{!editingEmail && <p className="mt-1 text-xs text-muted-foreground">{billing.billingEmail}</p>}</div>
              {!editingEmail && <button type="button" onClick={startEmailEdit} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"><Pencil className="h-3 w-3" aria-hidden />Edit</button>}
            </div>
            {editingEmail && <form noValidate onSubmit={saveEmail} className="mt-3 flex flex-col gap-2 sm:flex-row">
              <div className="flex-1"><label className="sr-only" htmlFor="billing-email">Billing email</label><input id="billing-email" type="email" value={email} onChange={(event) => { setEmail(event.target.value); setEmailError(""); }} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30" aria-invalid={Boolean(emailError)} aria-describedby={emailError ? "billing-email-error" : undefined} />{emailError && <p id="billing-email-error" className="mt-1 text-xs text-destructive">{emailError}</p>}</div>
              <div className="flex gap-2"><button type="button" onClick={() => setEditingEmail(false)} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted">Cancel</button><button type="submit" className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90">Save</button></div>
            </form>}
          </div>
        </section>

        <InvoiceHistory invoices={billing.invoices} />
      </main>
    </div>
  );
}

function downloadReceipt(invoice: DemoInvoice, user: { email: string; name: string }) {
  const body = [
    "DroneCores demo receipt",
    `Invoice: ${invoice.id}`,
    `Date: ${dateLabel(invoice.date)}`,
    `Customer: ${user.name} <${user.email}>`,
    `Description: ${invoice.description}`,
    `Amount: ${money(invoice.amount)}`,
    `Status: ${invoice.status}`,
    "",
    "Demo only. No payment was processed.",
  ].join("\n");
  const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${invoice.id}.txt`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function InvoiceHistory({ invoices }: { invoices: BillingRecord["invoices"] }) {
  const { user } = useAuth();
  return (
    <section className="mt-7 rounded-2xl border border-border bg-white p-5 shadow-sm sm:p-6" aria-labelledby="invoice-heading">
      <h2 id="invoice-heading" className="font-display text-lg font-bold">Invoice history</h2>
      <p className="mt-1 text-xs text-muted-foreground">Download a demo receipt for your records.</p>
      {invoices.length ? (
        <>
          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[620px] text-left text-xs">
              <thead><tr className="border-b border-border text-muted-foreground"><th className="pb-3 pr-4 font-medium">Date</th><th className="pb-3 pr-4 font-medium">Invoice</th><th className="pb-3 pr-4 font-medium">Description</th><th className="pb-3 pr-4 text-right font-medium">Amount</th><th className="pb-3 pr-4 font-medium">Status</th><th className="pb-3 text-right font-medium">Receipt</th></tr></thead>
              <tbody>{invoices.map((invoice) => <tr key={invoice.id} className="border-b border-border/70 last:border-0"><td className="py-3 pr-4 text-muted-foreground">{dateLabel(invoice.date)}</td><td className="py-3 pr-4 font-medium">{invoice.id}</td><td className="py-3 pr-4">{invoice.description}</td><td className="py-3 pr-4 text-right font-semibold">{money(invoice.amount)}</td><td className="py-3 pr-4"><span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">{invoice.status}</span></td><td className="py-3 text-right"><button type="button" aria-label={`Download receipt ${invoice.id}`} onClick={() => user && downloadReceipt(invoice, user)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-primary"><Download className="h-4 w-4" aria-hidden /></button></td></tr>)}</tbody>
            </table>
          </div>
          <ul className="mt-4 space-y-3 md:hidden">{invoices.map((invoice) => <li key={invoice.id} className="rounded-xl border border-border p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold">{invoice.description}</p><p className="mt-1 text-xs text-muted-foreground">{dateLabel(invoice.date)} · {invoice.id}</p></div><button type="button" aria-label={`Download receipt ${invoice.id}`} onClick={() => user && downloadReceipt(invoice, user)} className="rounded-lg p-2 text-primary hover:bg-secondary"><Download className="h-4 w-4" aria-hidden /></button></div><div className="mt-3 flex items-center justify-between"><span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">{invoice.status}</span><span className="font-semibold">{money(invoice.amount)}</span></div></li>)}</ul>
        </>
      ) : <p className="mt-4 rounded-xl bg-brand-soft p-4 text-sm text-muted-foreground">No invoices yet. Demo receipts will appear here when a paid plan is selected.</p>}
    </section>
  );
}
