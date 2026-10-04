import { catalogueAdminKey } from "../_shared/catalogue-admin-auth.ts";
import {
  enumerateJsonLdProductVariants,
  enumerateShopifyProductVariants,
  stableImportFingerprint,
  requireStableLogicalRunId,
  type UpstreamVariantDescriptor,
} from "../_shared/catalogue-import-core.ts";

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };
const EXPECTED_TOKEN_SHA256 =
  Deno.env.get("CATALOGUE_IMPORT_TOKEN_SHA256") ??
  "6b20b13426ac46cfbe69f75cb30378a87d535e94c4b4514dc7d821482fa758c0";

type AdapterRow = {
  id: string;
  source_id: string;
  adapter_key: string;
  adapter_type: string;
  version: number;
  active: boolean;
  max_batch_size: number;
  config: Record<string, unknown>;
};

type SourceRow = {
  id: string;
  name: string;
  base_url: string | null;
  verification_status: string;
};

type Category =
  | "frame"
  | "motors"
  | "flightController"
  | "esc"
  | "propellers"
  | "battery"
  | "camera"
  | "receiver";

type ParsedItem = {
  url: string;
  normalized: Record<string, unknown> | null;
  errors: string[];
};

const VALID_CATEGORIES = new Set<Category>([
  "frame", "motors", "flightController", "esc", "propellers", "battery", "camera", "receiver",
]);

function adminApiKey() {
  return catalogueAdminKey((name) => Deno.env.get(name));
}

async function adminRest<T>(path: string, init: RequestInit = {}, prefer?: string): Promise<T> {
  const baseUrl = Deno.env.get("SUPABASE_URL");
  if (!baseUrl) throw new Error("SUPABASE_URL unavailable.");
  const key = adminApiKey();
  const headers = new Headers(init.headers);
  headers.set("apikey", key);
  headers.set("accept", "application/json");
  if (!key.startsWith("sb_secret_")) headers.set("authorization", "Bearer " + key);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  if (prefer) headers.set("prefer", prefer);

  const response = await fetch(baseUrl + "/rest/v1/" + path.replace(/^\//, ""), {
    ...init,
    headers,
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error("Supabase admin request failed (" + response.status + "): " + body.slice(0, 700));
  }
  return body ? JSON.parse(body) as T : undefined as T;
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function authorized(req: Request) {
  const token = req.headers.get("x-catalogue-import-token");
  if (!token || token.length < 32) return false;
  return (await sha256Hex(token)) === EXPECTED_TOKEN_SHA256;
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function slugify(value: unknown) {
  return normalizeText(value).replace(/\s+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
}

function stripHtml(value: unknown) {
  return String(value ?? "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function matchesPattern(text: string, pattern: string) {
  try { return new RegExp(pattern, "i").test(text); } catch { return false; }
}

function matchesAnyPattern(text: string, patterns: string[]) {
  if (!patterns.length) return true;
  return patterns.some((pattern) => matchesPattern(text, pattern));
}

function xmlLocs(xml: string) {
  return [...xml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)]
    .map((match) => match[1]?.replace(/&amp;/g, "&").trim())
    .filter(Boolean) as string[];
}

function htmlLinks(html: string, baseUrl: string) {
  const out = new Set<string>();
  for (const match of html.matchAll(/href=["']([^"']+)["']/gi)) {
    const href = match[1]?.trim();
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) continue;
    try { out.add(new URL(href, baseUrl).toString()); } catch {}
  }
  return [...out];
}

async function fetchText(
  url: string,
  accept: string,
  options: { retryAttempts?: number; retryBaseDelayMs?: number } = {},
) {
  const attempts = Math.max(1, Math.min(Number(options.retryAttempts ?? 3), 5));
  const baseDelay = Math.max(250, Number(options.retryBaseDelayMs ?? 1000));

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(url, {
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "accept": accept,
          "accept-language": "en-US,en;q=0.8",
          "user-agent": "Mozilla/5.0 (compatible; DroneCoresCatalogueImporter/2.0; +https://dronecores.com)",
        },
      });
      if (response.ok) return await response.text();

      if ((response.status === 429 || response.status >= 500) && attempt < attempts) {
        const retryAfter = Number(response.headers.get("retry-after") ?? "0");
        const waitMs = retryAfter > 0 ? retryAfter * 1000 : baseDelay * Math.pow(2, attempt - 1);
        await sleep(Math.min(waitMs, 15000));
        continue;
      }
      throw new Error(url + " returned HTTP " + response.status);
    } catch (error) {
      if (attempt >= attempts) throw error;
      await sleep(Math.min(baseDelay * Math.pow(2, attempt - 1), 15000));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(url + " could not be fetched after retries");
}

function categoryRules(config: Record<string, unknown>) {
  const raw = Array.isArray(config.categoryRules) ? config.categoryRules : [];
  return raw.flatMap((rule) => {
    if (!rule || typeof rule !== "object") return [];
    const obj = rule as Record<string, unknown>;
    const category = String(obj.category ?? "") as Category;
    const pattern = String(obj.pattern ?? "");
    return VALID_CATEGORIES.has(category) && pattern ? [{ category, pattern }] : [];
  });
}

function categoryFromRules(text: string, rules: Array<{ category: Category; pattern: string }>) {
  for (const rule of rules) {
    if (matchesPattern(text, rule.pattern)) return rule.category;
  }
  return null;
}

function firstNumber(value: string | null | undefined) {
  if (!value) return null;
  const match = value.replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function applyRegexMappings(text: string, config: Record<string, unknown>) {
  const raw =
    config.regexMappings && typeof config.regexMappings === "object"
      ? config.regexMappings as Record<string, { pattern?: string; group?: number; type?: string }>
      : {};
  const mapped: Record<string, unknown> = {};

  for (const [field, spec] of Object.entries(raw)) {
    if (!spec?.pattern) continue;
    try {
      const match = new RegExp(spec.pattern, "i").exec(text);
      if (!match) continue;
      const group = Math.max(0, Number(spec.group ?? 1));
      const rawValue = match[group];
      if (rawValue === undefined) continue;
      if (spec.type === "string") {
        mapped[field] = rawValue.trim();
      } else {
        const number = firstNumber(rawValue);
        if (number === null || !Number.isFinite(number)) continue;
        mapped[field] = spec.type === "integer" ? Math.round(number) : number;
      }
    } catch {}
  }
  return mapped;
}

function collectObjects(value: unknown, out: Record<string, unknown>[] = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectObjects(item, out);
  } else if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    out.push(object);
    for (const child of Object.values(object)) collectObjects(child, out);
  }
  return out;
}

function parseJsonLd(html: string) {
  const out: unknown[] = [];
  const regex = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(regex)) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    try { out.push(JSON.parse(raw)); } catch {}
  }
  return out;
}

function isType(object: Record<string, unknown>, expected: string) {
  const raw = object["@type"];
  const values = Array.isArray(raw) ? raw : [raw];
  return values.some((value) => normalizeText(value) === normalizeText(expected));
}

