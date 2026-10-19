/**
 * Conservative HTML evidence extraction for two currently under-reviewed EU
 * merchant pages. Never itself marks any offer as verified.
 *
 * Uses exact H1 identity and correct variant/pack markers before looking for
 * price and stock within the rendered product section. Refuses conflicting
 * stock words rather than promoting a guess.
 */
export type MerchantObservation = {
  price: number | null;
  stock: "in_stock" | "out_of_stock" | "unknown";
  identityMatched: boolean;
  method: string;
  reasons: string[];
};

function visibleText(html: string) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&euro;|&#8364;/gi, "€")
    .replace(/&amp;/gi, "&")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function heading(html: string) {
  return visibleText(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "");
}

function euroPrice(text: string) {
  const m = text.match(/(?:€\s*(\d{1,5}(?:[.,]\d{2}))|(\d{1,5}(?:[.,]\d{2}))\s*€)/);
  const price = m ? Number((m[1] ?? m[2]).replace(",", ".")) : NaN;
  return Number.isFinite(price) && price > 0 ? price : null;
}

function simpleProductMetaPrice(html: string) {
  const match = html.match(/<meta\b[^>]*(?:property|itemprop|name)=["'](?:product:price:amount|price|og:price:amount)["'][^>]*content=["']([0-9]+[.,][0-9]{2})["'][^>]*>/i);
  const price = match ? Number(match[1].replace(",", ".")) : NaN;
  return Number.isFinite(price) && price > 0 ? price : null;
}

function bodyAfterHeading(html: string, headingText: string) {
  const text = visibleText(html);
  const index = text.toLowerCase().indexOf(headingText.toLowerCase());
  return index < 0 ? "" : text.slice(index, index + 2600);
}

function collectStock(text: string, scope: string) {
  // URLs in a product-specific document can supplement on-page evidence.
  // A negative availability marker has priority; contradictory signals are
  // rejected rather than interpreted as in-stock.
  const ins = /\b(?:auf lager|sofort verfügbar|in stock|instock|skladem)\b/i.test(text) ||
    /schema\.org\/InStock/i.test(scope);
  const outs = /\b(?:ausverkauft|nicht auf lager|momentan nicht verfügbar|out of stock|outofstock|vyprodáno|verkauf beendet)\b/i.test(text) ||
    /schema\.org\/OutOfStock/i.test(scope);
  return ins && outs ? "unknown" : ins ? "in_stock" : outs ? "out_of_stock" : "unknown";
}

const empty = (method: string, reason: string): MerchantObservation => ({
  price: null, stock: "unknown", identityMatched: false, method, reasons: [reason],
});

function uniquePrice(primary: number | null, secondary: number | null) {
  if (primary !== null && secondary !== null && primary !== secondary) return null;
  return primary ?? secondary;
}

export function parseRotoramaCnhl1300ThreeS(html: string): MerchantObservation {
  const method = "rotorama_exact_3s_heading_and_offer";
  const h1 = heading(html);
  const exact = /\bcnhl\b/i.test(h1) &&
    /\bblack series\b/i.test(h1) &&
    /\b1300\s*mah\b/i.test(h1) &&
    /\b3s\b/i.test(h1) &&
    /\b130c\b/i.test(h1) &&
    !/\b(?:4s|6s|100c)\b/i.test(h1);
  if (!exact) return empty(method, "Exact CNHL 1300mAh 3S 130C title missing");
  const section = bodyAfterHeading(html, h1);
  if (!section) return empty(method, "Product heading missing from rendered document");
  if (!/\b3s1p\b/i.test(section) || !/\bXT60\b/i.test(section)) {
    return empty(method, "Exact 3S1P/XT60 variant evidence absent");
  }
  const visiblePrice = euroPrice(section.slice(0, 950));
  const metaPrice = simpleProductMetaPrice(html);
  const price = uniquePrice(visiblePrice, metaPrice);
  const stock = collectStock(section.slice(0, 800), html.match(/<link\b[^>]*itemprop=["']availability["'][^>]*>/gi)?.join(" ") ?? "");
  const reasons = [];
  if (price === null) reasons.push("Unambiguous EUR price not captured");
  if (stock === "unknown") reasons.push("Unambiguous inventory not captured");
  return { price, stock, identityMatched: true, method, reasons };
}

export function parseRctechEthixP2Exact(html: string): MerchantObservation {
  const method = "rctech_exact_p2_sku_gtin";
  const h1 = heading(html);
  const exact = /\bhqprop\b/i.test(h1) &&
    /\bethix\b/i.test(h1) &&
    /\bp2\b/i.test(h1) &&
    /\bpickle\b/i.test(h1) &&
    /\b4\s*stk\b|\b4\s*st[üu]ck\b|\b4\s*pcs\b/i.test(h1) &&
    /\bEthixP2-PK-PC\b/i.test(html) &&
    /\b9313448340470\b/.test(html);
  if (!exact) return empty(method, "Exact HQProp P2 title, four-pack, SKU or GTIN missing");
  const section = bodyAfterHeading(html, h1);
  if (!section) return empty(method, "Product heading missing from rendered document");
  const visiblePrice = euroPrice(section.slice(0, 1000));
  const metaPrice = simpleProductMetaPrice(html);
  const price = uniquePrice(visiblePrice, metaPrice);
  const scopedStock = section.slice(0, 650);
  const stock = collectStock(scopedStock,
    html.match(/<link\b[^>]*itemprop=["']availability["'][^>]*>/gi)?.join(" ") ?? "");
  const reasons = [];
  if (price === null) reasons.push("Unambiguous EUR price not captured");
  if (stock === "unknown") reasons.push("Unambiguous inventory not captured");
  return {price, stock, identityMatched:true, method, reasons};
}
