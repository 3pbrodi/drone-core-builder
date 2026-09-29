export type IdentityConflict =
  "repeated_manufacturer_sku" | "repeated_mpn" | "missing_stable_variant_identity";

export type UpstreamVariantDescriptor = {
  upstreamItemId: string;
  upstreamParentProductId: string | null;
  upstreamVariantId: string | null;
  sourceUrl: string;
  model: string;
  variant: string | null;
  displayName: string;
  manufacturerSku: string | null;
  mpn: string | null;
  description: string | null;
  imageUrl: string | null;
  identityConflicts: IdentityConflict[];
  rawPayload: Record<string, unknown>;
};

export type ShopifyVariant = {
  id?: string | number | null;
  title?: string | null;
  sku?: string | null;
  mpn?: string | null;
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
  barcode?: string | null;
  position?: number | null;
  featured_image?: { src?: string | null } | null;
  image?: { src?: string | null } | null;
};

export type ShopifyProduct = {
  id?: string | number | null;
  title?: string | null;
  handle?: string | null;
  body_html?: string | null;
  vendor?: string | null;
  product_type?: string | null;
  tags?: string | string[] | null;
  mpn?: string | null;
  variants?: ShopifyVariant[] | null;
  images?: Array<{
    id?: string | number | null;
    src?: string | null;
    variant_ids?: Array<string | number> | null;
  }> | null;
};

function normalizeIdentity(value: unknown) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "");
  return normalized || null;
}

function cleanText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
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
    .replace(/\s+/g, " ")
    .trim();
}

export function stableImportFingerprint(value: unknown) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function absoluteUrl(value: unknown, baseUrl: string) {
  const raw = cleanText(value);
  if (!raw) return null;
  try {
    return new URL(raw, baseUrl).toString();
  } catch {
    return null;
  }
}

function meaningfulVariantLabel(variant: ShopifyVariant) {
  const title = cleanText(variant.title);
  if (title && !/^default(?:\s+title)?$/i.test(title)) return title;

  const options = [variant.option1, variant.option2, variant.option3]
    .map(cleanText)
    .filter((value): value is string => Boolean(value))
    .filter((value) => !/^default(?:\s+title)?$/i.test(value));

  return options.length ? options.join(" / ") : null;
}

function shopifyVariantImage(product: ShopifyProduct, variant: ShopifyVariant, baseUrl: string) {
  const direct =
    absoluteUrl(variant.featured_image?.src, baseUrl) ?? absoluteUrl(variant.image?.src, baseUrl);
  if (direct) return direct;

  const variantId = variant.id == null ? null : String(variant.id);
  if (variantId) {
    for (const image of product.images ?? []) {
      if ((image.variant_ids ?? []).map(String).includes(variantId)) {
        const url = absoluteUrl(image.src, baseUrl);
        if (url) return url;
      }
    }
  }

  return absoluteUrl(product.images?.[0]?.src, baseUrl);
}

function repeatedNormalizedValues(values: Array<string | null>) {
  const counts = new Map<string, number>();
  for (const value of values) {
    const normalized = normalizeIdentity(value);
    if (!normalized) continue;
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }
  return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([value]) => value));
}

