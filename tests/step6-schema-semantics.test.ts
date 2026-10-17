import {test, expect} from "bun:test";
import step5 from "../qa/step5-four-products-source-evidence.json";
import correction from "../qa/step6-field-semantics-correction.json";

test("Step 6 canonical voltages are cell counts and not nominal volts",()=>{
  expect(correction.field_mappings).toHaveLength(3);
  expect(correction.reviewer_approval).toBe(false);
  const battery=correction.field_mappings.find(x=>x.category==="battery")!;
  expect(battery.schema_field_key).toBe("voltage");
  expect(battery.canonical_db_value).toBe(3);
  expect(battery.nominal_volts_display_only).toBe(11.1);
  const esc=correction.field_mappings.filter(x=>x.category==="esc");
  expect(esc.map(x=>x.canonical_db_value).sort()).toEqual([3,6]);
  expect(esc.map(x=>x.nominal_volts_display_only).sort((a,b)=>a-b)).toEqual([11.1,22.2]);
  expect(correction.field_mappings.every(x=>x.unit==="cells")).toBe(true);
});

test("Step 5 source report nominal voltages cannot be mistaken for schema field",()=>{
  const battery=step5.candidates.find(x=>x.category==="battery")!;
  const esc=step5.candidates.find(x=>x.category==="esc")!;
  expect(battery.required_field_evidence.voltage.value).toBe(11.1);
  expect(esc.required_field_evidence.minVoltage.value).toBe(11.1);
  expect(esc.required_field_evidence.maxVoltage.value).toBe(22.2);
  for(const key of ["minVoltage","maxVoltage"] as const)
    expect(esc.required_field_evidence[key].provenance).toContain("DERIVED");
});