function brandName(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") return String((value as Record<string, unknown>).name ?? "");
  return "";
}

function normalizeImageUrl(value: unknown, baseUrl: string) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw && typeof raw === "object") {
    const object = raw as Record<string, unknown>;
    return normalizeImageUrl(object.url ?? object.contentUrl ?? object.src, baseUrl);
  }
  if (!raw) return null;
  try { return new URL(String(raw), baseUrl).toString(); } catch { return null; }
}

function firstHtmlMatch(html: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = pattern.exec(html);
    const value = match?.[1] ? stripHtml(match[1]).trim() : "";
    if (value) return value;
  }
  return "";
}

function sourcePathId(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.pathname.replace(/\/$/, "").split("/").pop() || url;
  } catch {
    return url;
  }
}

function buildNormalizedBase(input: {
  url: string;
  name: string;
  manufacturer: string;
  source: SourceRow;
  config: Record<string, unknown>;
  identityText: string;
  evidenceText: string;
  description: string | null;
  imageUrl: string | null;
  sku?: string | null;
  mpn?: string | null;
  externalId: string;
  parentExternalId?: string | null;
  upstreamVariantId?: string | null;
  identityConflicts?: readonly string[];
  model?: string | null;
  displayName?: string | null;
  variant?: string | null;
}) {
  const rules = categoryRules(input.config);
  const category = categoryFromRules(input.identityText, rules);
  const eligibilityPatterns = Array.isArray(input.config.eligibilityPatternsAny)
    ? input.config.eligibilityPatternsAny.map(String)
    : [];
  const eligible = matchesAnyPattern(input.identityText, eligibilityPatterns);
  const excludeContentPatterns = Array.isArray(input.config.excludeContentPatterns)
    ? input.config.excludeContentPatterns.map(String)
    : [];
  const contentExcluded = excludeContentPatterns.some((pattern) => matchesPattern(input.identityText, pattern));
  const mapped = applyRegexMappings(input.evidenceText, input.config);
  const idPrefix = [
    "import",
    slugify(input.manufacturer || input.source.name),
    slugify(input.model || input.name || input.externalId),
    input.variant ? slugify(input.variant) : "",
  ].filter(Boolean).join("-").slice(0, 116);
  const idBase = (idPrefix + "-" + stableImportFingerprint(input.externalId)).slice(0, 128);

  const normalized: Record<string, unknown> = {
    id: idBase,
    category,
    manufacturer: input.manufacturer,
    model: input.model || input.name || input.externalId,
    variant: input.variant ?? null,
    display_name: input.displayName || input.name || input.externalId,
    mpn: input.mpn ?? null,
    manufacturer_sku: input.sku ?? null,
    spec_summary: input.description,
    image_url: input.imageUrl,
    image_source_url: input.url,
    image_alt: input.name || input.externalId,
    image_exact_model_verified: false,
    image_provenance: "Official manufacturer product-page image; exact-model association requires review.",
    source_external_product_id: input.externalId,
    source_external_parent_product_id: input.parentExternalId ?? null,
    source_external_variant_id: input.upstreamVariantId ?? null,
    identity_conflicts: [...(input.identityConflicts ?? [])],
    source_url: input.url,
    source_product_url: input.url,
    source_name: input.source.name,
    ...mapped,
  };

  const errors: string[] = [];
  if (!eligible || contentExcluded) errors.push("Product did not match this adapter's drone/FPV eligibility rules.");
  if (!input.name) errors.push("Missing exact product name.");
  if (!input.manufacturer) errors.push("Missing manufacturer.");
  if (!category) errors.push("Category could not be classified.");
  if (!input.sku && !input.mpn) errors.push("No SKU/MPN available; dedupe will fall back to source/model identity.");
  if (!input.imageUrl) errors.push("No manufacturer image discovered.");

  return { normalized, errors };
}

function normalizeVariantDescriptor(
  descriptor: UpstreamVariantDescriptor,
  source: SourceRow,
  config: Record<string, unknown>,
  manufacturer: string,
  extraIdentityText = "",
) {
  const identityText = [
    descriptor.sourceUrl,
    descriptor.model,
    descriptor.variant,
    descriptor.displayName,
    extraIdentityText,
  ].filter(Boolean).join(" ");
  const evidenceText = [
    descriptor.model,
    descriptor.variant,
    descriptor.displayName,
    descriptor.description,
  ].filter(Boolean).join(" ");

  return {
    url: descriptor.sourceUrl,
    ...buildNormalizedBase({
      url: descriptor.sourceUrl,
      name: descriptor.displayName,
      model: descriptor.model,
      displayName: descriptor.displayName,
      manufacturer,
      source,
      config,
      identityText,
      evidenceText,
      description: descriptor.description,
      imageUrl: descriptor.imageUrl,
      sku: descriptor.manufacturerSku,
      mpn: descriptor.mpn,
      externalId: descriptor.upstreamItemId,
      parentExternalId: descriptor.upstreamParentProductId,
      upstreamVariantId: descriptor.upstreamVariantId,
      identityConflicts: descriptor.identityConflicts,
      variant: descriptor.variant,
    }),
  };
}

