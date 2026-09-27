import "@tanstack/react-start/server-only";

export type SupabaseRestConfig = {
  url: string;
  secretKey: string;
};

export class SupabaseCatalogueConfigurationError extends Error {}

export function getSupabaseRestConfig(): SupabaseRestConfig | null {
  const url = process.env["SUPABASE_URL"]?.trim();
  const secretKey = process.env["SUPABASE_SECRET_KEY"]?.trim();

  if (!url && !secretKey) return null;
  if (!url || !secretKey) {
    throw new SupabaseCatalogueConfigurationError(
      "Supabase catalogue configuration is incomplete. Set both SUPABASE_URL and SUPABASE_SECRET_KEY on the server.",
    );
  }

  return {
    url: url.replace(/\/$/, ""),
    secretKey,
  };
}

export function isDatabaseCatalogueEnabled() {
  return process.env["CATALOGUE_DATABASE_ENABLED"] === "true";
}

export async function supabaseRestRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const config = getSupabaseRestConfig();
  if (!config) {
    throw new SupabaseCatalogueConfigurationError(
      "Supabase catalogue is not configured.",
    );
  }

  const headers = new Headers(init.headers);
  headers.set("apikey", config.secretKey);
  headers.set("accept", "application/json");
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(
    `${config.url}/rest/v1/${path.replace(/^\//, "")}`,
    {
      ...init,
      headers,
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Supabase catalogue request failed (${response.status}): ${body.slice(0, 500)}`,
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
