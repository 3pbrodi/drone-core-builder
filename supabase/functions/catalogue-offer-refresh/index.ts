import { catalogueAdminKey } from "../_shared/catalogue-admin-auth.ts";
import { checkOffersByMerchant } from "../_shared/catalogue-offer-scheduler.ts";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };
const EXPECTED_REFRESH_TOKEN_SHA256 =
  "a7ba1baeae1110ea62b2b8c8592bf48fb79200b6ca5be601e3a47162547116f7";

type Target = {
  offerId: string;
  productId: string;
  productName: string;
  manufacturerName?: string | null;
  model?: string | null;
  variant?: string | null;
  manufacturerSku?: string | null;
  merchantSku?: string | null;
  merchantName: string;
  productUrl: string;
  currentPrice: number | string | null;
  currentStockStatus: string;
  currency: string;
};

type CheckResult = {
  offerId: string;
  productId: string;
  merchantName: string;
  success: boolean;
  price: number | null;
  currency: string | null;
  stockStatus: "in_stock" | "out_of_stock" | "preorder" | "backorder" | null;
  parserSource: string | null;
  responseStatus: number | null;
  checkedAt: string;
  error: string | null;
};

const stopWords = new Set([
  "the", "and", "for", "with", "fpv", "kit", "series", "version",
  "flight", "controller", "motor", "frame", "battery", "lipo", "camera",
  "receiver", "prop", "propeller", "esc", "official", "product",
]);

function normalizeText(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(value: unknown) {
  return new Set(
    normalizeText(value)
      .split(/\s+/)
      .filter((token) => token.length >= 2 && !stopWords.has(token)),
  );
}

function parsePrice(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  let text = String(value)
    .replace(/\u00a0/g, " ")
    .replace(/[^0-9,.-]/g, "")
    .trim();
  if (!text) return null;

  const comma = text.lastIndexOf(",");
  const dot = text.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) {
    if (comma > dot) text = text.replace(/\./g, "").replace(",", ".");
    else text = text.replace(/,/g, "");
  } else if (comma >= 0) {
    text = text.replace(",", ".");
  }

  const number = Number(text);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function availabilityToStock(value: unknown): CheckResult["stockStatus"] {
  const text = normalizeText(value).replace(/\s+/g, "");
  if (!text) return null;
  if (text.includes("instock") || text.endsWith("limitedavailability")) return "in_stock";
  if (
    text.includes("outofstock") ||
    text.includes("soldout") ||
    text.includes("discontinued")
  ) return "out_of_stock";
  if (text.includes("preorder") || text.includes("presale")) return "preorder";
  if (text.includes("backorder")) return "backorder";
  return null;
}

function typeIncludes(node: Record<string, unknown>, type: string) {
  const raw = node["@type"];
  if (Array.isArray(raw)) return raw.some((value) => normalizeText(value) === normalizeText(type));
  return normalizeText(raw) === normalizeText(type);
}

function collectObjects(value: unknown, out: Record<string, unknown>[] = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectObjects(item, out);
    return out;
  }
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    out.push(object);
    for (const child of Object.values(object)) collectObjects(child, out);
  }
  return out;
}

function candidateIdentityText(node: Record<string, unknown>) {
  return [
    node.name,
    node.sku,
    node.mpn,
    node.productID,
    node.model,
    node.description,
  ]
    .filter(Boolean)
    .join(" ");
}

function targetIdentityText(target: Target) {
  return [
    target.productName,
    target.manufacturerName,
    target.model,
    target.variant,
    target.manufacturerSku,
    target.merchantSku,
  ]
    .filter(Boolean)
    .join(" ");
}

function identityScore(target: Target, candidate: Record<string, unknown>) {
  const targetSku = normalizeText(target.merchantSku || target.manufacturerSku);
  const candidateSkus = [
    candidate.sku,
    candidate.mpn,
    candidate.productID,
  ].map(normalizeText).filter(Boolean);

  if (targetSku && candidateSkus.includes(targetSku)) return 10;

  const a = tokens(targetIdentityText(target));
  const b = tokens(candidateIdentityText(candidate));
  if (a.size === 0 || b.size === 0) return 0;

  let shared = 0;
  for (const token of a) if (b.has(token)) shared += 1;
  const ratio = shared / Math.min(a.size, b.size);
  return shared >= 2 ? ratio : 0;
}

