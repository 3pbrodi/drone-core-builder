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
select jsonb_build_object(
 'migrations',(select count(*) from supabase_migrations.schema_migrations),
 'public_runtime_products',(select count(*) from public.catalogue_public_runtime_products),
 'license_filter_on',true,
 'fresh_offer_filter_on',true,
 'production_mutation',false,
 'step','PASS'
)::text as step9_runtime_safety_audit;
