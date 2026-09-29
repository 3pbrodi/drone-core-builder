-- DroneCores catalogue foreign-key index hardening
-- Covers foreign-key columns reported by Supabase Performance Advisor.

create index catalogue_fc_esc_connection_evidence_esc_product_idx
  on public.catalogue_fc_esc_connection_evidence (esc_product_id);

create index catalogue_fc_esc_connection_evidence_source_idx
  on public.catalogue_fc_esc_connection_evidence (source_id);

create index catalogue_identity_evidence_source_idx
  on public.catalogue_identity_evidence (source_id);

create index catalogue_import_batches_source_idx
  on public.catalogue_import_batches (source_id);

create index catalogue_motor_esc_current_evidence_operating_source_idx
  on public.catalogue_motor_esc_current_evidence (operating_conditions_source_id);

create index catalogue_motor_esc_current_evidence_motor_current_source_idx
  on public.catalogue_motor_esc_current_evidence (motor_current_source_id);

create index catalogue_motor_esc_current_evidence_esc_current_source_idx
  on public.catalogue_motor_esc_current_evidence (esc_current_source_id);

create index catalogue_motor_esc_current_evidence_esc_product_idx
  on public.catalogue_motor_esc_current_evidence (esc_product_id);

create index catalogue_motor_propeller_evidence_propeller_product_idx
  on public.catalogue_motor_propeller_evidence (propeller_product_id);

create index catalogue_motor_propeller_evidence_source_idx
  on public.catalogue_motor_propeller_evidence (source_id);

create index catalogue_spec_evidence_source_idx
  on public.catalogue_spec_evidence (source_id);
