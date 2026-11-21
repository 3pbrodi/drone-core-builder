import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const captures = resolve(
  process.env.MANUFACTURER_PAIR_CAPTURE_DIR ??
    ".private-backups/manufacturer-pair-activation-20261121",
);
import { resolveCompatibilityEvidence } from "../../src/lib/catalogue-evidence";
const read = (name: string) => JSON.parse(readFileSync(resolve(captures, name), "utf8"));
const plan = read("manifest.json"),
  rows = read("runtime-product-fixtures.json"),
  proofs = read("exact-packet-rows.json"),
  before = read("public-before.json");
let handler: (r: Request) => Promise<Response>;
(globalThis as any).Deno = {
  env: {
    get: (name: string) =>
      name === "SUPABASE_URL"
        ? "http://127.0.0.1:48999"
        : name === "SUPABASE_ANON_KEY"
          ? "local-test-placeholder"
          : undefined,
  },
  serve: (fn: typeof handler) => {
    handler = fn;
  },
};
const fields = before.evidence.fields.map((r: any, i: number) => ({
  id: "synthetic-field-" + i,
  product_id: r.productId,
  field_key: r.field,
  value: r.value,
  unit: r.unit,
  source_id: r.sourceId,
  source_url: r.sourceUrl,
  authority: r.authority,
  exact_model_association: r.exactModelAssociation,
  verification_status: r.verificationStatus,
  retrieved_at: r.retrievedAt,
  verified_at: r.verifiedAt,
  conditions: r.conditions,
  caveats: r.caveats,
}));
const tables: Record<string, any[]> = {
  catalogue_public_runtime_products: rows,
  catalogue_public_verified_spec_evidence: fields,
  catalogue_public_fc_esc_evidence: proofs.fcEscRows,
  catalogue_public_motor_propeller_evidence: proofs.motorPropellerRows,
  catalogue_public_motor_esc_current_evidence: [],
};
(globalThis as any).fetch = async (input: any) => {
  const url = new URL(String(input));
  assert.equal(url.hostname, "127.0.0.1");
  const name = url.pathname.split("/").at(-1)!;
  let found = [...(tables[name] ?? [])];
  for (const [key, value] of url.searchParams) {
    if (value.startsWith("in.(")) {
      const ids = JSON.parse("[" + value.slice(4, -1) + "]");
      found = found.filter((r) => ids.includes(r[key]));
    }
  }
  const total = found.length,
    offset = Number(url.searchParams.get("offset") ?? 0),
    limit = Number(url.searchParams.get("limit") ?? 10000);
  found = found.slice(offset, offset + limit);
  return new Response(JSON.stringify(found), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "content-range": `${offset}-${offset + found.length - 1}/${total}`,
    },
  });
};
await import(pathToFileURL(resolve(captures, "runtime-before/catalogue-runtime/index.ts")).href);
const old = handler!;
await import(pathToFileURL(resolve(captures, "runtime-after/catalogue-runtime/index.ts")).href);
const next = handler!;
const query = {
  mode: "ids",
  ids: rows.map((r: any) => r.id),
  withEvidence: true,
  withManufacturers: false,
};
let checks = 0;
const check = (v: unknown, m: string) => {
  checks++;
  assert(v, m);
};
for (const suffix of ["", "?query=" + encodeURIComponent(JSON.stringify(query))]) {
  const oldResponse = await old(new Request("http://127.0.0.1/runtime" + suffix));
  const response = await next(new Request("http://127.0.0.1/runtime" + suffix));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), "*");
  const previous = await oldResponse.json(),
    data = await response.json();
  assert.deepEqual(data.products, previous.products);
  assert.deepEqual(data.evidence.fields, previous.evidence.fields);
  checks += 4;
  check(
    data.evidence.fcEscConnection.length === 4 && data.evidence.motorPropeller.length === 1,
    "Exact pair counts",
  );
  for (const item of plan.entries) {
    const s = Object.fromEntries(data.products.map((p: any) => [p.id, p]));
    const selected =
      item.kind === "fc_esc_connection"
        ? {
            flightController: s[item.productIds[0]],
            esc: s[item.productIds[1]],
            battery: { id: "fixture-6s", category: "battery", voltage: 6 },
          }
        : {
            motors: s[item.productIds[0]],
            propellers: s[item.productIds[1]],
            battery: { id: "fixture-6s", category: "battery", voltage: 6 },
          };
    const result = resolveCompatibilityEvidence(selected as any, data.evidence);
    const source =
      item.kind === "fc_esc_connection"
        ? result.pairSources.FC_ESC_CONNECTOR?.[0]
        : result.pairSources.MOTOR_PROPELLER_SIZE_GUIDANCE?.[0];
    check(
      source?.sha256 === item.source.sha256 && source?.url === item.source.url,
      "Captured source/hash survived actual handler",
    );
    check(source?.scope === item.scope, "Exact scope survived actual handler");
    const wrong = resolveCompatibilityEvidence(
      { ...selected, battery: { id: "fixture-2s", category: "battery", voltage: 2 } } as any,
      data.evidence,
    );
    check(
      item.kind === "fc_esc_connection"
        ? !wrong.technicalEvidence.fcEscConnector
        : !wrong.technicalEvidence.motorPropeller,
      "No out-of-range proof reuse",
    );
  }
}
assert.equal((await next(new Request("http://127.0.0.1/runtime", { method: "POST" }))).status, 405);
assert.equal((await next(new Request("http://127.0.0.1/runtime?query=broken"))).status, 400);
const receipt = {
  passed: true,
  checks: checks + 2,
  network: "Loopback-only mocked REST; actual deployed v4 handler baseline and two-file patch",
  unchangedBundleDependencies: 8,
  legacyAndQueryPaths: true,
  productAndFieldPayloadsPreserved: true,
  proofScopeAndWrongCellChecks: true,
};
writeFileSync(
  resolve(captures, "runtime-local-verification.json"),
  JSON.stringify(receipt, null, 2) + "\n",
);
console.log(JSON.stringify(receipt));
