// Direct, one-time merchant probes from ephemeral GitHub runner.
// No payment, purchase, credentials, cookies or Production imports.
// Status is not equivalent to formal verified offer; reviewer must accept it.
import {
  parseRctechExactProductFallback, parseRctechListingFallback,
} from "../../supabase/functions/_shared/catalogue-rctech-fallback.ts";

type Observation = {
  id:string;merchant:string;url:string;checkedAt:string;
  responseStatus:number|null;contentLength:number|null;
  exactProduct:boolean;priceEUR:number|null;stock:string;
  method:string;usableAsVerifiedOffer:boolean;reason:string;
};
const specs=[
  {id:"qa-cnhl-black-v2-1300mah-3s-130c-xt60-1pack",merchant:"Rotorama",
   url:"https://www.rotorama.de/product/cnhl-1300mah-3s-130c"},
  {id:"qa-hqprop-ethix-p2-pickle-2cw2ccw",merchant:"RCTech",
   url:"https://www.rctech.de/?a=7000&lang=eng"},
  {id:"qa-tbs-crossfire-nano-rx-se",merchant:"RCTech",
   url:"https://www.rctech.de/tbs-crossfire-nano-rx-longrange-empfaenger-se"},
  {id:"qa-tbs-lucid-6s-60a-4in1-esc",merchant:"RCTech",
   url:"https://www.rctech.de/tbs-lucid-60a-6s-4-in-1-esc"},
];
function decode(html:string){
  return html.replace(/&nbsp;|&#160;/gi," ").replace(/&euro;|&#8364;/gi,"€")
    .replace(/<script\b[\s\S]*?<\/script>/gi," ")
    .replace(/<style\b[\s\S]*?<\/style>/gi," ")
    .replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
}
function priceAt(text:string){
  const m=text.match(/(?:€\s*([0-9]{1,5}(?:[,.][0-9]{2})?)|([0-9]{1,5}(?:[,.][0-9]{2})?)\s*€)/i);
  return m?Number((m[1]??m[2]).replace(",",".")):null;
}
function hqSpecial(html:string) {
  const h1=decode(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]??"");
  const exact=/ethix.*p2.*pickle/i.test(h1) &&
    /EthixP2-PK-PC/i.test(html) && /9313448340470/.test(html);
  if(!exact)return null;
  const og=html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)/i)?.[1]??"";
  const title=decode(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]??"");
  const p=priceAt(og)||priceAt(title);
  const productText=decode(html.slice(Math.max(0,html.indexOf("<h1")),Math.max(0,html.indexOf("<h1"))+9000));
  const stock=/item out of stock|ausverkauft|artikel vergriffen/i.test(productText)?"out_of_stock":
    /auf lager|in stock|sofort verf[uü]gbar/i.test(productText)?"in_stock":"unknown";
  return {price:p,stock,exact,method:"exact_h1_sku_gtin_product_block"};
}
function rotoramaSpecial(html:string) {
  const rawTitle=html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]??"";
  const title=decode(rawTitle);
  const exact=/cnhl.*black.*1300.*3s.*130c/i.test(title);
  if(!exact)return null;
  const start=html.indexOf(rawTitle);
  const text=decode(html.slice(Math.max(0,start),Math.max(0,start)+11000));
  const p=priceAt(text);
  const stock=/auf lager|in stock|skladem/i.test(text)?"in_stock":
    /ausverkauft|nicht auf lager|vyprod[aá]no/i.test(text)?"out_of_stock":"unknown";
  return {price:p,stock,exact,method:"exact_product_heading_price_stock"};
}
const results:Observation[]=[];
for(const spec of specs){
  const checkedAt=new Date().toISOString();
  let result:Observation={
    id:spec.id,merchant:spec.merchant,url:spec.url,checkedAt,responseStatus:null,
    contentLength:null,exactProduct:false,priceEUR:null,stock:"unknown",
    method:"none",usableAsVerifiedOffer:false,reason:"Merchant live check pending review",
  };
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),12000);
  try {
    const res=await fetch(spec.url,{
      redirect:"follow",signal:controller.signal,
      headers:{"accept":"text/html,application/xhtml+xml",
        "accept-language":"de-DE,de;q=0.9,en;q=0.6",
        "user-agent":"Mozilla/5.0 (compatible; DroneCoresCatalogueVerifier/1.0; +https://dronecores.com)"},
    });
    result.responseStatus=res.status;
    const type=res.headers.get("content-type")??"";
    if(!res.ok||!type.toLowerCase().includes("text/html")){
      result.reason="HTTP or HTML response invalid";
    } else {
      const html=await res.text();
      result.contentLength=html.length;
      if(html.length>3_000_000){result.reason="Page too large; refused";}
      else {
        let observation:{price:number|null;stock:string;exact:boolean;method:string}|null=null;
        if(spec.id.includes("hqprop")) observation=hqSpecial(html);
        else if(spec.merchant==="Rotorama") observation=rotoramaSpecial(html);
        else {
          const m=spec.id.includes("nano")
            ?{productName:"TBS Crossfire Nano RX SE",model:"Crossfire Nano RX SE"}
            :{productName:"TBS Lucid 60A 6S 4-in-1 ESC",model:"Lucid 6S 60A"};
          const t={...m,productUrl:spec.url,manufacturerName:"TBS"};
          const parsed=parseRctechExactProductFallback(t,html) ??
            parseRctechListingFallback(t,html);
          if(parsed) observation={price:parsed.price,stock:parsed.stock,
            exact:true,method:parsed.parserSource};
        }
        if(observation){
          result.exactProduct=observation.exact;
          result.priceEUR=observation.price;
          result.stock=observation.stock;
          result.method=observation.method;
          result.reason=observation.price!==null && observation.stock!=="unknown"
            ?"Exact merchant reading captured, awaiting human verification"
            :"Incomplete or contradictory exact merchant data";
        } else result.reason="Failed closed: no exact identity or parsable offer";
      }
    }
  } catch(e){result.reason="Live fetch unavailable: "+String(e).slice(0,150);}
  finally{clearTimeout(timeout);}
  results.push(result);
}
const output={checkedAt:new Date().toISOString(),source:"direct_GitHub_runner_http",productionWrite:false,
  marketplaceOffersInserted:0,imagesCopied:0,reviewStatus:"pending_review",
  observations:results};
const outPath=Deno.args[0]??"step6-results/live-eu-offers.json";
Deno.writeTextFileSync(outPath,JSON.stringify(output,null,2)+"\n");
console.log(JSON.stringify({live_checks:results.length,
  direct_exact:results.filter(x=>x.exactProduct&&x.priceEUR!==null&&x.stock!=="unknown").length,
  errors:results.filter(x=>!x.exactProduct).map(x=>x.id),
  all_unverified:results.every(x=>!x.usableAsVerifiedOffer)}));
