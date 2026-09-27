import { z } from "zod";

import { parseCsvRecords } from "./catalogue-import";
import type { CatalogueEvidenceAuthority, EvidenceVerificationStatus } from "./catalogue-evidence";
import type { CatalogueSourceKind } from "./catalogue-source.server";

const stableProductId = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);

const optionalText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().optional(),
);

const csvBoolean = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes"].includes(normalized)) return true;
  if (["false", "0", "no"].includes(normalized)) return false;
  return value;
}, z.boolean());

export const catalogueSpecEvidenceCsvColumns = [
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
] as const;

const sourceKinds = [
  "manual",
  "csv",
  "xml",
  "api",
  "shopify",
  "manufacturer",
  "retailer",
] as const satisfies readonly CatalogueSourceKind[];

const authorities = [
  "manufacturer",
  "official_documentation",
  "retailer",
  "community",
  "internal_demo",
] as const satisfies readonly CatalogueEvidenceAuthority[];

const evidenceRowSchema = z.object({
  product_id: stableProductId,
  field_key: z
    .string()
    .trim()
    .regex(/^[A-Za-z][A-Za-z0-9_.:-]{0,127}$/),
  value_type: z.enum(["string", "number", "boolean"]),
  value: z.string().min(1),
  unit: optionalText,
  value_semantics: optionalText,
  source_name: z.string().trim().min(1),
  source_kind: z.enum(sourceKinds),
  source_url: z.string().url(),
  authority: z.enum(authorities),
  exact_model_association: csvBoolean,
  retrieved_at: z.string().datetime({ offset: true }),
  conditions_json: optionalText,
  caveats: optionalText,
});

const expectedUnits: Record<string, string> = {
  weight: "g",
  frameInches: "in",
  propInches: "in",
  voltage: "cells",
  minVoltage: "cells",
  maxVoltage: "cells",
  thrust: "g",
  current: "A",
  escAmps: "A",
  batteryMah: "mAh",
};

export type CatalogueSpecEvidenceImportRow = {
  productId: string;
  fieldKey: string;
  value: string | number | boolean;
  unit?: string;
  valueSemantics?: string;
  sourceName: string;
  sourceKind: CatalogueSourceKind;
  sourceUrl: string;
  authority: CatalogueEvidenceAuthority;
  exactModelAssociation: boolean;
  retrievedAt: string;
  conditions: Record<string, unknown>;
  caveats?: string;
  verificationStatus: EvidenceVerificationStatus;
};

export type ValidatedCatalogueSpecEvidenceRow = {
  rowNumber: number;
  raw: Record<string, string>;
  data: CatalogueSpecEvidenceImportRow;
  reviewIssues: string[];
};

export type InvalidCatalogueSpecEvidenceRow = {
  rowNumber: number;
  raw: Record<string, string>;
  errors: string[];
};

export type CatalogueSpecEvidenceCsvValidationResult = {
  headers: string[];
  validRows: ValidatedCatalogueSpecEvidenceRow[];
  invalidRows: InvalidCatalogueSpecEvidenceRow[];
};

function parseTypedValue(
  type: "string" | "number" | "boolean",
  value: string,
): string | number | boolean {
  if (type === "string") return value;

  if (type === "number") {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      throw new Error("value must be a finite number.");
    }
    return parsed;
  }

  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes"].includes(normalized)) return true;
  if (["false", "0", "no"].includes(normalized)) return false;
  throw new Error("value must be true/false, yes/no, or 1/0.");
}

function parseConditions(value?: string) {
  if (!value) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("conditions_json must contain valid JSON.");
  }

  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error("conditions_json must be a JSON object.");
  }

  return parsed as Record<string, unknown>;
}

function evidenceReviewIssues(row: CatalogueSpecEvidenceImportRow) {
  const issues: string[] = [];

  if (!row.exactModelAssociation) {
    issues.push("The source is not confirmed to describe the exact product/model.");
  }

  if (row.authority !== "manufacturer" && row.authority !== "official_documentation") {
    issues.push(
      "This source is not manufacturer or official documentation and requires technical review.",
    );
  }

  issues.push(
    "Imported evidence is staged only and requires explicit review before it can become verified.",
  );

  return issues;
}

