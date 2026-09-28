import { createServerFn } from "@tanstack/react-start";

export const getConfiguratorCatalogue = createServerFn({ method: "GET" }).handler(
  async () => {
    const { loadServerCatalogueSnapshot } = await import("./catalogue-database.server");
    return loadServerCatalogueSnapshot();
  },
);
