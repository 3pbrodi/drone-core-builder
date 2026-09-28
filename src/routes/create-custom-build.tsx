import { createFileRoute } from "@tanstack/react-router";
import { BuildInterface } from "@/components/BuildInterface";
import { aiPreset, presets, type BuildSelection, type Priority } from "@/lib/build-data";
import {
  createProductCatalogue,
  rebaseBuildSelectionToCatalogue,
} from "@/lib/catalogue-service";
import { getConfiguratorCatalogue } from "@/lib/configurator-catalogue.server-fn";

type BuildSearch = {
  source?: "ai" | "template";
  template?: keyof typeof presets;
  budget?: number;
  style?: "FPV" | "Cinematic" | "Racing" | "Long Range";
  priorities?: string;
};

const presetKeys = new Set(Object.keys(presets));
const styleNames = new Set(["FPV", "Cinematic", "Racing", "Long Range"]);
const priorityNames = new Set<Priority>(["footage", "parkour", "range", "beginner"]);

export const Route = createFileRoute("/create-custom-build")({
  validateSearch: (search: Record<string, unknown>): BuildSearch => {
    const source =
      search["source"] === "ai" || search["source"] === "template" ? search["source"] : undefined;
    const template =
      typeof search["template"] === "string" && presetKeys.has(search["template"])
        ? (search["template"] as keyof typeof presets)
        : undefined;
    const numericBudget = Number(search["budget"]);
    const budget = Number.isFinite(numericBudget)
      ? Math.max(300, Math.min(3000, numericBudget))
      : undefined;
    const style =
      typeof search["style"] === "string" && styleNames.has(search["style"])
        ? (search["style"] as BuildSearch["style"])
        : undefined;
    const selectedPriorities =
      typeof search["priorities"] === "string"
        ? search["priorities"]
            .split(",")
            .filter((value): value is Priority => priorityNames.has(value as Priority))
            .slice(0, 2)
        : [];

    return {
      ...(source ? { source } : {}),
      ...(template ? { template } : {}),
      ...(budget !== undefined ? { budget } : {}),
      ...(style ? { style } : {}),
      ...(selectedPriorities.length ? { priorities: selectedPriorities.join(",") } : {}),
    };
  },
  loader: async () => getConfiguratorCatalogue(),
  head: () => ({
    meta: [
      { title: "Custom Build — DroneCores" },
      {
        name: "description",
        content:
          "Configure a drone component by component with compatibility checks and a live 3D preview.",
      },
      { property: "og:title", content: "Custom Build — DroneCores" },
      {
        property: "og:description",
        content:
          "Configure a drone component by component with compatibility checks and a live 3D preview.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CreateCustomBuildPage,
});

function CreateCustomBuildPage() {
  const search = Route.useSearch();
  const catalogueSnapshot = Route.useLoaderData();
  const runtimeCatalogue = createProductCatalogue(catalogueSnapshot.products);

  let source: "Custom" | "AI Build" | "Template" = "Custom";
  let name = "Custom Build";
  let initial: BuildSelection = {};

  if (search["source"] === "template" && search["template"]) {
    const preset = presets[search["template"]];
    if (preset) {
      source = "Template";
      name = preset.name;
      initial = rebaseBuildSelectionToCatalogue(preset.selection, runtimeCatalogue);
    }
  } else if (search["source"] === "ai") {
    const selectedPriorities = (search["priorities"] ?? "")
      .split(",")
      .filter(Boolean) as Priority[];
    const generated = aiPreset(
      selectedPriorities,
      search["budget"] ?? 1000,
      search["style"] ?? null,
    );
    source = "AI Build";
    name = generated.name;
    initial = rebaseBuildSelectionToCatalogue(generated.selection, runtimeCatalogue);
  }

  const identity =
    source +
    ":" +
    name +
    ":" +
    catalogueSnapshot.products.map((product) => product.id).join(",") +
    ":" +
    Object.values(initial).join("|");

  return (
    <BuildInterface
      key={identity}
      source={source}
      name={name}
      initial={initial}
      products={catalogueSnapshot.products}
      evidenceSnapshot={catalogueSnapshot.evidence}
      catalogueReady={catalogueSnapshot.status === "ready"}
      catalogueMessage={catalogueSnapshot.error}
    />
  );
}
