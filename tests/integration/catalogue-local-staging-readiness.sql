\set ON_ERROR_STOP on

begin;

create or replace function pg_temp.assert_true(p_condition boolean, p_message text)
returns void
language plpgsql
as $$
begin
  if not coalesce(p_condition, false) then
    raise exception 'LOCAL STAGING ASSERTION FAILED: %', p_message;
  end if;
end
$$;

select pg_temp.assert_true(
  (select count(*) = 22 from supabase_migrations.schema_migrations),
  'all 22 repository migrations must be recorded after a clean reset'
);

select pg_temp.assert_true(
  (
    select count(*) = 18
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'drone_product_category'
  ),
  'component category enum must include Required, Optional, and Pilot Gear categories'
);

select pg_temp.assert_true(
  exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='catalogue_products'
      and column_name='integrated_categories'
  )
  and exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='catalogue_products'
      and column_name='included_categories'
  ),
  'component category architecture columns must exist'
);

select pg_temp.assert_true(
  to_regclass('public.catalogue_import_runs') is not null
  and to_regclass('public.catalogue_import_run_items') is not null
  and to_regclass('public.catalogue_import_batches') is not null
  and to_regclass('public.catalogue_import_rows') is not null,
  'durable importer run, manifest, batch, and staging tables must exist'
);

select pg_temp.assert_true(
  to_regclass('public.catalogue_import_batches_run_chunk_uidx') is not null,
  'run/chunk idempotency index must exist'
);

select pg_temp.assert_true(
  to_regprocedure('public.catalogue_get_or_create_import_run(uuid,uuid,text,integer)') is not null
  and to_regprocedure('public.catalogue_claim_import_run_items(uuid,integer,integer,boolean)') is not null
  and to_regprocedure('public.catalogue_release_import_run_claims(uuid,bigint[],text)') is not null
  and to_regprocedure('public.catalogue_stage_import_run_chunk(uuid,text,jsonb)') is not null
  and to_regprocedure('public.catalogue_process_import_batch(uuid,boolean,text)') is not null
  and to_regprocedure('public.catalogue_finalize_import_run(uuid,boolean)') is not null,
  'P0 importer recovery RPC set must exist'
);

select pg_temp.assert_true(
  not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public'
      and c.relkind='r'
      and c.relname like 'catalogue_%'
      and not c.relrowsecurity
  ),
  'every public catalogue table must have RLS enabled'
);

select pg_temp.assert_true(
  (
    select count(*) = 10
    from public.catalogue_sources
    where kind='manufacturer'
      and verification_status='verified'
      and (name, base_url) in (
        ('CNHL official', 'https://chinahobbyline.com'),
        ('Foxeer official', 'https://www.foxeer.com'),
        ('GEPRC official', 'https://geprc.com'),
        ('HQProp official', 'https://www.hqprop.com'),
        ('iFlight official', 'https://shop.iflight.com'),
        ('RadioMaster official', 'https://radiomasterrc.com'),
        ('RunCam official', 'https://shop.runcam.com'),
        ('SpeedyBee official', 'https://www.speedybee.com'),
        ('Tattu official', 'https://www.genstattu.com'),
        ('Team BlackSheep official', 'https://www.team-blacksheep.com')
      )
  ),
  'all ten official staging manufacturer sources must exist with repository-defined URLs'
);

select pg_temp.assert_true(
  (select count(*) = 10 from public.catalogue_source_adapters where active=true),
  'all ten repository manufacturer adapters must be active in local staging'
);

select pg_temp.assert_true(
  not exists (
    select 1
    from public.catalogue_source_adapters a
    join public.catalogue_sources s on s.id=a.source_id
    where s.verification_status <> 'verified'
  ),
  'every local importer adapter must reference a verified source'
);

select pg_temp.assert_true(
  not exists (
    select 1 from cron.job
    where jobname='catalogue-offer-refresh-midnight-berlin'
  ),
  'offer refresh cron must be disabled in disposable staging'
);

select pg_temp.assert_true(
  not exists (
    select 1 from vault.secrets
    where name like 'catalogue_%'
  ),
  'disposable staging must not contain catalogue production-style Vault secrets'
);

select pg_temp.assert_true(
  (select count(*)=0 from public.catalogue_products)
  and (select count(*)=0 from public.catalogue_offers)
  and (select count(*)=0 from public.catalogue_spec_evidence)
  and (select count(*)=0 from public.catalogue_identity_evidence)
  and (select count(*)=0 from public.catalogue_import_runs),
  'clean staging bootstrap must not copy production catalogue, evidence, offers, or runs'
);

rollback;
