import { createServerFn } from "@tanstack/react-start";
import type { ServerCatalogueSnapshot } from "./catalogue-database.server";

const PUBLIC_CATALOGUE_ENDPOINT =
  "https://rtwreynffguvqdcogahx.supabase.co/functions/v1/catalogue-runtime";

async function loadPublicCatalogueSnapshot(): Promise<ServerCatalogueSnapshot> {
  const response = await fetch(PUBLIC_CATALOGUE_ENDPOINT, {
    headers: { accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(
      `Public catalogue endpoint failed (${response.status}): ${(await response.text()).slice(0, 300)}`,
    );
  }

  return (await response.json()) as ServerCatalogueSnapshot;
}

export const getConfiguratorCatalogue = createServerFn({ method: "GET" }).handler(
  async () => {
    try {
      return await loadPublicCatalogueSnapshot();
    } catch (publicError) {
      const { loadServerCatalogueSnapshot } = await import("./catalogue-database.server");
      const fallback = await loadServerCatalogueSnapshot();

      if (fallback.status === "ready") return fallback;

      return {
        ...fallback,
        error:
          publicError instanceof Error
            ? publicError.message
            : fallback.error ?? "Verified catalogue could not be loaded.",
      };
    }
  },
);
