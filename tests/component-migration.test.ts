import {describe,expect,test} from "bun:test";

describe("component architecture migrations",()=>{
  test("keeps category enum expansion separate from schema usage",async()=>{
    const enumSql=await Bun.file("supabase/migrations/20260929175500_component_category_enum.sql").text();
    const architectureSql=await Bun.file("supabase/migrations/20260929175600_component_category_architecture.sql").text();
    for(const category of ["videoTransmitter","gps","buzzer","antenna","powerAccessory","optionalModule","radioTransmitter","fpvGoggles","batteryCharger","chargingAccessory"]){
      expect(enumSql).toContain(`add value if not exists '${category}'`);
      expect(architectureSql).toContain(`('${category}'`);
    }
  });
  test("extends runtime projection without changing existing product identifiers",async()=>{
    const sql=await Bun.file("supabase/migrations/20260929175600_component_category_architecture.sql").text();
    expect(sql).toContain("integrated_categories");
    expect(sql).toContain("included_categories");
    expect(sql).toContain("create or replace view public.catalogue_runtime_products");
    expect(sql).not.toContain("delete from public.catalogue_products");
  });
});
