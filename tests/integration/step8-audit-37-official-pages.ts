/**
 * Read-only inspection of all balanced 37 research candidates. NOT a seller
 * price check, a human identity review, an image-license review or a Production
 * import. Fail closed on unexpected domains, dubious variants and HTTP errors.
 * Never persist manufacturer page HTML, image URLs or photos.
 */
type Candidate = {
 pilot_id:string;category:string;manufacturer:string;model:string;
 source_url:string;missing_required_specs:string[];review_blockers:string[];
 component_classification?:string; eligible_as_standalone_component_research?:boolean;
};
type Observation = {
 pilot_id:string; category:string; model:string;manufacturer:string;
 component_classification:string;eligible_as_standalone_component_research:boolean;
 source_url:string; checked_at:string; http_status:number|null;
 content_type:string|null; html_bytes:number|null;
 source_page_reachable:boolean; title_excerpt:string|null;
 source_model_title_overlap:number; discriminating_model_tokens:string[];
 matched_discriminating_tokens:string[];
 title_review_signal:"possible_exact_model"|"ambiguous_model_or_variant"|"source_unavailable";
 manufacturer_evidence_status:"pending_human_review"; specs_verified:false;
 exact_variant_verified:false; merchant_offer_verified:false;
 image_rights_verified:false; publication_approved:false;
 missing_required_specs:string[]; review_blockers:string[]; notes:string[];
};
const inputPath=Deno.args[0]??"step8-results/balanced-source-triage.json";
const outPath=Deno.args[1]??"step8-results/official-source-audit-37.json";
const doc=JSON.parse(await Deno.readTextFile(inputPath));
const queue=doc.review_queue as Candidate[];
if (!Array.isArray(queue)||queue.length!==37||doc.summary.total_source_rows!==171)
 throw Error("Expected exact original 171-pilot and balanced 37-candidate review queue.");
