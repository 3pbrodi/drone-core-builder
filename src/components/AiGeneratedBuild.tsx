import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { BuildInterface } from "./BuildInterface";
import { Button } from "./ui/button";
import { loadAiBuildCatalogue } from "@/lib/ai-build-catalogue";
import type { AiBuildAnswers, AiBuildPlan } from "@/lib/ai-build-planner";
import { createAiBuildPlanner, type MatchingPhase } from "@/lib/ai-build-worker-client";
import { browserCatalogueEndpoint, fetchPublicCatalogueQuery } from "@/lib/catalogue-public-query";
import { money, type Product } from "@/lib/build-data";

type Match = {
  catalogue: NonNullable<Awaited<ReturnType<typeof loadAiBuildCatalogue>>>;
  plan: AiBuildPlan;
  estimationProducts: Product[];
};
const phases: Record<MatchingPhase, string> = {
  products: "Loading verified products…",
  compatibility: "Checking compatibility…",
  optimizing: "Optimizing your budget…",
  estimating: "Estimating performance…",
  loading: "Loading build…",
};
export function AiGeneratedBuild({ answers }: { answers: AiBuildAnswers }) {
  const [match, setMatch] = useState<Match | null>(null),
    [error, setError] = useState(false),
    [retry, setRetry] = useState(0),
    [phase, setPhase] = useState<MatchingPhase>("products");
  const identity = JSON.stringify(answers);
  useEffect(() => {
    let active = true;
    setMatch(null);
    setError(false);
    setPhase("products");
    const progress = (phase: MatchingPhase) => {
      if (active) setPhase(phase);
    };
    const read = (q: Parameters<typeof fetchPublicCatalogueQuery>[0]) =>
      fetchPublicCatalogueQuery(q, browserCatalogueEndpoint());
    let planner: ReturnType<typeof createAiBuildPlanner> | undefined;
    void (async () => {
      planner = createAiBuildPlanner(progress);
      const catalogue = await loadAiBuildCatalogue(read, () => active, progress);
      if (!active || !catalogue) return;
      progress("compatibility");
      const first = await planner.plan(answers, catalogue.products, catalogue.evidence),
        ids = Object.values(first.selection);
      if (!active) return;
      if (ids.length) {
        progress("compatibility");
        const fresh = await read({
          mode: "ids",
          ids,
          withEvidence: true,
          withManufacturers: false,
        });
        if (!active) return;
        // Fresh selected proofs replace the old snapshot; estimates use the wider catalogue only as mass references.
        const all = new Map(catalogue.products.map((p) => [p.id, p]));
        for (const id of ids) all.delete(id);
        for (const p of fresh.products) all.set(p.id, p);
        const estimationProducts = [...all.values()];
        const plan = {
          ...(await planner.plan(answers, fresh.products, fresh.evidence, estimationProducts)),
          examined: first.examined,
          candidateCount: first.candidateCount,
          method: first.method,
        };
        if (!active) return;
        if (ids.some((id) => !fresh.products.some((p) => p.id === id)))
          plan.notes.unshift(
            "Some candidates were withdrawn during matching; the remaining selection needs review.",
          );
        progress("loading");
        await new Promise(requestAnimationFrame);
        if (!active) return;
        setMatch({
          catalogue: { products: fresh.products, evidence: fresh.evidence },
          plan,
          estimationProducts,
        });
      } else {
        progress("loading");
        await new Promise(requestAnimationFrame);
        if (active) setMatch({ catalogue, plan: first, estimationProducts: catalogue.products });
      }
    })()
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => planner?.dispose());
    return () => {
      active = false;
      planner?.dispose();
    };
  }, [identity, retry]);
  if (error)
    return (
      <main className="mx-auto max-w-xl space-y-3 p-6">
        <h1 className="text-xl font-bold">AI Build</h1>
        <p role="alert">The build could not be prepared. Please retry.</p>
        <Button onClick={() => setRetry((n) => n + 1)}>Retry matching</Button>
      </main>
    );
  if (!match)
    return (
      <main
        aria-busy="true"
        aria-label="Preparing AI build"
        className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center"
      >
        <LoaderCircle
          data-loading-wheel
          aria-hidden="true"
          className="size-12 animate-spin text-primary motion-reduce:animate-none"
        />
        <h1 className="text-xl font-semibold">Building your drone</h1>
        <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
          {phases[phase]}
        </p>
        <p className="max-w-sm text-xs text-muted-foreground">
          Matching parts to your budget and selected use case
        </p>
      </main>
    );
  return (
    <BuildInterface
      key={identity + retry}
      source="AI Build"
      name={match.plan.name}
      initial={match.plan.selection}
      products={match.catalogue.products}
      estimationProducts={match.estimationProducts}
      evidenceSnapshot={match.catalogue.evidence}
      catalogueReady={true}
      preferences={{
        budget: answers.budget,
        priorities: answers.priorities.join(","),
        color: answers.color ?? "",
        wishes: answers.wishes ?? "",
        style: answers.style ?? "",
      }}
      recommendation={
        <section
          aria-label="AI matching result"
          className="mb-3 rounded-xl border border-border bg-card p-3 text-xs"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">
              {match.plan.complete ? "AI recommendation" : "Build needs attention"}
            </h2>
            <span>
              {money(match.plan.price)} / {money(answers.budget)}
            </span>
          </div>
          <details className="mt-1 text-muted-foreground">
            <summary className="cursor-pointer">
              Build details ·{" "}
              {match.plan.verified ? "catalogue checks passed" : "compatibility needs verification"}
            </summary>
            <div className="mt-3 space-y-2">
              <p>
                Initial recommendation · {answers.priorities.join(" + ") || "Balanced use"} ·{" "}
                {money(Math.max(0, answers.budget - match.plan.price))} budget remaining. Manual
                changes are checked below.
              </p>
              {answers.color && <p>Preferred color: {answers.color}</p>}
              {answers.wishes && <p className="break-words">Your wishes: {answers.wishes}</p>}
              <ul className="list-disc space-y-1 pl-4">
                {match.plan.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
              <h3 className="font-medium text-foreground">Why these components?</h3>
              <ul className="list-disc space-y-1 pl-4">
                {match.plan.reasons.map((reason) => (
                  <li key={reason.id}>
                    <strong>{reason.name}</strong> — {reason.text}
                  </li>
                ))}
              </ul>
              <p>{match.plan.method}</p>
            </div>
          </details>
        </section>
      }
    />
  );
}
