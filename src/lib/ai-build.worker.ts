import { planAiBuild } from "./ai-build-planner";
self.onmessage = (event: MessageEvent) => {
  const { id, answers, products, evidence, estimationProducts } = event.data;
  try {
    const plan = planAiBuild(
      answers,
      products,
      evidence,
      192,
      (phase) => self.postMessage({ id, phase }),
      estimationProducts ?? products,
    );
    self.postMessage({ id, plan });
  } catch {
    self.postMessage({ id, error: true });
  }
};
