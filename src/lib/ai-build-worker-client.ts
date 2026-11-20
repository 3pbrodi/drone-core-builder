import type { AiBuildAnswers, AiBuildPlan } from "./ai-build-planner";
import type { Product } from "./build-data";
import type { CatalogueEvidenceSnapshot } from "./catalogue-evidence";
export type MatchingPhase = "products" | "compatibility" | "optimizing" | "estimating" | "loading";
/** Keep CPU-heavy search off the UI thread, so the progress wheel stays responsive. */
export function createAiBuildPlanner(onProgress: (phase: MatchingPhase) => void) {
  const worker = new Worker(new URL("./ai-build.worker.ts", import.meta.url), { type: "module" });
  let sequence = 0;
  const pending = new Map<
    number,
    { resolve: (plan: AiBuildPlan) => void; reject: (error: Error) => void }
  >();
  worker.onmessage = ({ data }) => {
    const task = pending.get(data.id);
    if (!task) return;
    if (data.phase) {
      onProgress(data.phase);
      return;
    }
    pending.delete(data.id);
    if (data.error) task.reject(new Error("Build optimization failed."));
    else task.resolve(data.plan);
  };
  const fail = () => {
    for (const task of pending.values()) task.reject(new Error("Build optimization stopped."));
    pending.clear();
  };
  worker.onerror = fail;
  worker.onmessageerror = fail;
  return {
    plan: (
      answers: AiBuildAnswers,
      products: Product[],
      evidence: CatalogueEvidenceSnapshot,
      estimationProducts = products,
    ) =>
      new Promise<AiBuildPlan>((resolve, reject) => {
        const id = ++sequence;
        pending.set(id, { resolve, reject });
        worker.postMessage({ id, answers, products, evidence, estimationProducts });
      }),
    dispose: () => {
      worker.terminate();
      fail();
    },
  };
}