function normalizeProductPageVariants(
  url: string,
  html: string,
  source: SourceRow,
  config: Record<string, unknown>,
): ParsedItem[] {
  const descriptors = enumerateJsonLdProductVariants(html, url);
  if (descriptors.length) {
    return descriptors.map((descriptor) => {
      const rawProduct =
        descriptor.rawPayload.product &&
        typeof descriptor.rawPayload.product === "object"
          ? descriptor.rawPayload.product as Record<string, unknown>
          : {};
      const manufacturer =
        brandName(rawProduct.brand) ||
        String(config.manufacturer ?? source.name).trim();
      return normalizeVariantDescriptor(descriptor, source, config, manufacturer);
    });
  }

  let name = firstHtmlMatch(html, [
    /<meta\b[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["'][^>]*>/i,
    /<title\b[^>]*>([\s\S]*?)<\/title>/i,
    /<h1\b[^>]*>([\s\S]*?)<\/h1>/i,
  ]);
  if (
    config.preferUrlNameFallback === true ||
    !name ||
    /^(?:my[ ]+)?cart$/i.test(name) ||
    /^home$/i.test(name) ||
    /world fpv drone leading company/i.test(name)
  ) {
    name = sourcePathId(url)
      .replace(/-g-[0-9]+$/i, "")
      .replace(/-p[0-9]+(?:[.]html)?$/i, "")
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (value) => value.toUpperCase())
      .trim();
  }
  const description = firstHtmlMatch(html, [
    /<meta\b[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i,
    /<meta\b[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["'][^>]*>/i,
  ]).slice(0, 700) || null;
  const imageCandidate = firstHtmlMatch(html, [
    /<meta\b[^>]*property=["']og:image(?::secure_url)?["'][^>]*content=["']([^"']+)["'][^>]*>/i,
  ]);
  const imageUrl = normalizeImageUrl(imageCandidate || null, url);
  const manufacturer = String(config.manufacturer ?? source.name).trim();
  const externalId = "page:" + sourcePathId(url);
  const identityText = [url, name].join(" ");
  const evidenceText = [name, description].filter(Boolean).join(" ");
  return [{
    url,
    ...buildNormalizedBase({
      url,
      name,
      model: name,
      displayName: name,
      manufacturer,
      source,
      config,
      identityText,
      evidenceText,
      description,
      imageUrl,
      sku: null,
      mpn: null,
      externalId,
      parentExternalId: externalId,
      upstreamVariantId: null,
      identityConflicts: [],
      variant: null,
    }),
  }];
}

type ShopifyProduct = {
  id?: string | number;
  title?: string;
  handle?: string;
  body_html?: string;
  vendor?: string;
  product_type?: string;
  tags?: string | string[];
  variants?: Array<Record<string, unknown>>;
  images?: Array<Record<string, unknown>>;
};

function normalizeShopifyProductVariants(
  product: ShopifyProduct,
  source: SourceRow,
  config: Record<string, unknown>,
): ParsedItem[] {
  const manufacturer = String(config.manufacturer ?? product.vendor ?? source.name).trim();
  const tags = Array.isArray(product.tags) ? product.tags.join(" ") : String(product.tags ?? "");
  const extraIdentityText = [product.product_type, tags].filter(Boolean).join(" ");

  return enumerateShopifyProductVariants(product, source.base_url ?? "")
    .map((descriptor) =>
      normalizeVariantDescriptor(
        descriptor,
        source,
        config,
        manufacturer,
        extraIdentityText,
      )
    );
}

async function discoverSitemapProductUrls(config: Record<string, unknown>) {
  const sitemapUrl = String(config.sitemapUrl ?? "").trim();
  if (!sitemapUrl) throw new Error("Adapter config.sitemapUrl is required.");

  const includePatterns = Array.isArray(config.includePatterns) ? config.includePatterns.map(String) : [];
  const excludePatterns = Array.isArray(config.excludePatterns) ? config.excludePatterns.map(String) : [];
  const productSitemapPatterns = Array.isArray(config.productSitemapPatterns)
    ? config.productSitemapPatterns.map(String)
    : [];
  const productUrlPatterns = Array.isArray(config.productUrlPatterns)
    ? config.productUrlPatterns.map(String)
    : [];
  const maxSitemapDocuments = Math.max(1, Math.min(Number(config.maxSitemapDocuments ?? 50), 200));
  const maxDiscoveredProducts = Math.max(100, Math.min(Number(config.maxDiscoveredProducts ?? 10000), 50000));
  const queue = [sitemapUrl];
  const visited = new Set<string>();
  const products = new Set<string>();

  while (queue.length && visited.size < maxSitemapDocuments && products.size < maxDiscoveredProducts) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    const xml = await fetchText(current, "application/xml,text/xml;q=0.9,*/*;q=0.5", {
      retryAttempts: Number(config.retryAttempts ?? 3),
      retryBaseDelayMs: Number(config.retryBaseDelayMs ?? 1000),
    });
    const locs = xmlLocs(xml);

    if (/<sitemapindex\b/i.test(xml)) {
      const children = productSitemapPatterns.length
        ? locs.filter((loc) => matchesAnyPattern(loc, productSitemapPatterns))
        : locs.filter((loc) => /sitemap/i.test(loc));
      for (const child of children) if (!visited.has(child)) queue.push(child);
      continue;
    }

    for (const loc of locs) {
      const productMatch = productUrlPatterns.length
        ? matchesAnyPattern(loc, productUrlPatterns)
        : includePatterns.length
          ? matchesAnyPattern(loc, includePatterns)
          : true;
      const excluded = excludePatterns.some((pattern) => matchesPattern(loc, pattern));
      if (productMatch && !excluded) products.add(loc);
      if (products.size >= maxDiscoveredProducts) break;
    }
  }
  return [...products].sort();
}

async function discoverCategoryProductUrls(config: Record<string, unknown>) {
  const listingUrls = Array.isArray(config.listingUrls) ? config.listingUrls.map(String) : [];
  if (!listingUrls.length) throw new Error("Adapter config.listingUrls is required for category_html.");
  const productUrlPatterns = Array.isArray(config.productUrlPatterns) ? config.productUrlPatterns.map(String) : [];
  const excludePatterns = Array.isArray(config.excludePatterns) ? config.excludePatterns.map(String) : [];
  const products = new Set<string>();

  for (const listingUrl of listingUrls) {
    const html = await fetchText(listingUrl, "text/html,application/xhtml+xml", {
      retryAttempts: Number(config.retryAttempts ?? 3),
      retryBaseDelayMs: Number(config.retryBaseDelayMs ?? 1000),
    });
    for (const url of htmlLinks(html, listingUrl)) {
      const productMatch = productUrlPatterns.length ? matchesAnyPattern(url, productUrlPatterns) : true;
      const excluded = excludePatterns.some((pattern) => matchesPattern(url, pattern));
      if (productMatch && !excluded) products.add(url);
    }
  }
  return [...products].sort();
}

async function fetchShopifyProducts(config: Record<string, unknown>, page: number, pageSize: number) {
  const endpoint = String(config.productsEndpoint ?? "").trim();
  if (!endpoint) throw new Error("Adapter config.productsEndpoint is required for shopify_products_json.");
  const url = new URL(endpoint);
  url.searchParams.set("page", String(page));
  url.searchParams.set("limit", String(Math.min(pageSize, 250)));
  const body = await fetchText(url.toString(), "application/json", {
    retryAttempts: Number(config.retryAttempts ?? 3),
    retryBaseDelayMs: Number(config.retryBaseDelayMs ?? 1000),
  });
  const parsed = JSON.parse(body) as { products?: ShopifyProduct[] };
  return Array.isArray(parsed.products) ? parsed.products : [];
}

async function mapConcurrent<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
) {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, Math.max(1, items.length)) }, worker));
  return results;
}

