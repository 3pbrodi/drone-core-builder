\set ON_ERROR_STOP on
-- READ ONLY. For a separately authorized operator's explicit, VERIFIED target
-- or disposable REAL Production restore. Never infer target from config.toml.
begin read only;
select jsonb_build_object(
 'postgresVersion',current_setting('server_version'),
 'migrationVersions',(select jsonb_agg(version order by version) from supabase_migrations.schema_migrations),
 'products',(select count(*) from public.catalogue_products),
 'candidateProducts',(select count(*) from public.catalogue_products where record_class='candidate'),
 'publishedRuntimeProducts',(select count(*) from public.catalogue_public_runtime_products),
 'offers',(select count(*) from public.catalogue_offers),
 'identityEvidence',(select count(*) from public.catalogue_identity_evidence),
 'technicalEvidence',(select count(*) from public.catalogue_spec_evidence),
 'productSourceLinks',(select count(*) from public.catalogue_product_sources),
 'identityKeyCount',(select count(*) from public.catalogue_product_identity_keys),
 'sixPartIdentityCollisionGroups',(select count(*) from
  (select manufacturer_id,category,lower(trim(model)),
   lower(trim(coalesce(variant,''))),
   lower(trim(coalesce(manufacturer_sku,''))),
   lower(trim(coalesce(mpn,'')))
   from public.catalogue_products group by 1,2,3,4,5,6 having count(*)>1) d),
 'importBatches',(select count(*) from public.catalogue_import_batches),
 'importRows',(select count(*) from public.catalogue_import_rows),
 'importNewRows',(select count(*) from public.catalogue_import_rows where dedupe_status='new'),
 'importUnresolvedRows',(select count(*) from public.catalogue_import_rows where dedupe_status='unresolved'),
 'importFailedRows',(select count(*) from public.catalogue_import_rows where dedupe_status='failed'),
 'importRunsTable',to_regclass('public.catalogue_import_runs')::text,
 'importRunItemsTable',to_regclass('public.catalogue_import_run_items')::text,
 'authUsers',(select count(*) from auth.users),
 'profiles',(select count(*) from public.profiles),
 'plans',(select count(*) from public.plans),
 'subscriptions',(select count(*) from public.subscriptions),
 'paymentMethods',(select count(*) from public.payment_methods),
 'invoices',(select count(*) from public.invoices),
 'usageCounters',(select count(*) from public.usage_counters),
 'savedBuilds',(select count(*) from public.saved_builds),
 'storageBuckets',(select count(*) from storage.buckets),
 'storageObjectsMetadata',(select count(*) from storage.objects),
 'serviceRolePrivateUsage',has_schema_privilege('service_role','catalogue_internal','USAGE'),
 'serviceRolePrivateCreate',has_schema_privilege('service_role','catalogue_internal','CREATE'),
 'anonPrivateUsage',has_schema_privilege('anon','catalogue_internal','USAGE'),
 'authenticatedPrivateUsage',has_schema_privilege('authenticated','catalogue_internal','USAGE'),
 'catalogueCron',(select jsonb_agg(jsonb_build_object('name',jobname,'schedule',schedule,'active',active) order by jobname)
    from cron.job where jobname like 'catalogue-%')
) as sanitized_readonly_baseline;
commit;
