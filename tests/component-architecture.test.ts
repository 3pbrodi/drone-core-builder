import {describe,expect,test} from "bun:test";
import {categories,type Product} from "../src/lib/build-data";
import {allCategoryIds,categoryMetadata,optionalCategoryIds,pilotGearCategoryIds,sectionOrder} from "../src/lib/component-categories";
import {integratedRequiredFulfillments,requiredCategoriesForSelection,sectionCategoriesForSelection,selectionPriceSummary} from "../src/lib/configurator-selection";

const product=(overrides:Partial<Product>):Product=>({id:"fixture",category:"frame",name:"Fixture",spec:"Fixture",price:10,weight:10,...overrides});

describe("shared component architecture",()=>{
  test("keeps the original eight core category identifiers stable",()=>{
    expect(categories).toEqual(["frame","motors","flightController","esc","propellers","battery","camera","receiver"]);
  });
  test("defines Required, Optional, Pilot Gear in the mandated order",()=>{
    expect(sectionOrder).toEqual(["required","optional","pilotGear"]);
    expect(allCategoryIds.slice(0,8)).toEqual(categories);
  });
  test("represents new Optional and Pilot Gear categories centrally",()=>{
    expect(optionalCategoryIds).toEqual(["videoTransmitter","gps","buzzer","antenna","powerAccessory","optionalModule"]);
    expect(pilotGearCategoryIds).toEqual(["radioTransmitter","fpvGoggles","batteryCharger","chargingAccessory"]);
    expect(categoryMetadata.radioTransmitter.installationRole).toBe("pilot");
    expect(categoryMetadata.gps.installationRole).toBe("drone");
    expect(categoryMetadata.antenna.allowsMultiple).toBe(true);
  });
  test("documented integration fulfills a missing required role without duplicate slot",()=>{
    const flightController=product({id:"integrated-fc",category:"flightController",integratedCategories:["receiver"]});
    const selected={flightController};
    expect(requiredCategoriesForSelection(selected)).not.toContain("receiver");
    expect(integratedRequiredFulfillments(selected)).toEqual([{category:"receiver",product:flightController}]);
  });
  test("integrated VTX is hidden from Optional unless explicitly selected",()=>{
    const camera=product({id:"air-unit",category:"camera",integratedCategories:["videoTransmitter"]});
    expect(sectionCategoriesForSelection("optional",{camera})).not.toContain("videoTransmitter");
  });
  test("keeps Pilot Gear out of drone subtotal",()=>{
    expect(selectionPriceSummary({
      frame:product({id:"frame",category:"frame",price:100}),
      gps:product({id:"gps",category:"gps",price:20}),
      radioTransmitter:product({id:"radio",category:"radioTransmitter",price:300}),
    })).toEqual({drone:120,pilotGear:300,overall:420});
  });
});