function extractJsonLd(html: string) {
  const parsed: unknown[] = [];
  const regex = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(regex)) {
    const body = match[1]?.trim();
    if (!body) continue;
    try {
      parsed.push(JSON.parse(body));
    } catch {
      // Ignore invalid JSON-LD blocks instead of guessing.
    }
  }
  return parsed;
}

function offerObjects(product: Record<string, unknown>) {
  const raw = product.offers;
  if (!raw) return [] as Record<string, unknown>[];
  return collectObjects(raw).filter(
    (node) => typeIncludes(node, "Offer") || normalizeText(node["@type"]).endsWith("offer"),
  );
}


function itemPropValue(html: string, name: string) {
  const tagRegex = /<[^>]+>/gi;
  for (const match of html.matchAll(tagRegex)) {
    const tag = match[0];
    const attrs = new Map<string, string>();
    for (const attr of tag.matchAll(/([:\\w-]+)\\s*=\\s*["']([^"']*)["']/gi)) {
      attrs.set(attr[1].toLowerCase(), attr[2]);
    }
    if (normalizeText(attrs.get("itemprop")) !== normalizeText(name)) continue;
    const value = attrs.get("content") || attrs.get("href") || attrs.get("value");
    if (value) return value;
  }
  return null;
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
      attrs.get("property") ||
      attrs.get("name") ||
      attrs.get("itemprop") ||
      ""
    ).toLowerCase();
    const content = attrs.get("content");
    if (key && content && !map.has(key)) map.set(key, content);
  }
  return map;
}

function parseStructuredOffer(target: Target, html: string) {
  const products = extractJsonLd(html)
    .flatMap((value) => collectObjects(value))
    .filter((node) => typeIncludes(node, "Product"))
    .map((node) => ({ node, score: identityScore(target, node) }))
    .sort((a, b) => b.score - a.score);

  for (const product of products) {
    if (product.score < 0.35) continue;

    for (const offer of offerObjects(product.node)) {
      const currency = String(offer.priceCurrency ?? "").toUpperCase();
      const price = parsePrice(offer.price);
      const stock = availabilityToStock(offer.availability);
      if (currency === "EUR" && price !== null && stock) {
        return { price, currency, stock, parserSource: "json_ld" };
      }
    }
  }

  const meta = metaMap(html);
  const title =
    meta.get("og:title") ||
    meta.get("twitter:title") ||
    firstHeading(html) ||
    "";
  const pseudoProduct: Record<string, unknown> = {
    name: title,
    sku: meta.get("product:retailer_item_id") || meta.get("sku"),
  };
  if (identityScore(target, pseudoProduct) >= 0.35) {
    const price = parsePrice(
      meta.get("product:price:amount") ||
      meta.get("og:price:amount") ||
      meta.get("price") ||
      itemPropValue(html, "price"),
    );
    const currency = String(
      meta.get("product:price:currency") ||
      meta.get("og:price:currency") ||
      meta.get("pricecurrency") ||
      itemPropValue(html, "priceCurrency") ||
      "",
    ).toUpperCase();
    const stock = availabilityToStock(
      meta.get("product:availability") ||
      meta.get("og:availability") ||
      meta.get("availability") ||
      itemPropValue(html, "availability"),
    );

    if (currency === "EUR" && price !== null && stock) {
      return { price, currency, stock, parserSource: "meta" };
    }
  }

  return null;
}


function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&euro;|&#8364;/gi, "€")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function visibleText(html: string) {
  return decodeHtml(
    html
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  ).replace(/\s+/g, " ").trim();
}

function firstHeading(html: string) {
  const match = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  return match ? visibleText(match[1]) : "";
}

