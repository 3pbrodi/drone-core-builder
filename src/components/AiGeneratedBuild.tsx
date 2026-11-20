import { useEffect, useState } from "react";
import { BuildInterface } from "./BuildInterface";
import { Button } from "./ui/button";
import { loadAiBuildCatalogue } from "@/lib/ai-build-catalogue";
import { planAiBuild, type AiBuildAnswers, type AiBuildPlan } from "@/lib/ai-build-planner";
import { browserCatalogueEndpoint, fetchPublicCatalogueQuery } from "@/lib/catalogue-public-query";
import { money } from "@/lib/build-data";

type Match = {
  catalogue: NonNullable<Awaited<ReturnType<typeof loadAiBuildCatalogue>>>;
  plan: AiBuildPlan;
};
export function AiGeneratedBuild({ answers }: { answers: AiBuildAnswers }) {
  const [match, setMatch] = useState<Match | null>(null),
    [error, setError] = useState(false),
    [retry, setRetry] = useState(0);
  const identity = JSON.stringify(answers);
  useEffect(() => {
    let active = true;
    setMatch(null);
    setError(false);
    const read = (q: Parameters<typeof fetchPublicCatalogueQuery>[0]) =>
      fetchPublicCatalogueQuery(q, browserCatalogueEndpoint());
    void loadAiBuildCatalogue(read, () => active)
      .then(async (catalogue) => {
        if (!active || !catalogue) return;
        await new Promise((resolve) => setTimeout(resolve, 0));
        if (!active) return;
        const first = planAiBuild(answers, catalogue.products, catalogue.evidence),
          ids = Object.values(first.selection);
        if (ids.length) {
          const fresh = await read({
            mode: "ids",
            ids,
            withEvidence: true,
            withManufacturers: false,
          });
          if (!active) return;
          // Re-evaluate the exact returned variants and prices before inserting any selection.
          const evidence = fresh.evidence; // Removed or revoked proofs must not survive the fresh read.
          const plan = {
            ...planAiBuild(answers, fresh.products, evidence),
            examined: first.examined,
            candidateCount: first.candidateCount,
            method: first.method,
          };
          const missing = ids.some((id) => !fresh.products.some((p) => p.id === id));
          if (missing)
            plan.notes.unshift(
              "Some candidates were withdrawn during matching; the remaining selection needs review.",
            );
          setMatch({ catalogue: { products: fresh.products, evidence }, plan });
        } else setMatch({ catalogue, plan: first });
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [identity, retry]);
  if (error)
    return (
      <main className="mx-auto max-w-xl space-y-3 p-6">
        <h1 className="text-xl font-bold">AI Build</h1>
        <p role="alert">
          The verified catalogue could not be loaded. No demo build was substituted.
        </p>
        <Button onClick={() => setRetry((n) => n + 1)}>Retry matching</Button>
      </main>
    );
  if (!match)
    return (
      <main className="mx-auto max-w-xl p-6">
        <h1 className="text-xl font-bold">Matching your build</h1>
        <p role="status" className="mt-2">
          Comparing verified products, budget and compatibility…
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
          className="mb-4 space-y-2 rounded-xl border border-border bg-card p-4 text-sm"
        >
          <h2 className="font-semibold">
            {match.plan.complete
              ? "Initial AI catalogue recommendation"
              : "Some requirements could not be matched"}
          </h2>
          <p>
            Initial drone parts: <strong>{money(match.plan.price)}</strong> /{" "}
            {money(answers.budget)} budget · {answers.priorities.join(" + ") || "Balanced use"}
          </p>
          <p className="text-xs text-muted-foreground">
            Manual changes are checked in the configurator; this summary describes the initial
            recommendation.
          </p>
          <p>
            Hardware checks:{" "}
            {match.plan.verified ? "verified against current rules" : "further verification needed"}
            .
          </p>
          {answers.color && <p>Preferred color: {answers.color}</p>}
          {answers.wishes && <p className="break-words">Your wishes: {answers.wishes}</p>}
          <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
            {match.plan.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
          <details>
            <summary className="cursor-pointer font-medium">Why these components?</summary>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-xs">
              {match.plan.reasons.map((reason) => (
                <li key={reason.id}>
                  <strong>{reason.name}</strong> — {reason.text}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">{match.plan.method}</p>
          </details>
        </section>
      }
    />
  );
}
