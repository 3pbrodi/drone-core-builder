import { assertEquals } from "jsr:@std/assert@1.0.16";
import {
  parseRctechExactProductFallback,
  parseRctechListingFallback,
  rctechFallbackUrls,
} from "../supabase/functions/_shared/catalogue-rctech-fallback.ts";

Deno.test("RCTech GEPRC listing fallback reads exact target card", () => {
  const html = `
    <div class="productbox">
      <span>Auf Lager</span>
      <a href="/other-frame">Other Frame</a><strong>59,90 €</strong>
    </div>
    <form id="buy_form_7533">
      <div class="productbox">
        <span>Ausverkauft</span>
        <a href="/geprc-mk5-o4-pro-dc-frame"><img alt="GEPRC MK5"></a>
        ${"<source srcset='/media/geprc-mk5-o4-pro-dc-frame~x.webp'>".repeat(40)}
        <a href="/geprc-mk5-o4-pro-dc-frame">GEPRC MK5 O4 Pro DC Frame</a>
        <span>Artikelnummer: GP107631</span>
        <strong>89,90 €</strong>
        <span>Momentan nicht verfügbar</span>
      </div>
    </form>
    <div class="productbox">
      <span>Auf Lager</span><a href="/next-frame">Next Frame</a><strong>99,90 €</strong>
    </div>`;
  assertEquals(parseRctechListingFallback({
    productName: "GEPRC GEP-MK5 O4 Pro DC Frame",
    model: "GEP-MK5 O4 Pro DC Frame",
    manufacturerName: "GEPRC",
    productUrl: "https://www.rctech.de/geprc-mk5-o4-pro-dc-frame",
  }, html), {
    price: 89.9,
    currency: "EUR",
    stock: "out_of_stock",
    parserSource: "rctech_listing",
  });
});

Deno.test("RCTech exact Tattu product metadata combines exact URL price and schema stock", () => {
  const html = `
    <meta property="og:url" content="https://www.rctech.de/tattu-r-line-6s-1550-mah-150c-v5-lipo-akku">
    <meta property="og:title" content="Tattu R-Line 6S 1550 mAh 150C V5 LiPo Akku - RCTech.de FPV Shop, 42,90 €">
    <link itemprop="availability" href="https://schema.org/OutOfStock">
    <span class="status">Artikel vergriffen</span>`;
  assertEquals(parseRctechExactProductFallback({
    productName: "Tattu R-Line V5.0 1550mAh 6S 150C XT60",
    model: "R-Line Version 5.0 1550mAh 6S 150C",
    manufacturerName: "Tattu",
    productUrl: "https://www.rctech.de/tattu-r-line-6s-1550-mah-150c-v5-lipo-akku",
  }, html), {
    price: 42.9,
    currency: "EUR",
    stock: "out_of_stock",
    parserSource: "rctech_listing",
  });
});

Deno.test("RCTech exact metadata refuses a different canonical product", () => {
  const html = `
    <meta property="og:url" content="https://www.rctech.de/tattu-r-line-6s-1480-mah-150c-v5-lipo-akku">
    <meta property="og:title" content="Tattu R-Line 6S 1480 mAh 150C V5 LiPo Akku, 35,90 €">
    <link itemprop="availability" href="https://schema.org/InStock">`;
  assertEquals(parseRctechExactProductFallback({
    productName: "Tattu R-Line V5.0 1550mAh 6S 150C XT60",
    model: "R-Line Version 5.0 1550mAh 6S 150C",
    manufacturerName: "Tattu",
    productUrl: "https://www.rctech.de/tattu-r-line-6s-1550-mah-150c-v5-lipo-akku",
  }, html), null);
});

Deno.test("RCTech Tattu listing fallback keeps target distinct from neighboring batteries", () => {
  const html = `
    <div><span>Auf Lager</span><a href="/tattu-r-line-6s-1480-mah-150c-v5-lipo-akku">Tattu R-Line 6S 1480 mAh 150C V5</a><b>35,90 €</b></div>
    <div><span>Ausverkauft</span>
      <a href="/tattu-r-line-6s-1550-mah-150c-v5-lipo-akku">Tattu R-Line 6S 1550 mAh 150C V5 LiPo Akku</a>
      <a href="/tattu-r-line-6s-1550-mah-150c-v5-lipo-akku">Details</a>
      <b>42,90 €</b><span>Momentan nicht verfügbar</span>
    </div>
    <div><span>Auf Lager</span><a href="/tattu-r-line-6s-1800-mah-150c-v5-lipo-akku">Tattu R-Line 6S 1800 mAh 150C V5</a><b>49,90 €</b></div>`;
  assertEquals(parseRctechListingFallback({
    productName: "Tattu R-Line V5.0 1550mAh 6S 150C XT60",
    model: "R-Line Version 5.0 1550mAh 6S 150C",
    manufacturerName: "Tattu",
    productUrl: "https://www.rctech.de/tattu-r-line-6s-1550-mah-150c-v5-lipo-akku",
  }, html), {
    price: 42.9,
    currency: "EUR",
    stock: "out_of_stock",
    parserSource: "rctech_listing",
  });
});

Deno.test("RCTech fallback refuses pages without the exact product link", () => {
  assertEquals(parseRctechListingFallback({
    productName: "GEPRC GEP-MK5 O4 Pro DC Frame",
    model: "GEP-MK5 O4 Pro DC Frame",
    manufacturerName: "GEPRC",
    productUrl: "https://www.rctech.de/geprc-mk5-o4-pro-dc-frame",
  }, '<a href="/geprc-mk5-o4-pro-wide-x-frame">GEPRC MK5 O4 Pro Wide X Frame</a> 89,90 € Ausverkauft'), null);
});

Deno.test("RCTech manufacturer fallback URLs are explicit and fail closed", () => {
  assertEquals(rctechFallbackUrls({
    productName: "GEPRC GEP-MK5 O4 Pro DC Frame",
    model: "GEP-MK5 O4 Pro DC Frame",
    manufacturerName: "GEPRC",
    productUrl: "https://www.rctech.de/geprc-mk5-o4-pro-dc-frame",
  }), ["https://www.rctech.de/geprc"]);
  assertEquals(rctechFallbackUrls({
    productName: "Tattu R-Line V5.0 1550mAh 6S 150C XT60",
    model: "R-Line Version 5.0 1550mAh 6S 150C",
    manufacturerName: "Tattu",
    productUrl: "https://www.rctech.de/tattu-r-line-6s-1550-mah-150c-v5-lipo-akku",
  }), [
    "https://www.rctech.de/gensace__1550-mah",
    "https://www.rctech.de/gensace",
  ]);
  assertEquals(rctechFallbackUrls({
    productName: "Unknown",
    manufacturerName: "Unknown",
    productUrl: "https://www.rctech.de/unknown",
  }), []);
});
