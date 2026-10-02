import "@tanstack/react-start/server-only";

import {
  validateCatalogueProductCsv,
  validateCatalogueProductRows,
  type CatalogueProductImportRow,
  type ValidatedCatalogueImportRow,
} from "./catalogue-import";
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

type SourceAdapterRow = {
  id: string;
  max_batch_size: number;
};

export type CatalogueImportDedupeSummary = {
  batchId: string;
  newRows: number;
  exactMatches: number;
  probableMatches: number;
  conflicts: number;
};

export type StageCatalogueProductBatchInput = {
  rows: readonly CatalogueProductImportRow[] | readonly Record<string, unknown>[];
  sourceName: string;
  sourceKind?: CatalogueSourceKind;
  adapterKey: string;
  adapterType?: "csv" | "json" | "api" | "shopify" | "manufacturer" | "retailer";
  sourceRunId?: string;
  sourceCursor?: string;
  maxBatchSize?: number;
  autoLinkExactMatches?: boolean;
};

function toPostgrestQuery(params: Record<string, string>) {
  return new URLSearchParams(params).toString();
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size) as T[]);
  }
  return chunks;
}

async function runBatchDedupe(batchId: string) {
  return supabaseRestRequest<CatalogueImportDedupeSummary>(
    "rpc/catalogue_run_import_dedupe",
    {
      method: "POST",
      body: JSON.stringify({ p_batch_id: batchId }),
    },
  );
}

async function findOrCreateSourceAdapter(input: {
  sourceId: string;
  adapterKey: string;
  adapterType: NonNullable<StageCatalogueProductBatchInput["adapterType"]>;
  maxBatchSize: number;
}) {
  const query = toPostgrestQuery({
    select: "id,max_batch_size",
    adapter_key: `eq.${input.adapterKey}`,
    limit: "1",
  });
  const existing = await supabaseRestRequest<SourceAdapterRow[]>(
    `catalogue_source_adapters?${query}`,
  );
  if (existing[0]) return existing[0];

  const rows = await supabaseRestRequest<SourceAdapterRow[]>(
    "catalogue_source_adapters",
    {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify([
        {
          source_id: input.sourceId,
          adapter_key: input.adapterKey,
          adapter_type: input.adapterType,
          max_batch_size: input.maxBatchSize,
          active: true,
        },
      ]),
    },
  );

  const row = rows[0];
  if (!row) throw new Error("Supabase did not return the source adapter.");
  return row;
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

  const dedupe = await runBatchDedupe(batch.id);

  return {
    batchId: batch.id,
    status: batchStatus,
    totalRows: stagedRows.length,
    validRows: validation.validRows.length,
    invalidRows,
    needsReviewRows: validRowsNeedingReview,
    dedupe,
  };
}

export async function stageCatalogueProductBatch(
  input: StageCatalogueProductBatchInput,
) {
  const sourceKind = input.sourceKind ?? "api";
  const validation = validateCatalogueProductRows(input.rows);
  const sourceId = await findOrCreateCatalogueSource(input.sourceName, sourceKind);
  const adapter = await findOrCreateSourceAdapter({
    sourceId,
    adapterKey: input.adapterKey.trim(),
    adapterType: input.adapterType ?? "api",
    maxBatchSize: input.maxBatchSize ?? 500,
  });

  const stagedRows = [
    ...validation.validRows.map((row) => ({
      row_number: row.rowNumber,
      proposed_product_id: row.data.id,
      raw_data: row.raw,
      normalized_data: row.data,
      status: row.reviewIssues.length > 0 ? "needs_review" : "validated",
      validation_errors: row.reviewIssues,
      duplicate_product_id: null,
    })),
    ...validation.invalidRows.map((row) => ({
      row_number: row.rowNumber,
      proposed_product_id:
        typeof row.raw["id"] === "string" && row.raw["id"].trim()
          ? row.raw["id"]
          : null,
      raw_data: row.raw,
      normalized_data: null,
      status: "rejected",
      validation_errors: row.errors,
      duplicate_product_id: null,
    })),
  ];

  const batchStatus =
    validation.invalidRows.length > 0 ||
    validation.validRows.some((row) => row.reviewIssues.length > 0)
      ? "needs_review"
      : "validated";

  const batches = await supabaseRestRequest<ImportBatchRow[]>(
    "catalogue_import_batches",
    {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify([
        {
          source_id: sourceId,
          adapter_id: adapter.id,
          source_run_id: input.sourceRunId?.trim() || null,
          source_cursor: input.sourceCursor?.trim() || null,
          file_name: `${input.adapterKey}-batch.json`,
          status: batchStatus,
          total_rows: stagedRows.length,
          valid_rows: validation.validRows.length,
          invalid_rows: validation.invalidRows.length,
        },
      ]),
    },
  );

  const batch = batches[0];
  if (!batch) throw new Error("Supabase did not return the staged import batch.");

  const insertChunkSize = Math.min(adapter.max_batch_size || 500, 500);
  for (const rows of chunk(stagedRows, insertChunkSize)) {
    await supabaseRestRequest("catalogue_import_rows", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(rows.map((row) => ({ ...row, batch_id: batch.id }))),
    });
  }

  const dedupe = await runBatchDedupe(batch.id);

  let linkedExactMatches = 0;
  if (input.autoLinkExactMatches) {
    const result = await supabaseRestRequest<{ linkedRows: number }>(
      "rpc/catalogue_link_exact_import_matches",
      {
        method: "POST",
        body: JSON.stringify({
          p_batch_id: batch.id,
          p_reviewer: "DroneCores trusted batch importer",
          p_notes:
            "Exact source/SKU/MPN matches were linked to the existing canonical product; no canonical specs were overwritten.",
        }),
      },
    );
    linkedExactMatches = result.linkedRows ?? 0;
  }

  return {
    batchId: batch.id,
    status: batchStatus,
    totalRows: stagedRows.length,
    validRows: validation.validRows.length,
    invalidRows: validation.invalidRows.length,
    dedupe,
    linkedExactMatches,
  };
}