export function enumerateShopifyProductVariants(
  product: ShopifyProduct,
  baseUrl: string,
): UpstreamVariantDescriptor[] {
  const model = cleanText(product.title) ?? cleanText(product.handle) ?? "Unknown product";
  const handle = cleanText(product.handle);
  const sourceUrl =
    handle && baseUrl ? new URL("/products/" + handle, baseUrl).toString() : baseUrl;
  const parentId =
    product.id != null
      ? "shopify:product:" + String(product.id)
      : handle
        ? "shopify:handle:" + handle
        : "shopify:product-fingerprint:" +
          stableImportFingerprint([model, product.vendor, product.product_type]);

  const variants =
    product.variants && product.variants.length > 0 ? product.variants : ([{}] as ShopifyVariant[]);
  const repeatedSkus = repeatedNormalizedValues(variants.map((variant) => cleanText(variant.sku)));
  const repeatedMpns = repeatedNormalizedValues(variants.map((variant) => cleanText(variant.mpn)));

  return variants.map((variant, index) => {
    const variantLabel = meaningfulVariantLabel(variant);
    const sku = cleanText(variant.sku);
    const mpn = cleanText(variant.mpn) ?? cleanText(product.mpn);
    const upstreamVariantId = variant.id == null ? null : String(variant.id);
    const stableIdentityParts = [
      sku,
      mpn,
      variantLabel,
      cleanText(variant.option1),
      cleanText(variant.option2),
      cleanText(variant.option3),
      cleanText(variant.barcode),
    ].filter(Boolean);
    const identityConflicts: IdentityConflict[] = [];

    if (sku && repeatedSkus.has(normalizeIdentity(sku)!)) {
      identityConflicts.push("repeated_manufacturer_sku");
    }
    if (mpn && repeatedMpns.has(normalizeIdentity(mpn)!)) {
      identityConflicts.push("repeated_mpn");
    }
    if (!upstreamVariantId && stableIdentityParts.length === 0) {
      identityConflicts.push("missing_stable_variant_identity");
    }

    const fallbackFingerprint = stableImportFingerprint({
      parentId,
      stableIdentityParts,
      position: variant.position ?? index + 1,
    });
    const upstreamItemId = upstreamVariantId
      ? "shopify:variant:" + upstreamVariantId
      : parentId + ":variant-fingerprint:" + fallbackFingerprint;
    const description = stripHtml(product.body_html).slice(0, 700) || null;

    return {
      upstreamItemId,
      upstreamParentProductId: parentId,
      upstreamVariantId,
      sourceUrl,
      model,
      variant: variantLabel,
      displayName: variantLabel ? model + " — " + variantLabel : model,
      manufacturerSku: sku,
      mpn,
      description,
      imageUrl: shopifyVariantImage(product, variant, sourceUrl),
      identityConflicts,
      rawPayload: {
        source: "shopify_products_json",
        parentProductId: product.id ?? null,
        variantId: variant.id ?? null,
        handle: product.handle ?? null,
        variant,
      },
    };
  });
}

function parseJsonLd(html: string) {
  const parsed: unknown[] = [];
  const expression = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(expression)) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    try {
      parsed.push(JSON.parse(raw));
    } catch {
      // Malformed JSON-LD is handled by the caller's fallback parser.
    }
  }
  return parsed;
}

function collectObjects(value: unknown, output: Record<string, unknown>[] = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectObjects(item, output);
    return output;
  }
  if (!value || typeof value !== "object") return output;

  const object = value as Record<string, unknown>;
  output.push(object);
  for (const child of Object.values(object)) collectObjects(child, output);
  return output;
}

function hasType(object: Record<string, unknown>, expected: string) {
  const raw = object["@type"];
  const types = Array.isArray(raw) ? raw : [raw];
  return types.some((value) => String(value ?? "").toLowerCase() === expected.toLowerCase());
}

function objectName(value: unknown) {
  if (!value || typeof value !== "object") return null;
  return cleanText((value as Record<string, unknown>).name);
}

function explicitVariantLabel(product: Record<string, unknown>, model: string) {
  const values = [
    cleanText(product.color),
    cleanText(product.size),
    cleanText(product.model),
  ].filter((value): value is string => Boolean(value));
  const name = cleanText(product.name);
  if (name && normalizeIdentity(name) !== normalizeIdentity(model)) values.push(name);

  const unique: string[] = [];
  for (const value of values) {
    if (!unique.some((existing) => normalizeIdentity(existing) === normalizeIdentity(value))) {
      unique.push(value);
    }
  }
  return unique.length ? unique.join(" / ") : null;
}

