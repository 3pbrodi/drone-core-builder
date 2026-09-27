import { describe, expect, test } from "bun:test";

import {
  validateCatalogueSpecEvidenceCsv,
  type CatalogueSpecEvidenceImportRow,
} from "../src/lib/catalogue-evidence-import";
import { validateCatalogueProductCsv } from "../src/lib/catalogue-import";
import {
  catalogueSourceChanged,
  hashCatalogueSourceContent,
} from "../src/lib/catalogue-source-snapshot";

const evidenceHeader = [
  "product_id",
  "field_key",
  "value_type",
  "value",
  "unit",
  "value_semantics",
  "source_name",
  "source_kind",
  "source_url",
  "authority",
  "exact_model_association",
  "retrieved_at",
  "conditions_json",
  "caveats",
].join(",");

function evidenceRow(overrides: Partial<Record<string, string>> = {}) {
  const row: Record<string, string> = {
    product_id: "frame5",
    field_key: "mount",
    value_type: "string",
    value: "16x16",
    unit: "mm",
    value_semantics: "motor mounting pattern",
    source_name: "iFlight",
    source_kind: "manufacturer",
    source_url: "https://shop.iflight.com/Evoque-F5-V2-Frame-Kit-Pro1887",
    authority: "manufacturer",
    exact_model_association: "true",
    retrieved_at: "2026-09-28T00:00:00Z",
    conditions_json: "{}",
    caveats: "",
    ...overrides,
  };

  return [
    row.product_id,
    row.field_key,
    row.value_type,
    row.value,
    row.unit,
    row.value_semantics,
    row.source_name,
    row.source_kind,
    row.source_url,
    row.authority,
    row.exact_model_association,
    row.retrieved_at,
    row.conditions_json,
    row.caveats,
  ].join(",");
}

describe("Phase C source-backed evidence import", () => {
  test("reviewed evidence dataset parses without structural errors and never imports as verified", async () => {
    const csv = await Bun.file("docs/data/catalogue-phase-c-reviewed-evidence.csv").text();
    const result = validateCatalogueSpecEvidenceCsv(csv);

    expect(result.invalidRows).toHaveLength(0);
    expect(result.validRows).toHaveLength(7);
    for (const row of result.validRows) {
      expect(row.data.verificationStatus).toBe("pending_review");
      expect(row.reviewIssues.some((issue) => issue.includes("staged only"))).toBe(true);
    }
  });

  test("duplicate evidence for the same product, field, and source URL is rejected", () => {
    const row = evidenceRow();
    const result = validateCatalogueSpecEvidenceCsv([evidenceHeader, row, row].join("\n"));

    expect(result.validRows).toHaveLength(1);
    expect(result.invalidRows).toHaveLength(1);
    expect(result.invalidRows[0]?.errors[0]).toContain("Duplicate evidence");
  });

  test("known fields reject inconsistent units", () => {
    const result = validateCatalogueSpecEvidenceCsv(
      [
        evidenceHeader,
        evidenceRow({
          field_key: "escAmps",
          value_type: "number",
          value: "55",
          unit: "mA",
        }),
      ].join("\n"),
    );

    expect(result.validRows).toHaveLength(0);
    expect(result.invalidRows[0]?.errors[0]).toContain("must use unit A");
  });

  test("malformed condition JSON is rejected", () => {
    const result = validateCatalogueSpecEvidenceCsv(
      [
        evidenceHeader,
        evidenceRow({
          conditions_json: "{not-json}",
        }),
      ].join("\n"),
    );

    expect(result.validRows).toHaveLength(0);
    expect(result.invalidRows[0]?.errors[0]).toContain("valid JSON");
  });

  test("retailer evidence can be staged but is explicitly flagged for technical review", () => {
    const result = validateCatalogueSpecEvidenceCsv(
      [
        evidenceHeader,
        evidenceRow({
          source_name: "Example Retailer",
          source_kind: "retailer",
          source_url: "https://example.com/product",
          authority: "retailer",
        }),
      ].join("\n"),
    );

    expect(result.invalidRows).toHaveLength(0);
    const row = result.validRows[0];
    expect(row?.data.authority).toBe("retailer");
    expect(
      row?.reviewIssues.some((issue) =>
        issue.includes("not manufacturer or official documentation"),
      ),
    ).toBe(true);
  });

  test("product CSV rejects zero for fields that the PostgreSQL schema requires to be positive", () => {
    const csv = [
      "id,category,display_name,frame_size_inches",
      "zero-frame,frame,Zero Frame,0",
    ].join("\n");

    const result = validateCatalogueProductCsv(csv);
    expect(result.validRows).toHaveLength(0);
    expect(result.invalidRows).toHaveLength(1);
  });

  test("product CSV rejects malformed source URLs", () => {
    const csv = ["id,category,display_name,source_url", "bad-url,frame,Bad URL,not-a-url"].join(
      "\n",
    );

    const result = validateCatalogueProductCsv(csv);
    expect(result.validRows).toHaveLength(0);
    expect(result.invalidRows).toHaveLength(1);
  });
});

describe("source snapshot change detection", () => {
  test("identical source content hashes consistently", async () => {
    const first = await hashCatalogueSourceContent("manufacturer data");
    const second = await hashCatalogueSourceContent("manufacturer data");
    expect(first).toBe(second);
    expect(catalogueSourceChanged(first, second)).toBe(false);
  });

  test("changed source content produces a different hash", async () => {
    const first = await hashCatalogueSourceContent("manufacturer data");
    const second = await hashCatalogueSourceContent("manufacturer data v2");
    expect(first).not.toBe(second);
    expect(catalogueSourceChanged(first, second)).toBe(true);
  });
});
