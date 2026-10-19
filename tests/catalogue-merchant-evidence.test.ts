import {test, expect} from "bun:test";
import {parseRotoramaCnhl1300ThreeS,parseRctechEthixP2Exact} from "../src/lib/catalogue-merchant-evidence";

const rotorama=(status="Auf Lager",price="€ 14,39",variant="3S1P") => [
 "<main><h1>CNHL Black Series 1300mAh 3S 130C</h1>",
 "<section><div>"+status+"</div><strong>"+price+"</strong>",
 "<p>Konfiguration: "+variant+"</p><p>XT60 / Einzelakku</p></section></main>"
].join("");
const hq=(status="Sofort verfügbar", sku="EthixP2-PK-PC", price="2,99 €")=>[
 "<main><h1>HQProp Ethix P2 Pickle Prop Propeller (4 Stk.)</h1>",
 "<p>Artikelnummer: "+sku+"</p><p>GTIN: 9313448340470</p>",
 "<section><b>"+price+"</b> "+status+"</section></main>"
].join("");

test("CNHL genuine 3S XT60 reads its own EUR price and stock",()=>{
 const value=parseRotoramaCnhl1300ThreeS(rotorama());
 expect(value).toMatchObject({price:14.39,stock:"in_stock",identityMatched:true});
 expect(value.reasons).toEqual([]);
});
test("CNHL rejects wrong 6S title even if 3S appears elsewhere",()=>{
 const value=parseRotoramaCnhl1300ThreeS(rotorama().replace("1300mAh 3S 130C","1300mAh 6S 130C"));
 expect(value.identityMatched).toBe(false);
 expect(value.price).toBeNull();
});
test("CNHL rejects 3S title if canonical 3S1P variant evidence absent",()=>{
 const value=parseRotoramaCnhl1300ThreeS(rotorama().replace("3S1P","6S1P"));
 expect(value.identityMatched).toBe(false);
});
test("CNHL does not fabricate stock if availability marker missing",()=>{
 const value=parseRotoramaCnhl1300ThreeS(rotorama("Lieferstatus unbekannt"));
 expect(value).toMatchObject({price:14.39,stock:"unknown",identityMatched:true});
});
test("CNHL conflicting stock markers stay unresolved",()=>{
 const value=parseRotoramaCnhl1300ThreeS(rotorama("Auf Lager - Ausverkauft"));
 expect(value.stock).toBe("unknown");
});
test("CNHL unrelated script prices or shop recommendations never become product prices",()=>{
 const html=rotorama("Auf Lager","").replace("</main>",
 "<script>const recommendation = '€ 199,95';</script></main>");
 const value=parseRotoramaCnhl1300ThreeS(html);
 expect(value.price).toBeNull();
});
test("CNHL contradictory meta and visible EUR prices stay unknown",()=>{
 const value=parseRotoramaCnhl1300ThreeS(
 "<meta property='product:price:amount' content='15.99'>"+rotorama()
 );
 expect(value.price).toBeNull();
});
test("HQProp exact four-pack title, SKU, GTIN and inventory",()=>{
 const value=parseRctechEthixP2Exact(hq());
 expect(value).toMatchObject({price:2.99,stock:"in_stock",identityMatched:true});
});
test("HQProp P3 or mismatched manufacturer SKU never used as P2",()=>{
 expect(parseRctechEthixP2Exact(hq().replace("Ethix P2 Pickle","Ethix P3 Pickle")).identityMatched).toBe(false);
 expect(parseRctechEthixP2Exact(hq("Auf Lager","EthixP3-PBJ-PC")).identityMatched).toBe(false);
});
test("HQProp refuses two-packs even with identical SKU",()=>{
 expect(parseRctechEthixP2Exact(hq().replace("4 Stk.","2 Stk.")).identityMatched).toBe(false);
});
test("HQProp missing inventory remains unknown (no catalog-page guessing)",()=>{
 const value=parseRctechEthixP2Exact(hq("Bestellstatus prüfen"));
 expect(value).toMatchObject({price:2.99,stock:"unknown",identityMatched:true});
});
test("HQProp stock contradictions fail closed",()=>{
 const value=parseRctechEthixP2Exact(hq("Ausverkauft | Sofort verfügbar"));
 expect(value.stock).toBe("unknown");
});
test("HQProp script and style offers cannot fake product stock",()=>{
 const html=hq("Bestand unbekannt")+
 '<script>var stock="InStock", html="<span>Auf Lager</span>"</script>';
 const value=parseRctechEthixP2Exact(html);
 expect(value.stock).toBe("unknown");
});
