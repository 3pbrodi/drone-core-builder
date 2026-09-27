import "@tanstack/react-start/server-only";

import { validateCatalogueProductCsv, type ValidatedCatalogueImportRow } from "./catalogue-import";
import { findOrCreateCatalogueSource, type CatalogueSourceKind } from "./catalogue-source.server";
import { supabaseRestRequest } from "./supabase-rest.server";

type StageCatalogueCsvInput = {
  csvText: string;
  fileName: string;
  sourceName: string;
  sourceKind?: CatalogueSourceKind;
};

type IdRow = { id: string };

type ImportBatchRow = {
  id: string;
};

function toPostgrestQuery(params: Record<string, string>) {
  return new URLSearchParams(params).toString();
}

async function findExistingProductIds(ids: string[]) {
  if (ids.length === 0) return new Set<string>();

  const query = toPostgrestQuery({
    select: "id",
    id: `in.(${ids.join(",")})`,
  });
  const rows = await supabaseRestRequest<IdRow[]>(`catalogue_products?${query}`);
  return new Set(rows.map((row) => row.id));
}

function importRowStatus(row: ValidatedCatalogueImportRow, duplicateProductIds: Set<string>) {
  if (duplicateProductIds.has(row.data.id)) return "needs_review";
  if (row.reviewIssues.length > 0) return "needs_review";
  return "validated";
}

export async function stageCatalogueProductCsv({
  csvText,
  fileName,
  sourceName,
  sourceKind = "csv",
}: StageCatalogueCsvInput) {
  const validation = validateCatalogueProductCsv(csvText);
  const sourceId = await findOrCreateCatalogueSource(sourceName, sourceKind);
  const duplicateProductIds = await findExistingProductIds(
    validation.validRows.map((row) => row.data.id),
  );

  const validRowsNeedingReview = validation.validRows.filter(
    (row) => row.reviewIssues.length > 0 || duplicateProductIds.has(row.data.id),
  ).length;
  const invalidRows = validation.invalidRows.length;
  const batchStatus = validRowsNeedingReview > 0 || invalidRows > 0 ? "needs_review" : "validated";

  const batches = await supabaseRestRequest<ImportBatchRow[]>("catalogue_import_batches", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify([
      {
        source_id: sourceId,
        file_name: fileName,
        status: batchStatus,
        total_rows: validation.validRows.length + validation.invalidRows.length,
        valid_rows: validation.validRows.length,
        invalid_rows: validation.invalidRows.length,
      },
    ]),
  });

  const batch = batches[0];
  if (!batch) {
    throw new Error("Supabase did not return the staged import batch.");
  }

  const stagedRows = [
    ...validation.validRows.map((row) => ({
      batch_id: batch.id,
      row_number: row.rowNumber,
      proposed_product_id: row.data.id,
      raw_data: row.raw,
      normalized_data: row.data,
      status: importRowStatus(row, duplicateProductIds),
      validation_errors: [
        ...row.reviewIssues,
        ...(duplicateProductIds.has(row.data.id)
          ? ["Product ID already exists in the canonical catalogue."]
          : []),
      ],
      duplicate_product_id: duplicateProductIds.has(row.data.id) ? row.data.id : null,
    })),
    ...validation.invalidRows.map((row) => ({
      batch_id: batch.id,
      row_number: row.rowNumber,
      proposed_product_id: row.raw["id"] || null,
      raw_data: row.raw,
      normalized_data: null,
      status: "rejected",
      validation_errors: row.errors,
      duplicate_product_id: null,
    })),
  ];

  if (stagedRows.length > 0) {
    await supabaseRestRequest("catalogue_import_rows", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(stagedRows),
    });
  }

  return {
    batchId: batch.id,
    status: batchStatus,
    totalRows: stagedRows.length,
    validRows: validation.validRows.length,
    invalidRows,
    needsReviewRows: validRowsNeedingReview,
  };
}