async function discoverAdapterBatch(
  config: Record<string, unknown>,
  source: SourceRow,
  cursor: number,
  limit: number,
) {
  const mode = String(config.discoveryMode ?? "sitemap").trim();

  if (mode === "shopify_products_json") {
    const page = Math.max(1, cursor || 1);
    const pageSize = Math.min(limit, 250);
    const products = await fetchShopifyProducts(config, page, pageSize);
    const parsed = products.flatMap((product) =>
      normalizeShopifyProductVariants(product, source, config)
    );
    const hasMore = products.length === pageSize;
    return {
      parsed,
      selectedUrls: [...new Set(parsed.map((item) => item.url))],
      totalAvailable: null as number | null,
      nextCursor: hasMore ? String(page + 1) : null,
      hasMore,
    };
  }

  const allUrls = mode === "category_html"
    ? await discoverCategoryProductUrls(config)
    : await discoverSitemapProductUrls(config);
  const offset = Math.max(0, cursor);
  const selectedUrls = allUrls.slice(offset, offset + limit);
  const hasMore = offset + selectedUrls.length < allUrls.length;
  const nextCursor = hasMore ? String(offset + selectedUrls.length) : null;

  const concurrency = Math.max(1, Math.min(Number(config.concurrency ?? 3), 8));
  const requestDelayMs = Math.max(0, Math.min(Number(config.requestDelayMs ?? 150), 5000));
  const retryAttempts = Math.max(1, Math.min(Number(config.retryAttempts ?? 3), 5));
  const retryBaseDelayMs = Math.max(250, Number(config.retryBaseDelayMs ?? 1000));

  const parsed = await mapConcurrent(selectedUrls, concurrency, async (url): Promise<ParsedItem[]> => {
    try {
      const html = await fetchText(url, "text/html,application/xhtml+xml", {
        retryAttempts,
        retryBaseDelayMs,
      });
      if (requestDelayMs) await sleep(requestDelayMs);
      return normalizeProductPageVariants(url, html, source, config);
    } catch (error) {
      return [{
        url,
        normalized: null,
        errors: [error instanceof Error ? error.message : "Product fetch failed."],
      }];
    }
  });

  return {
    parsed: parsed.flat(),
    selectedUrls,
    totalAvailable: allUrls.length,
    nextCursor,
    hasMore,
  };
}

function isEligibleParsedItem(item: ParsedItem) {
  return Boolean(
    item.normalized &&
    item.normalized.category &&
    !item.errors.some((message) => message.includes("eligibility rules")),
  );
}

async function updateAdapterStatus(adapterId: string, values: Record<string, unknown>) {
  await adminRest(
    "catalogue_source_adapters?id=eq." + encodeURIComponent(adapterId),
    { method: "PATCH", body: JSON.stringify(values) },
  );
}

async function createCandidatesFromBatch(batchId: string, source: SourceRow, adapter: AdapterRow) {
  let candidatesCreated = 0;
  const candidateFailures: Array<{ importRowId: number; error: string }> = [];
  const evidenceSeedFailures: Array<{ importRowId: number; error: string }> = [];

  const newRows = await adminRest<Array<{ id: number; normalized_data: Record<string, unknown> }>>(
    "catalogue_import_rows?select=id,normalized_data&batch_id=eq." +
      encodeURIComponent(batchId) +
      "&dedupe_status=eq.new&status=eq.validated&order=row_number.asc",
  );

  for (const row of newRows) {
    let created = false;
    try {
      await adminRest(
        "rpc/catalogue_create_candidate_from_deduped_import",
        {
          method: "POST",
          body: JSON.stringify({
            p_import_row_id: row.id,
            p_reviewer: "DroneCores automated manufacturer importer",
            p_notes: "Candidate only. Publication still requires verified identity, technical evidence, technical review, verified EU/EUR offer, and the publication gate.",
          }),
        },
      );
      candidatesCreated += 1;
      created = true;
    } catch (error) {
      candidateFailures.push({
        importRowId: row.id,
        error: error instanceof Error ? error.message.slice(0, 500) : "Candidate creation failed",
      });
    }

    if (!created) continue;
    try {
      const normalized = row.normalized_data ?? {};
      const productId = String(normalized.id ?? "");
      const sourceUrl = String(normalized.source_url ?? "");
      const manufacturer = String(normalized.manufacturer ?? "");
      const model = String(normalized.model ?? normalized.display_name ?? "");
      const variant = normalized.variant ? String(normalized.variant) : null;
      if (!(productId && sourceUrl && manufacturer && model)) {
        throw new Error("Candidate evidence seed data is incomplete.");
      }

      await adminRest(
        "catalogue_identity_evidence",
        {
          method: "POST",
          body: JSON.stringify({
            product_id: productId,
            source_id: source.id,
            source_url: sourceUrl,
            authority: "manufacturer",
            manufacturer_label: manufacturer,
            model_label: model,
            variant_label: variant,
            exact_model_association: true,
            verification_status: "pending_review",
            retrieved_at: new Date().toISOString(),
            caveats: "Automatically staged from an official manufacturer adapter; human verification is required before canonical promotion.",
          }),
        },
      );

      const fieldMap: Record<string, string> = {
        frameInches: "frame_size_inches",
        mount: "motor_mount_pattern",
        propInches: "propeller_diameter_inches",
        motorSize: "motor_size_code",
        minVoltage: "min_battery_cells",
        maxVoltage: "max_battery_cells",
        connector: "connector",
        escInput: "esc_input",
        escAmps: "esc_amps",
        voltage: "battery_cells",
        batteryMah: "battery_capacity_mah",
        cameraVideoInterface: "camera_video_interface",
        cameraMinVoltageV: "camera_min_voltage_v",
        cameraMaxVoltageV: "camera_max_voltage_v",
        fcCameraVideoInterfaces: "fc_camera_video_interfaces",
        fcCameraPowerVoltagesV: "fc_camera_power_voltages_v",
        receiverProtocol: "receiver_protocol",
        receiverFrequencyMinMhz: "receiver_frequency_min_mhz",
        receiverFrequencyMaxMhz: "receiver_frequency_max_mhz",
        receiverMinVoltageV: "receiver_min_voltage_v",
        receiverMaxVoltageV: "receiver_max_voltage_v",
        receiverSignalInterface: "receiver_signal_interface",
        fcReceiverSignalInterfaces: "fc_receiver_signal_interfaces",
        fcReceiverPowerVoltagesV: "fc_receiver_power_voltages_v",
      };

      const requirements = await adminRest<Array<{ field_key: string }>>(
        "catalogue_category_field_requirements?select=field_key&category=eq." +
          encodeURIComponent(String(normalized.category ?? "")),
      );
      const evidenceRows = requirements.flatMap(({ field_key }) => {
        const normalizedKey = fieldMap[field_key] ?? field_key;
        const value = normalized[normalizedKey];
        if (value === null || value === undefined || value === "") return [];
        return [{
          product_id: productId,
          field_key,
          value,
          source_id: source.id,
          source_url: sourceUrl,
          authority: "manufacturer",
          exact_model_association: true,
          verification_status: "pending_review",
          retrieved_at: new Date().toISOString(),
          conditions: {
            importAdapterKey: adapter.adapter_key,
            importAdapterVersion: adapter.version,
            extraction: "structured_or_configured_regex",
          },
          caveats: "Automatically extracted from the exact manufacturer product page; verification is required before technical promotion.",
        }];
      });
      if (evidenceRows.length) {
        await adminRest("catalogue_spec_evidence", {
          method: "POST",
          body: JSON.stringify(evidenceRows),
        });
      }
    } catch (error) {
      evidenceSeedFailures.push({
        importRowId: row.id,
        error: error instanceof Error ? error.message.slice(0, 500) : "Evidence seeding failed",
      });
    }
  }

  return { candidatesCreated, candidateFailures, evidenceSeedFailures };
}


