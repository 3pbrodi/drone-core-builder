import { assertEquals } from "jsr:@std/assert@1.0.16";
import { assessMainComponentScope as assess } from
  "../supabase/functions/_shared/catalogue-scope-quality.ts";

Deno.test("exclude both real TBS false-positive battery pads", () => {
  assertEquals(assess("battery","TBS Battery Anti-slip Pad (3pcs)").excluded,true);
  assertEquals(assess("battery","TBS Ummagrip Battery Pad - TBS Edition").excluded,true);
});
Deno.test("exclude real TBS replacement bearing, not complete motor", () => {
  assertEquals(assess("motors","TBS ETHIX Mr Steele V2 / CATS NSK Bearing 8mm").excluded,true);
  assertEquals(assess("motors","SpeedyBee 1507-3600KV Motor Master3X").excluded,false);
});
Deno.test("exclude actual FS225 replacement arm but preserve complete Bee35 frame", () => {
  assertEquals(assess("frame","SpeedyBee Carbon Fiber Arm For FS225 V2 Frame(1 pcs)").excluded,true);
  assertEquals(assess("frame","SpeedyBee Bee35 3.5 inch Frame").excluded,false);
});
Deno.test("exclude BEC and USB-C extension when wrongly labelled FC", () => {
  assertEquals(assess("flightController","SpeedyBee F405 AIO 9V/5V 2A External BEC").excluded,true);
  assertEquals(assess("flightController","SpeedyBee F405 AIO Type-C extension Module").excluded,true);
  assertEquals(assess("flightController","SpeedyBee F405 AIO 40A Bluejay Flight Controller").excluded,false);
});
Deno.test("exclude actual DALPROP cap and mixed gift set, keep normal 2CW+2CCW propeller sets", () => {
  assertEquals(assess("propellers","Dalprop Cap").excluded,true);
  assertEquals(assess("propellers","Dalprop Gift Packs T5043c T5046 Props 14 Pair").excluded,true);
  assertEquals(assess("propellers","HQProp Ethix P2 Pickle Prop (2CW+2CCW)").excluded,false);
  assertEquals(assess("propellers","Dalprop Cyclone 3 Inch T3056c Pro Racing Drone Propellers").excluded,false);
});
Deno.test("explicit 4-in-1 ESC is not an FC or AIO despite F405/F7 in name", () => {
  assertEquals(assess("flightController","SpeedyBee F405 BLS 50A 30x30 4-in-1 ESC"),{
    category:"esc",excluded:false,reason:null,categoryCorrected:true,
  });
  assertEquals(assess("esc","SpeedyBee F7 V3 BL32 50A 4-in-1 ESC").category,"esc");
  assertEquals(assess("flightController","SpeedyBee F405 AIO 40A Flight Controller").category,"flightController");
});
Deno.test("never disqualify genuine 3S/4S/6S batteries", () => {
  assertEquals(assess("battery","CNHL Black Series V2.0 1300mAh 3S 130C LiPo Battery").excluded,false);
  assertEquals(assess("battery","CNHL 1500mAh 4S 130C LiPo Battery XT60").excluded,false);
});
