export type RctechListingTarget = {
  productName: string;
  model?: string | null;
  manufacturerName?: string | null;
  productUrl: string;
};

export type RctechListingObservation = {
  price: number;
  currency: "EUR";
  stock: "in_stock" | "out_of_stock";
  parserSource: "rctech_listing";
};

function normalize(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function visibleText(html: string) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&euro;|&#8364;/gi, "€")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseEuro(text: string) {
  const match =
    text.match(/([0-9]{1,5}(?:[.,][0-9]{1,2})?)\s*€/i) ??
    text.match(/€\s*([0-9]{1,5}(?:[.,][0-9]{1,2})?)/i);
  if (!match) return null;
  const value = Number(match[1].replace(",", "."));
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function identityTokens(value: string) {
  return normalize(value).split(/\s+/).filter((token) =>
    token.length >= 2 && !new Set([
      "the","and","for","with","fpv","kit","series","version","frame","battery",
      "lipo","akku","product","rline","line"
    ]).has(token)
  );
}

function identityMatches(target: RctechListingTarget, text: string) {
  const haystack = new Set(normalize(text).split(/\s+/));
  const tokens = identityTokens([target.productName, target.model].filter(Boolean).join(" "));
  if (tokens.length < 2) return false;
  const shared = tokens.filter((token) => haystack.has(token)).length;
  return shared >= Math.min(3, Math.max(2, Math.ceil(tokens.length * 0.55)));
}

function targetSlug(target: RctechListingTarget) {
  try {
    const url = new URL(target.productUrl);
    if (!/(^|[.])rctech[.]de$/i.test(url.hostname)) return null;
    return url.pathname.replace(/^\/+|\/+$/g, "");
  } catch {
    return null;
  }
}

/**
 * RCTech's current JTL product pages occasionally return a consent/product shell
 * to server-side fetches while manufacturer listing pages still contain the
 * exact product card, EUR price and stock badge. This fallback only accepts a
 * card anchored by the exact product URL slug and then re-validates product
 * identity before reading price/stock.
 */
export function parseRctechListingFallback(
  target: RctechListingTarget,
  html: string,
): RctechListingObservation | null {
  const slug = targetSlug(target);
  if (!slug) return null;

  const lower = html.toLowerCase();
  const needle = "/" + slug.toLowerCase();
  const at = lower.indexOf(needle);
  if (at < 0) return null;

  // Start a little before the exact product link so an "Auf Lager/Ausverkauft"
  // badge that precedes the title remains visible. Stop before distant products
  // can contribute unrelated price/stock text.
  const start = Math.max(0, at - 1400);
  let end = Math.min(html.length, at + 5200);
  const nextHref = lower.indexOf('href="', at + needle.length);
  if (nextHref > at && nextHref < end) {
    const nextSlugish = lower.indexOf("/", nextHref);
    if (nextSlugish > at && nextSlugish < end) end = Math.max(at + 900, nextHref);
  }

  const text = visibleText(html.slice(start, end));
  if (!identityMatches(target, text)) return null;

  const price = parseEuro(text);
  if (price === null) return null;

  let stock: RctechListingObservation["stock"] | null = null;
  if (/momentan nicht verf[uü]gbar|nicht verf[uü]gbar|ausverkauft/i.test(text)) {
    stock = "out_of_stock";
  } else if (/sofort verf[uü]gbar|\bauf lager\b/i.test(text)) {
    stock = "in_stock";
  }
  if (!stock) return null;

  return { price, currency: "EUR", stock, parserSource: "rctech_listing" };
}

export function rctechManufacturerFallbackUrl(manufacturerName: string | null | undefined) {
  const manufacturer = normalize(manufacturerName);
  if (manufacturer === "geprc") return "https://www.rctech.de/geprc";
  if (manufacturer === "tattu" || manufacturer === "gensace" || manufacturer === "gens ace") {
    return "https://www.rctech.de/gensace";
  }
  return null;
}
