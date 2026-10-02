import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageShell } from "@/components/PageShell";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/create-custom-build")({
  head: () => ({
    meta: [
      { title: "Create a Custom Build — DroneCores" },
      {
        name: "description",
        content:
          "Pick every part of your drone yourself, with plain-English explanations for each component.",
      },
      {
        property: "og:title",
        content: "Create a Custom Build — DroneCores",
      },
      {
        property: "og:description",
        content:
          "Pick every part of your drone yourself, with plain-English explanations for each component.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CreateCustomBuildPage,
});

type Part = {
  id: string;
  name: string;
  role: string;
  price: number;
  essential: boolean;
};

const PARTS: Part[] = [
  {
    id: "frame",
    name: "5-inch carbon frame kit",
    role: "The skeleton everything else mounts to",
    price: 45,
    essential: true,
  },
  {
    id: "motors",
    name: "2306 brushless motors (×4)",
    role: "Spin the propellers — more power means faster flight",
    price: 80,
    essential: true,
  },
  {
    id: "esc",
    name: "4-in-1 ESC board",
    role: "Controls how fast each motor spins",
    price: 55,
    essential: true,
  },
  {
    id: "fc",
    name: "Flight controller + GPS",
    role: "The brain — keeps the drone stable in the air",
    price: 95,
    essential: true,
  },
  {
    id: "radio",
    name: "Radio transmitter + receiver",
    role: "Your handheld controller",
    price: 130,
    essential: true,
  },
  {
    id: "camera",
    name: "4K camera + gimbal",
    role: "Records smooth, steady video",
    price: 220,
    essential: false,
  },
  {
    id: "battery",
    name: "6S 1500 mAh batteries (×2)",
    role: "About 12 minutes of flight per pack",
    price: 90,
    essential: false,
  },
  {
    id: "goggles",
    name: "FPV goggles",
    role: "See live video from the drone as it flies",
    price: 180,
    essential: false,
  },
];

function CreateCustomBuildPage() {
  const { user, status } = useAuth();
  const [selected, setSelected] = useState<Set<string>>(() =>
    new Set(PARTS.filter((part) => part.essential).map((part) => part.id)),
  );
  useEffect(() => {
    const validIds = new Set(PARTS.map((part) => part.id));
    try {
      const raw = window.localStorage.getItem("dronecores.draft");
      if (raw) {
        const draft = JSON.parse(raw) as { partIds?: unknown };
        if (Array.isArray(draft.partIds)) {
          const restored = draft.partIds.filter((id): id is string => typeof id === "string" && validIds.has(id));
          setSelected(new Set(restored));
        }
      }
    } catch {
      // Use the sample starter build if the local draft is unavailable.
    }
  }, []);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  const toggle = (id: string) => {
    setSaved(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const total = PARTS.filter((part) => selected.has(part.id)).reduce(
    (sum, part) => sum + part.price,
    0,
  );

  function saveBuild() {
    const partIds = [...selected];
    try {
      if (status === "signedIn" && user) {
        const key = `dronecores.builds.${user.id}`;
        const parsed = JSON.parse(window.localStorage.getItem(key) || "[]") as unknown;
        const builds = Array.isArray(parsed) ? parsed : [];
        builds.push({ id: crypto.randomUUID(), savedAt: new Date().toISOString(), partIds, estimatedTotal: total });
        window.localStorage.setItem(key, JSON.stringify(builds));
        window.localStorage.removeItem("dronecores.draft");
        setSaveError("");
        setSaved(true);
      } else if (status === "signedOut") {
        window.localStorage.setItem("dronecores.draft", JSON.stringify({ partIds, savedAt: new Date().toISOString() }));
        setSaveError("");
        setSaveDialogOpen(true);
      }
    } catch {
      setSaveError("This browser could not save your build. Check its storage settings and try again.");
    }
  }

  return (
    <PageShell
      eyebrow="Path 1"
      title="Create Custom Build"
      description="Tap a part to add or remove it from your build. Each one is explained in plain English — no jargon required."
    >
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <ul className="space-y-3">
          {PARTS.map((part) => {
            const isSelected = selected.has(part.id);
            return (
              <li key={part.id}>
                <button
                  type="button"
                  onClick={() => toggle(part.id)}
                  aria-pressed={isSelected}
                  className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-all active:scale-[0.99] sm:p-5 ${
                    isSelected
                      ? "border-primary/50 bg-secondary/60 shadow-sm"
                      : "border-border bg-card hover:border-primary/30"
                  }`}
                >
                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition-colors ${
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background"
                    }`}
                  >
                    {isSelected ? <Check className="h-4 w-4" aria-hidden /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-foreground">{part.name}</span>
                      {part.essential ? (
                        <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">
                          Essential
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">
                      {part.role}
                    </span>
                  </span>
                  <span className="shrink-0 font-display font-semibold text-foreground">
                    ${part.price}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
            <h2 className="font-display text-lg font-semibold text-foreground">
              Your build so far
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {selected.size} of {PARTS.length} parts selected
            </p>
            <div className="mt-5 flex items-baseline justify-between border-t border-border pt-5">
              <span className="text-sm font-medium text-muted-foreground">
                Estimated total
              </span>
              <span className="font-display text-3xl font-bold text-primary">
                ${total}
              </span>
            </div>
            <p className="mt-4 rounded-xl bg-brand-soft p-3 text-xs leading-relaxed text-muted-foreground">
              Sample parts and prices for now. When the real configurator arrives,
              this list will check that all your parts actually fit together.
            </p>
            <button type="button" onClick={saveBuild} disabled={status === "loading"} className="mt-5 h-11 w-full rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-wait disabled:opacity-60">
              {saved ? "Saved" : "Save Build"}
            </button>
            {saveError && <p role="alert" className="mt-2 text-xs text-destructive">{saveError}</p>}
          </div>
        </aside>
      </div>
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Want to save your progress?</DialogTitle>
            <DialogDescription>Your selected parts are saved as a draft in this browser. Sign in or create an account to keep this build with your account.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 pt-2 sm:grid-cols-2">
            <Link to="/login" search={{ redirect: "/create-custom-build", mode: "signup" }} className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Create account</Link>
            <Link to="/login" search={{ redirect: "/create-custom-build" }} className="inline-flex h-11 items-center justify-center rounded-xl border border-border px-4 text-sm font-semibold hover:bg-muted">Sign in</Link>
            <button type="button" onClick={() => setSaveDialogOpen(false)} className="h-11 rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted sm:col-span-2">Not now</button>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