type DurableRun = {
  runId: string;
  logicalRunId: string;
  status: string;
  manifestComplete: boolean;
  manifestHash: string | null;
  nextCursor: string | null;
  discoveryState?: Record<string, unknown>;
  hasMore: boolean;
};

type ClaimedRunItem = {
  id: number;
  upstreamItemId: string;
  parentUpstreamItemId: string | null;
  upstreamParentProductId: string | null;
  upstreamVariantId: string | null;
  itemKind: string;
  sourceUrl: string;
  discoveryOrdinal: number;
  discoveryStatus: string;
  processingStatus: string;
  rawPayload: Record<string, unknown>;
  normalizedData: Record<string, unknown> | null;
  errors: string[];
  attemptCount: number;
};

type ManifestItemInput = {
  upstreamItemId: string;
  sourceUrl: string;
  itemKind: "product" | "product_page" | "variant";
  discoveryStatus: "discovered" | "ready" | "excluded";
  upstreamParentProductId?: string | null;
  upstreamVariantId?: string | null;
  rawPayload?: Record<string, unknown>;
  normalizedData?: Record<string, unknown> | null;
  errors?: string[];
};

type DiscoveryState = {
  pass: number;
  insertedInPass: number;
};

function discoveryState(value: Record<string, unknown> | undefined): DiscoveryState {
  const pass = Math.max(1, Number(value?.pass ?? 1) || 1);
  const insertedInPass = Math.max(0, Number(value?.insertedInPass ?? 0) || 0);
  return { pass, insertedInPass };
}

function pageManifestId(url: string) {
  return "page:url:" + url;
}

function parsedDiscoveryStatus(item: ParsedItem): "ready" | "excluded" | "discovered" {
  if (!item.normalized) return "discovered";
  if (item.errors.some((message) => message.includes("eligibility rules"))) return "excluded";
  if (!item.normalized.category) return "discovered";
  return "ready";
}

async function getOrCreateDurableRun(
  adapter: AdapterRow,
  source: SourceRow,
  requestedLogicalRunId: string,
) {
  const logicalRunId = requireStableLogicalRunId(requestedLogicalRunId);

  return adminRest<DurableRun>("rpc/catalogue_get_or_create_import_run", {
    method: "POST",
    body: JSON.stringify({
      p_adapter_id: adapter.id,
      p_source_id: source.id,
      p_logical_run_id: logicalRunId,
      p_manifest_version: 1,
    }),
  });
}

async function readDurableRun(runId: string) {
  const rows = await adminRest<Array<{
    id: string;
    logical_run_id: string;
    status: string;
    manifest_complete: boolean;
    manifest_hash: string | null;
    next_cursor: string | null;
    discovery_state: Record<string, unknown> | null;
    has_more: boolean;
    discovered_count: number;
    staged_count: number;
    excluded_count: number;
    failed_count: number;
    review_count: number;
    completed_count: number;
    last_error: string | null;
  }>>(
    "catalogue_import_runs?select=*" +
      "&id=eq." + encodeURIComponent(runId) +
      "&limit=1",
  );
  return rows[0] ?? null;
}

async function upsertManifestItems(input: {
  runId: string;
  items: ManifestItemInput[];
  pass: number;
  nextCursor: string | null;
  state: DiscoveryState;
  complete: boolean;
}) {
  return adminRest<{
    runId: string;
    insertedCount: number;
    discoveredCount: number;
    manifestComplete: boolean;
    manifestHash: string | null;
    nextCursor: string | null;
    discoveryState: DiscoveryState;
  }>("rpc/catalogue_upsert_import_manifest_items", {
    method: "POST",
    body: JSON.stringify({
      p_run_id: input.runId,
      p_items: input.items,
      p_discovery_pass: input.pass,
      p_next_cursor: input.nextCursor,
      p_discovery_state: input.state,
      p_discovery_complete: input.complete,
    }),
  });
}

async function markRunError(runId: string, error: unknown, terminal = false) {
  const message = error instanceof Error ? error.message : String(error ?? "Import run failed");
  return adminRest("rpc/catalogue_mark_import_run_error", {
    method: "POST",
    body: JSON.stringify({
      p_run_id: runId,
      p_error: message.slice(0, 1000),
      p_terminal: terminal,
    }),
  });
}

async function discoverSitemapManifestCandidates(config: Record<string, unknown>) {
  const sitemapUrl = String(config.sitemapUrl ?? "").trim();
  if (!sitemapUrl) throw new Error("Adapter config.sitemapUrl is required.");

  const includePatterns = Array.isArray(config.includePatterns) ? config.includePatterns.map(String) : [];
  const excludePatterns = Array.isArray(config.excludePatterns) ? config.excludePatterns.map(String) : [];
  const productSitemapPatterns = Array.isArray(config.productSitemapPatterns)
    ? config.productSitemapPatterns.map(String)
    : [];
  const productUrlPatterns = Array.isArray(config.productUrlPatterns)
    ? config.productUrlPatterns.map(String)
    : [];
  const maxSitemapDocuments = Math.max(1, Math.min(Number(config.maxSitemapDocuments ?? 50), 200));
  const maxDiscoveredProducts = Math.max(100, Math.min(Number(config.maxDiscoveredProducts ?? 10000), 50000));
  const queue = [sitemapUrl];
  const visited = new Set<string>();
  const products = new Map<string, boolean>();

  while (queue.length && visited.size < maxSitemapDocuments && products.size < maxDiscoveredProducts) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    const xml = await fetchText(current, "application/xml,text/xml;q=0.9,*/*;q=0.5", {
      retryAttempts: Number(config.retryAttempts ?? 3),
      retryBaseDelayMs: Number(config.retryBaseDelayMs ?? 1000),
    });
    const locs = xmlLocs(xml);
    if (/<sitemapindex\b/i.test(xml)) {
      const children = productSitemapPatterns.length
        ? locs.filter((loc) => matchesAnyPattern(loc, productSitemapPatterns))
        : locs.filter((loc) => /sitemap/i.test(loc));
      for (const child of children) if (!visited.has(child)) queue.push(child);
      continue;
    }

    for (const loc of locs) {
      const productMatch = productUrlPatterns.length
        ? matchesAnyPattern(loc, productUrlPatterns)
        : includePatterns.length
          ? matchesAnyPattern(loc, includePatterns)
          : true;
      if (!productMatch) continue;
      const excluded = excludePatterns.some((pattern) => matchesPattern(loc, pattern));
      products.set(loc, excluded);
      if (products.size >= maxDiscoveredProducts) break;
    }
  }

  return [...products.entries()]
    .map(([url, excluded]) => ({ url, excluded }))
    .sort((a, b) => a.url.localeCompare(b.url));
}

