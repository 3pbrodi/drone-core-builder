import { readAllRows, type RestReader } from "./catalogue-runtime-read.ts";
import { inFilter } from "./catalogue-query.ts";
type CatalogueEvidenceJson = null | boolean | number | string | CatalogueEvidenceJson[] | { [key: string]: CatalogueEvidenceJson };
type CatalogueEvidenceObject = { [key: string]: CatalogueEvidenceJson };
type CatalogueEvidenceAuthority = "manufacturer" | "official_documentation" | "retailer" | "community" | "internal_demo";
type EvidenceVerificationStatus = "unverified" | "pending_review" | "verified" | "rejected";
export type SpecEvidenceRow = {
  product_id: string;
  field_key: string;
  value: CatalogueEvidenceJson;
  unit: string | null;
  source_id: string;
  source_url: string | null;
  authority: CatalogueEvidenceAuthority;
  exact_model_association: boolean;
  verification_status: EvidenceVerificationStatus;
  retrieved_at: string | null;
  verified_at: string | null;
  conditions: CatalogueEvidenceObject;
  caveats: string | null;
};

type PairProvenanceRow = {
  source_id?: string;
  source_snapshot_id?: string | null;
  source_url?: string | null;
  source_content_hash?: string | null;
  source_locator?: string | null;
  compatibility_scope?: string | null;
};
function pairProvenance(row: PairProvenanceRow) {
  if (
    [
      row.source_snapshot_id,
      row.source_url,
      row.source_content_hash,
      row.source_locator,
      row.compatibility_scope,
    ].every((v) => v == null)
  )
    return undefined;
  return {
    sourceId: row.source_id ?? "",
    snapshotId: row.source_snapshot_id ?? "",
    url: row.source_url ?? "",
    sha256: row.source_content_hash ?? "",
    locator: row.source_locator ?? "",
    scope: row.compatibility_scope ?? "",
  };
}
export type MotorPropellerEvidenceRow = PairProvenanceRow & {
  motor_product_id: string;
  propeller_product_id: string;
  result: "compatible" | "incompatible";
  authority: CatalogueEvidenceAuthority;
  exact_products_verified: boolean;
  verification_status: EvidenceVerificationStatus;
  retrieved_at: string | null;
  verified_at: string | null;
  operating_conditions: CatalogueEvidenceObject;
};

export type MotorEscCurrentEvidenceRow = {
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
  operating_conditions: CatalogueEvidenceObject;
};

export type FcEscConnectionEvidenceRow = PairProvenanceRow & {
  details?: CatalogueEvidenceObject;
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

function toFieldEvidence(row: SpecEvidenceRow) {
  const field = row.field_key;
  return {
    productId: row.product_id,
    field,
    value: row.value,
    unit: row.unit,
    sourceId: row.source_id ?? "public",
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

export async function readEvidenceRows(read: RestReader, productIds: readonly string[]) {
 const ids = [...new Set(productIds)], wanted = new Set(ids);
 const fields: SpecEvidenceRow[] = [], motorPropellerRows: MotorPropellerEvidenceRow[] = [], motorEscRows: MotorEscCurrentEvidenceRow[] = [], fcEscRows: FcEscConnectionEvidenceRow[] = [];
 for (let offset=0; offset<ids.length; offset+=100) {
  const subset = inFilter(ids.slice(offset,offset+100));
  const path = (table: string, left: string, order: string, right?: string) => {
   const params = new URLSearchParams({select:"*",[left]:subset,order});
   if(right && ids.length<=100) params.set(right,inFilter(ids));
   return `${table}?${params}`;
  };
  const [f,p,m,c] = await Promise.all([
   readAllRows<SpecEvidenceRow>(read,path("catalogue_public_verified_spec_evidence","product_id","product_id.asc,field_key.asc,id.asc")),
   readAllRows<MotorPropellerEvidenceRow>(read,path("catalogue_public_motor_propeller_evidence","motor_product_id","motor_product_id.asc,propeller_product_id.asc,id.asc","propeller_product_id")),
   readAllRows<MotorEscCurrentEvidenceRow>(read,path("catalogue_public_motor_esc_current_evidence","motor_product_id","motor_product_id.asc,esc_product_id.asc,id.asc","esc_product_id")),
   readAllRows<FcEscConnectionEvidenceRow>(read,path("catalogue_public_fc_esc_evidence","flight_controller_product_id","flight_controller_product_id.asc,esc_product_id.asc,id.asc","esc_product_id")),
  ]);
  fields.push(...f.filter(r=>wanted.has(r.product_id)));
  motorPropellerRows.push(...p.filter(r=>wanted.has(r.motor_product_id)&&wanted.has(r.propeller_product_id)));
  motorEscRows.push(...m.filter(r=>wanted.has(r.motor_product_id)&&wanted.has(r.esc_product_id)));
  fcEscRows.push(...c.filter(r=>wanted.has(r.flight_controller_product_id)&&wanted.has(r.esc_product_id)));
 }
 return {fields,motorPropellerRows,motorEscRows,fcEscRows};
}
export function mapEvidenceRows({fields,motorPropellerRows,motorEscRows,fcEscRows}: Awaited<ReturnType<typeof readEvidenceRows>>) {

  const mappedFields = fields
    .map(toFieldEvidence)
    .filter(item => item !== null);

  const motorPropeller = motorPropellerRows.map(
    (row) => ({
      provenance: pairProvenance(row),
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

  const motorEscCurrent = motorEscRows.map(
    (row) => ({
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

  const fcEscConnection = fcEscRows.map(
    (row) => ({
      provenance: pairProvenance(row),
      operatingConditions: row.details?.["operatingConditions"] as CatalogueEvidenceObject | undefined,
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

  return { fields: mappedFields, motorPropeller, motorEscCurrent, fcEscConnection };
}
