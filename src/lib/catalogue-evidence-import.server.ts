import "@tanstack/react-start/server-only";

import { validateCatalogueSpecEvidenceCsv } from "./catalogue-evidence-import";
import { supabaseRestRequest } from "./supabase-rest.server";

type StageCatalogueSpecEvidenceCsvInput = {
  csvText: string;
  fileName: string;
};

type ImportBatchRow = { id: string };

export async function stageCatalogueSpecEvidenceCsv({
  csvText,
  fileName,
}: StageCatalogueSpecEvidenceCsvInput) {
  const validation = validateCatalogueSpecEvidenceCsv(csvText);
  const batchStatus =
    validation.validRows.length > 0 ? "needs_review" : "rejected";

  const batches = await supabaseRestRequest<ImportBatchRow[]>(
    "catalogue_import_batches",
    {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify([
        {
          source_id: null,
          file_name: fileName,
          import_kind: "spec_evidence",
          status: batchStatus,
          total_rows:
            validation.validRows.length + validation.invalidRows.length,
          valid_rows: validation.validRows.length,
          invalid_rows: validation.invalidRows.length,
          notes:
            "Specification evidence is staged only. Canonical verification requires explicit review and promotion.",
        },
      ]),
    },
  );

  const batch = batches[0];
  if (!batch) {
    throw new Error("Supabase did not return the staged evidence batch.");
  }

  const rows = [
    ...validation.validRows.map((row) => ({
      batch_id: batch.id,
      row_number: row.rowNumber,
      proposed_product_id: row.data.productId,
      raw_data: row.raw,
      normalized_data: row.data,
      status: "needs_review",
      validation_errors: row.reviewIssues,
      duplicate_product_id: null,
    })),
    ...validation.invalidRows.map((row) => ({
      batch_id: batch.id,
      row_number: row.rowNumber,
      proposed_product_id: row.raw["product_id"] || null,
      raw_data: row.raw,
      normalized_data: null,
      status: "rejected",
      validation_errors: row.errors,
      duplicate_product_id: null,
    })),
  ];

  if (rows.length > 0) {
    await supabaseRestRequest("catalogue_import_rows", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(rows),
    });
  }

  return {
    batchId: batch.id,
    status: batchStatus,
    totalRows: rows.length,
    validRows: validation.validRows.length,
    invalidRows: validation.invalidRows.length,
    needsReviewRows: validation.validRows.length,
  };
}
