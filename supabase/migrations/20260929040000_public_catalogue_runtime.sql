-- Lovable/browser-safe public catalogue snapshots.
-- Only already-published runtime rows and verified evidence are copied here.
-- Public roles receive SELECT only; all internal catalogue tables remain private.

drop view if exists public.catalogue_public_runtime_products;
drop table if exists public.catalogue_public_runtime_products;

create table public.catalogue_public_runtime_products as
select * from public.catalogue_runtime_products;

alter table public.catalogue_public_runtime_products enable row level security;

create policy "Public verified runtime catalogue is readable"
  on public.catalogue_public_runtime_products
  for select
  to anon, authenticated
  using (true);

revoke all on public.catalogue_public_runtime_products from anon, authenticated;
grant select on public.catalogue_public_runtime_products to anon, authenticated;

drop view if exists public.catalogue_public_verified_spec_evidence;
drop table if exists public.catalogue_public_verified_spec_evidence;

create table public.catalogue_public_verified_spec_evidence as
select
  id, product_id, field_key, value, unit, value_semantics,
  source_url, authority, exact_model_association,
  verification_status, retrieved_at, verified_at, conditions, caveats
from public.catalogue_verified_spec_evidence;

alter table public.catalogue_public_verified_spec_evidence enable row level security;

create policy "Public verified spec evidence is readable"
  on public.catalogue_public_verified_spec_evidence
  for select
  to anon, authenticated
  using (true);

revoke all on public.catalogue_public_verified_spec_evidence from anon, authenticated;
grant select on public.catalogue_public_verified_spec_evidence to anon, authenticated;

create or replace view public.catalogue_public_motor_propeller_evidence as
select * from public.catalogue_motor_propeller_evidence
where verification_status='verified';

create or replace view public.catalogue_public_motor_esc_current_evidence as
select * from public.catalogue_motor_esc_current_evidence
where verification_status='verified';

create or replace view public.catalogue_public_fc_esc_evidence as
select * from public.catalogue_fc_esc_connection_evidence
where verification_status='verified';

revoke insert, update, delete, truncate, references, trigger
  on public.catalogue_public_motor_propeller_evidence from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger
  on public.catalogue_public_motor_esc_current_evidence from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger
  on public.catalogue_public_fc_esc_evidence from anon, authenticated;

grant select on public.catalogue_public_motor_propeller_evidence to anon, authenticated;
grant select on public.catalogue_public_motor_esc_current_evidence to anon, authenticated;
grant select on public.catalogue_public_fc_esc_evidence to anon, authenticated;