async function discoverCategoryManifestCandidates(config: Record<string, unknown>) {
  const listingUrls = Array.isArray(config.listingUrls) ? config.listingUrls.map(String) : [];
  if (!listingUrls.length) throw new Error("Adapter config.listingUrls is required for category_html.");
  const productUrlPatterns = Array.isArray(config.productUrlPatterns) ? config.productUrlPatterns.map(String) : [];
  const excludePatterns = Array.isArray(config.excludePatterns) ? config.excludePatterns.map(String) : [];
  const products = new Map<string, boolean>();

  for (const listingUrl of listingUrls) {
    const html = await fetchText(listingUrl, "text/html,application/xhtml+xml", {
      retryAttempts: Number(config.retryAttempts ?? 3),
      retryBaseDelayMs: Number(config.retryBaseDelayMs ?? 1000),
    });
    for (const url of htmlLinks(html, listingUrl)) {
      const productMatch = productUrlPatterns.length ? matchesAnyPattern(url, productUrlPatterns) : true;
      if (!productMatch) continue;
      const excluded = excludePatterns.some((pattern) => matchesPattern(url, pattern));
      products.set(url, excluded);
    }
  }

  return [...products.entries()]
    .map(([url, excluded]) => ({ url, excluded }))
    .sort((a, b) => a.url.localeCompare(b.url));
}

async function persistDiscoveryPage(
  run: DurableRun,
  pass: number,
  state: DiscoveryState,
  items: ManifestItemInput[],
  nextCursor: string | null,
  sourceHasMore: boolean,
) {
  const first = await upsertManifestItems({
    runId: run.runId,
    items,
    pass,
    nextCursor,
    state,
    complete: false,
  });
  const insertedInPass = state.insertedInPass + Number(first.insertedCount ?? 0);

  if (sourceHasMore) {
    const nextState = { pass, insertedInPass };
    await upsertManifestItems({
      runId: run.runId,
      items: [],
      pass,
      nextCursor,
      state: nextState,
      complete: false,
    });
    return {
      complete: false,
      nextCursor,
      state: nextState,
      insertedCount: Number(first.insertedCount ?? 0),
      discoveredCount: first.discoveredCount,
    };
  }

  if (pass >= 2 && insertedInPass === 0) {
    const finalState = { pass, insertedInPass: 0 };
    const finalized = await upsertManifestItems({
      runId: run.runId,
      items: [],
      pass,
      nextCursor: null,
      state: finalState,
      complete: true,
    });
    return {
      complete: true,
      nextCursor: null,
      state: finalState,
      insertedCount: Number(first.insertedCount ?? 0),
      discoveredCount: finalized.discoveredCount,
      manifestHash: finalized.manifestHash,
    };
  }

  const nextState = { pass: pass + 1, insertedInPass: 0 };
  await upsertManifestItems({
    runId: run.runId,
    items: [],
    pass,
    nextCursor: null,
    state: nextState,
    complete: false,
  });
  return {
    complete: false,
    nextCursor: null,
    state: nextState,
    insertedCount: Number(first.insertedCount ?? 0),
    discoveredCount: first.discoveredCount,
  };
}

async function advanceDurableDiscovery(
  run: DurableRun,
  adapter: AdapterRow,
  source: SourceRow,
  limit: number,
) {
  const config = adapter.config ?? {};
  const mode = String(config.discoveryMode ?? "sitemap").trim();
  const state = discoveryState(run.discoveryState);
  const pass = state.pass;

  if (mode === "shopify_products_json") {
    const page = Math.max(1, Number.parseInt(run.nextCursor ?? "1", 10) || 1);
    const pageSize = Math.min(Math.max(limit, 25), 250);
    const products = await fetchShopifyProducts(config, page, pageSize);
    const parsed = products.flatMap((product) =>
      normalizeShopifyProductVariants(product, source, config)
    );
    const items: ManifestItemInput[] = parsed.flatMap((item) => {
      const upstreamItemId = String(item.normalized?.source_external_product_id ?? "").trim();
      if (!upstreamItemId) return [];
      return [{
        upstreamItemId,
        sourceUrl: item.url,
        itemKind: "variant",
        discoveryStatus: parsedDiscoveryStatus(item),
        upstreamParentProductId:
          item.normalized?.source_external_parent_product_id == null
            ? null
            : String(item.normalized.source_external_parent_product_id),
        upstreamVariantId:
          item.normalized?.source_external_variant_id == null
            ? null
            : String(item.normalized.source_external_variant_id),
        rawPayload: {
          source: "shopify_products_json",
          discoveryPage: page,
        },
        normalizedData: item.normalized,
        errors: item.errors,
      }];
    });
    const sourceHasMore = products.length === pageSize;
    return persistDiscoveryPage(
      run,
      pass,
      state,
      items,
      sourceHasMore ? String(page + 1) : null,
      sourceHasMore,
    );
  }

  const candidates = mode === "category_html"
    ? await discoverCategoryManifestCandidates(config)
    : await discoverSitemapManifestCandidates(config);
  const after = run.nextCursor ?? "";
  const discoveryLimit = Math.min(Math.max(limit * 4, 100), 1000);
  const remaining = candidates.filter((item) => !after || item.url > after);
  const selected = remaining.slice(0, discoveryLimit);
  const sourceHasMore = remaining.length > selected.length;
  const nextCursor = sourceHasMore ? selected[selected.length - 1]?.url ?? null : null;
  const items: ManifestItemInput[] = selected.map(({ url, excluded }) => ({
    upstreamItemId: pageManifestId(url),
    sourceUrl: url,
    itemKind: "product_page",
    discoveryStatus: excluded ? "excluded" : "discovered",
    rawPayload: {
      source: mode,
      excludedByAdapterRule: excluded,
    },
    errors: excluded ? ["Excluded by adapter discovery rule."] : [],
  }));

  return persistDiscoveryPage(run, pass, state, items, nextCursor, sourceHasMore);
}

async function findStagedRunBatch(runId: string) {
  const items = await adminRest<Array<{ batch_id: string | null }>>(
    "catalogue_import_run_items?select=batch_id" +
      "&run_id=eq." + encodeURIComponent(runId) +
      "&processing_status=eq.staged" +
      "&batch_id=not.is.null" +
      "&order=discovery_ordinal.asc&limit=1",
  );
  return items[0]?.batch_id ?? null;
}

async function processDurableBatch(batchId: string, createCandidates: boolean) {
  return adminRest<Record<string, unknown>>("rpc/catalogue_process_import_batch", {
    method: "POST",
    body: JSON.stringify({
      p_batch_id: batchId,
      p_create_candidates: createCandidates,
      p_reviewer: "DroneCores durable manufacturer importer",
    }),
  });
}

async function claimRunItems(
  runId: string,
  limit: number,
  maxAttempts: number,
  retryExhausted: boolean,
) {
  return adminRest<{ runId: string; items: ClaimedRunItem[] }>(
    "rpc/catalogue_claim_import_run_items",
    {
      method: "POST",
      body: JSON.stringify({
        p_run_id: runId,
        p_limit: Math.min(limit, 500),
        p_max_attempts: maxAttempts,
        p_retry_exhausted: retryExhausted,
      }),
    },
  );
}