function productTextWindow(html: string) {
  const match = /<h1\b[^>]*>[\s\S]*?<\/h1>/i.exec(html);
  if (!match || match.index === undefined) return visibleText(html.slice(0, 12000));
  const start = match.index;
  return visibleText(html.slice(start, start + 18000));
}

function firstEuroPrice(text: string) {
  const patterns = [
    /€\s*([0-9]{1,5}(?:[.,][0-9]{1,2})?)/i,
    /([0-9]{1,5}(?:[.,][0-9]{1,2})?)\s*€/i,
    /([0-9]{1,5}(?:[.,][0-9]{1,2})?)\s*EUR\b/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const price = parsePrice(match[1]);
      if (price !== null) return price;
    }
  }
  return null;
}

function parseMerchantTextFallback(target: Target, html: string) {
  const heading = firstHeading(html);
  if (!heading || identityScore(target, { name: heading }) < 0.35) return null;

  const text = productTextWindow(html);
  const merchant = normalizeText(target.merchantName);
  let stock: CheckResult["stockStatus"] = null;
  let parserSource = "merchant_text";

  if (merchant === "rotorama") {
    parserSource = "rotorama_text";
    if (/verkauf beendet|sale ended|prodej ukon[cč]en/i.test(text)) {
      stock = "out_of_stock";
    } else if (/\bin stock\b|\bauf lager\b|\bskladem\b/i.test(text)) {
      stock = "in_stock";
    }
  } else if (merchant.includes("la camera embarquee")) {
    parserSource = "lce_text";
    if (/\bin stock\b|\ben stock\b/i.test(text)) {
      stock = "in_stock";
    } else if (/out of stock|rupture de stock|indisponible/i.test(text)) {
      stock = "out_of_stock";
    } else if (/coming soon|bient[oô]t disponible/i.test(text)) {
      stock = "preorder";
    }
  } else if (merchant.includes("rctech de")) {
    parserSource = "rctech_text";
    if (/sofort verf[uü]gbar|\bauf lager\b/i.test(text)) {
      stock = "in_stock";
    } else if (/nicht verf[uü]gbar|ausverkauft/i.test(text)) {
      stock = "out_of_stock";
    }
  } else if (merchant.includes("fpvgarage")) {
    parserSource = "fpvgarage_text";
    if (/out of stock|sold out|not available/i.test(text)) {
      stock = "out_of_stock";
    } else if (/add to cart/i.test(text)) {
      stock = "in_stock";
    }
  }

  const price = firstEuroPrice(text);
  if (price !== null && stock) {
    return {
      price,
      currency: "EUR",
      stock,
      parserSource,
    };
  }

  return null;
}

async function checkTarget(target: Target): Promise<CheckResult> {
  const checkedAt = new Date().toISOString();
  let responseStatus: number | null = null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let response: Response;
    try {
      response = await fetch(target.productUrl, {
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "accept": "text/html,application/xhtml+xml",
          "accept-language": "en-US,en;q=0.8,de;q=0.6",
          "user-agent":
            "Mozilla/5.0 (compatible; DroneCoresCatalogueVerifier/1.0; +https://dronecores.com)",
        },
      });
    } finally {
      clearTimeout(timeout);
    }

    responseStatus = response.status;
    if (!response.ok) {
      return {
        offerId: target.offerId,
        productId: target.productId,
        merchantName: target.merchantName,
        success: false,
        price: null,
        currency: null,
        stockStatus: null,
        parserSource: null,
        responseStatus,
        checkedAt,
        error: `Merchant page returned HTTP ${response.status}.`,
      };
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("text/html")) {
      return {
        offerId: target.offerId,
        productId: target.productId,
        merchantName: target.merchantName,
        success: false,
        price: null,
        currency: null,
        stockStatus: null,
        parserSource: null,
        responseStatus,
        checkedAt,
        error: "Merchant page did not return HTML.",
      };
    }

    const lengthHeader = Number(response.headers.get("content-length") || "0");
    if (lengthHeader > 5_000_000) {
      return {
        offerId: target.offerId,
        productId: target.productId,
        merchantName: target.merchantName,
        success: false,
        price: null,
        currency: null,
        stockStatus: null,
        parserSource: null,
        responseStatus,
        checkedAt,
        error: "Merchant page exceeded the safe parsing size.",
      };
    }

    const html = await response.text();
    const parsed =
      parseStructuredOffer(target, html) ??
      parseMerchantTextFallback(target, html);

    if (!parsed) {
      return {
        offerId: target.offerId,
        productId: target.productId,
        merchantName: target.merchantName,
        success: false,
        price: null,
        currency: null,
        stockStatus: null,
        parserSource: null,
        responseStatus,
        checkedAt,
        error: "No exact-product EUR price and structured availability could be verified.",
      };
    }

    return {
      offerId: target.offerId,
      productId: target.productId,
      merchantName: target.merchantName,
      success: true,
      price: parsed.price,
      currency: parsed.currency,
      stockStatus: parsed.stock,
      parserSource: parsed.parserSource,
      responseStatus,
      checkedAt,
      error: null,
    };
  } catch (error) {
    return {
      offerId: target.offerId,
      productId: target.productId,
      merchantName: target.merchantName,
      success: false,
      price: null,
      currency: null,
      stockStatus: null,
      parserSource: null,
      responseStatus,
      checkedAt,
      error: error instanceof Error ? error.message.slice(0, 500) : "Unknown merchant fetch error.",
    };
  }
}

