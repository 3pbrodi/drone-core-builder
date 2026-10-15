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

const identityStopWords = new Set([
  "the","and","for","with","fpv","kit","series","version","frame","battery",
  "lipo","akku","product","rline","line",
]);

function identityTokens(value: string) {
  return normalize(value).split(/\s+/).filter(
    (token) => token.length >= 2 && !identityStopWords.has(token),
  );
}

function identityMatches(target: RctechListingTarget, text: string) {
  const haystack = new Set(normalize(text).split(/\s+/));
  const wanted = identityTokens(
    [target.productName, target.model].filter(Boolean).join(" "),
  );
  if (wanted.length < 2) return false;
  const shared = wanted.filter((token) => haystack.has(token)).length;
  return shared >= Math.min(3, Math.max(2, Math.ceil(wanted.length * 0.55)));
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
 * Parse one exact JTL product card. RCTech wraps each listing product in a
 * buy-form; using that boundary avoids reading a neighbour's price/stock.
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

  const formStart = lower.lastIndexOf("<form", at);
  const formEndStart = lower.indexOf("</form>", at);
  let segment: string;
  if (
    formStart >= 0 &&
    formEndStart > at &&
    at - formStart <= 20_000 &&
    formEndStart - formStart <= 50_000
  ) {
    segment = html.slice(formStart, formEndStart + "</form>".length);
  } else {
    // Conservative fallback for simplified/test markup without JTL form tags.
    segment = html.slice(Math.max(0, at - 1800), Math.min(html.length, at + 9000));
  }

  const text = visibleText(segment);
  if (!identityMatches(target, text)) return null;

  const price = parseEuro(text);
  if (price === null) return null;

  let stock: RctechListingObservation["stock"] | null = null;
  if (
    /schema[.]org\/outofstock/i.test(segment) ||
    /momentan nicht verf[uü]gbar|nicht verf[uü]gbar|ausverkauft|artikel vergriffen/i.test(text)
  ) {
    stock = "out_of_stock";
  } else if (
    /schema[.]org\/instock/i.test(segment) ||
    /sofort verf[uü]gbar|\bauf lager\b/i.test(text)
  ) {
    stock = "in_stock";
  }
  if (!stock) return null;

  return { price, currency: "EUR", stock, parserSource: "rctech_listing" };
}

/**
 * RCTech manufacturer/category fallbacks are intentionally explicit. For Tattu,
 * the capacity filter URL currently resolves to the exact product page and
 * exposes schema.org availability that the generic manufacturer page may omit
 * because of pagination.
 */
export function rctechFallbackUrls(target: RctechListingTarget) {
  const manufacturer = normalize(target.manufacturerName);
  if (manufacturer === "geprc") return ["https://www.rctech.de/geprc"];

  if (manufacturer === "tattu" || manufacturer === "gensace" || manufacturer === "gens ace") {
    const identity = [target.productName, target.model].filter(Boolean).join(" ");
    const capacity = identity.match(/\b([0-9]{3,4})\s*mah\b/i)?.[1] ?? null;
    const urls = capacity
      ? [`https://www.rctech.de/gensace__${capacity}-mah`]
      : [];
    urls.push("https://www.rctech.de/gensace");
    return [...new Set(urls)];
  }
  return [] as string[];
}