function resultForStoredVariant(item: ClaimedRunItem) {
  if (!item.normalizedData) {
    return {
      upstreamItemId: item.upstreamItemId,
      outcome: "parse_failed",
      sourceUrl: item.sourceUrl,
      errors: item.errors,
      lastError: "Stored manufacturer variant has no normalized data.",
    };
  }
  if (item.errors.some((message) => message.includes("eligibility rules"))) {
    return {
      upstreamItemId: item.upstreamItemId,
      outcome: "excluded",
      sourceUrl: item.sourceUrl,
      normalizedData: item.normalizedData,
      errors: item.errors,
      lastError: null,
    };
  }
  if (!item.normalizedData.category) {
    return {
      upstreamItemId: item.upstreamItemId,
      outcome: "parse_failed",
      sourceUrl: item.sourceUrl,
      normalizedData: item.normalizedData,
      errors: item.errors,
      lastError: "Stored manufacturer variant could not be classified into a component category.",
    };
  }
  return {
    upstreamItemId: item.upstreamItemId,
    outcome: "ready",
    sourceUrl: item.sourceUrl,
    upstreamParentProductId: item.upstreamParentProductId,
    upstreamVariantId: item.upstreamVariantId,
    normalizedData: item.normalizedData,
    errors: item.errors,
    rawData: {
      sourceProductUrl: item.sourceUrl,
      upstreamItemId: item.upstreamItemId,
    },
  };
}

async function processClaimedPageItem(
  item: ClaimedRunItem,
  source: SourceRow,
  config: Record<string, unknown>,
) {
  try {
    const html = await fetchText(item.sourceUrl, "text/html,application/xhtml+xml", {
      retryAttempts: Number(config.retryAttempts ?? 3),
      retryBaseDelayMs: Number(config.retryBaseDelayMs ?? 1000),
    });
    const parsed = normalizeProductPageVariants(item.sourceUrl, html, source, config);
    if (!parsed.length) {
      return [{
        upstreamItemId: item.upstreamItemId,
        outcome: "parse_failed",
        sourceUrl: item.sourceUrl,
        errors: ["No product variant could be parsed from the manufacturer page."],
        lastError: "No product variant could be parsed from the manufacturer page.",
      }];
    }

    const results: Record<string, unknown>[] = [{
      upstreamItemId: item.upstreamItemId,
      outcome: "expanded",
      sourceUrl: item.sourceUrl,
      errors: [],
    }];

    parsed.forEach((parsedItem, index) => {
      const normalized = parsedItem.normalized;
      const upstreamItemId = String(
        normalized?.source_external_product_id ??
          item.upstreamItemId + ":parsed:" + stableImportFingerprint([index, parsedItem.url]),
      );
      const outcome = !normalized
        ? "parse_failed"
        : parsedItem.errors.some((message) => message.includes("eligibility rules"))
          ? "excluded"
          : normalized.category
            ? "ready"
            : "parse_failed";
      results.push({
        upstreamItemId,
        parentUpstreamItemId: item.upstreamItemId,
        upstreamParentProductId:
          normalized?.source_external_parent_product_id ?? item.upstreamParentProductId,
        upstreamVariantId: normalized?.source_external_variant_id ?? null,
        itemKind: "variant",
        outcome,
        sourceUrl: parsedItem.url,
        normalizedData: normalized,
        errors: parsedItem.errors,
        lastError: outcome === "parse_failed"
          ? parsedItem.errors.join(" | ") || "Product parsing failed."
          : null,
        rawPayload: {
          source: "manufacturer_product_page",
          parentUpstreamItemId: item.upstreamItemId,
        },
        rawData: {
          sourceProductUrl: parsedItem.url,
          upstreamItemId,
        },
      });
    });

    return results;
  } catch (error) {
    return [{
      upstreamItemId: item.upstreamItemId,
      outcome: "fetch_failed",
      sourceUrl: item.sourceUrl,
      errors: [error instanceof Error ? error.message : "Product fetch failed."],
      lastError: error instanceof Error ? error.message : "Product fetch failed.",
    }];
  }
}

