-- Local-only QA to confirm the 25th disposable schema migration is effective.
\set ON_ERROR_STOP on
do $assert$
declare
 v text;
begin
 if (select count(*) from supabase_migrations.schema_migrations)<>25
 then raise exception 'Expected 25 disposable schema migrations'; end if;
 v:=pg_get_functiondef('catalogue_internal.guard_public_runtime_record()'::regprocedure);
 if position('i.license_name' in v)=0
  or position('i.license_url' in v)=0
  or position('new.last_checked_at' in v)=0
  or position('24 hours' in v)=0
 then raise exception 'Missing image-license and fresh-offer redaction in snapshot guard'; end if;
 if (select count(*) from pg_trigger t
     where t.tgrelid='public.catalogue_public_runtime_products'::regclass
       and t.tgname='catalogue_public_runtime_license_freshness_guard'
       and not t.tgisinternal)<>1
 then raise exception 'Public runtime snapshot guard trigger not installed'; end if;
 if exists (select 1 from public.catalogue_public_runtime_products)
 then raise exception 'Disposable public runtime must start empty'; end if;
 if (select count(*) from information_schema.tables
     where table_schema='public' and table_name='catalogue_release_reviews')<>1
 then raise exception 'Owner release review migration absent in local schema'; end if;
end
$assert$;
-- Prove policy with temporary real table writes ONLY in disposable DB.
-- All synthetic rows are rolled back immediately.
begin;
insert into public.catalogue_public_runtime_products(
 id,image_url,image_alt,image_source_url,price_amount,currency,
 stock_status,offer_url,last_checked_at,offer_region
) values
('qa-synthetic-stale-image',
 'https://example.org/third-party-photo.jpg','Unlicensed image',
 'https://example.org/product',49.99,'EUR','in_stock',
 'https://example.org/offer',now()-interval '2 days','EU'),
('qa-synthetic-fresh-image',
 'https://example.org/another-unlicensed-photo.jpg','Unlicensed image',
 'https://example.org/product',29.99,'EUR','in_stock',
 'https://example.org/offer',now()-interval '2 minutes','EU');
do $test$
begin
 if exists(select 1 from public.catalogue_public_runtime_products
   where id like 'qa-synthetic-%' and image_url is not null)
 then raise exception 'UNSAFE: unlicensed external image reached public runtime'; end if;
 if exists(select 1 from public.catalogue_public_runtime_products
    where id='qa-synthetic-stale-image' and
     (price_amount is not null or offer_url is not null or stock_status::text<>'unknown'))
 then raise exception 'UNSAFE: old merchant price/availability reached runtime'; end if;
 if not exists(select 1 from public.catalogue_public_runtime_products
    where id='qa-synthetic-fresh-image' and price_amount=29.99
      and stock_status::text='in_stock')
 then raise exception 'Fresh verified-like test offer was incorrectly discarded'; end if;
end
$test$;
rollback;

select jsonb_build_object(
 'migrations',(select count(*) from supabase_migrations.schema_migrations),
 'public_runtime_products',(select count(*) from public.catalogue_public_runtime_products),
 'license_filter_on',true,
 'fresh_offer_filter_on',true,
 'production_mutation',false,
 'step','PASS'
)::text as step9_runtime_safety_audit;
