/**
 * Extract actual manufacturer product heading, not the first generic shop H1.
 * An apparent match is only a human-review hint, NEVER identity verification.
 * Robust for TBS pages with <h1>SHOP</h1> before the product heading.
 */
const stopWords=new Set(["the","for","and","with","fpv","drone","parts","set","kit",
 "standard","polycarbonate","frame","motor","camera","battery","brushless","prop",
 "propeller","flight","controller","esc","receiver","racing","version","new","size",
 "team","blacksheep","shop","products","view","online","official"]);
export function stripManufacturerHtml(html:string){
 return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ")
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ")
  .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi," ")
  .replace(/<!--[\s\S]*?-->/g," ")
  .replace(/&nbsp;|&#160;/gi," ")
  .replace(/&amp;/gi,"&")
  .replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'")
  .replace(/&deg;/gi,"°").replace(/<[^>]*>/g," ")
  .replace(/\s+/g," ").trim();
}
function tokens(s:string){
 return [...new Set(s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g," ")
   .split(/\s+/).filter(t=>t.length>=2&&!stopWords.has(t)))];
}
export type ManufacturerTitleEvidence={
 title:string|null;
 modelTokens:string[];
 matchedTokens:string[];
 score:number;
 titleMatch:"possible_exact_model"|"ambiguous_model_or_variant";
};
export function selectManufacturerProductTitle(
 html:string,expectedModel:string
):ManufacturerTitleEvidence {
 const h1=[...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)]
  .map(m=>stripManufacturerHtml(m[1]).slice(0,240))
  .filter(x=>x && !/^(shop|catalog|categories|login|register|account)$/i.test(x));
 const og=[...html.matchAll(/<meta\b[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/gi)]
  .map(m=>stripManufacturerHtml(m[1]));
 const title=stripManufacturerHtml(
  html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]??"");
 const choices=[...h1,...og,title].filter(Boolean).slice(0,20);
 const expected=tokens(expectedModel);
 const scores=choices.map(x=>{
   const seen=new Set(tokens(x));
   const matched=expected.filter(t=>seen.has(t));
   return {title:x,matched,ratio:expected.length?matched.length/expected.length:0};
 });
 // Prefer actual H1 over generic OG/shop title on equal score.
 scores.sort((a,b)=>b.ratio-a.ratio||b.matched.length-a.matched.length);
 const best=scores[0];
 const score=best?Math.round(best.ratio*100):0;
 return {title:best?.title??null,modelTokens:expected,
  matchedTokens:best?.matched??[],score,
  titleMatch:best && best.matched.length>=2 && score>=65
   ?"possible_exact_model":"ambiguous_model_or_variant"};
}
