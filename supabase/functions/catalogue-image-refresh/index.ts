import { catalogueRestFetch } from "../_shared/catalogue-rest-retry.ts";
import { catalogueAdminKey } from "../_shared/catalogue-admin-auth.ts";
const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };
const EXPECTED_TOKEN_SHA256 = "971ed0ddc041ff1f1e96c37253fbc539e9c043a2419281de16a10488a30848c1";

type ProductRow = {
  id: string;
  display_name: string;
  model: string;
  variant: string | null;
  manufacturer_sku: string | null;
  selectable: boolean;
};

type IdentityEvidenceRow = {
  product_id: string;
  manufacturer_label: string;
  model_label: string;
  variant_label: string | null;
  source_url: string | null;
  authority: string;
  exact_model_association: boolean;
  verification_status: string;
  verified_at: string | null;
};

type CandidateImage = {
  productId: string;
  productName: string;
  sourceUrl: string;
  imageUrl: string | null;
  parserSource: string | null;
  identityScore: number;
  success: boolean;
  error: string | null;
};

function adminApiKey() {
  return catalogueAdminKey((name) => Deno.env.get(name));
}

async function adminRest<T>(
  path: string,
  init: RequestInit = {},
  prefer?: string,
): Promise<T> {
  const baseUrl = Deno.env.get("SUPABASE_URL");
  if (!baseUrl) throw new Error("SUPABASE_URL unavailable.");

  const key = adminApiKey();
  const headers = new Headers(init.headers);
  headers.set("apikey", key);
  headers.set("accept", "application/json");
  if (!key.startsWith("sb_secret_")) headers.set("authorization", `Bearer ${key}`);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  if (prefer) headers.set("prefer", prefer);

  const response = await catalogueRestFetch(
    `${baseUrl}/rest/v1/${path.replace(/^\//, "")}`,
    { ...init, headers },
  );
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Supabase admin request failed (${response.status}): ${text.slice(0, 600)}`);
  }
  return text ? JSON.parse(text) as T : undefined as T;
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function isAuthorized(req: Request) {
  const token = req.headers.get("x-catalogue-image-refresh-token");
  if (!token || token.length < 32) return false;
  return (await sha256Hex(token)) === EXPECTED_TOKEN_SHA256;
}

function normalize(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const STOP = new Set([
  "the","and","for","with","fpv","kit","series","version","v1","v2","v3","v4","v5",
  "flight","controller","motor","frame","battery","lipo","camera","receiver","prop",
  "propeller","esc","official","product","black","grey","gray"
]);

function tokens(value: unknown) {
  return normalize(value).split(/\s+/).filter((t) => t.length >= 2 && !STOP.has(t));
}

function stripHtml(value: string) {
  return value.replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function parseJsonLd(html: string) {
  const out: unknown[] = [];
  const rx = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(rx)) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    try { out.push(JSON.parse(raw)); } catch {}
  }
  return out;
}

function collectObjects(value: unknown, out: Record<string, unknown>[] = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectObjects(item, out);
  } else if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    out.push(obj);
    for (const child of Object.values(obj)) collectObjects(child, out);
  }
  return out;
}

function isType(obj: Record<string, unknown>, expected: string) {
  const raw = obj["@type"];
  const values = Array.isArray(raw) ? raw : [raw];
  return values.some((value) => normalize(value) === normalize(expected));
}

function metaMap(html: string) {
  const map = new Map<string, string>();
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0];
    const attrs = new Map<string, string>();
    for (const attr of tag.matchAll(/([:\w-]+)\s*=\s*["']([^"']*)["']/gi)) {
      attrs.set(attr[1].toLowerCase(), attr[2]);
    }
    const key = (
      attrs.get("property") || attrs.get("name") || attrs.get("itemprop") || ""
    ).toLowerCase();
    const content = attrs.get("content");
    if (key && content && !map.has(key)) map.set(key, content);
  }
  return map;
}

function identityScore(
  product: ProductRow,
  evidence: IdentityEvidenceRow,
  pageName: string,
  pageSku: string | null,
  htmlText: string,
) {
  const wantedSku = normalize(product.manufacturer_sku);
  const candidateSku = normalize(pageSku);
  if (wantedSku && candidateSku && wantedSku === candidateSku) return 1;

  const expected = tokens([
    product.display_name,
    product.model,
    product.variant,
    evidence.model_label,
    evidence.variant_label,
    evidence.manufacturer_label,
  ].filter(Boolean).join(" "));
  const page = new Set(tokens(pageName + " " + htmlText.slice(0, 6000)));
  if (!expected.length || !page.size) return 0;

  const uniqueExpected = [...new Set(expected)];
  const shared = uniqueExpected.filter((t) => page.has(t)).length;
  return shared / uniqueExpected.length;
}

function normalizeImageUrl(value: unknown, base: string): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw === "object" && raw) {
    const obj = raw as Record<string, unknown>;
    return normalizeImageUrl(obj.url ?? obj.contentUrl, base);
  }
  if (!raw) return null;
  try {
    const url = new URL(String(raw), base);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function extractImage(html: string, sourceUrl: string) {
  const objects = parseJsonLd(html).flatMap((v) => collectObjects(v));
  const productObjects = objects.filter((o) => isType(o, "Product"));
  for (const product of productObjects) {
    const image = normalizeImageUrl(product.image, sourceUrl);
    if (image) {
      return {
        imageUrl: image,
        pageName: String(product.name ?? ""),
        pageSku: product.sku ? String(product.sku) : product.mpn ? String(product.mpn) : null,
        parserSource: "json_ld_product_image",
      };
    }
  }

  const meta = metaMap(html);
  const image = normalizeImageUrl(
    meta.get("og:image") || meta.get("twitter:image") || meta.get("twitter:image:src"),
    sourceUrl,
  );
  if (image) {
    return {
      imageUrl: image,
      pageName: meta.get("og:title") || meta.get("twitter:title") || "",
      pageSku: meta.get("product:retailer_item_id") || meta.get("sku") || null,
      parserSource: "open_graph_image",
    };
  }

  return null;
}

async function verifyImageFetch(imageUrl: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    let response = await fetch(imageUrl, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": "Mozilla/5.0 (compatible; DroneCoresCatalogueVerifier/1.0)" },
    });
    if (response.status === 405 || response.status === 403) {
      response = await fetch(imageUrl, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "range": "bytes=0-2047",
          "user-agent": "Mozilla/5.0 (compatible; DroneCoresCatalogueVerifier/1.0)",
        },
      });
    }
    const ct = response.headers.get("content-type")?.toLowerCase() ?? "";
    return response.ok && ct.startsWith("image/");
  } finally {
    clearTimeout(timeout);
  }
}

async function checkOne(product: ProductRow, evidence: IdentityEvidenceRow): Promise<CandidateImage> {
  const sourceUrl = evidence.source_url!;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let response: Response;
    try {
      response = await fetch(sourceUrl, {
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "accept": "text/html,application/xhtml+xml",
          "accept-language": "en-US,en;q=0.8,de;q=0.6",
          "user-agent": "Mozilla/5.0 (compatible; DroneCoresCatalogueVerifier/1.0; +https://dronecores.com)",
        },
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      return { productId: product.id, productName: product.display_name, sourceUrl, imageUrl: null, parserSource: null, identityScore: 0, success: false, error: `Source returned HTTP ${response.status}` };
    }

    const html = await response.text();
    const extracted = extractImage(html, sourceUrl);
    if (!extracted) {
      return { productId: product.id, productName: product.display_name, sourceUrl, imageUrl: null, parserSource: null, identityScore: 0, success: false, error: "No product image found in exact-model manufacturer metadata." };
    }

    const score = identityScore(product, evidence, extracted.pageName, extracted.pageSku, stripHtml(html));
    if (score < 0.45) {
      return { productId: product.id, productName: product.display_name, sourceUrl, imageUrl: extracted.imageUrl, parserSource: extracted.parserSource, identityScore: score, success: false, error: "Manufacturer page identity did not meet the exact-model image threshold." };
    }

    const fetchable = await verifyImageFetch(extracted.imageUrl);
    if (!fetchable) {
      return { productId: product.id, productName: product.display_name, sourceUrl, imageUrl: extracted.imageUrl, parserSource: extracted.parserSource, identityScore: score, success: false, error: "Image URL did not return an image response." };
    }

    return { productId: product.id, productName: product.display_name, sourceUrl, imageUrl: extracted.imageUrl, parserSource: extracted.parserSource, identityScore: score, success: true, error: null };
  } catch (error) {
    return { productId: product.id, productName: product.display_name, sourceUrl, imageUrl: null, parserSource: null, identityScore: 0, success: false, error: error instanceof Error ? error.message.slice(0, 500) : "Unknown error" };
  }
}

async function mapConcurrent<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await fn(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, Math.max(1, items.length)) }, worker));
  return results;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: JSON_HEADERS });
  }
  if (!(await isAuthorized(req))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: JSON_HEADERS });
  }

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch {}
  const mode = body.mode === "apply" ? "apply" : "dry_run";

  try {
    const [products, evidence] = await Promise.all([
      adminRest<ProductRow[]>(
        "catalogue_products?select=id,display_name,model,variant,manufacturer_sku,selectable&selectable=eq.true&verification_status=eq.verified&record_class=eq.canonical",
      ),
      adminRest<IdentityEvidenceRow[]>(
        "catalogue_identity_evidence?select=product_id,manufacturer_label,model_label,variant_label,source_url,authority,exact_model_association,verification_status,verified_at&verification_status=eq.verified&exact_model_association=eq.true&source_url=not.is.null&authority=in.(manufacturer,official_documentation)&order=verified_at.desc.nullslast",
      ),
    ]);

    const evidenceByProduct = new Map<string, IdentityEvidenceRow>();
    for (const row of evidence) {
      if (!evidenceByProduct.has(row.product_id)) evidenceByProduct.set(row.product_id, row);
    }

    const targets = products.flatMap((product) => {
      const ev = evidenceByProduct.get(product.id);
      return ev ? [{ product, evidence: ev }] : [];
    });

    const results = await mapConcurrent(targets, 4, ({ product, evidence }) => checkOne(product, evidence));

    let applied = 0;
    if (mode === "apply") {
      for (const result of results) {
        if (!result.success || !result.imageUrl) continue;

        await adminRest(
          `catalogue_product_images?product_id=eq.${encodeURIComponent(result.productId)}&primary_image=eq.true`,
          { method: "PATCH", body: JSON.stringify({ primary_image: false }) },
        );

        const existing = await adminRest<Array<{ id: string }>>(
          `catalogue_product_images?select=id&product_id=eq.${encodeURIComponent(result.productId)}&image_url=eq.${encodeURIComponent(result.imageUrl)}&limit=1`,
        );

        if (existing.length) {
          await adminRest(
            `catalogue_product_images?id=eq.${existing[0].id}`,
            {
              method: "PATCH",
              body: JSON.stringify({
                source_url: result.sourceUrl,
                alt_text: result.productName,
                exact_model_verified: true,
                verification_status: "verified",
                provenance: `Exact-model manufacturer page image via ${result.parserSource}`,
                primary_image: true,
                captured_at: new Date().toISOString(),
              }),
            },
          );
        } else {
          await adminRest(
            "catalogue_product_images",
            {
              method: "POST",
              body: JSON.stringify({
                product_id: result.productId,
                image_url: result.imageUrl,
                source_url: result.sourceUrl,
                alt_text: result.productName,
                exact_model_verified: true,
                verification_status: "verified",
                provenance: `Exact-model manufacturer page image via ${result.parserSource}`,
                primary_image: true,
                captured_at: new Date().toISOString(),
              }),
            },
          );
        }
        applied += 1;
      }
    }

    return new Response(JSON.stringify({
      mode,
      targetCount: targets.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      applied,
      results,
    }), { headers: JSON_HEADERS });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Image refresh failed",
    }), { status: 500, headers: JSON_HEADERS });
  }
});