type OfferRow = {
  id: string;
  product_id: string;
  merchant_id: string;
  merchant_sku: string | null;
  product_url: string;
  price_amount: number | string | null;
  currency: string | null;
  stock_status: string;
  region: string | null;
  verification_status: string;
  last_checked_at: string | null;
};

type ProductRow = {
  id: string;
  display_name: string;
  model: string | null;
  variant: string | null;
  manufacturer_sku: string | null;
  record_class: string;
  identity_status: string;
  verification_status: string;
  selectable: boolean;
  manufacturer_id: string | null;
};

type MerchantRow = {
  id: string;
  name: string;
  active: boolean;
  verification_status: string;
};

type ManufacturerRow = { id: string; name: string };

type RunRow = {
  id: string;
  local_date: string;
  status: string;
  total_targets: number;
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
  if (!baseUrl) throw new Error("SUPABASE_URL is unavailable.");

  const key = adminApiKey();
  const headers = new Headers(init.headers);
  headers.set("apikey", key);
  headers.set("accept", "application/json");
  if (!key.startsWith("sb_secret_")) {
    headers.set("authorization", `Bearer ${key}`);
  }
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  if (prefer) headers.set("prefer", prefer);

  const response = await fetch(
    `${baseUrl}/rest/v1/${path.replace(/^\//, "")}`,
    { ...init, headers },
  );

  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `Supabase admin request failed (${response.status}): ${text.slice(0, 500)}`,
    );
  }

  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function validRefreshToken(token: string | null) {
  if (!token || token.length < 32) return false;
  return (await sha256Hex(token)) === EXPECTED_REFRESH_TOKEN_SHA256;
}

