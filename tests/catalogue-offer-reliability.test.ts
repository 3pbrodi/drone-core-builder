import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { catalogueAdminKey, cataloguePublicKey } from "../supabase/functions/_shared/catalogue-admin-auth.ts";
import { checkOffersByMerchant } from "../supabase/functions/_shared/catalogue-offer-scheduler.ts";
import { catalogueRestFetch } from "../supabase/functions/_shared/catalogue-rest-retry.ts";

const env = (values: Record<string, string>) =>
  (name: string) => values[name];

describe("catalogue worker secret key resolution", () => {
  it("prefers a modern secret key without falling back to a hosted JWT", () => {
    const key = catalogueAdminKey(env({
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SECRET_KEYS: JSON.stringify({ default: "sb_secret_modern" }),
      SUPABASE_SERVICE_ROLE_KEY: "legacy-jwt",
    }));
    assert.equal(key, "sb_secret_modern");
  });

  it("refuses a legacy service-role JWT on hosted projects", () => {
    assert.throws(
      () => catalogueAdminKey(env({
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "legacy-jwt",
      })),
      /require a Supabase secret API key/,
    );
  });

  it("retains local disposable-stack compatibility", () => {
    assert.equal(
      catalogueAdminKey(env({
        SUPABASE_URL: "http://kong:8000",
        SUPABASE_SERVICE_ROLE_KEY: "local-only-jwt",
      })),
      "local-only-jwt",
    );
  });

  it("fails closed on invalid or malformed modern secrets", () => {
    assert.throws(
      () => catalogueAdminKey(env({
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SECRET_KEYS: "not-json",
      })),
      /JSON object/,
    );
    assert.throws(
      () => catalogueAdminKey(env({
        SUPABASE_URL: "http://localhost:54321",
        SUPABASE_SECRET_KEYS: JSON.stringify({ default: "wrong-format" }),
        SUPABASE_SERVICE_ROLE_KEY: "local-only-jwt",
      })),
      /modern sb_secret_/,
    );
  });
});

describe("catalogue runtime publishable key resolution", () => {
  it("uses the modern publishable key for the public runtime", () => {
    assert.equal(
      cataloguePublicKey(env({
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_PUBLISHABLE_KEYS: JSON.stringify({ default: "sb_publishable_modern" }),
        SUPABASE_ANON_KEY: "legacy-anon",
      })),
      "sb_publishable_modern",
    );
  });

  it("rejects hosted legacy anon JWTs but permits disposable local fallback", () => {
    assert.throws(
      () => cataloguePublicKey(env({
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_ANON_KEY: "legacy-anon",
      })),
      /requires a Supabase publishable API key/,
    );
    assert.equal(
      cataloguePublicKey(env({
        SUPABASE_URL: "http://127.0.0.1:54321",
        SUPABASE_ANON_KEY: "local-anon",
      })),
      "local-anon",
    );
  });
});

