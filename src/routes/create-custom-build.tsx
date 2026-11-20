import type { ServerCatalogueSnapshot } from "@/lib/catalogue-database.server";
import { createFileRoute } from "@tanstack/react-router";
import { BuildInterface } from "@/components/BuildInterface";
import { presets, type BuildSelection, type Priority } from "@/lib/build-data";
import { createProductCatalogue, rebaseBuildSelectionToCatalogue } from "@/lib/catalogue-service";
import { AiGeneratedBuild } from "@/components/AiGeneratedBuild";
import { getConfiguratorCatalogue } from "@/lib/configurator-catalogue.server-fn";

type BuildSearch = {
  product?: string;
  source?: "ai" | "template";
  template?: keyof typeof presets;
  budget?: number;
  style?: "FPV" | "Cinematic" | "Racing" | "Long Range";
  priorities?: string;
  color?: string;
  wishes?: string;
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
    const color =
      typeof search["color"] === "string" && search["color"].trim()
        ? search["color"].trim().slice(0, 80)
        : undefined;
    const wishes =
      typeof search["wishes"] === "string" && search["wishes"].trim()
        ? search["wishes"].trim().slice(0, 500)
        : undefined;

    return {
      ...(typeof search["product"] === "string" && search["product"].length <= 200 ? { product: search["product"] } : {}),
      ...(source ? { source } : {}),
      ...(template ? { template } : {}),
      ...(budget !== undefined ? { budget } : {}),
      ...(style ? { style } : {}),
      ...(selectedPriorities.length ? { priorities: selectedPriorities.join(",") } : {}),
      ...(color ? { color } : {}),
      ...(wishes ? { wishes } : {}),
    };
  },
  loaderDeps: ({search}) => search,
  loader: async ({deps}) => {
    let selection:BuildSelection={};
    if(deps.source==="template" && deps.template) { const preset=presets[deps.template]; if(preset) selection=preset.selection; }
    return getConfiguratorCatalogue({data:{ids:[...new Set([...Object.values(selection),...(deps.product?[deps.product]:[])])]}});
  },
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
  const catalogueSnapshot = Route.useLoaderData() as ServerCatalogueSnapshot;
  if(search.source==='ai') return <AiGeneratedBuild key={JSON.stringify(search)} answers={{budget:search.budget??1000,priorities:(search.priorities??'').split(',').filter(Boolean) as Priority[],...(search.color?{color:search.color}:{}),...(search.wishes?{wishes:search.wishes}:{}),...(search.style?{style:search.style}:{})}}/>;
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
  }

  const requestedProduct = catalogueSnapshot.products.find(p => p.id === search.product);
  if (requestedProduct) initial[requestedProduct.category] = requestedProduct.id;

  const preferences = undefined;

  const identity =
    source +
    ":" +
    name +
    ":" +
    catalogueSnapshot.products.map((product) => product.id).join(",") +
    ":" +
    Object.values(initial).join("|") +
    ":" +
    JSON.stringify(preferences ?? {});

  return (
    <BuildInterface
      key={identity}
      source={source}
      name={name}
      initial={initial}
      products={catalogueSnapshot.products}
      evidenceSnapshot={catalogueSnapshot.evidence}
      catalogueReady={catalogueSnapshot.status === "ready"}
      {...(preferences ? { preferences } : {})}
      {...(catalogueSnapshot.error ? { catalogueMessage: catalogueSnapshot.error } : {})}
    />
  );
}