async function advanceDurableProcessing(input: {
  run: DurableRun;
  source: SourceRow;
  adapter: AdapterRow;
  limit: number;
  maxAttempts: number;
  retryExhausted: boolean;
  createCandidates: boolean;
}) {
  const existingBatchId = await findStagedRunBatch(input.run.runId);
  if (existingBatchId) {
    const processed = await processDurableBatch(existingBatchId, input.createCandidates);
    return { phase: "recovered_batch", batchId: existingBatchId, processed };
  }

  const claimed = await claimRunItems(
    input.run.runId,
    input.limit,
    input.maxAttempts,
    input.retryExhausted,
  );
  if (!claimed.items.length) {
    const state = await adminRest<Record<string, unknown>>(
      "rpc/catalogue_refresh_import_run_state",
      { method: "POST", body: JSON.stringify({ p_run_id: input.run.runId }) },
    );
    return { phase: "idle", state };
  }

  const resultGroups = await mapConcurrent(
    claimed.items,
    Math.max(1, Math.min(Number(input.adapter.config?.concurrency ?? 3), 8)),
    async (item) => {
      if (item.itemKind === "variant" && item.normalizedData) {
        return [resultForStoredVariant(item)];
      }
      return processClaimedPageItem(item, input.source, input.adapter.config ?? {});
    },
  );
  const results = resultGroups.flat();
  const chunkKey = "items-" + stableImportFingerprint(
    claimed.items.map((item) => item.upstreamItemId).sort(),
  );
  let staged: {
    runId: string;
    batchId: string;
    totalRows: number;
    validRows: number;
    invalidRows: number;
  };
  try {
    staged = await adminRest<{
      runId: string;
      batchId: string;
      totalRows: number;
      validRows: number;
      invalidRows: number;
    }>("rpc/catalogue_stage_import_run_chunk", {
      method: "POST",
      body: JSON.stringify({
        p_run_id: input.run.runId,
        p_chunk_key: chunkKey,
        p_results: results,
      }),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Import chunk staging failed.";
    try {
      await adminRest("rpc/catalogue_release_import_run_claims", {
        method: "POST",
        body: JSON.stringify({
          p_run_id: input.run.runId,
          p_item_ids: claimed.items.map((item) => item.id),
          p_error: message.slice(0, 1000),
        }),
      });
    } catch (releaseError) {
      const releaseMessage =
        releaseError instanceof Error ? releaseError.message : String(releaseError);
      throw new Error(
        "Import chunk staging failed and claim release also failed. " +
          "Staging error: " + message + " Claim release error: " + releaseMessage,
      );
    }
    throw error;
  }

  let processed: Record<string, unknown> | null = null;
  if (Number(staged.totalRows ?? 0) > 0) {
    processed = await processDurableBatch(staged.batchId, input.createCandidates);
  } else {
    processed = await adminRest<Record<string, unknown>>(
      "rpc/catalogue_refresh_import_run_state",
      { method: "POST", body: JSON.stringify({ p_run_id: input.run.runId }) },
    );
  }

  return {
    phase: "processed_chunk",
    chunkKey,
    claimedCount: claimed.items.length,
    resultCount: results.length,
    staged,
    processed,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: JSON_HEADERS,
    });
  }
  if (!(await authorized(req))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: JSON_HEADERS,
    });
  }

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch {}

  const adapterKey = String(body.adapterKey ?? "").trim();
  const dryRun = body.dryRun !== false;
  const createCandidates = body.createCandidates === true;
  const requestedLimit = Math.max(1, Math.min(Number(body.limit ?? 100), 500));
  const rawCursor = String(body.cursor ?? "").trim();
  const requestedCursor = Math.max(0, Number.parseInt(rawCursor || "0", 10) || 0);
  const requestedLogicalRunIdRaw = body.logicalRunId ?? body.sourceRunId ?? "";
  let requestedLogicalRunId = "";
  if (!dryRun) {
    try {
      requestedLogicalRunId = requireStableLogicalRunId(requestedLogicalRunIdRaw);
    } catch (error) {
      return new Response(JSON.stringify({
        error: error instanceof Error ? error.message : "A stable logicalRunId is required.",
      }), {
        status: 400,
        headers: JSON_HEADERS,
      });
    }
  }
  const retryExhausted = body.retryFailed === true;
  const maxAttempts = Math.max(1, Math.min(Number(body.maxAttempts ?? 3), 20));
  const finalize = body.finalize === true;
  const allowFinalizeWithErrors = body.allowFinalizeWithErrors === true;

  if (!adapterKey) {
    return new Response(JSON.stringify({ error: "adapterKey is required" }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }

  let adapterForStatus: AdapterRow | null = null;
  let activeRunId: string | null = null;

  try {
    const adapters = await adminRest<AdapterRow[]>(
      "catalogue_source_adapters?select=*&adapter_key=eq." +
        encodeURIComponent(adapterKey) +
        "&limit=1",
    );
    const adapter = adapters[0];
    adapterForStatus = adapter ?? null;
    if (!adapter || !adapter.active) throw new Error("Adapter is missing or inactive.");

    const sources = await adminRest<SourceRow[]>(
      "catalogue_sources?select=id,name,base_url,verification_status&id=eq." +
        encodeURIComponent(adapter.source_id) +
        "&limit=1",
    );
    const source = sources[0];
    if (!source || source.verification_status !== "verified") {
      throw new Error("Adapter source is not verified.");
    }

    await updateAdapterStatus(adapter.id, {
      last_started_at: new Date().toISOString(),
      last_status: dryRun ? "dry_run_running" : "running",
    });

    // Dry-run remains side-effect-light and exercises the live source parser
    // without creating durable run rows.
    if (dryRun) {
      const limit = Math.min(requestedLimit, adapter.max_batch_size || 500);
      const discovery = await discoverAdapterBatch(adapter.config ?? {}, source, requestedCursor, limit);
      const parsed = discovery.parsed as ParsedItem[];
      const eligible = parsed.filter(isEligibleParsedItem);
      const failures = parsed.filter((item) => !item.normalized);
      await updateAdapterStatus(adapter.id, {
        last_completed_at: new Date().toISOString(),
        last_status: "dry_run_completed",
      });
      return new Response(JSON.stringify({
        dryRun: true,
        adapterKey,
        cursor: rawCursor || null,
        discovered: discovery.selectedUrls.length,
        totalAvailable: discovery.totalAvailable,
        stageable: eligible.length,
        skipped: parsed.length - eligible.length,
        failed: failures.length,
        nextCursor: discovery.nextCursor,
        hasMore: discovery.hasMore,
        sample: eligible.slice(0, 10),
        skippedSample: parsed.filter((item) => !isEligibleParsedItem(item)).slice(0, 10),
        failures: failures.slice(0, 20),
      }), { headers: JSON_HEADERS });
    }

    const run = await getOrCreateDurableRun(
      adapter,
      source,
      requestedLogicalRunId,
    );
    activeRunId = run.runId;

    if (finalize) {
      const state = await adminRest<Record<string, unknown>>(
        "rpc/catalogue_finalize_import_run",
        {
          method: "POST",
          body: JSON.stringify({
            p_run_id: run.runId,
            p_allow_errors: allowFinalizeWithErrors,
          }),
        },
      );
      await updateAdapterStatus(adapter.id, {
        last_completed_at: new Date().toISOString(),
        last_status: String(state.status ?? "completed"),
      });
      return new Response(JSON.stringify({
        dryRun: false,
        adapterKey,
        logicalRunId: run.logicalRunId,
        runId: run.runId,
        phase: "finalized",
        state,
      }), { headers: JSON_HEADERS });
    }

    if (!run.manifestComplete) {
      const discovery = await advanceDurableDiscovery(
        run,
        adapter,
        source,
        Math.min(requestedLimit, adapter.max_batch_size || 500),
      );
      const state = await readDurableRun(run.runId);
      await updateAdapterStatus(adapter.id, {
        last_completed_at: new Date().toISOString(),
        last_status: discovery.complete ? "resumable" : "discovering",
      });
      return new Response(JSON.stringify({
        dryRun: false,
        adapterKey,
        logicalRunId: run.logicalRunId,
        runId: run.runId,
        phase: "discovery",
        discovery,
        state,
      }), { headers: JSON_HEADERS });
    }

    const processing = await advanceDurableProcessing({
      run,
      source,
      adapter,
      limit: Math.min(requestedLimit, adapter.max_batch_size || 500),
      maxAttempts,
      retryExhausted,
      createCandidates,
    }) as Record<string, unknown>;

    const state = await readDurableRun(run.runId);
    const finalStatus = state?.status ?? "resumable";
    await updateAdapterStatus(adapter.id, {
      last_completed_at: new Date().toISOString(),
      last_status: finalStatus,
    });

    return new Response(JSON.stringify({
      dryRun: false,
      adapterKey,
      logicalRunId: run.logicalRunId,
      runId: run.runId,
      phase: "processing",
      processing,
      state,
    }), { headers: JSON_HEADERS });
  } catch (error) {
    const recoveryErrors: string[] = [];
    if (activeRunId) {
      try {
        await markRunError(activeRunId, error, false);
      } catch (markError) {
        recoveryErrors.push(
          "Could not persist run error state: " +
            (markError instanceof Error ? markError.message : String(markError)),
        );
      }
    }
    if (adapterForStatus?.id) {
      try {
        await updateAdapterStatus(adapterForStatus.id, {
          last_completed_at: new Date().toISOString(),
          last_status: activeRunId ? "resumable" : "failed",
        });
      } catch (adapterStatusError) {
        recoveryErrors.push(
          "Could not persist adapter status: " +
            (adapterStatusError instanceof Error
              ? adapterStatusError.message
              : String(adapterStatusError)),
        );
      }
    }
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Import runner failed",
      ...(activeRunId ? { runId: activeRunId, resumable: true } : {}),
      ...(recoveryErrors.length ? { recoveryErrors } : {}),
    }), { status: 500, headers: JSON_HEADERS });
  }
});
