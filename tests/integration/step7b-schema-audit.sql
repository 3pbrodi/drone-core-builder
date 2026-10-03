\set ON_ERROR_STOP on
do $audit$
declare tab text;
begin
 if (select count(*) from supabase_migrations.schema_migrations)<>24 or
 not exists(select 1 from supabase_migrations.schema_migrations where version='20261002190436' and name='auth_billing_foundation')
 then raise exception 'Expected 24 repo migrations, including original auth foundation';end if;
 if not has_schema_privilege('service_role','catalogue_internal','USAGE')
 or has_schema_privilege('service_role','catalogue_internal','CREATE')
 or has_schema_privilege('anon','catalogue_internal','USAGE')
 or has_schema_privilege('authenticated','catalogue_internal','USAGE')
 or exists(select 1 from pg_namespace n cross join lateral aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a
  where n.nspname='catalogue_internal' and a.grantee=0 and a.privilege_type in ('USAGE','CREATE'))
 then raise exception 'Private schema privilege regression';end if;
 foreach tab in array array['profiles','plans','subscriptions','payment_methods','invoices','usage_counters','saved_builds'] loop
 if to_regclass('public.'||tab) is null or not (select relrowsecurity from pg_class where oid=to_regclass('public.'||tab))
 or not exists(select 1 from pg_constraint where conrelid=to_regclass('public.'||tab) and contype='p')
 then raise exception 'Missing auth table/RLS/PK: %',tab;end if;
 end loop;
 if (select count(*) from pg_policies where schemaname='public' and tablename=any(array['profiles','plans','subscriptions','payment_methods','invoices','usage_counters','saved_builds']))<>11
 or (select count(*) from pg_indexes where schemaname='public' and tablename=any(array['profiles','plans','subscriptions','payment_methods','invoices','usage_counters','saved_builds']))<>16
 or (select count(*) from pg_constraint c join pg_class t on t.oid=c.conrelid where c.contype='f'
   and t.relname=any(array['profiles','plans','subscriptions','payment_methods','invoices','usage_counters','saved_builds']))<>7
 then raise exception 'Auth migration policies/indexes/foreign keys mismatch';end if;
 if (select count(*) from pg_trigger where not tgisinternal and tgname in
  ('profiles_updated_at','subscriptions_updated_at','saved_builds_updated_at','on_auth_user_created'))<>4
 or not (select prosecdef from pg_proc where oid='public.handle_new_user()'::regprocedure)
 or has_function_privilege('anon','public.handle_new_user()','EXECUTE')
 or has_function_privilege('authenticated','public.handle_new_user()','EXECUTE')
 or not (select 'search_path=""'=any(proconfig) from pg_proc where oid='public.handle_new_user()'::regprocedure)
 then raise exception 'Auth triggers or SECURITY DEFINER/ACL/search_path mismatch';end if;
 if (select count(*) from public.plans)<>3 then raise exception 'Original three plan rows missing';end if;
 if (select count(*) from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='drone_product_category')<>18
 or to_regclass('public.catalogue_import_runs') is null or to_regclass('public.catalogue_import_run_items') is null
 or to_regprocedure('public.catalogue_claim_import_run_items(uuid,integer,integer,boolean)') is null
 or to_regprocedure('public.catalogue_release_import_run_claims(uuid,bigint[],text)') is null
 then raise exception 'Current 18-category/P0 importer not reproduced';end if;
 foreach tab in array array['catalogue_public_runtime_products','catalogue_public_verified_spec_evidence',
 'catalogue_public_motor_propeller_evidence','catalogue_public_motor_esc_current_evidence',
 'catalogue_public_fc_esc_evidence'] loop
 if to_regclass('public.'||tab) is null or not (select relrowsecurity from pg_class where oid=to_regclass('public.'||tab))
 or (select count(*) from pg_policies where schemaname='public' and tablename=tab)<>1
 or not exists(select 1 from pg_constraint where conrelid=to_regclass('public.'||tab) and contype='p')
 then raise exception 'Snapshot missing or weakened: %',tab;end if;end loop;
 if (select count(*) from pg_trigger where not tgisinternal and tgname like '%public_snapshot_sync')<9
 or to_regprocedure('catalogue_internal.refresh_public_catalogue_snapshots()') is null
 then raise exception 'Nine public snapshot triggers missing';end if;
 if exists(select 1 from pg_constraint fk join pg_class s on s.oid=fk.conrelid join pg_class t on t.oid=fk.confrelid
  where fk.contype='f' and
   ((s.relname like 'catalogue_%' and t.relname=any(array['profiles','plans','subscriptions','payment_methods','invoices','usage_counters','saved_builds']))
   or (t.relname like 'catalogue_%' and s.relname=any(array['profiles','plans','subscriptions','payment_methods','invoices','usage_counters','saved_builds']))))
 then raise exception 'Unexpected catalogue-to-auth FK';end if;
 if (select count(*) from public.catalogue_products)<>0 or (select count(*) from public.catalogue_offers)<>0
 or (select count(*) from public.catalogue_import_runs)<>0 or (select count(*) from public.catalogue_import_run_items)<>0
 or (select count(*) from public.catalogue_import_batches)<>0 or (select count(*) from public.catalogue_import_rows)<>0
 or (select count(*) from public.catalogue_identity_evidence)<>0 or (select count(*) from public.catalogue_spec_evidence)<>0
 then raise exception 'Fresh database not zero for catalogue';end if;
end $audit$;
select jsonb_build_object(
 'versions',(select jsonb_agg(version order by version) from supabase_migrations.schema_migrations),
 'tables',(select jsonb_agg(c.relname||':'||c.relkind||':'||c.relrowsecurity order by c.relname) from pg_class c
 join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p','v','m')),
 'indexes',(select jsonb_agg(tablename||':'||indexname order by tablename,indexname) from pg_indexes where schemaname='public'),
 'policies',(select jsonb_agg(tablename||':'||policyname||':'||cmd order by tablename,policyname) from pg_policies where schemaname='public'),
 'triggers',(select jsonb_agg(c.relname||':'||tg.tgname order by c.relname,tg.tgname) from pg_trigger tg join pg_class c on c.oid=tg.tgrelid
  join pg_namespace n on n.oid=c.relnamespace where not tg.tgisinternal and (n.nspname='public' or tg.tgname='on_auth_user_created')),
 'categories',(select jsonb_agg(e.enumlabel order by e.enumsortorder) from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='drone_product_category'),
 'authTables',7,'authPolicies',11,'authIndexes',16,'snapshotTables',5,
 'serviceSchemaUsage',has_schema_privilege('service_role','catalogue_internal','USAGE'),
 'anonSchemaUsage',has_schema_privilege('anon','catalogue_internal','USAGE'),
 'authenticatedSchemaUsage',has_schema_privilege('authenticated','catalogue_internal','USAGE'),
 'products',(select count(*) from public.catalogue_products),
 'offers',(select count(*) from public.catalogue_offers));
