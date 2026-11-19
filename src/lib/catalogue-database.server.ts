import "@tanstack/react-start/server-only";
import { loadRuntimeProducts } from "../../supabase/functions/_shared/catalogue-runtime-read";

import { type Category, type Product } from "./build-data";
import {
  emptyCatalogueEvidenceSnapshot,
  type CatalogueEvidenceSnapshot,
} from "./catalogue-evidence";
import { fetchCatalogueEvidenceSnapshotForProductIds } from "./catalogue-evidence.server";
import { validateRuntimeCatalogue, type RuntimeCatalogueValidation } from "./catalogue-runtime";
import { isDatabaseCatalogueEnabled, supabaseRestRequest } from "./supabase-rest.server";

export type DatabaseCatalogueLoadResult = {
  products: Product[];
  rejectedProductIds: string[];
};

export type ServerCatalogueSnapshot = {
  source: "database" | "unavailable";
  status: "ready" | "database_disabled" | "database_unavailable" | "coverage_failed";
  products: Product[];
  evidence: CatalogueEvidenceSnapshot;
  validation: RuntimeCatalogueValidation;
  error?: string;
};

export async function fetchDatabaseRuntimeProducts(): Promise<DatabaseCatalogueLoadResult> {
  return loadRuntimeProducts<Category>(supabaseRestRequest);
}

function unavailableSnapshot(
  status: Exclude<ServerCatalogueSnapshot["status"], "ready">,
  error?: string,
  validation = validateRuntimeCatalogue([]),
): ServerCatalogueSnapshot {
  return {
    source: "unavailable",
    status,
    products: [],
    evidence: emptyCatalogueEvidenceSnapshot(),
    validation,
    ...(error ? { error } : {}),
  };
}

export async function loadServerCatalogueSnapshot(): Promise<ServerCatalogueSnapshot> {
  if (!isDatabaseCatalogueEnabled()) {
    return unavailableSnapshot(
      "database_disabled",
      "The verified Supabase catalogue is disabled by the server configuration.",
    );
  }

  try {
    const database = await fetchDatabaseRuntimeProducts();
    const validation = { ...validateRuntimeCatalogue(database.products,database.rejectedProductIds), ok: database.products.length > 0 };

    if (!validation.ok) {
      const parts = [
        validation.missingCategories.length
          ? `missing categories: ${validation.missingCategories.join(", ")}`
          : null,
        validation.rejectedProductIds.length
          ? `rejected runtime rows: ${validation.rejectedProductIds.join(", ")}`
          : null,
        validation.duplicateProductIds.length
          ? `duplicate IDs: ${validation.duplicateProductIds.join(", ")}`
          : null,
        validation.invalidProductIds.length
          ? `invalid numeric data: ${validation.invalidProductIds.join(", ")}`
          : null,
      ].filter(Boolean);

      return unavailableSnapshot(
        "coverage_failed",
        `Verified catalogue coverage check failed (${parts.join("; ")}).`,
        validation,
      );
    }

    const evidence = await fetchCatalogueEvidenceSnapshotForProductIds(
      database.products.map((product) => product.id),
    );

    return {
      source: "database",
      status: "ready",
      products: database.products,
      evidence,
      validation,
    };
  } catch (error) {
    return unavailableSnapshot(
      "database_unavailable",
      error instanceof Error ? error.message : "Unknown Supabase catalogue error",
    );
  }
}
