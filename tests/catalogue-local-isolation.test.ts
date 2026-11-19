import { expect, test } from "bun:test";
import { assertCatalogueEndpoint, catalogueRuntimeEndpoint } from "../src/lib/catalogue-endpoint";

test("local and test catalogue runs cannot inherit production endpoints", () => {
  for (const env of [{ NODE_ENV: "test" }, { NODE_ENV: "production", CATALOGUE_LOCAL_ONLY: "true" }]) {
    expect(() => catalogueRuntimeEndpoint(env)).toThrow();
    expect(() => catalogueRuntimeEndpoint({ ...env, SUPABASE_URL: "https://rtwreynffguvqdcogahx.supabase.co" })).toThrow();
    expect(() => catalogueRuntimeEndpoint({ ...env, CATALOGUE_RUNTIME_URL: "https://rtwreynffguvqdcogahx.supabase.co/functions/v1/catalogue-runtime" })).toThrow();
    // Same validator protects REST fallback, including explicitly configured URLs.
    expect(() => assertCatalogueEndpoint("https://rtwreynffguvqdcogahx.supabase.co", env)).toThrow();
  }
});

test("loopback runtime and fallback are usable without remote credentials", () => {
  expect(catalogueRuntimeEndpoint({ NODE_ENV: "test", SUPABASE_URL: "http://127.0.0.1:4189/" }))
    .toBe("http://127.0.0.1:4189/functions/v1/catalogue-runtime");
  expect(() => assertCatalogueEndpoint("http://[::1]:54321", { NODE_ENV: "test" })).not.toThrow();
  expect(() => assertCatalogueEndpoint("http://localhost.example.com", { NODE_ENV: "test" })).toThrow();
});

test("public catalogue is available in previews; explicit local-only mode remains isolated", () => {
  expect(catalogueRuntimeEndpoint({ NODE_ENV: "development" })).toBe("https://rtwreynffguvqdcogahx.supabase.co/functions/v1/catalogue-runtime");
  expect(catalogueRuntimeEndpoint({ NODE_ENV: "production" })).toBe("https://rtwreynffguvqdcogahx.supabase.co/functions/v1/catalogue-runtime");
});
