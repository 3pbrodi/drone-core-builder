import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { PageShell } from "@/components/PageShell";

export const Route = createFileRoute("/ai-build")({
  head: () => ({
    meta: [
      { title: "AI Build — DroneCores" },
      {
        name: "description",
        content:
          "Describe what you want to do with your drone in one sentence and get a suggested parts list.",
      },
      { property: "og:title", content: "AI Build — DroneCores" },
      {
        property: "og:description",
        content:
          "Describe what you want to do with your drone in one sentence and get a suggested parts list.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AiBuildPage,
});

const IDEAS = [
  "A travel drone that fits in a backpack and films 4K",
  "My very first FPV racer — I've never flown before",
  "A quiet photography drone for early mornings",
];

type Suggestion = {
  name: string;
  parts: string[];
  why: string;
};

const SUGGESTIONS: Record<string, Suggestion> = {
  [IDEAS[0]]: {
    name: "Backpack Cinematic Build",
    parts: [
      "220mm folding frame — small enough for a backpack",
      "Efficient 2306 motors — long flight times, low noise",
      "4K camera with a 3-axis gimbal for steady footage",
      "6S 3000 mAh battery — around 25 minutes of flying",
    ],
    why: "Foldable parts keep it portable, while the gimbal and big battery do the heavy lifting for video quality.",
  },
  [IDEAS[1]]: {
    name: "First Racer Build",
    parts: [
      "Tiny 95mm whoop frame — survives crashes",
      "Gentle 1103 motors — smooth and forgiving to fly",
      "Ducted prop guards — safe around people and furniture",
      "Basic analog FPV camera — simple and cheap to replace",
    ],
    why: "Small, protected props and mild power mean your first crashes cost almost nothing.",
  },
  [IDEAS[2]]: {
    name: "Silent Shutter Build",
    parts: [
      "7-inch long frame with large, slow-spinning props",
      "Low-KV motors tuned for quiet efficiency",
      "Micro 4/3 camera with fast low-light lens",
      "GPS + return-to-home for calm, hands-off hovering",
    ],
    why: "Big slow propellers are dramatically quieter than small fast ones — perfect for sunrise shoots.",
  },
};

function AiBuildPage() {
  const [idea, setIdea] = useState(IDEAS[0]);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);

  const generate = () => {
    setSuggestion(SUGGESTIONS[idea] ?? null);
  };

  return (
    <PageShell
      eyebrow="Path 3"
      title="AI Build"
      description="Tell the AI what you want to do with your drone — it suggests a parts list you can open in the custom builder."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-7">
          <h2 className="font-display text-lg font-semibold text-foreground">
            What do you want to fly?
          </h2>
          <label htmlFor="ai-idea" className="mt-4 block text-sm font-medium text-muted-foreground">
            Describe your dream drone
          </label>
          <textarea
            id="ai-idea"
            value={idea}
            onChange={(event) => setIdea(event.target.value)}
            rows={3}
            className="mt-2 w-full resize-none rounded-2xl border border-input bg-background p-4 text-sm text-foreground outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-ring"
            placeholder="For example: a small drone for filming my mountain bike runs"
          />
          <div className="mt-4 flex flex-wrap gap-2">
            {IDEAS.map((sampleIdea) => (
              <button
                key={sampleIdea}
                type="button"
                onClick={() => setIdea(sampleIdea)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all active:scale-95 ${
                  idea === sampleIdea
                    ? "border-primary bg-secondary text-secondary-foreground"
                    : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                {sampleIdea}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={generate}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98] sm:w-auto"
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            Generate my build
          </button>
        </section>

        <section aria-live="polite">
          {suggestion ? (
            <article className="h-full rounded-3xl border border-primary/30 bg-brand-soft p-6 shadow-sm sm:p-7">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                AI suggestion
              </p>
              <h2 className="mt-2 font-display text-xl font-semibold text-foreground">
                {suggestion.name}
              </h2>
              <ul className="mt-4 space-y-2.5">
                {suggestion.parts.map((part) => (
                  <li key={part} className="flex items-start gap-2.5 text-sm text-foreground">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                    {part}
                  </li>
                ))}
              </ul>
              <p className="mt-5 rounded-2xl bg-card p-4 text-sm leading-relaxed text-muted-foreground">
                {suggestion.why}
              </p>
            </article>
          ) : (
            <div className="flex h-full min-h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-border p-8 text-center">
              <Sparkles className="h-8 w-8 text-primary" aria-hidden />
              <p className="mt-4 max-w-xs text-sm text-muted-foreground">
                Tap a sample idea above (or type your own), then hit{" "}
                <span className="font-semibold text-foreground">Generate my build</span> to see a
                suggested parts list.
              </p>
            </div>
          )}
          <p className="mt-4 text-xs text-muted-foreground">
            Sample preview — this demo answers from a fixed list. Real AI builds arrive in a later
            step.
          </p>
        </section>
      </div>
    </PageShell>
  );
}
