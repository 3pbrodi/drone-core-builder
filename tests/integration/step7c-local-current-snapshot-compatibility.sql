-- DISPOSABLE STEP7C PRODUCTION-STATE COMPATIBILITY SETUP (NOT historical migration SQL).
-- Read-only Production schema evidence shows three *_next_pkey names and
-- the canonical current snapshot refresh function. Apply only after original
-- 20 historical SQLs, never on any hosted Supabase project.

alter table public.catalogue_public_fc_esc_evidence
 rename constraint catalogue_public_fc_esc_evidence_pkey to catalogue_public_fc_esc_evidence_next_pkey;
alter table public.catalogue_public_motor_esc_current_evidence
 rename constraint catalogue_public_motor_esc_current_evidence_pkey to catalogue_public_motor_esc_current_evidence_next_pkey;
alter table public.catalogue_public_motor_propeller_evidence
 rename constraint catalogue_public_motor_propeller_evidence_pkey to catalogue_public_motor_propeller_evidence_next_pkey;

create or replace function catalogue_internal.refresh_public_catalogue_snapshots()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  delete from public.catalogue_public_runtime_products where true;
  insert into public.catalogue_public_runtime_products
  select * from public.catalogue_runtime_products;

  delete from public.catalogue_public_verified_spec_evidence where true;
  insert into public.catalogue_public_verified_spec_evidence (
    id, product_id, field_key, value, unit, value_semantics,
    source_url, authority, exact_model_association,
    verification_status, retrieved_at, verified_at, conditions, caveats
  )
  select
    id, product_id, field_key, value, unit, value_semantics,
    source_url, authority, exact_model_association,
    verification_status, retrieved_at, verified_at, conditions, caveats
  from public.catalogue_verified_spec_evidence;

  delete from public.catalogue_public_motor_propeller_evidence where true;
  insert into public.catalogue_public_motor_propeller_evidence
  select *
  from public.catalogue_motor_propeller_evidence
  where verification_status = 'verified';

  delete from public.catalogue_public_motor_esc_current_evidence where true;
  insert into public.catalogue_public_motor_esc_current_evidence
  select *
  from public.catalogue_motor_esc_current_evidence
  where verification_status = 'verified';

  delete from public.catalogue_public_fc_esc_evidence where true;
  insert into public.catalogue_public_fc_esc_evidence
  select *
  from public.catalogue_fc_esc_connection_evidence
  where verification_status = 'verified';

  return null;
end;
$$;