async function loadTargets(): Promise<{
  targets: Target[];
  offers: Map<string, OfferRow>;
}> {
  const [offers, products, merchants, manufacturers] = await Promise.all([
    adminRest<OfferRow[]>(
      "catalogue_offers?select=id,product_id,merchant_id,merchant_sku,product_url,price_amount,currency,stock_status,region,verification_status,last_checked_at&verification_status=eq.verified&currency=eq.EUR&region=eq.EU",
    ),
    adminRest<ProductRow[]>(
      "catalogue_products?select=id,display_name,model,variant,manufacturer_sku,record_class,identity_status,verification_status,selectable,manufacturer_id&record_class=eq.canonical&identity_status=eq.verified&verification_status=eq.verified&selectable=eq.true",
    ),
    adminRest<MerchantRow[]>(
      "catalogue_merchants?select=id,name,active,verification_status&active=eq.true&verification_status=eq.verified",
    ),
    adminRest<ManufacturerRow[]>(
      "catalogue_manufacturers?select=id,name",
    ),
  ]);

  const productById = new Map(products.map((row) => [row.id, row]));
  const merchantById = new Map(merchants.map((row) => [row.id, row]));
  const manufacturerById = new Map(manufacturers.map((row) => [row.id, row]));
  const offerById = new Map<string, OfferRow>();
  const targets: Target[] = [];

  for (const offer of offers) {
    const product = productById.get(offer.product_id);
    const merchant = merchantById.get(offer.merchant_id);
    if (!product || !merchant) continue;

    offerById.set(offer.id, offer);
    targets.push({
      offerId: offer.id,
      productId: product.id,
      productName: product.display_name,
      manufacturerName: product.manufacturer_id
        ? manufacturerById.get(product.manufacturer_id)?.name ?? null
        : null,
      model: product.model,
      variant: product.variant,
      manufacturerSku: product.manufacturer_sku,
      merchantSku: offer.merchant_sku,
      merchantName: merchant.name,
      productUrl: offer.product_url,
      currentPrice: offer.price_amount,
      currentStockStatus: offer.stock_status,
      currency: offer.currency ?? "EUR",
    });
  }

  targets.sort((a, b) =>
    a.merchantName.localeCompare(b.merchantName) ||
    a.productName.localeCompare(b.productName)
  );

  return { targets, offers: offerById };
}

function berlinDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function getRun(localDate: string) {
  const rows = await adminRest<RunRow[]>(
    `catalogue_offer_refresh_runs?select=id,local_date,status,total_targets&local_date=eq.${encodeURIComponent(localDate)}&limit=1`,
  );
  return rows[0] ?? null;
}

async function beginRun(localDate: string, force: boolean, targetCount: number) {
  const existing = await getRun(localDate);

  if (existing && !force) {
    return { run: existing, skip: true };
  }

  if (existing) {
    await adminRest(
      `catalogue_offer_refresh_checks?run_id=eq.${existing.id}`,
      { method: "DELETE" },
    );
    const updated = await adminRest<RunRow[]>(
      `catalogue_offer_refresh_runs?id=eq.${existing.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          started_at: new Date().toISOString(),
          finished_at: null,
          status: "running",
          total_targets: targetCount,
          successful_checks: 0,
          failed_checks: 0,
          updated_offers: 0,
          error_message: null,
        }),
      },
      "return=representation",
    );
    return { run: updated[0], skip: false };
  }

  try {
    const inserted = await adminRest<RunRow[]>(
      "catalogue_offer_refresh_runs",
      {
        method: "POST",
        body: JSON.stringify({
          local_date: localDate,
          timezone: "Europe/Berlin",
          status: "running",
          total_targets: targetCount,
        }),
      },
      "return=representation",
    );
    return { run: inserted[0], skip: false };
  } catch (error) {
    const raced = await getRun(localDate);
    if (raced && !force) return { run: raced, skip: true };
    throw error;
  }
}

async function finishRun(
  runId: string,
  status: "completed" | "partial" | "failed",
  total: number,
  successful: number,
  failed: number,
  applied: number,
  errorMessage: string | null,
) {
  await adminRest(
    `catalogue_offer_refresh_runs?id=eq.${runId}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        finished_at: new Date().toISOString(),
        status,
        total_targets: total,
        successful_checks: successful,
        failed_checks: failed,
        updated_offers: applied,
        error_message: errorMessage?.slice(0, 2000) ?? null,
      }),
    },
  );
}