function jsonLdActualVariantId(product: Record<string, unknown>) {
  for (const key of ["productID", "@id"]) {
    const value = cleanText(product[key]);
    if (value) return value;
  }

  const url = cleanText(product.url);
  if (url && /[#?](?:variant|sku|id)=/i.test(url)) return url;
  return null;
}

function jsonLdImage(product: Record<string, unknown>, pageUrl: string) {
  const image = Array.isArray(product.image) ? product.image[0] : product.image;
  if (image && typeof image === "object") {
    const object = image as Record<string, unknown>;
    return absoluteUrl(object.url ?? object.contentUrl, pageUrl);
  }
  return absoluteUrl(image, pageUrl);
}

export function enumerateJsonLdProductVariants(
  html: string,
  pageUrl: string,
): UpstreamVariantDescriptor[] {
  const objects = parseJsonLd(html).flatMap((value) => collectObjects(value));
  const groups = objects.filter((object) => hasType(object, "ProductGroup"));

  let parent: Record<string, unknown> | null = null;
  let products: Record<string, unknown>[] = [];

  for (const group of groups) {
    const variants = group.hasVariant;
    if (Array.isArray(variants)) {
      const objectVariants = variants.filter(
        (value): value is Record<string, unknown> => Boolean(value) && typeof value === "object",
      );
      if (objectVariants.length) {
        parent = group;
        products = objectVariants;
        break;
      }
    }
  }

  if (!products.length) {
    products = objects.filter((object) => hasType(object, "Product"));
  }
  if (!products.length) return [];

  const parentModel =
    cleanText(parent?.name) ??
    objectName(products[0]?.isVariantOf) ??
    cleanText(products[0]?.name) ??
    "Unknown product";
  const parentIdentity =
    cleanText(parent?.productGroupID) ??
    cleanText(parent?.["@id"]) ??
    cleanText(parent?.url) ??
    pageUrl;
  const parentId = "jsonld:product:" + stableImportFingerprint(parentIdentity);

  const repeatedSkus = repeatedNormalizedValues(products.map((product) => cleanText(product.sku)));
  const repeatedMpns = repeatedNormalizedValues(products.map((product) => cleanText(product.mpn)));

  const seen = new Set<string>();
  const descriptors: UpstreamVariantDescriptor[] = [];

  products.forEach((product, index) => {
    const sku = cleanText(product.sku);
    const mpn = cleanText(product.mpn);
    const upstreamVariantId = jsonLdActualVariantId(product);
    const variant = explicitVariantLabel(product, parentModel);
    const stableIdentityParts = [
      upstreamVariantId,
      sku,
      mpn,
      variant,
      cleanText(product.gtin),
      cleanText(product.gtin13),
      cleanText(product.gtin14),
    ].filter(Boolean);
    const identityConflicts: IdentityConflict[] = [];

    if (sku && repeatedSkus.has(normalizeIdentity(sku)!)) {
      identityConflicts.push("repeated_manufacturer_sku");
    }
    if (mpn && repeatedMpns.has(normalizeIdentity(mpn)!)) {
      identityConflicts.push("repeated_mpn");
    }
    if (!upstreamVariantId && stableIdentityParts.length === 0) {
      identityConflicts.push("missing_stable_variant_identity");
    }

    const generatedFingerprint = stableImportFingerprint({
      parentId,
      stableIdentityParts,
      position: index + 1,
    });
    const upstreamItemId = upstreamVariantId
      ? "jsonld:variant:" + stableImportFingerprint(upstreamVariantId)
      : parentId + ":variant-fingerprint:" + generatedFingerprint;

    if (seen.has(upstreamItemId)) return;
    seen.add(upstreamItemId);

    const name = cleanText(product.name);
    const model = parent ? parentModel : (name ?? parentModel);
    const displayName =
      variant && normalizeIdentity(variant) !== normalizeIdentity(model)
        ? model + " — " + variant
        : model;
    const sourceUrl = absoluteUrl(product.url, pageUrl) ?? pageUrl;

    descriptors.push({
      upstreamItemId,
      upstreamParentProductId: parentId,
      upstreamVariantId,
      sourceUrl,
      model,
      variant,
      displayName,
      manufacturerSku: sku,
      mpn,
      description: stripHtml(product.description).slice(0, 700) || null,
      imageUrl: jsonLdImage(product, sourceUrl),
      identityConflicts,
      rawPayload: {
        source: "json_ld",
        parentProductId: parentIdentity,
        variantId: upstreamVariantId,
        product,
      },
    });
  });

  return descriptors;
}
