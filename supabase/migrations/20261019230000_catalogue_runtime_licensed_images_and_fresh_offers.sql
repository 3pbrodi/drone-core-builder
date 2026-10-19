-- DRAFT: owner approval REQUIRED before Production deployment.
-- Public *snapshot table* redaction is schema-drift-safe: the local runtime
-- view has fewer columns than the current hosted Production view, so never
-- replace the view's SELECT-list using a live snapshot of a different schema.
-- This trigger applies to every INSERT/UPDATE of the public snapshot row.
begin;

create or replace function catalogue_internal.guard_public_runtime_record()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $fn$
begin
  -- Matching manufacturer photo DOES NOT imply redistribution permission.
  -- Exact image URL must have a documented non-empty license name + URL.
  if new.image_url is not null and not exists(
    select 1 from public.catalogue_product_images i
    where i.product_id=new.id
      and i.image_url=new.image_url
      and i.exact_model_verified=true
      and i.verification_status::text='verified'
      and nullif(btrim(i.license_name),'') is not null
      and i.license_url ~* '^https://[^[:space:]]+$'
  ) then
    new.image_url:=null;
    new.image_alt:=null;
    new.image_source_url:=null;
  end if;

  -- A new snapshot must never copy an offer older than 24h.
  -- A future follow-up must also handle expiration as time passes without
  -- a snapshot rebuild; this trigger alone only checks at write time.
  if new.last_checked_at is null
     or new.last_checked_at > now()
     or new.last_checked_at < now()-interval '24 hours' then
    new.price_amount:=null;
    new.currency:=null;
    new.stock_status:='unknown'::public.stock_status;
    new.offer_url:=null;
    new.last_checked_at:=null;
    new.offer_region:=null;
  end if;
  return new;
end;
$fn$;

revoke all on function catalogue_internal.guard_public_runtime_record()
from public, anon, authenticated;

drop trigger if exists catalogue_public_runtime_license_freshness_guard
on public.catalogue_public_runtime_products;
create trigger catalogue_public_runtime_license_freshness_guard
before insert or update on public.catalogue_public_runtime_products
for each row execute function catalogue_internal.guard_public_runtime_record();

-- Existing public rows are redacted in the same transaction (on Production
-- this would affect all 24 photographed products; DO NOT APPLY without the
-- owner's explicit visual-policy approval).
update public.catalogue_public_runtime_products set id=id;
commit;