describe("transient Supabase PGRST303 retry", () => {
  const skew = () => new Response(
    JSON.stringify({ code: "PGRST303", message: "JWT issued at future" }),
    { status: 401, headers: { "content-type": "application/json" } },
  );
  const immediate = async (_ms: number) => {};

  it("retries only the precise clock-skew error on a GET", async () => {
    let calls = 0;
    const response = await catalogueRestFetch(
      "https://example.supabase.co/rest/v1/catalogue_products",
      {},
      async () => (++calls === 1 ? skew() : new Response("[]", { status: 200 })),
      [0],
      immediate,
    );
    assert.equal(response.status, 200);
    assert.equal(calls, 2);
  });

  it("does not retry writes even if a response reports JWT clock skew", async () => {
    let calls = 0;
    const response = await catalogueRestFetch(
      "https://example.supabase.co/rest/v1/catalogue_offers",
      { method: "POST", body: "{}" },
      async () => { calls++; return skew(); },
      [0, 0],
      immediate,
    );
    assert.equal(response.status, 401);
    assert.equal(calls, 1);
  });

  it("does not retry other 401s, server errors or unparseable errors", async () => {
    for (const result of [
      new Response(JSON.stringify({ code: "PGRST301", message: "Invalid JWT" }), { status: 401 }),
      new Response("server error", { status: 500 }),
      new Response("not json", { status: 401 }),
    ]) {
      let calls = 0;
      const response = await catalogueRestFetch(
        "https://example.supabase.co/rest/v1/catalogue_products",
        {},
        async () => { calls++; return result; },
        [0, 0],
        immediate,
      );
      assert.equal(response.status, result.status);
      assert.equal(calls, 1);
    }
  });

  it("stops after bounded attempts if the provider error persists", async () => {
    let calls = 0;
    const waits: number[] = [];
    const response = await catalogueRestFetch(
      "https://example.supabase.co/rest/v1/catalogue_products",
      {},
      async () => { calls++; return skew(); },
      [1, 3],
      async (ms) => { waits.push(ms); },
    );
    assert.equal(response.status, 401);
    assert.equal(calls, 3);
    assert.deepEqual(waits, [1, 3]);
  });
});

describe("merchant-aware offer checks", () => {
  type Item = { id: string; merchantName: string };
  type Result = { id: string; responseStatus: number | null; skipped: boolean };
  const skip = (target: Item, responseStatus: 403 | 429): Result =>
    ({ id: target.id, responseStatus, skipped: true });

  it("checks one merchant sequentially and preserves the original result order", async () => {
    const targets: Item[] = [
      { id: "a1", merchantName: "A" },
      { id: "b1", merchantName: "B" },
      { id: "a2", merchantName: "a" },
    ];
    const inFlight = new Map<string, number>();
    const maximum = new Map<string, number>();
    const results = await checkOffersByMerchant(
      targets,
      async (target): Promise<Result> => {
        const key = target.merchantName.toLowerCase();
        const current = (inFlight.get(key) ?? 0) + 1;
        inFlight.set(key, current);
        maximum.set(key, Math.max(maximum.get(key) ?? 0, current));
        await Promise.resolve();
        inFlight.set(key, (inFlight.get(key) ?? 1) - 1);
        return { id: target.id, responseStatus: 200, skipped: false };
      },
      skip,
      2,
    );
    assert.deepEqual(results.map((row) => row.id), ["a1", "b1", "a2"]);
    assert.equal(maximum.get("a"), 1);
    assert.ok(results.every((row) => !row.skipped));
  });

  it("halts further requests to a merchant on HTTP 429 without blocking others", async () => {
    const requested: string[] = [];
    const targets: Item[] = [
      { id: "a1", merchantName: "A" },
      { id: "a2", merchantName: "A" },
      { id: "b1", merchantName: "B" },
      { id: "a3", merchantName: "A" },
    ];
    const results = await checkOffersByMerchant(
      targets,
      async (target): Promise<Result> => {
        requested.push(target.id);
        return {
          id: target.id,
          responseStatus: target.id === "a1" ? 429 : 200,
          skipped: false,
        };
      },
      skip,
    );
    assert.deepEqual(requested.sort(), ["a1", "b1"]);
    assert.deepEqual(results.map((r) => r.skipped), [false, true, false, true]);
    assert.deepEqual(results.map((r) => r.responseStatus), [429, 429, 200, 429]);
  });

  it("applies the same circuit breaker to HTTP 403", async () => {
    const results = await checkOffersByMerchant(
      [{ id: "first", merchantName: "A" }, { id: "second", merchantName: "A" }],
      async (item): Promise<Result> =>
        ({ id: item.id, responseStatus: 403, skipped: false }),
      skip,
      1,
    );
    assert.deepEqual(results.map((row) => row.skipped), [false, true]);
  });

  it("returns an empty result for an empty catalogue", async () => {
    const result = await checkOffersByMerchant<Item, Result>([], async () => {
      throw new Error("Should not be called");
    }, skip);
    assert.deepEqual(result, []);
  });
});