export function validateCatalogueSpecEvidenceCsv(
  csvText: string,
): CatalogueSpecEvidenceCsvValidationResult {
  const records = parseCsvRecords(csvText);
  if (records.length === 0) throw new Error("CSV is empty.");

  const headerRow = records[0];
  if (!headerRow) throw new Error("CSV is missing a header row.");

  const headers = headerRow.map((header, index) =>
    index === 0 ? header.replace(/^\uFEFF/, "").trim() : header.trim(),
  );

  const duplicates = headers.filter((header, index) => headers.indexOf(header) !== index);
  if (duplicates.length > 0) {
    throw new Error(`CSV contains duplicate headers: ${[...new Set(duplicates)].join(", ")}`);
  }

  const supported = new Set<string>(catalogueSpecEvidenceCsvColumns);
  const unknownHeaders = headers.filter((header) => !supported.has(header));
  if (unknownHeaders.length > 0) {
    throw new Error(`CSV contains unsupported columns: ${unknownHeaders.join(", ")}`);
  }

  for (const required of catalogueSpecEvidenceCsvColumns) {
    if (!headers.includes(required)) {
      throw new Error(`CSV is missing required column: ${required}`);
    }
  }

  const validRows: ValidatedCatalogueSpecEvidenceRow[] = [];
  const invalidRows: InvalidCatalogueSpecEvidenceRow[] = [];
  const seenEvidence = new Set<string>();

  records.slice(1).forEach((cells, recordIndex) => {
    const rowNumber = recordIndex + 2;
    const raw = Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));

    if (cells.length !== headers.length) {
      invalidRows.push({
        rowNumber,
        raw,
        errors: [`Expected ${headers.length} columns but found ${cells.length}.`],
      });
      return;
    }

    const parsed = evidenceRowSchema.safeParse(raw);
    if (!parsed.success) {
      invalidRows.push({
        rowNumber,
        raw,
        errors: parsed.error.issues.map((issue) => {
          const field = issue.path.join(".");
          return field ? `${field}: ${issue.message}` : issue.message;
        }),
      });
      return;
    }

    const duplicateKey = [
      parsed.data.product_id,
      parsed.data.field_key,
      parsed.data.source_url,
    ].join("|");
    if (seenEvidence.has(duplicateKey)) {
      invalidRows.push({
        rowNumber,
        raw,
        errors: ["Duplicate evidence row for the same product, field, and source URL."],
      });
      return;
    }

    try {
      const typedValue = parseTypedValue(parsed.data.value_type, parsed.data.value);
      const conditions = parseConditions(parsed.data.conditions_json);
      const expectedUnit = expectedUnits[parsed.data.field_key];

      if (expectedUnit && parsed.data.unit !== expectedUnit) {
        invalidRows.push({
          rowNumber,
          raw,
          errors: [
            `Field ${parsed.data.field_key} must use unit ${expectedUnit}; received ${parsed.data.unit ?? "blank"}.`,
          ],
        });
        return;
      }

      const data: CatalogueSpecEvidenceImportRow = {
        productId: parsed.data.product_id,
        fieldKey: parsed.data.field_key,
        value: typedValue,
        ...(parsed.data.unit ? { unit: parsed.data.unit } : {}),
        ...(parsed.data.value_semantics ? { valueSemantics: parsed.data.value_semantics } : {}),
        sourceName: parsed.data.source_name,
        sourceKind: parsed.data.source_kind,
        sourceUrl: parsed.data.source_url,
        authority: parsed.data.authority,
        exactModelAssociation: parsed.data.exact_model_association,
        retrievedAt: parsed.data.retrieved_at,
        conditions,
        ...(parsed.data.caveats ? { caveats: parsed.data.caveats } : {}),
        verificationStatus: "pending_review",
      };

      seenEvidence.add(duplicateKey);
      validRows.push({
        rowNumber,
        raw,
        data,
        reviewIssues: evidenceReviewIssues(data),
      });
    } catch (error) {
      invalidRows.push({
        rowNumber,
        raw,
        errors: [error instanceof Error ? error.message : "Invalid evidence row."],
      });
    }
  });

  return { headers, validRows, invalidRows };
}
