type Environment = Record<string, string | undefined>;
export const publicCatalogueRuntime = "https://rtwreynffguvqdcogahx.supabase.co/functions/v1/catalogue-runtime";

export function assertCatalogueEndpoint(url: string, env: Environment): void {
  const localOnly = env["CATALOGUE_LOCAL_ONLY"] === "true" || env["NODE_ENV"] === "test";
  if (!localOnly) return;
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol) ||
      !["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname) ||
      parsed.username || parsed.password) {
    throw new Error("Local catalogue tests require a loopback endpoint; remote access is disabled.");
  }
}

export function catalogueRuntimeEndpoint(env: Environment): string {
  const localOnly = env["CATALOGUE_LOCAL_ONLY"] === "true" || env["NODE_ENV"] === "test";
  const base = env["SUPABASE_URL"]?.trim() || env["VITE_SUPABASE_URL"]?.trim();
  // Authentication may use a different project. The product catalogue has its
  // own established public endpoint; only dedicated catalogue settings override it.
  const endpoint = env["CATALOGUE_RUNTIME_URL"]?.trim() || env["VITE_CATALOGUE_RUNTIME_URL"]?.trim() ||
    (localOnly ? (base ? `${base.replace(/\/$/, "")}/functions/v1/catalogue-runtime` : null) : publicCatalogueRuntime);
  if (!endpoint) throw new Error("Set CATALOGUE_RUNTIME_URL for local catalogue access.");
  assertCatalogueEndpoint(endpoint, env);
  return endpoint;
}
