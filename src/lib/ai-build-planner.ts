import {
  type BuildSelection,
  type Category,
  type Product,
  type Priority,
  type FlightStyle,
} from "./build-data";
import { evaluate, type CompatibilityRuleCode, type SelectedProducts } from "./build-calculations";
import { resolveCompatibilityEvidence, type CatalogueEvidenceSnapshot } from "./catalogue-evidence";
import {
  fulfillmentProductForCategory,
  requiredCategoriesForSelection,
  selectionPriceSummary,
} from "./configurator-selection";
import { coreRequiredCategoryIds, categoryMetadata } from "./component-categories";
import { installedComponentWeight, productPurchaseQuantity } from "./component-measurements";
import {
  estimateBuildPerformance,
  type BuildPerformanceEstimate,
} from "./build-performance-estimates";
import { compatibilityCoverageGaps } from "./compatibility-coverage";
import {
  validateBuildCompatibility,
  type CompatibilityValidation,
} from "./compatibility-validation";
import { productOptionFacts } from "./product-option-facts";

export type AiBuildAnswers = {
  budget: number;
  priorities: Priority[];
  color?: string;
  wishes?: string;
  style?: FlightStyle;
};
export type AiBuildPlan = {
  name: string;
  selection: BuildSelection;
  price: number;
  budget: number;
  complete: boolean;
  verified: boolean;
  validation: CompatibilityValidation;
  notes: string[];
  reasons: { id: string; name: string; text: string }[];
  examined: number;
  candidateCount: number;
  method: string;
  performance: BuildPerformanceEstimate;
};
type Requirements = {
  cells?: number;
  size?: number;
  maxSize?: number;
  maxWeight?: number;
  strictWeight?: boolean;
  protocol?: string;
  video?: string;
  exclude: string[];
  blockedProtocols: string[];
  blockedVideo: string[];
  gps: boolean;
  conflicts: string[];
  parsed: string[];
  unverified: string[];
};
const positive = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n > 0;
const cost = (p: Product) => Math.round(p.price * productPurchaseQuantity(p) * 100);
const colorWords: Record<string, string[]> = {
  "Sky Blue": ["blue", "blau"],
  "Midnight Black": ["black", "schwarz"],
  "Arctic White": ["white", "weiß", "weiss"],
  "Racing Red": ["red", "rot"],
  "Sunset Orange": ["orange"],
  "Forest Green": ["green", "grün", "gruen"],
};
const word = (s: string, w: string) =>
  new RegExp(`(?:^|[^\\p{L}\\p{N}])${w}(?:$|[^\\p{L}\\p{N}])`, "iu").test(s);
