import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { catalogueAdminKey } from "../supabase/functions/_shared/catalogue-admin-auth.ts";
import { checkOffersByMerchant } from "../supabase/functions/_shared/catalogue-offer-scheduler.ts";

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
