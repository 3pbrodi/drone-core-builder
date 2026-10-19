// Direct, one-time merchant probes from ephemeral GitHub runner.
// No payment, purchase, credentials, cookies or Production imports.
// Status is not equivalent to formal verified offer; reviewer must accept it.
import {
  parseRctechExactProductFallback, parseRctechListingFallback,
} from "../../supabase/functions/_shared/catalogue-rctech-fallback.ts";
import {parseRctechEthixP2Exact,parseRotoramaCnhl1300ThreeS} from "../../src/lib/catalogue-merchant-evidence.ts";

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
        if (spec.id.includes("hqprop") || spec.merchant==="Rotorama") {
          const value=spec.id.includes("hqprop")
            ?parseRctechEthixP2Exact(html)
            :parseRotoramaCnhl1300ThreeS(html);
          if(value.identityMatched) observation={
            price:value.price,stock:value.stock,exact:true,method:value.method,
          };
        }
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
const outPath=Deno.args[0]??"step8-results/live-eu-offers.json";
Deno.writeTextFileSync(outPath,JSON.stringify(output,null,2)+"\n");
console.log(JSON.stringify({live_checks:results.length,
  direct_exact:results.filter(x=>x.exactProduct&&x.priceEUR!==null&&x.stock!=="unknown").length,
  errors:results.filter(x=>!x.exactProduct).map(x=>x.id),
  all_unverified:results.every(x=>!x.usableAsVerifiedOffer),
  observations:results.map(({id,priceEUR,stock,exactProduct,responseStatus,reason})=>
    ({id,priceEUR,stock,exactProduct,responseStatus,reason}))}));