export function parseAiRequirements(wishes = ""): Requirements {
  const s = wishes.toLowerCase().replace(/,/g, "."),
    r: Requirements = {
      exclude: [],
      blockedProtocols: [],
      blockedVideo: [],
      gps: false,
      conflicts: [],
      parsed: [],
      unverified: [],
    };
  const cells = [...new Set([...s.matchAll(/\b([1-9]|1[02])\s*s\b/g)].map((m) => Number(m[1])))];
  if (cells.length > 1) r.conflicts.push("Conflicting battery cell counts: choose one cell count.");
  else if (cells[0]) {
    r.cells = cells[0];
    r.parsed.push(`${r.cells}S electrical system`);
  }
  const size = s.match(/(\d+(?:\.\d+)?)\s*(?:inch(?:es)?|zoll|["″])/);
  if (size) {
    r.size = Number(size[1]);
    r.parsed.push(`${r.size}-inch frame/propeller class`);
  }
  if (/\b(?:backpack|school bag|schultasche|rucksack|compact|kompakt)\b/.test(s)) {
    r.maxSize = 4;
    r.parsed.push("Compact frame preference: at most 4 inches");
  }
  const mass = s.match(
    /(?:under|below|max(?:imum)?\.?|unter|höchstens|bis(?: zu)?|<=|≤)\s*(\d+(?:\.\d+)?)\s*(kg|g|grams?|gramm)\b/,
  );
  if (mass) {
    r.strictWeight = /^(?:under|below|unter)/.test(mass[0]);
    r.maxWeight = Number(mass[1]) * (mass[2] === "kg" ? 1000 : 1);
    r.parsed.push(
      `Documented installed component mass ${r.strictWeight ? "<" : "≤"} ${r.maxWeight} g`,
    );
    r.unverified.push(
      "A component-mass limit does not certify take-off mass: wiring, hardware and payload still need weighing.",
    );
  }
  for (const m of s.matchAll(
    /(?:\bno|\bwithout|\bkein\w*|\bohne)\s+(elrs|expresslrs|crossfire|analog|analogue|digital)\b/g,
  )) {
    const term = m[1]!;
    if (["elrs", "expresslrs", "crossfire"].includes(term))
      r.blockedProtocols.push(term === "expresslrs" ? "elrs" : term);
    else r.blockedVideo.push(term === "analogue" ? "analog" : term);
  }
  const positiveText = s.replace(
    /(?:\bno|\bwithout|\bkein\w*|\bohne)\s+(?:elrs|expresslrs|crossfire|analog|analogue|digital|dji)\b/g,
    "",
  );
  const elrs = /\b(?:elrs|expresslrs)\b/.test(positiveText),
    crossfire = /\bcrossfire\b/.test(positiveText);
  if (elrs && crossfire)
    r.conflicts.push("ELRS and Crossfire were both requested; select one receiver system.");
  else if (elrs || crossfire) {
    r.protocol = elrs ? "elrs" : "crossfire";
    r.parsed.push(`${elrs ? "ExpressLRS" : "Crossfire"} receiver`);
  }
  const analog = /\b(?:analog|analogue)\b/.test(positiveText),
    digital = /\b(?:digital|hdzero|walksnail|dji)\b/.test(positiveText);
  if (analog && digital) r.conflicts.push("Both analog and digital video were requested.");
  else if (analog || digital) {
    r.video = analog ? "analog" : "digital";
    r.parsed.push(`${r.video} video interfaces`);
  }
  for (const m of s.matchAll(
    /(?:\bno|\bwithout|\bkein\w*|\bohne)\s+(dji|hglrc|betafpv|radiomaster|iflight|tattu|cnhl)\b/g,
  ))
    r.exclude.push(m[1]!);
  if (r.exclude.length) r.parsed.push(`Exclude ${r.exclude.join(", ")}`);
  r.gps = /\bgps\b/.test(s) && !/(?:no|without|kein\w*|ohne)\s+gps/.test(s);
  if (r.gps) r.parsed.push("GPS module");
  if (r.size && r.maxSize && r.size > r.maxSize)
    r.conflicts.push("The requested frame size conflicts with the compact-size requirement.");
  if (wishes.trim())
    r.unverified.push(
      `Free-text review: “${wishes.trim()}”. Applied recognized constraints: ${r.parsed.join("; ") || "none"}. Other wishes are not automatically certified.`,
    );
  return r;
}
function fulfilled(selected: SelectedProducts, c: Category) {
  return Boolean(
    selected[c] ||
    (categoryMetadata[c].canBeFulfilledByIntegration && fulfillmentProductForCategory(selected, c)),
  );
}
function allowed(p: Product, r: Requirements) {
  if (
    !positive(p.price) ||
    !Number.isFinite(p.weight) ||
    p.weight < 0 ||
    !p.offer ||
    p.offer.currency !== "EUR" ||
    p.offer.region !== "EU"
  )
    return false;
  if (
    r.exclude.length &&
    (!p.manufacturer || r.exclude.some((b) => word(p.manufacturer!.toLowerCase(), b)))
  )
    return false;
  if (["motors", "propellers"].includes(p.category) && !positive(p.packageQuantity)) return false;
  if (p.category === "propellers" && r.size !== undefined && p.propInches !== r.size) return false;
  if (p.category === "receiver" && r.blockedProtocols.length) {
    const protocol = (p.receiverProtocol ?? "").toLowerCase().replace("expresslrs", "elrs");
    if (!protocol || r.blockedProtocols.some((b) => protocol.includes(b))) return false;
  }
  if (["camera", "videoTransmitter"].includes(p.category) && r.blockedVideo.length) {
    const video = (
      p.cameraVideoInterface ??
      p.videoTransmitterSystem ??
      p.video ??
      ""
    ).toLowerCase();
    if (!video || r.blockedVideo.some((v) => video.includes(v))) return false;
  }
  if (r.maxWeight !== undefined && installedComponentWeight(p) === null) return false;
  if (
    p.category === "frame" &&
    ((r.size !== undefined && p.frameInches !== r.size) ||
      (r.maxSize !== undefined && (!positive(p.frameInches) || p.frameInches > r.maxSize)))
  )
    return false;
  if (p.category === "receiver" && r.protocol) {
    const protocol = (p.receiverProtocol ?? "").toLowerCase();
    if (r.protocol === "elrs" ? !/elrs|expresslrs/.test(protocol) : !protocol.includes("crossfire"))
      return false;
  }
  if (r.cells !== undefined) {
    if (p.category === "battery" && p.voltage !== r.cells) return false;
    if (
      ["motors", "esc", "flightController"].includes(p.category) &&
      (!positive(p.minVoltage) ||
        !positive(p.maxVoltage) ||
        r.cells < p.minVoltage ||
        r.cells > p.maxVoltage)
    )
      return false;
  }
  if (p.category === "camera" && r.video) {
    const v = p.cameraVideoInterface?.toLowerCase() ?? p.video?.toLowerCase() ?? "";
    if (r.video === "analog" ? !v.includes("analog") : !v || v.includes("analog")) return false;
  }
  if (
    p.category === "videoTransmitter" &&
    r.video &&
    p.videoTransmitterSystem?.toLowerCase() !== r.video
  )
    return false;
  return true;
}
const near = (value: number | undefined, target: number, scale: number) =>
  value === undefined ? 0 : Math.max(0, 1 - Math.abs(value - target) / scale);

/** Bounded, deterministic search over real published variants; no generated specifications. */
export function planAiBuild(
  answers: AiBuildAnswers,
  products: readonly Product[],
  evidence: CatalogueEvidenceSnapshot,
  beamWidth = 192,
  onProgress?: (phase: "optimizing" | "estimating") => void,
  estimationProducts: readonly Product[] = products,
): AiBuildPlan {
  const budget = Math.round(
      Math.max(0, Number.isFinite(answers.budget) ? answers.budget : 0) * 100,
    ),
    r = parseAiRequirements(answers.wishes),
    priorities = new Set(answers.priorities);
  if (answers.style === "Cinematic") priorities.add("footage");
  if (answers.style === "Long Range") priorities.add("range");
  if (answers.style === "FPV" || answers.style === "Racing") priorities.add("parkour");
  const targets: Record<Priority, number> = { range: 7, beginner: 2.5, footage: 3.5, parkour: 5 };
  const notes = [...r.unverified],
    profileTarget = priorities.size
      ? [...priorities].reduce((sum, p) => sum + targets[p], 0) / priorities.size
      : 5;
  const target = Math.min(r.maxSize ?? Infinity, r.size ?? profileTarget);
  const unique = [
    ...new Map(products.filter((p) => allowed(p, r)).map((p) => [p.id, p])).values(),
  ].sort((a, b) => a.id.localeCompare(b.id));
  const empty: AiBuildPlan = {
    name: priorities.size
      ? [...priorities]
          .map(
            (p) =>
              ({ range: "Range", beginner: "Beginner", footage: "Filming", parkour: "Freestyle" })[
                p
              ],
          )
          .join(" + ") + " AI Build"
      : "Balanced AI Build",
    selection: {},
    price: 0,
    budget: budget / 100,
    complete: false,
    verified: false,
    validation: validateBuildCompatibility({}, evidence),
    notes: [],
    reasons: [],
    examined: 0,
    candidateCount: unique.length,
    method: `Use-case performance search (${beamWidth} alternatives per stage), budget-diverse candidates and single/paired upgrades including source-verified pair recovery; not a proof of a global optimum.`,
    performance: estimateBuildPerformance({}, products),
  };
  if (r.conflicts.length) return { ...empty, notes: r.conflicts };
  const fields = new Map<string, typeof evidence.fields>();
  for (const f of evidence.fields) {
    const rows = fields.get(f.productId) ?? [];
    rows.push(f);
    fields.set(f.productId, rows);
  }
  const productEvidence = new Map(
    unique.map((p) => [
      p.id,
      resolveCompatibilityEvidence(
        { [p.category]: p },
        { ...evidence, fields: fields.get(p.id) ?? [] },
      ),
    ]),
  );
  const verifiedFields = new Map(
    unique.map((p) => [p.id, productEvidence.get(p.id)!.verification[p.category] ?? []]),
  );
  function assessment(selected: SelectedProducts) {
    const resolved = resolveCompatibilityEvidence(selected, { ...evidence, fields: [] });
    resolved.verification = Object.fromEntries(
      Object.values(selected)
        .filter(Boolean)
        .map((p) => [p!.category, verifiedFields.get(p!.id) ?? []]),
    );
    const evidenceIssues = [
      ...resolved.issues,
      ...Object.values(selected).flatMap((p) => productEvidence.get(p!.id)?.issues ?? []),
    ];
    return {
      ...evaluate(selected, resolved.verification, resolved.technicalEvidence),
      evidenceIssues,
    };
  }
  // Use the same rejection policy during search and every upgrade path.
  const blocked = (result: ReturnType<typeof assessment>) =>
    result.evidenceIssues.some((issue) => issue.kind === "conflict") ||
    result.rules.some(
      (rule) => rule.applicable && (rule.status === "fail" || rule.advisoryOutcome === "fail"),
    );
  // Hard requirements require matching field evidence, not just a plausible value.
  for (let i = unique.length - 1; i >= 0; i--) {
    const p = unique[i]!,
      keys: (keyof Product)[] = [];
    if (r.cells !== undefined) {
      if (p.category === "battery") keys.push("voltage");
      if (["motors", "esc", "flightController"].includes(p.category))
        keys.push("minVoltage", "maxVoltage");
    }
    if ((r.size !== undefined || r.maxSize !== undefined) && p.category === "frame")
      keys.push("frameInches");
    if (r.size !== undefined && p.category === "propellers") keys.push("propInches");
    if ((r.protocol || r.blockedProtocols.length) && p.category === "receiver")
      keys.push("receiverProtocol");
    if ((r.video || r.blockedVideo.length) && p.category === "camera")
      keys.push(p.cameraVideoInterface ? "cameraVideoInterface" : "video");
    if ((r.video || r.blockedVideo.length) && p.category === "videoTransmitter")
      keys.push("videoTransmitterSystem");
    if (r.maxWeight !== undefined)
      keys.push("weight", "weightBasis", "weightScope", "weightUnitQuantity");
    if (
      productEvidence.get(p.id)?.issues.some((issue) => issue.kind === "conflict") ||
      keys.some((key) => !verifiedFields.get(p.id)?.includes(key))
    )
      unique.splice(i, 1);
  }
  const pool = (c: Category) => unique.filter((p) => p.category === c);
  function utility(p: Product): number {
    const verified = new Set(verifiedFields.get(p.id)),
      known = (k: keyof Product) => (verified.has(k) ? p[k] : undefined);
    let value = 0.15 * Math.min(1, verified.size / 8);
    if (p.category === "frame")
      value +=
        2 * near(known("frameInches") as number | undefined, r.size ?? target, Math.max(3, target));
    if (p.category === "propellers")
      value += near(
        known("propInches") as number | undefined,
        r.size ?? target,
        Math.max(3, target),
      );
    if (p.category === "motors") {
      const size = target <= 2.5 ? 802 : target <= 4 ? 1404 : target <= 5.5 ? 2207 : 2807;
      value += near(known("motorSize") as number | undefined, size, Math.max(800, size / 2));
      const kv = target >= 6 ? 1300 : target <= 3 ? 8000 : priorities.has("parkour") ? 1950 : 1700;
      value += 0.3 * near(known("motorKv") as number | undefined, kv, kv);
    }
    if (p.category === "battery") {
      const targetMah = priorities.has("range") ? 2200 : target <= 3 ? 650 : 1300;
      value += near(known("batteryMah") as number | undefined, targetMah, targetMah);
    }
    if (priorities.has("beginner") || priorities.has("parkour")) {
      const mass = installedComponentWeight(p);
      if (mass !== null) value += 0.15 / (1 + mass / 100);
    }
    if (
      answers.color &&
      ["frame", "propellers"].includes(p.category) &&
      (colorWords[answers.color] ?? []).some((w) =>
        word([p.name, p.variant].join(" ").toLowerCase(), w),
      )
    )
      value += 0.25;
    return value;
  }
  // Whole-build performance matters, not the price tag of an isolated part.
  // These engineering estimates remain separate from source/compatibility evidence.
  function performanceUtility(selected: SelectedProducts): number {
    const p = estimateBuildPerformance(selected, estimationProducts);
    if (!p.takeoffGrams) return 0;
    const endurance = Math.log1p(Math.max(0, p.hoverMinutes ?? 0) / 5);
    const speed = Math.log1p(Math.max(0, p.speedKmh?.value ?? 0) / 60);
    const agility = Math.log1p(Math.max(0, (p.thrustToWeight ?? 1) - 1));
    const margin = Math.min(1, (p.thrustToWeight ?? 0) / 3);
    const lightness = 1 / (1 + p.takeoffGrams.value / 300);
    const scores: Record<Priority, number> = {
      range: 3 * endurance + 0.4 * margin,
      parkour: 1.4 * speed + 1.5 * agility + 0.4 * lightness,
      footage: 1.4 * endurance + margin + 0.5 * lightness,
      beginner: 2 * lightness + margin + 0.3 * endurance,
    };
    return priorities.size
      ? [...priorities].reduce((sum, p) => sum + scores[p], 0) / priorities.size
      : endurance + speed + 0.5 * agility;
  }
  const categories: Category[] = [...coreRequiredCategoryIds];
  if (priorities.has("range") || r.gps) categories.push("gps");
  // A usable video link needs a transmitter and antenna, unless documented as included/integrated.
  categories.push("videoTransmitter", "antenna");
  const minima = new Map(
    categories.map((c) => [
      c,
      categoryMetadata[c].canBeFulfilledByIntegration &&
      unique.some((p) => p.integratedCategories?.includes(c) || p.includedCategories?.includes(c))
        ? 0
        : Math.min(...pool(c).map(cost)),
    ]),
  );
  type Node = {
    selected: SelectedProducts;
    amount: number;
    score: number;
    coverage: number;
    unresolved: number;
    key: string;
  };
  let examined = 0;
  const rank = (a: Node, b: Node) =>
    b.coverage - a.coverage ||
    a.unresolved - b.unresolved ||
    b.score - a.score ||
    a.amount - b.amount ||
    a.key.localeCompare(b.key);
  function retain(nodes: Node[]): Node[] {
    const sorted = nodes.sort(rank),
      limit = Math.max(1, beamWidth);
    const chosen = sorted.slice(0, Math.ceil(limit / 2)),
      seen = new Set(chosen.map((n) => n.key)),
      buckets = new Set<string>();
    for (const node of sorted) {
      const bucket = `${node.coverage}:${Math.floor((node.amount / Math.max(1, budget)) * 12)}:${node.selected.frame?.id ?? ""}:${node.selected.battery?.id ?? ""}`;
      if (!seen.has(node.key) && !buckets.has(bucket)) {
        chosen.push(node);
        seen.add(node.key);
        buckets.add(bucket);
      }
      if (chosen.length >= limit) break;
    }
    for (const node of sorted) {
      if (chosen.length >= limit) break;
      if (!seen.has(node.key)) {
        chosen.push(node);
        seen.add(node.key);
      }
    }
    return chosen;
  }
  onProgress?.("optimizing");
  function search(order: Category[]): Node {
    let beam: Node[] = [{ selected: {}, amount: 0, score: 0, coverage: 0, unresolved: 0, key: "" }];
    for (let index = 0; index < order.length; index++) {
      const c = order[index]!,
        next: Node[] = [];
      for (const node of beam) {
        if (fulfilled(node.selected, c)) {
          next.push(node);
          continue;
        }
        let added = false;
        for (const p of pool(c)) {
          examined++;
          const amount = node.amount + cost(p);
          if (amount > budget) continue;
          const selected = { ...node.selected, [c]: p },
            result = assessment(selected);
          if (blocked(result)) continue;
          if (r.maxWeight !== undefined) {
            const mass = Object.values(selected).reduce(
              (sum, p) => sum + (installedComponentWeight(p!) ?? Infinity),
              0,
            );
            if (r.strictWeight ? mass >= r.maxWeight : mass > r.maxWeight) continue;
          }
          const remaining = order.slice(index + 1).filter((k) => !fulfilled(selected, k));
          const lowerBound = remaining.reduce((sum, k) => sum + (minima.get(k) ?? Infinity), 0);
          if (Number.isFinite(lowerBound) && amount + lowerBound > budget) continue;
          const verifiedPass = result.rules.filter(
            (rule) =>
              rule.applicable && rule.status === "pass" && rule.evidenceLevel === "verified",
          ).length;
          const unknown =
            result.rules.filter(
              (rule) =>
                rule.applicable && (rule.status === "unknown" || rule.evidenceLevel !== "verified"),
            ).length + compatibilityCoverageGaps(selected).length;
          let score =
            Object.values(selected).reduce((sum, p) => sum + utility(p!), 0) +
            verifiedPass * 0.03 -
            unknown * 0.01;
          const coverage = categories.filter((k) => fulfilled(selected, k)).length;
          if (coverage === categories.length) score += performanceUtility(selected);
          next.push({
            selected,
            amount,
            score,
            coverage,
            unresolved: unknown,
            key: Object.values(selected)
              .map((p) => p!.id)
              .join("|"),
          });
          added = true;
        }
        if (!added) next.push(node);
      }
      beam = retain(next);
    }
    return beam.sort(rank)[0]!;
  }
  // Resolve electrical test conditions before evaluating motor/propeller evidence.
  const electricalOrder: Category[] = [
    "frame",
    "battery",
    "motors",
    "propellers",
    ...categories.filter((c) => !["frame", "battery", "motors", "propellers"].includes(c)),
  ];
  let best = search(electricalOrder);
  // A second order explores consumer/FC dependencies even if the first found a full build.
  const alternate = search([
    ...electricalOrder.filter((c) => c !== "flightController" && c !== "esc"),
    "flightController",
    "esc",
  ]);
  if (rank(alternate, best) < 0) best = alternate;
  function upgraded(
    base: Node,
    replacements: Product[],
    requiredVerifiedRule?: CompatibilityRuleCode,
  ): Node | null {
    const selected = { ...base.selected };
    for (const p of replacements) {
      selected[p.category] = p;
      for (const c of [...(p.integratedCategories ?? []), ...(p.includedCategories ?? [])])
        if (c !== p.category && categoryMetadata[c].canBeFulfilledByIntegration) delete selected[c];
    }
    const amount = Object.values(selected).reduce((sum, p) => sum + cost(p!), 0);
    if (amount > budget) return null;
    const checked = assessment(selected);
    if (blocked(checked)) return null;
    if (
      requiredVerifiedRule &&
      !checked.rules.some(
        (rule) =>
          rule.code === requiredVerifiedRule &&
          rule.applicable &&
          rule.status === "pass" &&
          rule.evidenceLevel === "verified",
      )
    )
      return null;
    if (r.maxWeight !== undefined) {
      const mass = Object.values(selected).reduce(
        (sum, p) => sum + (installedComponentWeight(p!) ?? Infinity),
        0,
      );
      if (r.strictWeight ? mass >= r.maxWeight : mass > r.maxWeight) return null;
    }
    const coverage = categories.filter((c) => fulfilled(selected, c)).length;
    const passes = checked.rules.filter(
      (rule) => rule.applicable && rule.status === "pass" && rule.evidenceLevel === "verified",
    ).length;
    const unknown =
      checked.rules.filter(
        (rule) =>
          rule.applicable && (rule.status === "unknown" || rule.evidenceLevel !== "verified"),
      ).length + compatibilityCoverageGaps(selected).length;
    const score =
      Object.values(selected).reduce((sum, p) => sum + utility(p!), 0) +
      passes * 0.03 -
      unknown * 0.01 +
      (coverage === categories.length ? performanceUtility(selected) : 0);
    return {
      selected,
      amount,
      score,
      coverage,
      unresolved: unknown,
      key: Object.values(selected)
        .map((p) => p!.id)
        .sort()
        .join("|"),
    };
  }
  // Evidence records are exploration hints only. The resolver must verify the
  // proposed exact pair in its actual battery/propeller context before ranking.
  // Index only eligible products; never reintroduce an excluded/conflicted variant.
  const eligible = new Map(unique.map((p) => [p.id, p]));
  const pairedCandidates = new Map<string, { parts: Product[]; rule: CompatibilityRuleCode }>();
  function rememberPair(
    leftId: string,
    rightId: string,
    leftCategory: Category,
    rightCategory: Category,
    rule: CompatibilityRuleCode,
  ) {
    const left = eligible.get(leftId),
      right = eligible.get(rightId);
    // Preserve the search invariant: an integrated/included role must not be
    // duplicated by adding a separate component to obtain a better proof count.
    const covers = (provider: Product, role: Category) =>
      categoryMetadata[role].canBeFulfilledByIntegration &&
      [...(provider.integratedCategories ?? []), ...(provider.includedCategories ?? [])].includes(
        role,
      );
    if (
      left?.category === leftCategory &&
      right?.category === rightCategory &&
      !covers(left, rightCategory) &&
      !covers(right, leftCategory)
    )
      pairedCandidates.set(JSON.stringify([rule, leftId, rightId]), { parts: [left, right], rule });
  }
  for (const row of evidence.fcEscConnection)
    if (row?.verificationStatus === "verified")
      rememberPair(
        row.flightControllerId,
        row.escId,
        "flightController",
        "esc",
        "FC_ESC_CONNECTOR",
      );
  for (const row of evidence.motorPropeller)
    if (row?.verificationStatus === "verified")
      rememberPair(
        row.motorId,
        row.propellerId,
        "motors",
        "propellers",
        "MOTOR_PROPELLER_SIZE_GUIDANCE",
      );
  for (const row of evidence.motorEscCurrent)
    if (row?.verificationStatus === "verified")
      rememberPair(row.motorId, row.escId, "motors", "esc", "MOTOR_ESC_CURRENT");
  const evidencePairs = [...pairedCandidates.values()].sort(
    (a, b) =>
      a.rule.localeCompare(b.rule) ||
      a.parts[0]!.id.localeCompare(b.parts[0]!.id) ||
      a.parts[1]!.id.localeCompare(b.parts[1]!.id),
  );
  // Spending is allowed only when the measured/design objective improves. Coupled
  // upgrades escape local traps such as a motor needing a different cell count.
  for (let pass = 0; pass < 2; pass++) {
    const before = best;
    for (const c of categories)
      for (const p of pool(c)) {
        examined++;
        const candidate = upgraded(best, [p]);
        if (candidate && rank(candidate, best) < 0) best = candidate;
      }
    for (const [left, right] of [
      ["motors", "battery"],
      ["frame", "propellers"],
    ] as [Category, Category][]) {
      const base = best;
      let paired = best;
      for (const a of pool(left))
        for (const b of pool(right)) {
          examined++;
          const candidate = upgraded(base, [a, b]);
          if (candidate && rank(candidate, paired) < 0) paired = candidate;
        }
      best = paired;
    }
    // These coupled changes can recover a supported pair pruned by the beam,
    // even when neither isolated replacement improves compatibility.
    for (const pair of evidencePairs) {
      examined++;
      const candidate = upgraded(best, pair.parts, pair.rule);
      if (candidate && rank(candidate, best) < 0) best = candidate;
    }
    if (best === before) break;
  }
  onProgress?.("estimating");
  const result = assessment(best.selected),
    selection = Object.fromEntries(
      Object.values(best.selected).map((p) => [p!.category, p!.id]),
    ) as BuildSelection;
  const missing = categories.filter((c) => !fulfilled(best.selected, c));
  if (missing.length)
    notes.push(
      `No complete match found in the bounded search under the budget and constraints. Missing: ${missing.join(", ")}.`,
    );
  const unknown = result.rules.filter(
    (rule) => rule.applicable && (rule.status !== "pass" || rule.evidenceLevel !== "verified"),
  );
  if (unknown.length)
    notes.push(
      `Compatibility still needs verification: ${unknown.map((rule) => rule.code).join(", ")}.`,
    );
  const coverageGaps = compatibilityCoverageGaps(best.selected);
  if (coverageGaps.length)
    notes.push(
      `Additional integration checks need verification: ${coverageGaps.map((g) => g.code).join(", ")}.`,
    );
  if (Object.values(best.selected).some((p) => p!.offer?.freshness !== "current"))
    notes.push(
      "Budget uses last recorded prices; current retailer prices and stock may differ. Out-of-stock products remain eligible.",
    );
  if (answers.color) {
    const visible = Object.values(best.selected).filter(
      (p) => p && ["frame", "propellers"].includes(p.category),
    );
    if (
      !visible.some((p) =>
        (colorWords[answers.color!] ?? []).some((w) =>
          word([p!.name, p!.variant].join(" ").toLowerCase(), w),
        ),
      )
    )
      notes.push(
        `Preferred color ${answers.color} is not documented for the chosen variants; no color match is claimed.`,
      );
    else
      notes.push(
        `Preferred color ${answers.color}: matched explicit variant wording where available; other component colors are not certified.`,
      );
  }
  notes.push(
    "Confirmed conflicts and disputed verified sources are excluded. At equal required-component coverage, fewer unresolved checks take priority over modeled performance and price. Use-case ranking is a design preference, not a measured flight-time, camera-quality or crash-resistance guarantee. Budget covers selected drone components, not pilot gear, tools or unspecified accessories.",
  );
  const reasonFor = (p: Product) => {
    if (p.category === "frame" || p.category === "propellers")
      return `Ranked toward a ${target.toFixed(1)}-inch design class for the chosen use case; explicit size limits take precedence.`;
    if (p.category === "motors")
      return "Ranked by documented motor size/KV and the supported electrical/mechanical checks.";
    if (p.category === "battery")
      return "Ranked by documented capacity and cell-count compatibility within the total budget.";
    if (p.category === "gps")
      return "Included for the range priority or explicit GPS request; reception/rescue performance still needs validation.";
    return "Chosen within the total budget using documented interfaces and whole-build use-case scoring; unknown interfaces remain flagged.";
  };
  const reasons = Object.values(best.selected).map((p) => ({
    id: p!.id,
    name: p!.name,
    text: `${productOptionFacts(p!)
      .map((f) => `${f.label}: ${f.value}`)
      .join(
        "; ",
      )}. ${productPurchaseQuantity(p!)} sales pack(s), ${(cost(p!) / 100).toFixed(2)} EUR. ${reasonFor(p!)}`,
  }));
  const validation = validateBuildCompatibility(best.selected, evidence, categories);
  return {
    ...empty,
    validation,
    selection,
    price: Math.round(selectionPriceSummary(best.selected).drone * 100) / 100,
    complete:
      missing.length === 0 &&
      requiredCategoriesForSelection(best.selected).every((c) => Boolean(best.selected[c])),
    verified: missing.length === 0 && validation.status === "verified-compatible",
    notes,
    reasons,
    examined,
    candidateCount: unique.length,
    performance: estimateBuildPerformance(best.selected, estimationProducts),
  };
}
