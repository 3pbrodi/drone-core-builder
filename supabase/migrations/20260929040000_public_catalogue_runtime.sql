-- Public read-only catalogue surfaces used by the Lovable/runtime configurator.
-- These expose only already-published runtime rows and verified evidence.

create or replace view public.catalogue_public_runtime_products as
select * from public.catalogue_runtime_products;

create or replace view public.catalogue_public_verified_spec_evidence as
select
  id, product_id, field_key, value, unit, value_semantics,
  source_url, authority, exact_model_association,
  verification_status, retrieved_at, verified_at, conditions, caveats
from public.catalogue_verified_spec_evidence;

create or replace view public.catalogue_public_motor_propeller_evidence as
select * from public.catalogue_motor_propeller_evidence
where verification_status='verified';

create or replace view public.catalogue_public_motor_esc_current_evidence as
select * from public.catalogue_motor_esc_current_evidence
where verification_status='verified';

create or replace view public.catalogue_public_fc_esc_evidence as
select * from public.catalogue_fc_esc_connection_evidence
where verification_status='verified';

grant select on public.catalogue_public_runtime_products to anon;
grant select on public.catalogue_public_verified_spec_evidence to anon;
grant select on public.catalogue_public_motor_propeller_evidence to anon;
grant select on public.catalogue_public_motor_esc_current_evidence to anon;
grant select on public.catalogue_public_fc_esc_evidence to anon;
