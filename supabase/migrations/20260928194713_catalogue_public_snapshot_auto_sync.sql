-- Lovable/browser-safe public catalogue snapshots.
-- Only already-published runtime rows and verified evidence are copied here.
-- Public roles receive SELECT only; all internal catalogue tables remain private.

drop view if exists public.catalogue_public_runtime_products;
drop table if exists public.catalogue_public_runtime_products;

create table public.catalogue_public_runtime_products as
select * from public.catalogue_runtime_products;

alter table public.catalogue_public_runtime_products enable row level security;
alter table public.catalogue_public_runtime_products add primary key (id);

create policy "Public verified runtime catalogue is readable"
  on public.catalogue_public_runtime_products
  for select to anon, authenticated
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
alter table public.catalogue_public_verified_spec_evidence add primary key (id);

create policy "Public verified spec evidence is readable"
  on public.catalogue_public_verified_spec_evidence
  for select to anon, authenticated
  using (true);

revoke all on public.catalogue_public_verified_spec_evidence from anon, authenticated;
grant select on public.catalogue_public_verified_spec_evidence to anon, authenticated;

drop view if exists public.catalogue_public_motor_propeller_evidence;
drop table if exists public.catalogue_public_motor_propeller_evidence;

create table public.catalogue_public_motor_propeller_evidence as
select * from public.catalogue_motor_propeller_evidence
where verification_status='verified';

alter table public.catalogue_public_motor_propeller_evidence enable row level security;
alter table public.catalogue_public_motor_propeller_evidence add primary key (id);

create policy "Public verified motor propeller evidence is readable"
  on public.catalogue_public_motor_propeller_evidence
  for select to anon, authenticated
  using (true);

revoke all on public.catalogue_public_motor_propeller_evidence from anon, authenticated;
grant select on public.catalogue_public_motor_propeller_evidence to anon, authenticated;

drop view if exists public.catalogue_public_motor_esc_current_evidence;
drop table if exists public.catalogue_public_motor_esc_current_evidence;

create table public.catalogue_public_motor_esc_current_evidence as
select * from public.catalogue_motor_esc_current_evidence
where verification_status='verified';

alter table public.catalogue_public_motor_esc_current_evidence enable row level security;
alter table public.catalogue_public_motor_esc_current_evidence add primary key (id);

create policy "Public verified motor esc evidence is readable"
  on public.catalogue_public_motor_esc_current_evidence
  for select to anon, authenticated
  using (true);

revoke all on public.catalogue_public_motor_esc_current_evidence from anon, authenticated;
grant select on public.catalogue_public_motor_esc_current_evidence to anon, authenticated;

drop view if exists public.catalogue_public_fc_esc_evidence;
drop table if exists public.catalogue_public_fc_esc_evidence;

create table public.catalogue_public_fc_esc_evidence as
select * from public.catalogue_fc_esc_connection_evidence
where verification_status='verified';

alter table public.catalogue_public_fc_esc_evidence enable row level security;
alter table public.catalogue_public_fc_esc_evidence add primary key (id);

create policy "Public verified fc esc evidence is readable"
  on public.catalogue_public_fc_esc_evidence
  for select to anon, authenticated
  using (true);

revoke all on public.catalogue_public_fc_esc_evidence from anon, authenticated;
grant select on public.catalogue_public_fc_esc_evidence to anon, authenticated;


-- Keep Lovable/public read snapshots synchronized with the canonical catalogue.
-- The trigger function lives in a non-exposed schema and cannot be called by
-- anon/authenticated clients. Statement-level triggers keep refresh frequency low.

create schema if not exists catalogue_internal;
revoke all on schema catalogue_internal from public, anon, authenticated;

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

revoke all on function catalogue_internal.refresh_public_catalogue_snapshots()
  from public, anon, authenticated;

drop trigger if exists catalogue_products_public_snapshot_sync on public.catalogue_products;
create trigger catalogue_products_public_snapshot_sync
after insert or update or delete on public.catalogue_products
for each statement
execute function catalogue_internal.refresh_public_catalogue_snapshots();

drop trigger if exists catalogue_product_specs_public_snapshot_sync on public.catalogue_product_specs;
create trigger catalogue_product_specs_public_snapshot_sync
after insert or update or delete on public.catalogue_product_specs
for each statement
execute function catalogue_internal.refresh_public_catalogue_snapshots();

drop trigger if exists catalogue_product_images_public_snapshot_sync on public.catalogue_product_images;
create trigger catalogue_product_images_public_snapshot_sync
after insert or update or delete on public.catalogue_product_images
for each statement
execute function catalogue_internal.refresh_public_catalogue_snapshots();

drop trigger if exists catalogue_offers_public_snapshot_sync on public.catalogue_offers;
create trigger catalogue_offers_public_snapshot_sync
after insert or update or delete on public.catalogue_offers
for each statement
execute function catalogue_internal.refresh_public_catalogue_snapshots();

drop trigger if exists catalogue_spec_evidence_public_snapshot_sync on public.catalogue_spec_evidence;
create trigger catalogue_spec_evidence_public_snapshot_sync
after insert or update or delete on public.catalogue_spec_evidence
for each statement
execute function catalogue_internal.refresh_public_catalogue_snapshots();

drop trigger if exists catalogue_motor_propeller_evidence_public_snapshot_sync on public.catalogue_motor_propeller_evidence;
create trigger catalogue_motor_propeller_evidence_public_snapshot_sync
after insert or update or delete on public.catalogue_motor_propeller_evidence
for each statement
execute function catalogue_internal.refresh_public_catalogue_snapshots();

drop trigger if exists catalogue_motor_esc_current_evidence_public_snapshot_sync on public.catalogue_motor_esc_current_evidence;
create trigger catalogue_motor_esc_current_evidence_public_snapshot_sync
after insert or update or delete on public.catalogue_motor_esc_current_evidence
for each statement
execute function catalogue_internal.refresh_public_catalogue_snapshots();

drop trigger if exists catalogue_fc_esc_connection_evidence_public_snapshot_sync on public.catalogue_fc_esc_connection_evidence;
create trigger catalogue_fc_esc_connection_evidence_public_snapshot_sync
after insert or update or delete on public.catalogue_fc_esc_connection_evidence
for each statement
execute function catalogue_internal.refresh_public_catalogue_snapshots();

drop trigger if exists catalogue_manufacturers_public_snapshot_sync on public.catalogue_manufacturers;
create trigger catalogue_manufacturers_public_snapshot_sync
after insert or update or delete on public.catalogue_manufacturers
for each statement
execute function catalogue_internal.refresh_public_catalogue_snapshots();