const categories=new Set(["battery","camera","esc","flightController","frame","motors","propellers","receiver"]);
const domains=new Set(["www.hqprop.com","www.foxeer.com","www.speedybee.com","www.team-blacksheep.com"]);
const ids=new Set<string>();
function strip(html:string){
 return html.replace(/<script\b[\s\S]*?<\/script>/gi," ")
  .replace(/<style\b[\s\S]*?<\/style>/gi," ")
  .replace(/<svg\b[\s\S]*?<\/svg>/gi," ")
  .replace(/<!--[\s\S]*?-->/g," ")
  .replace(/&nbsp;|&#160;/gi," ")
  .replace(/&amp;/gi,"&")
  .replace(/&quot;/gi,'"')
  .replace(/&#39;|&apos;/gi,"'")
  .replace(/&deg;/gi,"°")
  .replace(/<[^>]*>/g," ")
  .replace(/\s+/g," ").trim();
}
const stopWords=new Set(["the","for","and","with","fpv","drone","parts","set","kit",
 "standard","polycarbonate","frame","motor","camera","battery","brushless","prop",
 "propeller","flight","controller","esc","receiver","racing","version","new","size"]);
function normalize(s:string){
 return s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g," ").trim();
}
function strongTokens(s:string){
 return [...new Set(normalize(s).split(/\s+/).filter(t=>t.length>=2&&!stopWords.has(t)))];
}
function titleFromHtml(html:string){
 const h1=html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
 const og=html.match(/<meta\b[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)?.[1];
 const t=html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
 return strip(h1||og||t||"").slice(0,200);
}
async function one(c:Candidate):Promise<Observation>{
 const now=new Date().toISOString();
 const x:Observation={
  pilot_id:c.pilot_id,category:c.category,manufacturer:c.manufacturer,
  component_classification:c.component_classification??"unclassified",
  eligible_as_standalone_component_research:c.eligible_as_standalone_component_research===true,
  model:c.model,source_url:c.source_url,checked_at:now,http_status:null,
  content_type:null,html_bytes:null,source_page_reachable:false,
  title_excerpt:null,source_model_title_overlap:0,discriminating_model_tokens:[],
  matched_discriminating_tokens:[],title_review_signal:"source_unavailable",
  manufacturer_evidence_status:"pending_human_review",specs_verified:false,
  exact_variant_verified:false,merchant_offer_verified:false,
  image_rights_verified:false,publication_approved:false,
  missing_required_specs:c.missing_required_specs??[],review_blockers:[...(c.review_blockers??[])],
  notes:[]
 };
 if(!x.eligible_as_standalone_component_research) x.notes.push("Not a standalone component; exclude from promotion");
 if (!categories.has(c.category) || !c.pilot_id || ids.has(c.pilot_id)) {
  x.notes.push("Invalid category, pilot identity or duplicated source row");return x;
 }
 ids.add(c.pilot_id);
 let url:URL;
 try {url=new URL(c.source_url);}
 catch {x.notes.push("Malformed original manufacturer URL");return x;}
 if(url.protocol!=="https:"||!domains.has(url.hostname)){
  x.notes.push("Original source URL outside approved manufacturer domains");return x;
 }
 const ctrl=new AbortController();const stop=setTimeout(()=>ctrl.abort(),11000);
 try {
  const response=await fetch(url,{redirect:"follow",signal:ctrl.signal,
   headers:{"accept":"text/html,application/xhtml+xml","user-agent":"Mozilla/5.0 (compatible; DroneCoresCatalogueVerifier/1.0; +https://dronecores.com)"}});
  x.http_status=response.status;
  x.content_type=response.headers.get("content-type");
  const finalUrl=new URL(response.url);
  if(!domains.has(finalUrl.hostname)) {x.notes.push("Redirected outside known manufacturer");return x;}
  if(!response.ok||!x.content_type?.toLowerCase().includes("text/html")){
    x.notes.push("Cannot confirm manufacturer HTML page; preserve review blocker");
    return x;
  }
  const html=await response.text();
  x.html_bytes=html.length;
  if (html.length>3_000_000){x.notes.push("Manufacturer page too large; refused");return x;}
  x.source_page_reachable=true;
  x.title_excerpt=titleFromHtml(html)||null;
  const expected=strongTokens(c.model);
  const found=new Set(strongTokens(x.title_excerpt??""));
  x.discriminating_model_tokens=expected.slice(0,16);
  x.matched_discriminating_tokens=expected.filter(t=>found.has(t)).slice(0,16);
  x.source_model_title_overlap=expected.length
   ?Math.round(100*x.matched_discriminating_tokens.length/expected.length):0;
  // This is a RESEARCH HINT ONLY, never proof of an exact manufacturer variant.
  x.title_review_signal=expected.length>=2 && x.matched_discriminating_tokens.length>=2 &&
   x.source_model_title_overlap>=65?"possible_exact_model":"ambiguous_model_or_variant";
  x.notes.push(x.title_review_signal==="possible_exact_model"
   ?"Title tokens corroborate manufacturer model family, variant still needs expert review"
   :"Title does not uniquely establish exact model or variant; manual source excerpt required");
  if(x.missing_required_specs.length) x.notes.push("Mandatory technical specifications incomplete in archived normalized data");
 }catch(e){x.notes.push("Source fetch error: "+String(e).slice(0,90));}
 finally {clearTimeout(stop);}
 return x;
}
const observations:Observation[]=[];
const concurrency=2;
for(let offset=0;offset<queue.length;offset+=concurrency){
 const batch=await Promise.all(queue.slice(offset,offset+concurrency).map(one));
 observations.push(...batch);
}
const summary={
 run_at:new Date().toISOString(),origin:"balanced 171 manufacturer-source raw pilot",
 research_candidates:queue.length,
 source_reachable:observations.filter(x=>x.source_page_reachable).length,
 model_family_title_hints:observations.filter(x=>x.title_review_signal==="possible_exact_model").length,
 source_unavailable:observations.filter(x=>!x.source_page_reachable).length,
 missing_spec_candidates:observations.filter(x=>x.missing_required_specs.length>0).length,
 excluded_accessory_or_bundle:observations.filter(x=>!x.eligible_as_standalone_component_research).length,
 potential_standalone_component:observations.filter(x=>x.eligible_as_standalone_component_research).length,
 possible_dupe_count:observations.filter(x=>x.review_blockers.includes("same_maker_model_variant_fingerprint_review")).length,
 formal_identity_verified:0,formal_spec_fields_verified:0,
 human_approved_for_publication:0,manufacturer_images_downloaded:0,
 production_database_writes:0,merchant_offers_verified:0,
 by_category:Object.fromEntries([...categories].sort().map(c=>[c,observations.filter(x=>x.category===c).length])),
 description:"No models are formally verified. A page/title token match is NOT enough for exact model, SKU, specs, pack, license or publication."
};
await Deno.writeTextFile(outPath,JSON.stringify({summary,observations},null,2)+"\n");
console.log("STEP8_OFFICIAL_SOURCE_SUMMARY "+JSON.stringify(summary));
console.log("STEP8_UNAVAILABLE "+JSON.stringify(observations.filter(x=>!x.source_page_reachable).map(x=>({id:x.pilot_id,url:x.source_url,http_status:x.http_status,content_type:x.content_type,notes:x.notes}))));

console.log("STEP8_SOURCE_OBSERVATIONS_COMPACT:"+JSON.stringify(
 observations.map(({pilot_id,category,manufacturer,model,source_url,http_status,
  source_page_reachable,title_excerpt,source_model_title_overlap,title_review_signal,
  component_classification,eligible_as_standalone_component_research,missing_required_specs})=>
  ({pilot_id,category,manufacturer,model,source_url,http_status,source_page_reachable,
    title_excerpt,source_model_title_overlap,title_review_signal,
    component_classification,eligible_as_standalone_component_research,missing_required_specs}))
));
