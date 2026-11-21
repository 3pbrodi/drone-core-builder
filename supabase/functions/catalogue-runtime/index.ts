import { mapEvidenceRows } from "../_shared/catalogue-evidence-read.ts";
import { loadCatalogueQuery } from "../_shared/catalogue-query-service.ts";
import { normalizeCatalogueQuery, type CountedReader } from "../_shared/catalogue-query.ts";
import { readAllRows } from "../_shared/catalogue-runtime-read.ts";
import { runtimeRowToProduct } from "../_shared/catalogue-runtime-product.ts";
import { catalogueRestFetch } from "../_shared/catalogue-rest-retry.ts";
import { cataloguePublicKey } from "../_shared/catalogue-admin-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "public, max-age=30, s-maxage=60",
};

const categories = [
  "frame",
  "motors",
  "flightController",
  "esc",
  "propellers",
  "battery",
  "camera",
  "receiver",
];

async function restPage(path: string) {
  const baseUrl = Deno.env.get("SUPABASE_URL");
  if (!baseUrl) throw new Error("Supabase public runtime URL missing.");
  const publicKey = cataloguePublicKey((name) => Deno.env.get(name));

  const response = await catalogueRestFetch(`${baseUrl}/rest/v1/${path}`, {
    headers: { apikey: publicKey, Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(
      `Public catalogue request failed (${response.status}): ${await response.text()}`,
    );
  }
  return response.json();
}

const countedRest: CountedReader = async <T>(path: string) => {
 const baseUrl = Deno.env.get("SUPABASE_URL");
 if(!baseUrl) throw new Error("Supabase runtime URL missing.");
 const response = await catalogueRestFetch(`${baseUrl}/rest/v1/${path}`,{headers:{apikey:cataloguePublicKey(name=>Deno.env.get(name)),Accept:"application/json",Prefer:"count=exact"}});
 if(!response.ok) throw new Error("Runtime page could not be loaded.");
 return {rows:await response.json() as T[],total:Number(response.headers.get("content-range")?.split("/")[1])};
};
async function rest(path: string) { return readAllRows<any>(restPage, path); }
const toProduct = (row: any) => runtimeRowToProduct(row);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  const encoded = new URL(req.url).searchParams.get("query");
  let query;
  if(encoded) {
    try { query=normalizeCatalogueQuery(JSON.parse(encoded)); }
    catch { return new Response(JSON.stringify({error:"Invalid catalogue query"}),{status:400,headers:jsonHeaders}); }
  }
  try {
    if(query) return new Response(JSON.stringify(await loadCatalogueQuery(countedRest,restPage,query)),{headers:jsonHeaders});
    const [rows, fields, motorPropeller, motorEsc, fcEsc] = await Promise.all([
      rest("catalogue_public_runtime_products?select=*&order=id.asc"),
      rest("catalogue_public_verified_spec_evidence?select=*&order=product_id.asc,field_key.asc"),
      rest("catalogue_public_motor_propeller_evidence?select=*&order=motor_product_id.asc,propeller_product_id.asc"),
      rest("catalogue_public_motor_esc_current_evidence?select=*&order=motor_product_id.asc,esc_product_id.asc"),
      rest("catalogue_public_fc_esc_evidence?select=*&order=flight_controller_product_id.asc,esc_product_id.asc"),
    ]);

    const products = rows.map(toProduct).filter(Boolean);
    const missingCategories = categories.filter(
      (category) => !products.some((product: any) => product.category === category),
    );

    const validation = {
      ok: products.length > 0,
      missingCategories,
      duplicateProductIds: [],
      rejectedProductIds: [],
      invalidProductIds: [],
    };

    const evidence = mapEvidenceRows({
      fields, motorPropellerRows: motorPropeller, motorEscRows: motorEsc, fcEscRows: fcEsc,
    });

    return new Response(
      JSON.stringify({
        source: validation.ok ? "database" : "unavailable",
        status: validation.ok ? "ready" : "coverage_failed",
        products: validation.ok ? products : [],
        evidence: validation.ok
          ? evidence
          : {
              fields: [],
              motorPropeller: [],
              motorEscCurrent: [],
              fcEscConnection: [],
            },
        validation,
        ...(validation.ok ? {} : { error: "Verified catalogue coverage check failed." }),
      }),
      { headers: jsonHeaders },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        source: "unavailable",
        status: "database_unavailable",
        products: [],
        evidence: { fields: [], motorPropeller: [], motorEscCurrent: [], fcEscConnection: [] },
        validation: {
          ok: false,
          missingCategories: categories,
          duplicateProductIds: [],
          rejectedProductIds: [],
          invalidProductIds: [],
        },
        error: error instanceof Error ? error.message : "Unknown catalogue error",
      }),
      { status: 500, headers: jsonHeaders },
    );
  }
});
