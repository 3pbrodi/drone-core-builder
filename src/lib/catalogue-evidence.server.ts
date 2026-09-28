import "@tanstack/react-start/server-only";

import type { SelectedProducts } from "./build-calculations";
import {
  emptyCatalogueEvidenceSnapshot,
  resolveCompatibilityEvidence,
  type CatalogueEvidenceAuthority,
  type CatalogueEvidenceSnapshot,
  type CatalogueFcEscConnectionEvidence,
  type CatalogueFieldEvidence,
  type CatalogueMotorEscCurrentEvidence,
  type CatalogueMotorPropellerEvidence,
  type EvidenceVerificationStatus,
  type ResolvedCompatibilityEvidence,
} from "./catalogue-evidence";
import { supabaseRestRequest } from "./supabase-rest.server";
import type { Product } from "./build-data";

type SpecEvidenceRow = {
  product_id: string;
  field_key: string;
  value: unknown;
  unit: string | null;
  source_id: string;
  source_url: string | null;
  authority: CatalogueEvidenceAuthority;
  exact_model_association: boolean;
  verification_status: EvidenceVerificationStatus;
  retrieved_at: string | null;
  verified_at: string | null;
  conditions: Record<string, unknown>;
  caveats: string | null;
};

type MotorPropellerEvidenceRow = {
  motor_product_id: string;
  propeller_product_id: string;
  result: "compatible" | "incompatible";
  authority: CatalogueEvidenceAuthority;
  exact_products_verified: boolean;
  verification_status: EvidenceVerificationStatus;
  retrieved_at: string | null;
  verified_at: string | null;
  operating_conditions: Record<string, unknown>;
};

type MotorEscCurrentEvidenceRow = {
  motor_product_id: string;
  esc_product_id: string;
  motor_current_amps: number;
  motor_rating_type: "continuous" | "burst" | "peak";
  esc_current_amps: number;
  esc_rating_type: "continuous" | "burst" | "peak";
  exact_products_verified: boolean;
  rating_types_verified: boolean;
  motor_operating_conditions_verified: boolean;
  verification_status: EvidenceVerificationStatus;
  retrieved_at: string | null;
  verified_at: string | null;
  operating_conditions: Record<string, unknown>;
};

type FcEscConnectionEvidenceRow = {
  flight_controller_product_id: string;
  esc_product_id: string;
  result: "compatible" | "incompatible";
  authority: CatalogueEvidenceAuthority;
  exact_products_verified: boolean;
  connector_family_verified: boolean;
  pinout_verified: boolean;
  wire_order_verified: boolean;
  signal_compatibility_verified: boolean;
  voltage_compatibility_verified: boolean;
  verification_status: EvidenceVerificationStatus;
  retrieved_at: string | null;
  verified_at: string | null;
};

function query(params: Record<string, string>) {
  return new URLSearchParams(params).toString();
}

function encodeIn(values: readonly string[]) {
  return `in.(${values.map((value) => `"${value.replaceAll('"', '\\"')}"`).join(",")})`;
}

function toFieldEvidence(row: SpecEvidenceRow): CatalogueFieldEvidence | null {
  const field = row.field_key as keyof Product;
  return {
    productId: row.product_id,
    field,
    value: row.value,
    unit: row.unit,
    sourceId: row.source_id,
    sourceUrl: row.source_url,
    authority: row.authority,
    exactModelAssociation: row.exact_model_association,
    verificationStatus: row.verification_status,
    retrievedAt: row.retrieved_at,
    verifiedAt: row.verified_at,
    conditions: row.conditions,
    caveats: row.caveats,
  };
}

