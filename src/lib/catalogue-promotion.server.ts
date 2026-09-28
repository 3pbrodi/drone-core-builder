import "@tanstack/react-start/server-only";

import type { Category } from "./build-data";
import { findOrCreateCatalogueSource, type CatalogueSourceKind } from "./catalogue-source.server";
import { supabaseRestRequest } from "./supabase-rest.server";

export type CataloguePromotionReadiness = {
  id: string;
  category: Category;
  displayName: string;
  recordClass: "demo_seed" | "candidate" | "canonical";
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
  record_class: "demo_seed" | "candidate" | "canonical";
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
  recordClass?: "candidate" | "canonical";
  identityStatus?: "pending_review" | "verified";
  verificationStatus?: "pending_review" | "verified";
  selectable: boolean;
};

export type CataloguePromotionActionInput = {
  productId: string;
  reviewer: string;
  notes?: string;
};

export type CreateCatalogueCandidateInput = {
  importRowId: number;
  reviewer: string;
  notes?: string;
};

export type StageCatalogueIdentityEvidenceInput = {
  productId: string;
  sourceName: string;
  sourceKind: CatalogueSourceKind;
  sourceUrl: string;
  authority: "manufacturer" | "official_documentation";
  manufacturerLabel: string;
  modelLabel: string;
  variantLabel?: string;
  exactModelAssociation: boolean;
  retrievedAt: string;
  caveats?: string;
};

export type ReviewEvidenceInput = {
  evidenceId: string;
  reviewer: string;
  notes?: string;
};

export type ReviewImportedEvidenceInput = {
  importRowId: number;
  reviewer: string;
  notes?: string;
};

export type AddVerifiedEuOfferInput = {
  productId: string;
  merchantName: string;
  productUrl: string;
  priceAmount: number;
  stockStatus: "unknown" | "in_stock" | "out_of_stock" | "preorder" | "backorder";
  lastCheckedAt: string;
  reviewer: string;
  notes?: string;
  merchantCountryCode?: string;
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
    | "catalogue_unpublish_product"
    | "catalogue_complete_technical_review",
  input: CataloguePromotionActionInput,
) {
  return supabaseRestRequest<CataloguePromotionResult>(`rpc/${functionName}`, {
    method: "POST",
    body: JSON.stringify({
      p_product_id: input.productId,
      p_reviewer: normalizeReviewer(input.reviewer),
      p_notes: input.notes?.trim() || null,
    }),
  });
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

export async function createCatalogueCandidateFromImport(
  input: CreateCatalogueCandidateInput,
): Promise<CataloguePromotionResult> {
  return supabaseRestRequest<CataloguePromotionResult>(
    "rpc/catalogue_create_candidate_from_deduped_import",
    {
      method: "POST",
      body: JSON.stringify({
        p_import_row_id: input.importRowId,
        p_reviewer: normalizeReviewer(input.reviewer),
        p_notes: input.notes?.trim() || null,
      }),
    },
  );
}

export async function stageCatalogueIdentityEvidence(
  input: StageCatalogueIdentityEvidenceInput,
): Promise<string> {
  const sourceId = await findOrCreateCatalogueSource(input.sourceName.trim(), input.sourceKind);

  const rows = await supabaseRestRequest<{ id: string }[]>("catalogue_identity_evidence", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify([
      {
        product_id: input.productId,
        source_id: sourceId,
        source_url: input.sourceUrl,
        authority: input.authority,
        manufacturer_label: input.manufacturerLabel.trim(),
        model_label: input.modelLabel.trim(),
        variant_label: input.variantLabel?.trim() || null,
        exact_model_association: input.exactModelAssociation,
        verification_status: "pending_review",
        retrieved_at: input.retrievedAt,
        verified_at: null,
        caveats: input.caveats?.trim() || null,
      },
    ]),
  });

  const row = rows[0];
  if (!row) {
    throw new Error("Supabase did not return the staged identity evidence.");
  }
  return row.id;
}

export async function verifyCatalogueIdentityEvidence(input: ReviewEvidenceInput) {
  return supabaseRestRequest("rpc/catalogue_verify_identity_evidence", {
    method: "POST",
    body: JSON.stringify({
      p_identity_evidence_id: input.evidenceId,
      p_reviewer: normalizeReviewer(input.reviewer),
      p_notes: input.notes?.trim() || null,
    }),
  });
}

export async function acceptCatalogueSpecEvidenceFromImport(input: ReviewImportedEvidenceInput) {
  return supabaseRestRequest("rpc/catalogue_accept_spec_evidence_from_import", {
    method: "POST",
    body: JSON.stringify({
      p_import_row_id: input.importRowId,
      p_reviewer: normalizeReviewer(input.reviewer),
      p_notes: input.notes?.trim() || null,
    }),
  });
}

export async function verifyCatalogueSpecEvidence(input: ReviewEvidenceInput) {
  return supabaseRestRequest("rpc/catalogue_verify_spec_evidence", {
    method: "POST",
    body: JSON.stringify({
      p_spec_evidence_id: input.evidenceId,
      p_reviewer: normalizeReviewer(input.reviewer),
      p_notes: input.notes?.trim() || null,
    }),
  });
}

export async function completeCatalogueTechnicalReview(input: CataloguePromotionActionInput) {
  return callPromotionRpc("catalogue_complete_technical_review", input);
}

export async function addVerifiedEuOffer(input: AddVerifiedEuOfferInput) {
  return supabaseRestRequest("rpc/catalogue_add_verified_eu_offer", {
    method: "POST",
    body: JSON.stringify({
      p_product_id: input.productId,
      p_merchant_name: input.merchantName.trim(),
      p_product_url: input.productUrl,
      p_price_amount: input.priceAmount,
      p_stock_status: input.stockStatus,
      p_last_checked_at: input.lastCheckedAt,
      p_reviewer: normalizeReviewer(input.reviewer),
      p_notes: input.notes?.trim() || null,
      p_merchant_country_code: input.merchantCountryCode?.trim() || null,
    }),
  });
}
