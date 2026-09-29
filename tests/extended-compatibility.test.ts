import {describe,expect,test} from "bun:test";
import {evaluateCompatibilityRules,type CompatibilityVerification,type SelectedProducts} from "../src/lib/build-calculations";
import type {Product} from "../src/lib/build-data";

const product=(overrides:Partial<Product>):Product=>({id:"fixture",category:"frame",name:"Fixture",spec:"Fixture",price:1,weight:1,...overrides});
function rule(code:string,selected:SelectedProducts,verification:CompatibilityVerification={}){
  const found=evaluateCompatibilityRules(selected,verification).find((item)=>item.code===code);
  if(!found) throw new Error(`Missing rule ${code}`);
  return found;
}

describe("Optional and Pilot Gear compatibility",()=>{
  test("radio / receiver becomes verified only from verified protocol fields",()=>{
    const receiver=product({id:"rx",category:"receiver",receiverProtocol:"CRSF"});
    const radio=product({id:"radio",category:"radioTransmitter",radioProtocols:["CRSF","ELRS"]});
    const verification:CompatibilityVerification={receiver:["receiverProtocol"],radioTransmitter:["radioProtocols"]};
    expect(rule("RADIO_RECEIVER_PROTOCOL",{receiver,radioTransmitter:radio},verification).status).toBe("pass");
    expect(rule("RADIO_RECEIVER_PROTOCOL",{receiver,radioTransmitter:radio},verification).evidenceLevel).toBe("verified");
    expect(rule("RADIO_RECEIVER_PROTOCOL",{receiver,radioTransmitter:radio}).evidenceLevel).toBe("unverified");
  });
  test("goggles / video mismatch can be a verified incompatibility",()=>{
    const camera=product({id:"camera",category:"camera",video:"analog"});
    const goggles=product({id:"goggles",category:"fpvGoggles",supportedVideoSystems:["DJI O4"]});
    const verification:CompatibilityVerification={camera:["video"],fpvGoggles:["supportedVideoSystems"]};
    expect(rule("GOGGLES_VIDEO_SYSTEM",{camera,fpvGoggles:goggles},verification).status).toBe("fail");
  });
  test("battery / charger checks chemistry, cell count and connector",()=>{
    const battery=product({id:"battery",category:"battery",batteryChemistry:"LiPo",voltage:6,batteryConnector:"XT60"});
    const charger=product({id:"charger",category:"batteryCharger",chargerBatteryChemistries:["LiPo"],chargerMinCells:1,chargerMaxCells:6,chargerConnectors:["XT60"]});
    const verification:CompatibilityVerification={battery:["batteryChemistry","voltage","batteryConnector"],batteryCharger:["chargerBatteryChemistries","chargerMinCells","chargerMaxCells","chargerConnectors"]};
    expect(rule("BATTERY_CHARGER",{battery,batteryCharger:charger},verification).status).toBe("pass");
    expect(rule("BATTERY_CHARGER",{battery,batteryCharger:charger},verification).evidenceLevel).toBe("verified");
  });
  test("GPS / FC remains unknown when interface or power data are incomplete",()=>{
    const gps=product({id:"gps",category:"gps",deviceSignalInterface:"UART"});
    const fc=product({id:"fc",category:"flightController",fcPeripheralInterfaces:["UART"]});
    expect(rule("GPS_FC_INTEGRATION",{gps,flightController:fc}).status).toBe("unknown");
  });
});
