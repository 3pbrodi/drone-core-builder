import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth, type AuthUser } from "@/lib/auth";

export type PlanId = "free" | "pro" | "team";
export type BillingInterval = "monthly" | "yearly";
export type DemoCard = { brand: "VISA"; last4: "4242"; addedAt: string };
export type DemoInvoice = {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: "Paid";
};
export type Usage = { aiBuilds: number; savedBuilds: number; exports: number };
export type BillingRecord = {
  plan: PlanId;
  interval: BillingInterval;
  cancelAtPeriodEnd: boolean;
  periodEndAt: string | null;
  card: DemoCard | null;
  billingEmail: string;
  usage: Usage;
  invoices: DemoInvoice[];
  nextInvoiceNumber: number;
};

export const PLAN_LIMITS: Record<PlanId, { aiBuilds: number; savedBuilds: number; exports: number }> = {
  free: { aiBuilds: 10, savedBuilds: 3, exports: 0 },
  pro: { aiBuilds: 100, savedBuilds: 50, exports: 20 },
  team: { aiBuilds: 500, savedBuilds: Infinity, exports: Infinity },
};

export const PLAN_PRICES: Record<PlanId, { monthly: number; yearlyMonthly: number; yearlyTotal: number }> = {
  free: { monthly: 0, yearlyMonthly: 0, yearlyTotal: 0 },
  pro: { monthly: 19, yearlyMonthly: 15.2, yearlyTotal: 182.4 },
  team: { monthly: 49, yearlyMonthly: 39.2, yearlyTotal: 470.4 },
};

type BillingContextValue = {
  billing: BillingRecord | null;
  changePlan: (plan: PlanId, interval: BillingInterval) => boolean;
  cancelSubscription: () => void;
  resumeSubscription: () => void;
  addDemoCard: () => void;
  removeCard: () => boolean;
  updateBillingEmail: (email: string) => void;
};

const BillingContext = createContext<BillingContextValue | null>(null);

function storageKey(userId: string) {
  return `dronecores.billing.${userId}`;
}

function readBilling(user: AuthUser): BillingRecord {
  try {
    const raw = window.localStorage.getItem(storageKey(user.id));
    if (raw) {
      const parsed = JSON.parse(raw) as BillingRecord;
      if (parsed.periodEndAt && new Date(parsed.periodEndAt).getTime() <= Date.now() && parsed.cancelAtPeriodEnd) {
        return {
          ...parsed,
          plan: "free",
          interval: "monthly",
          cancelAtPeriodEnd: false,
          periodEndAt: null,
        };
      }
      return parsed;
    }
  } catch {
    // Fall back to the demo account state when local storage is unavailable or malformed.
  }

  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + 30);
  const invoices: DemoInvoice[] = [
    { id: "DEMO-0001", date: new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()).toISOString(), description: "Pro plan, monthly", amount: 19, status: "Paid" },
    { id: "DEMO-0002", date: new Date(now.getFullYear(), now.getMonth() - 2, now.getDate()).toISOString(), description: "Pro plan, monthly", amount: 19, status: "Paid" },
    { id: "DEMO-0003", date: new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).toISOString(), description: "Pro plan, monthly", amount: 19, status: "Paid" },
    { id: "DEMO-0004", date: now.toISOString(), description: "Pro plan, monthly", amount: 19, status: "Paid" },
  ];
  return {
    plan: "pro",
    interval: "monthly",
    cancelAtPeriodEnd: false,
    periodEndAt: end.toISOString(),
    card: { brand: "VISA", last4: "4242", addedAt: now.toISOString() },
    billingEmail: user.email,
    usage: { aiBuilds: 4, savedBuilds: 15, exports: 6 },
    invoices,
    nextInvoiceNumber: 5,
  };
}

