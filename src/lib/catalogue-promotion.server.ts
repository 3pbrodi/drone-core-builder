import "@tanstack/react-start/server-only";

import type { Category } from "./build-data";
import { supabaseRestRequest } from "./supabase-rest.server";

export type CataloguePromotionReadiness = {
  id: string;
  category: Category;
  displayName: string;
  recordClass: "demo_seed" | "canonical";
  identityStatus: "unverified" | "pending_review" | "verified" | "rejected";
  verificationStatus: "unverified" | "pending_review" | "verified" | "rejected";
  selectable: boolean;
  identityQualityStatus: "unverified" | "partially_verified" | "verified" | "conflicting" | null;
  technicalQualityStatus: "unverified" | "partially_verified" | "verified" | "conflicting" | null;
  humanReviewRequired: boolean | null;
  identityBlockers: string[];
  publicationBlockers: string[];
};

type PromotionReadinessRow = {
  id: string;
  category: Category;
  display_name: string;
  record_class: "demo_seed" | "canonical";
  identity_status: CataloguePromotionReadiness["identityStatus"];
  verification_status: CataloguePromotionReadiness["verificationStatus"];
  selectable: boolean;
  identity_quality_status: CataloguePromotionReadiness["identityQualityStatus"];
  technical_quality_status: CataloguePromotionReadiness["technicalQualityStatus"];
  human_review_required: boolean | null;
  identity_blockers: string[] | null;
  publication_blockers: string[] | null;
};

export type CataloguePromotionResult = {
  productId: string;
  recordClass?: "canonical";
  identityStatus?: "verified";
  verificationStatus?: "verified";
  selectable: boolean;
};

export type CataloguePromotionActionInput = {
  productId: string;
  reviewer: string;
  notes?: string;
};

function query(params: Record<string, string>) {
  return new URLSearchParams(params).toString();
}

function normalizeReviewer(reviewer: string) {
  const value = reviewer.trim();
  if (!value) {
    throw new Error("A reviewer label is required.");
  }
  return value;
}

function toReadiness(row: PromotionReadinessRow): CataloguePromotionReadiness {
  return {
    id: row.id,
    category: row.category,
    displayName: row.display_name,
    recordClass: row.record_class,
    identityStatus: row.identity_status,
    verificationStatus: row.verification_status,
    selectable: row.selectable,
    identityQualityStatus: row.identity_quality_status,
    technicalQualityStatus: row.technical_quality_status,
    humanReviewRequired: row.human_review_required,
    identityBlockers: row.identity_blockers ?? [],
    publicationBlockers: row.publication_blockers ?? [],
  };
}

export async function fetchCataloguePromotionReadiness(
  productId: string,
): Promise<CataloguePromotionReadiness | null> {
  const rows = await supabaseRestRequest<PromotionReadinessRow[]>(
    `catalogue_promotion_readiness?${query({
      select: "*",
      id: `eq.${productId}`,
      limit: "1",
    })}`,
  );

  const row = rows[0];
  return row ? toReadiness(row) : null;
}

async function callPromotionRpc(
  functionName:
    | "catalogue_promote_identity"
    | "catalogue_publish_product"
    | "catalogue_unpublish_product",
  input: CataloguePromotionActionInput,
) {
  return supabaseRestRequest<CataloguePromotionResult>(
    `rpc/${functionName}`,
    {
      method: "POST",
      body: JSON.stringify({
        p_product_id: input.productId,
        p_reviewer: normalizeReviewer(input.reviewer),
        p_notes: input.notes?.trim() || null,
      }),
    },
  );
}

export async function promoteCatalogueIdentity(
  input: CataloguePromotionActionInput,
): Promise<CataloguePromotionResult> {
  return callPromotionRpc("catalogue_promote_identity", input);
}

export async function publishCatalogueProduct(
  input: CataloguePromotionActionInput,
): Promise<CataloguePromotionResult> {
  return callPromotionRpc("catalogue_publish_product", input);
}

export async function unpublishCatalogueProduct(
  input: CataloguePromotionActionInput,
): Promise<CataloguePromotionResult> {
  return callPromotionRpc("catalogue_unpublish_product", input);
}
