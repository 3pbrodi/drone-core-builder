type Environment = Record<string, string | undefined>;
const productionRuntime = "https://rtwreynffguvqdcogahx.supabase.co/functions/v1/catalogue-runtime";

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
  const base = env["SUPABASE_URL"]?.trim();
  const localOnly = env["CATALOGUE_LOCAL_ONLY"] === "true" || env["NODE_ENV"] === "test";
  const endpoint = env["CATALOGUE_RUNTIME_URL"]?.trim() ||
    (base ? `${base.replace(/\/$/, "")}/functions/v1/catalogue-runtime` :
      env["NODE_ENV"] === "production" && !localOnly ? productionRuntime : null);
  if (!endpoint) throw new Error("Set CATALOGUE_RUNTIME_URL for local catalogue access.");
  assertCatalogueEndpoint(endpoint, env);
  return endpoint;
}