async function applyResults(
  runId: string,
  results: CheckResult[],
  offerById: Map<string, OfferRow>,
) {
  const checks = results
    .map((result) => {
      const offer = offerById.get(result.offerId);
      if (!offer) return null;

      const canApply =
        result.success &&
        result.price !== null &&
        result.price >= 0 &&
        result.currency === "EUR" &&
        result.stockStatus !== null;

      return {
        run_id: runId,
        offer_id: result.offerId,
        product_id: result.productId,
        merchant_name: result.merchantName,
        product_url: offer.product_url,
        previous_price: offer.price_amount,
        observed_price: result.price,
        previous_stock_status: offer.stock_status,
        observed_stock_status: result.stockStatus,
        observed_currency: result.currency,
        parser_source: result.parserSource,
        response_status: result.responseStatus,
        success: result.success,
        applied: canApply,
        checked_at: result.checkedAt,
        error_message: canApply
          ? null
          : result.error ?? "Observed offer data did not pass verification gates.",
      };
    })
    .filter(Boolean);

  if (checks.length) {
    await adminRest(
      "catalogue_offer_refresh_checks",
      { method: "POST", body: JSON.stringify(checks) },
    );
  }

  const updates = results.flatMap((result) => {
    const offer = offerById.get(result.offerId);
    if (
      !offer ||
      !result.success ||
      result.price === null ||
      result.price < 0 ||
      result.currency !== "EUR" ||
      result.stockStatus === null
    ) {
      return [];
    }

    return [{
      id: offer.id,
      product_id: offer.product_id,
      merchant_id: offer.merchant_id,
      merchant_sku: offer.merchant_sku,
      product_url: offer.product_url,
      price_amount: result.price,
      currency: "EUR",
      stock_status: result.stockStatus,
      region: "EU",
      verification_status: "verified",
      last_checked_at: result.checkedAt,
    }];
  });

  if (updates.length) {
    await adminRest(
      "catalogue_offers?on_conflict=id",
      { method: "POST", body: JSON.stringify(updates) },
      "resolution=merge-duplicates,return=minimal",
    );
  }

  return updates.length;
}

async function checkAllTargets(targets: Target[]) {
  return checkOffersByMerchant(
    targets,
    checkTarget,
    (target, blockedStatus): CheckResult => ({
      offerId: target.offerId,
      productId: target.productId,
      merchantName: target.merchantName,
      success: false,
      price: null,
      currency: null,
      stockStatus: null,
      parserSource: null,
      responseStatus: blockedStatus,
      checkedAt: new Date().toISOString(),
      error:
        "Merchant returned HTTP " + blockedStatus +
        " earlier in this run. Further requests to this merchant were skipped.",
    }),
  );
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  const token = req.headers.get("x-catalogue-refresh-token");
  if (!(await validRefreshToken(token))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: jsonHeaders,
    });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const mode = body.mode === "dry_run" ? "dry_run" : "apply";
  const force = body.force === true;

  try {
    const { targets, offers } = await loadTargets();

    if (mode === "dry_run") {
      const results = await checkAllTargets(targets);
      return new Response(JSON.stringify({
        mode,
        targetCount: targets.length,
        successful: results.filter((item) => item.success).length,
        failed: results.filter((item) => !item.success).length,
        results,
      }), { headers: jsonHeaders });
    }

    const localDate = berlinDate();
    const { run, skip } = await beginRun(localDate, force, targets.length);
    if (!run) throw new Error("Offer refresh run could not be created.");

    if (skip) {
      return new Response(JSON.stringify({
        runId: run.id,
        skipped: true,
        status: run.status,
      }), { headers: jsonHeaders });
    }

    try {
      const results = await checkAllTargets(targets);
      const applied = await applyResults(run.id, results, offers);
      const successful = results.filter((item) => item.success).length;
      const failed = results.length - successful;
      const status = failed === 0
        ? "completed"
        : successful > 0
        ? "partial"
        : "failed";

      await finishRun(
        run.id,
        status,
        targets.length,
        successful,
        failed,
        applied,
        null,
      );

      return new Response(JSON.stringify({
        runId: run.id,
        skipped: false,
        status,
        totalTargets: targets.length,
        successfulChecks: successful,
        failedChecks: failed,
        updatedOffers: applied,
      }), { headers: jsonHeaders });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Offer refresh failed.";
      await finishRun(
        run.id,
        "failed",
        targets.length,
        0,
        targets.length,
        0,
        message,
      );
      throw error;
    }
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Offer refresh failed.",
    }), { status: 500, headers: jsonHeaders });
  }
});
