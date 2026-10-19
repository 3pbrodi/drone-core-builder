import {test,expect} from "bun:test";
import {selectManufacturerProductTitle} from "../src/lib/catalogue-source-title";

test("TBS generic SHOP heading is skipped in favor of actual model heading",()=>{
 const html="<title>Team BlackSheep Store</title><h1>SHOP</h1><h1>TBS Lucid 6S 4in1 ESC</h1>";
 const r=selectManufacturerProductTitle(html,"TBS Lucid 6S 4in1 ESC | Team BlackSheep");
 expect(r.title).toBe("TBS Lucid 6S 4in1 ESC");
 expect(r.titleMatch).toBe("possible_exact_model");
 expect(r.score).toBe(100);
});
test("Critical 8S alternative cannot be accepted for the 6S release candidate",()=>{
 const html="<h1>SHOP</h1><h1>TBS Lucid 8S 4in1 ESC</h1>";
 const r=selectManufacturerProductTitle(html,"TBS Lucid 6S 4in1 ESC | Team BlackSheep");
 expect(r.titleMatch).toBe("ambiguous_model_or_variant");
});
test("TBS standard Nano RX lacks SE, so blocks special edition",()=>{
 const r=selectManufacturerProductTitle(
 "<h1>SHOP</h1><h1>TBS Crossfire Nano RX</h1>",
 "TBS Crossfire Nano RX (SE) - FPV Long Range Drone Receiver | Team BlackSheep");
 expect(r.titleMatch).toBe("ambiguous_model_or_variant");
});
test("Proper SE receiver, unique variant, becomes an auditable hint not verified",()=>{
 const r=selectManufacturerProductTitle(
 "<h1>SHOP</h1><h1>TBS Crossfire Nano RX (SE) - FPV Long Range Drone Receiver</h1>",
 "TBS Crossfire Nano RX (SE) - FPV Long Range Drone Receiver | Team BlackSheep");
 expect(r.titleMatch).toBe("possible_exact_model");
});
test("Motor 1404 4600KV is not the 1507 3600KV variant",()=>{
 const r=selectManufacturerProductTitle(
 "<h1>SpeedyBee 1507-3600KV Motor</h1>",
 "SpeedyBee 1404-4600KV Motor Bee25 2.5 inch FPV");
 expect(r.titleMatch).toBe("ambiguous_model_or_variant");
});
test("Script-injected headings and generic title do not become exact products",()=>{
 const r=selectManufacturerProductTitle(
 '<script><h1>TBS Lucid 6S 4in1 ESC</h1></script><h1>SHOP</h1><title>Store</title>',
 "TBS Lucid 6S 4in1 ESC");
 expect(r.titleMatch).toBe("ambiguous_model_or_variant");
});
test("No heading or product metadata results in review hold",()=>{
 const r=selectManufacturerProductTitle("<h1>SHOP</h1>","TBS Lucid 6S 4in1 ESC");
 expect(r.titleMatch).toBe("ambiguous_model_or_variant");
 expect(r.title).toBeNull();
});