function writeBilling(userId: string, value: BillingRecord) {
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function addMonths(from: Date, months: number) {
  const result = new Date(from);
  result.setMonth(result.getMonth() + months);
  return result;
}

export function BillingProvider({ children }: { children: ReactNode }) {
  const { user, status } = useAuth();
  const [billing, setBilling] = useState<BillingRecord | null>(null);

  useEffect(() => {
    if (status === "signedIn" && user) {
      const next = readBilling(user);
      setBilling(next);
      writeBilling(user.id, next);
    } else if (status === "signedOut") {
      setBilling(null);
    }
  }, [user, status]);

  useEffect(() => {
    if (user && billing) writeBilling(user.id, billing);
  }, [user, billing]);

  useEffect(() => {
    if (!user || !billing?.cancelAtPeriodEnd || !billing.periodEndAt) return;
    const expireAt = new Date(billing.periodEndAt).getTime();
    const expire = () => {
      setBilling((current) => {
        if (!current || !current.cancelAtPeriodEnd || current.plan === "free") return current;
        const updated: BillingRecord = {
          ...current,
          plan: "free",
          interval: "monthly",
          cancelAtPeriodEnd: false,
          periodEndAt: null,
        };
        writeBilling(user.id, updated);
        return updated;
      });
    };
    const delay = expireAt - Date.now();
    if (delay > 0) {
      const timeoutId = window.setTimeout(expire, delay);
      return () => window.clearTimeout(timeoutId);
    }
    expire();
  }, [user, billing?.cancelAtPeriodEnd, billing?.periodEndAt]);

  const changePlan = useCallback(
    (plan: PlanId, interval: BillingInterval) => {
      if (!user || !billing) return false;
      if (plan !== "free" && !billing.card) return false;
      setBilling((current) => {
        if (!current) return current;
        const now = new Date();
        const price = interval === "yearly" ? PLAN_PRICES[plan].yearlyTotal : PLAN_PRICES[plan].monthly;
        const invoices =
          plan === "free"
            ? current.invoices
            : [
                {
                  id: `DEMO-${String(current.nextInvoiceNumber).padStart(4, "0")}`,
                  date: now.toISOString(),
                  description: `${plan[0].toUpperCase()}${plan.slice(1)} plan, ${interval}`,
                  amount: price,
                  status: "Paid" as const,
                },
                ...current.invoices,
              ];
        const updated: BillingRecord = {
          ...current,
          plan,
          interval: plan === "free" ? "monthly" : interval,
          cancelAtPeriodEnd: false,
          periodEndAt: plan === "free" ? null : addMonths(now, interval === "yearly" ? 12 : 1).toISOString(),
          invoices,
          nextInvoiceNumber: plan === "free" ? current.nextInvoiceNumber : current.nextInvoiceNumber + 1,
        };
        writeBilling(user.id, updated);
        return updated;
      });
      return true;
    },
    [user, billing],
  );

  const cancelSubscription = useCallback(() => {
    if (!user || !billing || billing.plan === "free") return;
    setBilling((current) => {
      if (!current) return current;
      const updated = { ...current, cancelAtPeriodEnd: true };
      writeBilling(user.id, updated);
      return updated;
    });
  }, [user, billing]);

  const resumeSubscription = useCallback(() => {
    if (!user || !billing) return;
    setBilling((current) => {
      if (!current) return current;
      const updated = { ...current, cancelAtPeriodEnd: false };
      writeBilling(user.id, updated);
      return updated;
    });
  }, [user, billing]);

  const addDemoCard = useCallback(() => {
    if (!user) return;
    setBilling((current) => {
      if (!current) return current;
      const updated = {
        ...current,
        card: current.card ?? { brand: "VISA" as const, last4: "4242" as const, addedAt: new Date().toISOString() },
      };
      writeBilling(user.id, updated);
      return updated;
    });
  }, [user]);

  const removeCard = useCallback(() => {
    if (!user || !billing || billing.plan !== "free") return false;
    setBilling((current) => {
      if (!current) return current;
      const updated = { ...current, card: null };
      writeBilling(user.id, updated);
      return updated;
    });
    return true;
  }, [user, billing]);

  const updateBillingEmail = useCallback(
    (email: string) => {
      if (!user) return;
      setBilling((current) => {
        if (!current) return current;
        const updated = { ...current, billingEmail: email };
        writeBilling(user.id, updated);
        return updated;
      });
    },
    [user],
  );

  const value = useMemo(
    () => ({ billing, changePlan, cancelSubscription, resumeSubscription, addDemoCard, removeCard, updateBillingEmail }),
    [billing, changePlan, cancelSubscription, resumeSubscription, addDemoCard, removeCard, updateBillingEmail],
  );
  return <BillingContext.Provider value={value}>{children}</BillingContext.Provider>;
}

export function useBilling() {
  const context = useContext(BillingContext);
  if (!context) throw new Error("useBilling must be used within BillingProvider");
  return context;
}