export async function fetchCatalogueEvidenceSnapshotForProductIds(
  productIds: readonly string[],
): Promise<CatalogueEvidenceSnapshot> {
  const uniqueProductIds = [...new Set(productIds.filter(Boolean))];
  if (uniqueProductIds.length === 0) {
    return emptyCatalogueEvidenceSnapshot();
  }

  const inFilter = encodeIn(uniqueProductIds);

  const [fields, motorPropellerRows, motorEscRows, fcEscRows] = await Promise.all([
    supabaseRestRequest<SpecEvidenceRow[]>(
      `catalogue_verified_spec_evidence?${query({
        select: "*",
        product_id: inFilter,
      })}`,
    ),
    supabaseRestRequest<MotorPropellerEvidenceRow[]>(
      `catalogue_motor_propeller_evidence?${query({
        select: "*",
        motor_product_id: inFilter,
        propeller_product_id: inFilter,
        verification_status: "eq.verified",
      })}`,
    ),
    supabaseRestRequest<MotorEscCurrentEvidenceRow[]>(
      `catalogue_motor_esc_current_evidence?${query({
        select: "*",
        motor_product_id: inFilter,
        esc_product_id: inFilter,
        verification_status: "eq.verified",
      })}`,
    ),
    supabaseRestRequest<FcEscConnectionEvidenceRow[]>(
      `catalogue_fc_esc_connection_evidence?${query({
        select: "*",
        flight_controller_product_id: inFilter,
        esc_product_id: inFilter,
        verification_status: "eq.verified",
      })}`,
    ),
  ]);

  const snapshot = emptyCatalogueEvidenceSnapshot();

  snapshot.fields = fields
    .map(toFieldEvidence)
    .filter((item): item is CatalogueFieldEvidence => item !== null);

  snapshot.motorPropeller = motorPropellerRows.map(
    (row): CatalogueMotorPropellerEvidence => ({
      motorId: row.motor_product_id,
      propellerId: row.propeller_product_id,
      result: row.result,
      authority: row.authority,
      exactProductsVerified: row.exact_products_verified,
      verificationStatus: row.verification_status,
      retrievedAt: row.retrieved_at,
      verifiedAt: row.verified_at,
      operatingConditions: row.operating_conditions,
    }),
  );

  snapshot.motorEscCurrent = motorEscRows.map(
    (row): CatalogueMotorEscCurrentEvidence => ({
      motorId: row.motor_product_id,
      escId: row.esc_product_id,
      motorCurrentAmps: row.motor_current_amps,
      motorRatingType: row.motor_rating_type,
      escCurrentAmps: row.esc_current_amps,
      escRatingType: row.esc_rating_type,
      exactProductsVerified: row.exact_products_verified,
      ratingTypesVerified: row.rating_types_verified,
      motorOperatingConditionsVerified: row.motor_operating_conditions_verified,
      verificationStatus: row.verification_status,
      retrievedAt: row.retrieved_at,
      verifiedAt: row.verified_at,
      operatingConditions: row.operating_conditions,
    }),
  );

  snapshot.fcEscConnection = fcEscRows.map(
    (row): CatalogueFcEscConnectionEvidence => ({
      flightControllerId: row.flight_controller_product_id,
      escId: row.esc_product_id,
      result: row.result,
      authority: row.authority,
      exactProductsVerified: row.exact_products_verified,
      connectorFamilyVerified: row.connector_family_verified,
      pinoutVerified: row.pinout_verified,
      wireOrderVerified: row.wire_order_verified,
      signalCompatibilityVerified: row.signal_compatibility_verified,
      voltageCompatibilityVerified: row.voltage_compatibility_verified,
      verificationStatus: row.verification_status,
      retrievedAt: row.retrieved_at,
      verifiedAt: row.verified_at,
    }),
  );

  return snapshot;
}

export async function fetchCatalogueEvidenceSnapshot(
  selected: SelectedProducts,
): Promise<CatalogueEvidenceSnapshot> {
  const productIds = Object.values(selected)
    .filter((product): product is Product => Boolean(product))
    .map((product) => product.id);

  return fetchCatalogueEvidenceSnapshotForProductIds(productIds);
}

export async function fetchResolvedCompatibilityEvidence(
  selected: SelectedProducts,
): Promise<ResolvedCompatibilityEvidence> {
  const snapshot = await fetchCatalogueEvidenceSnapshot(selected);
  return resolveCompatibilityEvidence(selected, snapshot);
}
