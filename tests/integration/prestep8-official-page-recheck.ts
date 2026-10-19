/** Read-only manufacturer's official HTML source recheck; does NOT verify images,
 * EU price, merchant availability, rights or issue reviewer approval.
 * Results are single-run observations; never write Production or hotlink images.
 */
type Target={
 id:string;url:string;expected:{key:string,pattern:string}[];
};
const target:Target[]=[
 {id:"qa-cnhl-black-v2-1300mah-3s-130c-xt60-1pack",
  url:"https://chinahobbyline.com/de/products/cnhl-black-series-1300mah-11-1v-3s-130c-lipo-battery-with-xt60-plug",
  expected:[{key:"sku",pattern:"1301303BK"},{key:"capacity",pattern:"1300\\s*mAh"},{key:"cell_count",pattern:"3S1P"},{key:"connector",pattern:"XT60"}]},
 {id:"qa-hqprop-ethix-p2-pickle-2cw2ccw",
  url:"https://www.hqprop.com/ethix-p2-pickle-prop-2cw2ccw-poly-carbonate-p0459.html",
  expected:[{key:"model",pattern:"Ethix\\s*P2\\s*Pickle"},{key:"diameter",pattern:"5[.]1\\s*inch"},{key:"pitch",pattern:"Pitch\\s*[:：]?\\s*2[.]9"},{key:"two_cw",pattern:"2\\s*x\\s*CW"},{key:"two_ccw",pattern:"2\\s*x\\s*CCW"}]},
 {id:"qa-tbs-crossfire-nano-rx-se",
  url:"https://www.team-blacksheep.com/products/prod:crossfire_nano_se",
  expected:[{key:"se",pattern:"Nano\\s*RX\\s*\\(SE\\)"},{key:"antenna",pattern:"Immortal[\\s-]*T\\s*V2"},{key:"protocol",pattern:"CRSF"},{key:"frequency_low",pattern:"868\\s*MHz"},{key:"frequency_high",pattern:"915\\s*MHz"},{key:"voltage_low",pattern:"3[.]3\\s*V"},{key:"voltage_high",pattern:"8[.]4\\s*V"}]},
 {id:"qa-tbs-lucid-6s-60a-4in1-esc",
  url:"https://www.team-blacksheep.com/products/prod:lucid_4in1",
  expected:[{key:"model",pattern:"Lucid\\s*6S\\s*4in1\\s*ESC"},{key:"esc_amp",pattern:"60A"},{key:"input_cells",pattern:"3[\\s-]*6S"},{key:"am32",pattern:"AM32"}]}
];
function textFromHtml(html:string) {
 return html.replace(/<script\b[\s\S]*?<\/script>/gi," ")
   .replace(/<style\b[\s\S]*?<\/style>/gi," ")
   .replace(/<[^>]*>/g," ").replace(/&nbsp;|&#160;/g," ")
   .replace(/&amp;/g,"&").replace(/\s+/g," ").trim();
}
const results=[];
for(const t of target){
 const startedAt=new Date().toISOString();
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),15000);
 let entry:{id:string,source_url:string,checked_at:string,response_status:number|null,
  source_page_reachable:boolean,checked_claims:Record<string,boolean>,
  human_verified:boolean,publication_authorized:boolean,reason:string}={
   id:t.id,source_url:t.url,checked_at:startedAt,response_status:null,
   source_page_reachable:false,checked_claims:{},human_verified:false,
   publication_authorized:false,reason:"Source unavailable",
  };
 try {
  const resp=await fetch(t.url,{redirect:"follow",signal:controller.signal,
   headers:{"accept":"text/html,application/xhtml+xml","user-agent":"DroneCoresEvidenceVerifier/1.0"}});
  entry.response_status=resp.status;
  const type=resp.headers.get("content-type")??"";
  if(resp.ok && type.toLowerCase().includes("text/html")){
    const html=await resp.text();
    if(html.length<=4_000_000){
      entry.source_page_reachable=true;
      const content=textFromHtml(html);
      for(const e of t.expected){
        entry.checked_claims[e.key]=new RegExp(e.pattern,"i").test(content);
      }
      entry.reason=Object.values(entry.checked_claims).every(Boolean)
       ?"Official manufacturer page contains expected identity/spec markers; reviewer approval NOT granted"
       :"Manufacturer page accessible but some expected markers absent; keep review pending";
    }else entry.reason="Oversized HTML not parsed";
  }else entry.reason="Non-HTML or non-success source response";
 }catch(e){entry.reason="Source fetch error: "+String(e).slice(0,130)}
 finally {clearTimeout(timer);}
 results.push(entry);
}
const output={
 checked_at:new Date().toISOString(),source_type:"manufacturer_official_html",
 url_fetches:results.length,
 images_downloaded:0, database_writes:0,
 independent_human_review_count:0,
 publication_permissions_granted:0,
 results
};
Deno.writeTextFileSync(Deno.args[0]??"prestep8-results/manufacturer-pages.json",
 JSON.stringify(output,null,2)+"\n");
console.log(JSON.stringify({source_pages:results.length,reachable:results.filter(x=>x.source_page_reachable).length,
 all_expected_markers:results.filter(x=>Object.values(x.checked_claims).length>0&&Object.values(x.checked_claims).every(Boolean)).length,
 missing:results.map(x=>({id:x.id,missing:Object.entries(x.checked_claims).filter(([_,v])=>!v).map(([k])=>k),
 reason:x.reason})),human_approved:0,images_downloaded:0}));
