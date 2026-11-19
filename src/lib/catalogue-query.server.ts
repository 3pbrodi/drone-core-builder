import "@tanstack/react-start/server-only";
import { catalogueRuntimeEndpoint } from "./catalogue-endpoint";
import { getSupabaseRestConfig, supabaseRestRequest } from "./supabase-rest.server";
import { loadCatalogueQuery } from "../../supabase/functions/_shared/catalogue-query-service";
import { normalizeCatalogueQuery, type CatalogueQuery, type CountedReader } from "../../supabase/functions/_shared/catalogue-query";
import type { Category } from "./build-data";

export type CatalogueQueryResult = Awaited<ReturnType<typeof loadCatalogueQuery<Category>>>;

const countedRest: CountedReader = async <T>(path: string) => {
  const config = getSupabaseRestConfig();
  if (!config) throw new Error("Catalogue is not configured.");
  const response = await fetch(`${config.url}/rest/v1/${path}`, { headers: { apikey: config.secretKey, accept: "application/json", Prefer: "count=exact" } });
  if (!response.ok) throw new Error("Catalogue page could not be loaded.");
  return { rows: await response.json() as T[], total: Number(response.headers.get("content-range")?.split("/")[1]) };
};

export async function fetchCatalogueQuery(input: CatalogueQuery): Promise<CatalogueQueryResult> {
  const query = normalizeCatalogueQuery(input);
  if (process.env["CATALOGUE_DATABASE_ENABLED"] === "false") throw new Error("Catalogue is disabled.");
  try {
    // Lovable previews provide the public project URL through Vite, without
    // requiring server database credentials for the public catalogue endpoint.
    const url = new URL(catalogueRuntimeEndpoint({
      ...process.env,
      VITE_SUPABASE_URL: process.env["VITE_SUPABASE_URL"] || import.meta.env?.["VITE_SUPABASE_URL"],
    }));
    url.searchParams.set("query", JSON.stringify(query));
    const response = await fetch(url, { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error("Runtime query failed.");
    const result = await response.json() as CatalogueQueryResult;
    // Old deployed runtimes return an unbounded legacy snapshot; do not accept it.
    if (result.queryVersion !== 1 || result.status !== "ready") throw new Error("Runtime query version unavailable.");
    return result;
  } catch {
    return loadCatalogueQuery<Category>(countedRest, supabaseRestRequest, query);
  }
}
