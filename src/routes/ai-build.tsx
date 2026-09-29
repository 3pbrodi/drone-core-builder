import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, SkipForward } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import type { Priority } from "@/lib/build-data";

export const Route = createFileRoute("/ai-build")({
  head: () => ({
    meta: [
      { title: "AI Build — DroneCores" },
      {
        name: "description",
        content:
          "Answer four quick questions and open a suggested drone in the shared DroneCores configurator.",
      },
      { property: "og:title", content: "AI Build — DroneCores" },
      {
        property: "og:description",
        content:
          "Answer four quick questions and open a suggested drone in the shared DroneCores configurator.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AiBuildPage,
});

const BUDGET_MIN = 300;
const BUDGET_MAX = 3000;
const BUDGET_STEP = 50;
const DEFAULT_BUDGET = 1000;

const COLOR_OPTIONS: { name: string; hex: string }[] = [
  { name: "Sky Blue", hex: "#3B82F6" },
  { name: "Midnight Black", hex: "#1E293B" },
  { name: "Arctic White", hex: "#F1F5F9" },
  { name: "Racing Red", hex: "#EF4444" },
  { name: "Sunset Orange", hex: "#F97316" },
  { name: "Forest Green", hex: "#22C55E" },
];

const STEP_LABELS = ["Budget", "What matters most", "Preferred color", "Personalization"];

const PRIORITY_OPTIONS: { id: Priority; title: string; description: string }[] = [
  {
    id: "footage",
    title: "🎬 Crisp, Stable Camera Footage",
    description:
      "4K gimbal camera and smooth hovering for cinematic travel clips and YouTube videos.",
  },
  {
    id: "parkour",
    title: "🏁 Freestyle Parkour & Racing",
    description:
      "Instant throttle response, sharp cornering, and agility for flips, dives, and race gates.",
  },
  {
    id: "range",
    title: "⏱️ Long Flight Time & Range",
    description:
      "25–35+ min battery and GPS Return-to-Home so you can explore further without stress.",
  },
  {
    id: "beginner",
    title: "🛡️ Easy to Fly & Crash-Resistant",
    description:
      "Ducted prop guards and forgiving controls so beginners can practice without breaking parts.",
  },
];

function formatBudget(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function AiBuildPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [budget, setBudget] = useState(DEFAULT_BUDGET);
  const [color, setColor] = useState<string | null>(null);
  const [selectedPriorities, setSelectedPriorities] = useState<Priority[]>([]);
  const [wishes, setWishes] = useState("");

  const nextStep = () => setStep((current) => Math.min(current + 1, 3));
  const prevStep = () => setStep((current) => Math.max(current - 1, 0));

  const finish = () => {
    void navigate({
      to: "/create-custom-build",
      search: {
        source: "ai",
        budget,
        ...(selectedPriorities.length ? { priorities: selectedPriorities.join(",") } : {}),
      },
    });
  };

  const togglePriority = (priority: Priority) => {
    setSelectedPriorities((current) => {
      if (current.includes(priority)) {
        return current.filter((item) => item !== priority);
      }
      if (current.length >= 2) return current;
      return [...current, priority];
    });
  };

  const buttonBase =
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all active:scale-[0.98]";

  const questionCard = (children: React.ReactNode) => (
    <section className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-widest text-primary">
        Step {step + 1} of 4 — {STEP_LABELS[step]}
      </p>
      {children}
    </section>
  );

  const navigationRow = ({
    onContinue,
    onSkip,
    continueLabel = "Continue",
  }: {
    onContinue: () => void;
    onSkip: () => void;
    continueLabel?: string;
  }) => (
    <div className="mt-6 flex flex-wrap items-center gap-3">
      {step > 0 && (
        <button
          type="button"
          onClick={prevStep}
          className={`${buttonBase} border border-border text-muted-foreground hover:border-primary/40 hover:text-primary`}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back
        </button>
      )}
      <button
        type="button"
        onClick={onSkip}
        className={`${buttonBase} border border-border text-muted-foreground hover:border-primary/40 hover:text-foreground`}
      >
        <SkipForward className="h-4 w-4" aria-hidden />
        Skip
      </button>
      <button
        type="button"
        onClick={onContinue}
        className={`${buttonBase} ml-auto bg-primary text-primary-foreground hover:bg-primary/90`}
      >
        {continueLabel}
        <ArrowRight className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );

  return (
    <PageShell
      eyebrow="Path 3"
      title="AI Build"
      description="Answer four quick questions and open the result in the same shared configurator used by Custom Build and Templates."
    >
      <div className="mb-6 flex items-center gap-3" aria-hidden>
        {STEP_LABELS.map((label, index) => (
          <div key={label} className="flex flex-1 items-center gap-3">
            <div
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                index <= step ? "bg-primary" : "bg-muted"
              }`}
            />
          </div>
        ))}
      </div>

      <div className="mx-auto w-full max-w-2xl">
        {step === 0 &&
          questionCard(
            <>
              <h2 className="mt-3 font-display text-2xl font-semibold text-foreground">
                What is your budget?
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Drag the slider to set how much you want to spend.
              </p>
              <p className="mt-6 text-center font-display text-4xl font-bold text-primary tabular-nums">
                {formatBudget(budget)}
              </p>
              <label htmlFor="budget-slider" className="sr-only">
                Budget in euros
              </label>
              <input
                id="budget-slider"
                type="range"
                min={BUDGET_MIN}
                max={BUDGET_MAX}
                step={BUDGET_STEP}
                value={budget}
                onChange={(event) => setBudget(Number(event.target.value))}
                className="mt-4 w-full accent-primary"
              />
              <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                <span>{formatBudget(BUDGET_MIN)}</span>
                <span>{formatBudget(BUDGET_MAX)}</span>
              </div>
              {navigationRow({
                onContinue: nextStep,
                onSkip: () => {
                  setBudget(DEFAULT_BUDGET);
                  nextStep();
                },
              })}
            </>,
          )}

        {step === 1 &&
          questionCard(
            <>
              <h2 className="mt-3 font-display text-2xl font-semibold text-foreground">
                What matters most to you?
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Pick what you want your drone to specialize in
              </p>
              <p className="mt-2 text-xs font-medium text-muted-foreground">
                Select one or two options. Once two are selected, the remaining options stay
                disabled until you deselect one.
              </p>
              <div
                className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2"
                aria-label="Build priorities"
              >
                {PRIORITY_OPTIONS.map((option) => {
                  const selected = selectedPriorities.includes(option.id);
                  const disabled = !selected && selectedPriorities.length >= 2;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={selected}
                      disabled={disabled}
                      onClick={() => togglePriority(option.id)}
                      className={`relative rounded-2xl border p-4 text-left transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-45 ${
                        selected
                          ? "border-primary bg-secondary"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      {selected && (
                        <span className="absolute right-3 top-3 grid size-6 place-items-center rounded-full bg-primary text-primary-foreground">
                          <Check className="size-4" aria-hidden />
                        </span>
                      )}
                      <span className="block pr-7 text-sm font-semibold text-foreground">
                        {option.title}
                      </span>
                      <span className="mt-1.5 block text-xs leading-relaxed text-muted-foreground">
                        {option.description}
                      </span>
                    </button>
                  );
                })}
              </div>
              {navigationRow({
                onContinue: nextStep,
                onSkip: () => {
                  setSelectedPriorities([]);
                  nextStep();
                },
              })}
            </>,
          )}

        {step === 2 &&
          questionCard(
            <>
              <h2 className="mt-3 font-display text-2xl font-semibold text-foreground">
                What color should your drone be?
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Pick a shell color — or skip this and decide later.
              </p>
              <div
                className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3"
                role="radiogroup"
                aria-label="Preferred color"
              >
                {COLOR_OPTIONS.map((option) => {
                  const selected = color === option.name;
                  return (
                    <button
                      key={option.name}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setColor(option.name)}
                      className={`flex flex-col items-center gap-2 rounded-2xl border p-3 transition-all active:scale-95 ${
                        selected
                          ? "border-primary bg-secondary"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <span
                        className="h-9 w-9 rounded-full border border-border shadow-sm"
                        style={{ backgroundColor: option.hex }}
                        aria-hidden
                      />
                      <span className="text-xs font-medium text-foreground">{option.name}</span>
                    </button>
                  );
                })}
              </div>
              {navigationRow({
                onContinue: nextStep,
                onSkip: () => {
                  setColor(null);
                  nextStep();
                },
              })}
            </>,
          )}

        {step === 3 &&
          questionCard(
            <>
              <h2 className="mt-3 font-display text-2xl font-semibold text-foreground">
                Personalization
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Add any optional wishes for your build. You can also skip this.
              </p>
              <label htmlFor="special-wishes" className="sr-only">
                Special wishes or personalization
              </label>
              <textarea
                id="special-wishes"
                value={wishes}
                onChange={(event) => setWishes(event.target.value)}
                rows={6}
                className="mt-4 w-full resize-none rounded-2xl border border-input bg-background p-4 text-sm text-foreground outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-ring"
                placeholder="For example: it should fit in my school bag and be as quiet as possible"
              />
              {navigationRow({
                onContinue: finish,
                onSkip: () => {
                  setWishes("");
                  finish();
                },
                continueLabel: "Open my build",
              })}
            </>,
          )}
      </div>
    </PageShell>
  );
}
