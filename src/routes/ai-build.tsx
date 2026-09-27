import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  RotateCcw,
  SkipForward,
} from "lucide-react";
import { PageShell } from "@/components/PageShell";
import type { FlightStyle, Priority } from "@/lib/build-data";

export const Route = createFileRoute("/ai-build")({
  head: () => ({
    meta: [
      { title: "AI Build — DroneCores" },
      {
        name: "description",
        content:
          "Pick a budget and a color, choose how you want to fly, add special wishes, and get a suggested drone parts list.",
      },
      { property: "og:title", content: "AI Build — DroneCores" },
      {
        property: "og:description",
        content:
          "Pick a budget and a color, choose how you want to fly, add special wishes, and get a suggested drone parts list.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AiBuildPage,
});

type Suggestion = {
  name: string;
  parts: string[];
  why: string;
};

const BUDGET_MIN = 300;
const BUDGET_MAX = 3000;
const BUDGET_STEP = 50;

const COLOR_OPTIONS: { name: string; hex: string }[] = [
  { name: "Sky Blue", hex: "#3B82F6" },
  { name: "Midnight Black", hex: "#1E293B" },
  { name: "Arctic White", hex: "#F1F5F9" },
  { name: "Racing Red", hex: "#EF4444" },
  { name: "Sunset Orange", hex: "#F97316" },
  { name: "Forest Green", hex: "#22C55E" },
];

const STEP_LABELS = ["Budget", "Flight Style", "What matters most", "Personalization"];

const STYLE_OPTIONS: { name: FlightStyle; hint: string }[] = [
  { name: "FPV", hint: "Fly through goggles — fast and immersive" },
  { name: "Cinematic", hint: "Smooth, steady video of your trips" },
  { name: "Racing", hint: "Maximum speed on a race track" },
  { name: "Long Range", hint: "Fly far and explore wide landscapes" },
];

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

function buildSuggestion(
  budget: number,
  colorName: string | null,
  styleName: string | null,
): Suggestion {
  const colorPart = colorName
    ? `Custom shell in ${colorName}`
    : "Classic factory shell";

  if (styleName === "FPV") {
    return {
      name: "Immersive FPV Build",
      parts: [
        "5-inch freestyle frame with soft-mounted motors",
        "Punchy 2207 motors for quick, snappy moves",
        "Digital FPV camera — crystal clear through goggles",
        "6S 1300 mAh battery for nimble, agile flying",
        colorPart,
      ],
      why: `FPV is all about feeling every move, so this build favors quick response over long flight times. Your ${formatBudget(budget)} budget covers it comfortably.`,
    };
  }

  if (styleName === "Cinematic") {
    return {
      name: "Backpack Cinematic Build",
      parts: [
        "220mm folding frame — small enough for a backpack",
        "Efficient 2306 motors — long flight times, low noise",
        "4K camera with a 3-axis gimbal for steady footage",
        "6S 3000 mAh battery — around 25 minutes of flying",
        colorPart,
      ],
      why: `Cinematic flying lives on smooth footage, so the gimbal and big battery do the heavy lifting. Your ${formatBudget(budget)} budget covers everything here with room to spare.`,
    };
  }

  if (styleName === "Racing") {
    return {
      name: "Track Rocket Build",
      parts: [
        "5-inch stiff racing frame — zero flex at speed",
        "High-KV 2207 motors for explosive acceleration",
        "Lightweight analog FPV camera — lowest possible lag",
        "Small 6S 850 mAh battery to keep weight down",
        colorPart,
      ],
      why: `Racing drones shed every gram they can, so this build is deliberately minimal. Your ${formatBudget(budget)} budget leaves room for spare props — you will need them.`,
    };
  }

  if (styleName === "Long Range") {
    return {
      name: "Long-Range Explorer Build",
      parts: [
        "7-inch long frame with large, efficient props",
        "Low-KV motors tuned for calm, quiet efficiency",
        "GPS + return-to-home for hands-off safety",
        "High-capacity 6S 4000 mAh battery — very long flights",
        colorPart,
      ],
      why: `Long range is about efficiency and safety, so big slow propellers and GPS keep you flying far and coming home. Your ${formatBudget(budget)} budget fits this build well.`,
    };
  }


  if (budget < 700) {
    return {
      name: "First Racer Build",
      parts: [
        "Tiny 95mm whoop frame — survives crashes",
        "Gentle 1103 motors — smooth and forgiving to fly",
        "Ducted prop guards — safe around people and furniture",
        "Basic analog FPV camera — simple and cheap to replace",
        colorPart,
      ],
      why: `Your ${formatBudget(budget)} budget fits this comfortably. Small, protected props and mild power mean your first crashes cost almost nothing.`,
    };
  }

  if (budget <= 1500) {
    return {
      name: "Backpack Cinematic Build",
      parts: [
        "220mm folding frame — small enough for a backpack",
        "Efficient 2306 motors — long flight times, low noise",
        "4K camera with a 3-axis gimbal for steady footage",
        "6S 3000 mAh battery — around 25 minutes of flying",
        colorPart,
      ],
      why: `Your ${formatBudget(budget)} budget covers everything here with room to spare. Foldable parts keep it portable, while the gimbal and big battery do the heavy lifting for video quality.`,
    };
  }

  return {
    name: "Silent Shutter Pro Build",
    parts: [
      "7-inch long frame with large, slow-spinning props",
      "Low-KV motors tuned for quiet efficiency",
      "Micro 4/3 camera with fast low-light lens",
      "GPS + return-to-home for calm, hands-off hovering",
      colorPart,
    ],
    why: `Your ${formatBudget(budget)} budget unlocks premium parts. Big slow propellers are dramatically quieter than small fast ones — perfect for sunrise shoots.`,
  };
}

function AiBuildPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [budget, setBudget] = useState(1000);
  const [color, setColor] = useState<string | null>(null);
  const [style, setStyle] = useState<FlightStyle | null>(null);
  const [selectedPriorities, setSelectedPriorities] = useState<Priority[]>([]);
  const [wishes, setWishes] = useState("");
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);

  const finish = () => {
    void navigate({
      to: "/create-custom-build",
      search: {
        source: "ai",
        budget,
        ...(style ? { style } : {}),
        ...(selectedPriorities.length
          ? { priorities: selectedPriorities.join(",") }
          : {}),
      },
    });
  };

  const startOver = () => {
    setStep(0);
    setBudget(1000);
    setColor(null);
    setStyle(null);
    setSelectedPriorities([]);
    setWishes("");
    setSuggestion(null);
  };

  const nextStep = () => setStep((current) => Math.min(current + 1, 3));
  const prevStep = () => setStep((current) => Math.max(current - 1, 0));

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
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all active:scale-[0.98]";

  const questionCard = (children: React.ReactNode) => (
    <section className="rounded-3xl border border-border bg-card p-8 shadow-sm sm:p-10">
      <p className="text-xs font-semibold uppercase tracking-widest text-primary">
        Step {step + 1} of 4 — {STEP_LABELS[step]}
      </p>
      {children}
    </section>
  );

  const navigationRow = (continueLabel: string, onContinue: () => void) => (
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
      {step < 3 && (
        <button
          type="button"
          onClick={nextStep}
          className={`${buttonBase} border border-border text-muted-foreground hover:border-primary/40 hover:text-foreground`}
        >
          <SkipForward className="h-4 w-4" aria-hidden />
          Skip
        </button>
      )}
      <button
        type="button"
        onClick={onContinue}
        className={`${buttonBase} bg-primary text-primary-foreground hover:bg-primary/90 ml-auto`}
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
      description="Answer four quick questions and open a suggested parts selection in the same shared configurator used by Custom Build and Templates."
    >
      {/* Progress dots */}
      <div className="mb-6 flex items-center gap-3" aria-hidden>
        {STEP_LABELS.map((label, index) => (
          <div key={label} className="flex flex-1 items-center gap-3">
            <div
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                index <= Math.min(step, 3) ? "bg-primary" : "bg-muted"
              }`}
            />
          </div>
        ))}
      </div>

      <div className={step === 4 ? "grid gap-6 lg:grid-cols-2" : "mx-auto w-full max-w-2xl"}>
        <div>
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
                {navigationRow("Continue", nextStep)}
              </>,
            )}

          {step === 1 &&
            questionCard(
              <>
                <h2 className="mt-3 font-display text-2xl font-semibold text-foreground">
                  How do you want to fly?
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pick the flying style that fits you — you can skip this.
                </p>
                <div
                  className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2"
                  role="radiogroup"
                  aria-label="Flying style"
                >
                  {STYLE_OPTIONS.map((option) => {
                    const selected = style === option.name;
                    return (
                      <button
                        key={option.name}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setStyle(option.name)}
                        className={`rounded-2xl border p-4 text-left transition-all active:scale-95 ${
                          selected
                            ? "border-primary bg-secondary"
                            : "border-border hover:border-primary/40"
                        }`}
                      >
                        <span className="block text-sm font-semibold text-foreground">
                          {option.name}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {option.hint}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {navigationRow("Continue", nextStep)}
              </>,
            )}

          {step === 2 &&
            questionCard(
              <>
                <h2 className="mt-3 font-display text-2xl font-semibold text-foreground">
                  What matters most to you?
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pick what you want your drone to specialize in
                </p>
                <p className="mt-2 text-xs font-medium text-muted-foreground">
                  Choose one or two options. Once two are selected, deselect one to choose another.
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
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={prevStep}
                    className={`${buttonBase} border border-border text-muted-foreground hover:border-primary/40 hover:text-primary`}
                  >
                    <ArrowLeft className="h-4 w-4" aria-hidden />
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={nextStep}
                    disabled={selectedPriorities.length === 0}
                    className={`${buttonBase} ml-auto bg-primary text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-45`}
                  >
                    Continue
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </>,
            )}

          {step === 3 &&
            questionCard(
              <>
                <h2 className="mt-3 font-display text-2xl font-semibold text-foreground">
                  Personalize your build
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Choose an optional color and add any special wishes before opening your build.
                </p>

                <p className="mt-5 text-sm font-semibold text-foreground">Preferred color</p>
                <div
                  className="mt-2 grid grid-cols-3 gap-3"
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
                        <span className="text-xs font-medium text-foreground">
                          {option.name}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <label htmlFor="special-wishes" className="mt-5 block text-sm font-semibold text-foreground">
                  Special wishes <span className="font-normal text-muted-foreground">(optional)</span>
                </label>
                <textarea
                  id="special-wishes"
                  value={wishes}
                  onChange={(event) => setWishes(event.target.value)}
                  rows={5}
                  className="mt-2 w-full resize-none rounded-2xl border border-input bg-background p-4 text-sm text-foreground outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-ring"
                  placeholder="For example: it must fit in my school bag, and I want it as quiet as possible"
                />
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={prevStep}
                    className={`${buttonBase} border border-border text-muted-foreground hover:border-primary/40 hover:text-primary`}
                  >
                    <ArrowLeft className="h-4 w-4" aria-hidden />
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={finish}
                    className={`${buttonBase} ml-auto bg-primary text-primary-foreground hover:bg-primary/90`}
                  >
                    Open my build
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </>,
            )}

          {step === 4 && (
            <section className="flex h-full flex-col items-start justify-center rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-7">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                Your answers
              </p>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <dt className="font-semibold text-foreground">Budget:</dt>
                  <dd className="text-muted-foreground">{formatBudget(budget)}</dd>
                </div>
                <div className="flex items-center gap-2">
                  <dt className="font-semibold text-foreground">Color:</dt>
                  <dd className="text-muted-foreground">
                    {color ?? "Skipped — you pick later"}
                  </dd>
                </div>
                <div className="flex items-center gap-2">
                  <dt className="font-semibold text-foreground">Style:</dt>
                  <dd className="text-muted-foreground">
                    {style ?? "Skipped"}
                  </dd>
                </div>
                <div className="flex items-start gap-2">
                  <dt className="shrink-0 font-semibold text-foreground">Wishes:</dt>
                  <dd className="text-muted-foreground">
                    {wishes.trim() ? wishes.trim() : "Skipped"}
                  </dd>
                </div>
              </dl>
              <button
                type="button"
                onClick={startOver}
                className={`${buttonBase} mt-6 border border-border text-muted-foreground hover:border-primary/40 hover:text-primary`}
              >
                <RotateCcw className="h-4 w-4" aria-hidden />
                Start over
              </button>
            </section>
          )}
        </div>

        {step === 4 && suggestion && (
          <section aria-live="polite">
            <article className="h-full rounded-3xl border border-primary/30 bg-brand-soft p-6 shadow-sm sm:p-7">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                AI suggestion
              </p>
              <h2 className="mt-2 font-display text-xl font-semibold text-foreground">
                {suggestion.name}
              </h2>
              <ul className="mt-4 space-y-2.5">
                {suggestion.parts.map((part) => (
                  <li
                    key={part}
                    className="flex items-start gap-2.5 text-sm text-foreground"
                  >
                    <span
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                      aria-hidden
                    />
                    {part}
                  </li>
                ))}
              </ul>
              <p className="mt-5 rounded-2xl bg-card p-4 text-sm leading-relaxed text-muted-foreground">
                {suggestion.why}
              </p>
            </article>
            <p className="mt-4 text-xs text-muted-foreground">
              Sample preview — this demo answers from a fixed list. Real AI
              builds arrive in a later step.
            </p>
          </section>
        )}
      </div>
    </PageShell>
  );
}
