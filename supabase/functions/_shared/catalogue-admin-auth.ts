/**
 * Hosted catalogue workers must use Supabase's modern secret API key.
 * The legacy service-role JWT can fail with PGRST303 ("JWT issued at future")
 * and must not silently be selected in production.
 *
 * The local Supabase stack may still expose only its disposable service-role JWT.
 * Never expose the returned key to browser code or logs.
 */
export function catalogueAdminKey(
  getEnv: (name: string) => string | undefined,
): string {
  const rawKeys = getEnv("SUPABASE_SECRET_KEYS");
  if (rawKeys) {
    let keys: unknown;
    try {
      keys = JSON.parse(rawKeys);
    } catch {
      throw new Error("SUPABASE_SECRET_KEYS must be a JSON object.");
    }
    const key = (keys && typeof keys === "object" && !Array.isArray(keys))
      ? (keys as Record<string, unknown>).default
      : null;
    if (typeof key === "string" && key.startsWith("sb_secret_")) return key;
    throw new Error(
      "SUPABASE_SECRET_KEYS.default must be a modern sb_secret_ API key.",
    );
  }

  // Preserve disposable local integration tests without depending on hosted JWTs.
  const url = getEnv("SUPABASE_URL");
  let hostname = "";
  try {
    hostname = url ? new URL(url).hostname.toLowerCase() : "";
  } catch {
    // Fail closed for an invalid production URL.
  }
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "kong") {
    const localKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    if (localKey) return localKey;
  }

  throw new Error(
    "Hosted catalogue workers require a Supabase secret API key named default. " +
    "Create it under Project Settings > API Keys and confirm " +
    "SUPABASE_SECRET_KEYS is available to Edge Functions. " +
    "The legacy service-role JWT is not used in hosted catalogue workers.",
  );
}

/** Public catalogue runtime requests should also avoid legacy JWT clock errors. */
export function cataloguePublicKey(
  getEnv: (name: string) => string | undefined,
): string {
  const rawKeys = getEnv("SUPABASE_PUBLISHABLE_KEYS");
  if (rawKeys) {
    let keys: unknown;
    try {
      keys = JSON.parse(rawKeys);
    } catch {
      throw new Error("SUPABASE_PUBLISHABLE_KEYS must be a JSON object.");
    }
    const key = (keys && typeof keys === "object" && !Array.isArray(keys))
      ? (keys as Record<string, unknown>).default
      : null;
    if (typeof key === "string" && key.startsWith("sb_publishable_")) return key;
    throw new Error(
      "SUPABASE_PUBLISHABLE_KEYS.default must be a modern sb_publishable_ API key.",
    );
  }

  const url = getEnv("SUPABASE_URL");
  let hostname = "";
  try {
    hostname = url ? new URL(url).hostname.toLowerCase() : "";
  } catch {
    // Invalid hosted URLs do not qualify for a legacy-key exception.
  }
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "kong") {
    const localKey = getEnv("SUPABASE_ANON_KEY");
    if (localKey) return localKey;
  }
  throw new Error(
    "Hosted catalogue runtime requires a Supabase publishable API key named default.",
  );
}
