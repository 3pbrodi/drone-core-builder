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
  const first = lower.indexOf(needle);
  if (first < 0) return null;

  // JTL product cards usually repeat the same product href for image/title.
  // Anchor on the last repeat in the local cluster, so price/availability that
  // follows the title wins over neighbouring cards.
  let at = first;
  for (;;) {
    const next = lower.indexOf(needle, at + needle.length);
    if (next < 0 || next - first > 2400) break;
    at = next;
  }
  const before = visibleText(html.slice(Math.max(0, at - 1000), at));
  const after = visibleText(html.slice(at, Math.min(html.length, at + 3000)));
  const text = before + " " + after;
  if (!identityMatches(target, text)) return null;

  const price = parseEuro(after);
  if (price === null) return null;

  let stock: RctechListingObservation["stock"] | null = null;
  const stockText = after.slice(0, 1800) + " " + before.slice(-700);
  if (/momentan nicht verf[uü]gbar|nicht verf[uü]gbar|ausverkauft/i.test(stockText)) {
    stock = "out_of_stock";
  } else if (/sofort verf[uü]gbar|\bauf lager\b/i.test(stockText)) {
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
