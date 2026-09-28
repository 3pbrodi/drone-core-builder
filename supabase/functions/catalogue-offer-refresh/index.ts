const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

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

async function mapConcurrent<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  async function worker() {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await fn(items[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, Math.max(items.length, 1)) }, () => worker()),
  );
  return results;
}

async function rpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const baseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!baseUrl || !anonKey) throw new Error("Supabase function environment is incomplete.");

  const response = await fetch(`${baseUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      "apikey": anonKey,
      "authorization": `Bearer ${anonKey}`,
      "content-type": "application/json",
      "accept": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`RPC ${name} failed (${response.status}): ${text.slice(0, 500)}`);
  }
  return text ? JSON.parse(text) as T : (null as T);
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

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  const token = req.headers.get("x-catalogue-refresh-token");
  if (!token) {
    return new Response(JSON.stringify({ error: "Missing refresh token." }), {
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

  if (mode === "dry_run") {
    try {
      const targets = await rpc<Target[]>("catalogue_offer_refresh_preview", {
        p_token: token,
      });
      const results = await mapConcurrent(targets, 4, checkTarget);
      return new Response(JSON.stringify({
        mode,
        targetCount: targets.length,
        successful: results.filter((item) => item.success).length,
        failed: results.filter((item) => !item.success).length,
        results,
      }), { headers: jsonHeaders });
    } catch (error) {
      return new Response(JSON.stringify({
        mode,
        error: error instanceof Error ? error.message : "Dry run failed.",
      }), { status: 500, headers: jsonHeaders });
    }
  }

  let runId: string | null = null;
  try {
    const begin = await rpc<{
      runId: string;
      skip: boolean;
      status: string;
      targets: Target[];
    }>("catalogue_offer_refresh_begin", {
      p_token: token,
      p_local_date: berlinDate(),
      p_force: force,
    });

    runId = begin.runId;
    if (begin.skip) {
      return new Response(JSON.stringify({
        runId,
        skipped: true,
        status: begin.status,
      }), { headers: jsonHeaders });
    }

    const results = await mapConcurrent(begin.targets, 4, checkTarget);

    await rpc("catalogue_offer_refresh_apply_batch", {
      p_token: token,
      p_run_id: runId,
      p_results: results,
    });

    const finish = await rpc("catalogue_offer_refresh_finish", {
      p_token: token,
      p_run_id: runId,
      p_error: null,
    });

    return new Response(JSON.stringify({
      runId,
      skipped: false,
      ...finish as Record<string, unknown>,
    }), { headers: jsonHeaders });
  } catch (error) {
    if (runId) {
      try {
        await rpc("catalogue_offer_refresh_finish", {
          p_token: token,
          p_run_id: runId,
          p_error: error instanceof Error ? error.message : "Offer refresh failed.",
        });
      } catch {
        // Keep the original failure.
      }
    }

    return new Response(JSON.stringify({
      runId,
      error: error instanceof Error ? error.message : "Offer refresh failed.",
    }), { status: 500, headers: jsonHeaders });
  }
});
