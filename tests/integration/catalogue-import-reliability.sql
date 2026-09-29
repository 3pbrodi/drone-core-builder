\set ON_ERROR_STOP on
begin;

create or replace function pg_temp.assert_true(p_condition boolean,p_message text)
returns void
language plpgsql
as $$
begin
  if not coalesce(p_condition,false) then
    raise exception 'ASSERTION FAILED: %',p_message;
  end if;
end
$$;

insert into public.catalogue_sources(
  id,name,kind,base_url,verification_status
) values (
  '10000000-0000-0000-0000-000000000001',
  'P0 Integration Source',
  'manufacturer',
  'https://integration.invalid',
  'verified'
);

insert into public.catalogue_source_adapters(
  id,source_id,adapter_key,adapter_type,version,active,max_batch_size,config
) values (
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000001',
  'p0-integration-adapter',
  'manufacturer',
  1,true,100,'{}'::jsonb
);

insert into public.catalogue_manufacturers(
  id,name,verification_status
) values (
  '10000000-0000-0000-0000-000000000003',
  'P0 Integration Manufacturer',
  'verified'
);

insert into public.catalogue_products(
  id,manufacturer_id,model,variant,display_name,category,
  manufacturer_sku,mpn,record_class,identity_status,verification_status,selectable
) values
(
  'p0-exact',
  '10000000-0000-0000-0000-000000000003',
  'Exact Motor','1750KV','Exact Motor 1750KV','motors',
  'EXACT-SKU','EXACT-MPN','canonical','verified','pending_review',false
),
(
  'p0-family-a',
  '10000000-0000-0000-0000-000000000003',
  'Family Motor','1750KV','Family Motor 1750KV','motors',
  'FAMILY-A','FAMILY-MPN-A','canonical','verified','pending_review',false
),
(
  'p0-conflict-a',
  '10000000-0000-0000-0000-000000000003',
  'Conflict A','A','Conflict A','motors',
  'CONFLICT-A','CONFLICT-MPN-A','canonical','verified','pending_review',false
),
(
  'p0-conflict-b',
  '10000000-0000-0000-0000-000000000003',
  'Conflict B','B','Conflict B','motors',
  'CONFLICT-B','CONFLICT-MPN-B','canonical','verified','pending_review',false
);

insert into public.catalogue_product_identity_keys(
  product_id,key_kind,key_value,confidence
) values
(
  'p0-conflict-a','manufacturer_sku',
  'motors|p0integrationmanufacturer|sharedconflict',1
),
(
  'p0-conflict-b','manufacturer_sku',
  'motors|p0integrationmanufacturer|sharedconflict',1
);

-- Stable logical run ID: repeating the same logical run cannot create a second run.
select public.catalogue_get_or_create_import_run(
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000001',
  'integration-idempotent',1
);
select public.catalogue_get_or_create_import_run(
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000001',
  'integration-idempotent',1
);
select pg_temp.assert_true(
  (select count(*)=1 from public.catalogue_import_runs
   where logical_run_id='integration-idempotent'),
  'same logical run must create exactly one durable run'
);


-- Production importer calls these RPCs through service_role, not postgres.
set local role service_role;
select public.catalogue_get_or_create_import_run(
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000001',
  'integration-service-role-smoke',1
);
reset role;


-- Canonical identity includes category, so identical manufacturer/model/variant
-- labels in different component categories do not collide.
insert into public.catalogue_products(
  id,manufacturer_id,model,variant,display_name,category,
  record_class,identity_status,verification_status,selectable
) values
(
  'p0-cross-category-motor',
  '10000000-0000-0000-0000-000000000003',
  'Shared Label','V1','Shared Label V1 Motor','motors',
  'canonical','verified','pending_review',false
),
(
  'p0-cross-category-receiver',
  '10000000-0000-0000-0000-000000000003',
  'Shared Label','V1','Shared Label V1 Receiver','receiver',
  'canonical','verified','pending_review',false
);
select pg_temp.assert_true(
  (select count(*)=2 from public.catalogue_products
   where id in ('p0-cross-category-motor','p0-cross-category-receiver')),
  'category-aware canonical identity must allow the same model/variant label in different categories'
);

-- Two Shopify variants from one parent product remain independent durable items
-- and independent staging rows.
do $shopify$
declare
  v_run_id uuid;
begin
  v_run_id := (
    public.catalogue_get_or_create_import_run(
      '10000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000001',
      'integration-shopify-variants',1
    )->>'runId'
  )::uuid;

  perform public.catalogue_upsert_import_manifest_items(
    v_run_id,
    jsonb_build_array(
      jsonb_build_object(
        'upstreamItemId','shopify:variant:1001',
        'upstreamParentProductId','shopify:product:100',
        'upstreamVariantId','1001',
        'sourceUrl','https://integration.invalid/products/motor',
        'itemKind','variant','discoveryStatus','ready',
        'normalizedData',jsonb_build_object(
          'id','shopify-motor-1855','category','motors',
          'manufacturer','P0 Integration Manufacturer','model','Shopify Motor',
          'variant','1855KV','display_name','Shopify Motor — 1855KV',
          'manufacturer_sku','SHOP-1855',
          'source_external_product_id','shopify:variant:1001',
          'source_external_parent_product_id','shopify:product:100',
          'source_external_variant_id','1001',
          'source_url','https://integration.invalid/products/motor'
        )
      ),
      jsonb_build_object(
        'upstreamItemId','shopify:variant:1002',
        'upstreamParentProductId','shopify:product:100',
        'upstreamVariantId','1002',
        'sourceUrl','https://integration.invalid/products/motor',
        'itemKind','variant','discoveryStatus','ready',
        'normalizedData',jsonb_build_object(
          'id','shopify-motor-1960','category','motors',
          'manufacturer','P0 Integration Manufacturer','model','Shopify Motor',
          'variant','1960KV','display_name','Shopify Motor — 1960KV',
          'manufacturer_sku','SHOP-1960',
          'source_external_product_id','shopify:variant:1002',
          'source_external_parent_product_id','shopify:product:100',
          'source_external_variant_id','1002',
          'source_url','https://integration.invalid/products/motor'
        )
      )
    ),
    1,null,jsonb_build_object('pass',1,'insertedInPass',2),true
  );

  perform public.catalogue_stage_import_run_chunk(
    v_run_id,'shopify-variants',
    jsonb_build_array(
      jsonb_build_object(
        'upstreamItemId','shopify:variant:1001','outcome','ready',
        'sourceUrl','https://integration.invalid/products/motor',
        'normalizedData',(select normalized_data from public.catalogue_import_run_items where run_id=v_run_id and upstream_item_id='shopify:variant:1001'),
        'errors','[]'::jsonb
      ),
      jsonb_build_object(
        'upstreamItemId','shopify:variant:1002','outcome','ready',
        'sourceUrl','https://integration.invalid/products/motor',
        'normalizedData',(select normalized_data from public.catalogue_import_run_items where run_id=v_run_id and upstream_item_id='shopify:variant:1002'),
        'errors','[]'::jsonb
      )
    )
  );

  perform pg_temp.assert_true(
    (select count(*)=2 from public.catalogue_import_rows where import_run_id=v_run_id),
    'two Shopify variants must produce two staging rows'
  );
  perform pg_temp.assert_true(
    (select count(distinct upstream_item_id)=2 from public.catalogue_import_rows where import_run_id=v_run_id),
    'Shopify upstream variant identity must remain distinct through staging'
  );
end
$shopify$;

-- Source changes between discovery pages/passes. Pass 1 sees A/B, pass 2 sees
-- B/C, pass 3 confirms B/C. A must become a durable excluded manifest item.
select public.catalogue_get_or_create_import_run(
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000001',
  'integration-changing-source',1
);
select public.catalogue_upsert_import_manifest_items(
  (select id from public.catalogue_import_runs where logical_run_id='integration-changing-source'),
  jsonb_build_array(
    jsonb_build_object('upstreamItemId','page:A','sourceUrl','https://integration.invalid/a','itemKind','product_page','discoveryStatus','discovered'),
    jsonb_build_object('upstreamItemId','page:B','sourceUrl','https://integration.invalid/b','itemKind','product_page','discoveryStatus','discovered')
  ),
  1,null,jsonb_build_object('pass',1,'insertedInPass',2),false
);
select public.catalogue_upsert_import_manifest_items(
  (select id from public.catalogue_import_runs where logical_run_id='integration-changing-source'),
  jsonb_build_array(
    jsonb_build_object('upstreamItemId','page:B','sourceUrl','https://integration.invalid/b','itemKind','product_page','discoveryStatus','discovered'),
    jsonb_build_object('upstreamItemId','page:C','sourceUrl','https://integration.invalid/c','itemKind','product_page','discoveryStatus','discovered')
  ),
  2,null,jsonb_build_object('pass',2,'insertedInPass',1),false
);
select public.catalogue_upsert_import_manifest_items(
  (select id from public.catalogue_import_runs where logical_run_id='integration-changing-source'),
  jsonb_build_array(
    jsonb_build_object('upstreamItemId','page:B','sourceUrl','https://integration.invalid/b','itemKind','product_page','discoveryStatus','discovered'),
    jsonb_build_object('upstreamItemId','page:C','sourceUrl','https://integration.invalid/c','itemKind','product_page','discoveryStatus','discovered')
  ),
  3,null,jsonb_build_object('pass',3,'insertedInPass',0),true
);
select pg_temp.assert_true(
  (select manifest_complete from public.catalogue_import_runs
   where logical_run_id='integration-changing-source'),
  'stable discovery pass must freeze the manifest'
);
select pg_temp.assert_true(
  (
    select i.discovery_status='excluded' and i.processing_status='done'
    from public.catalogue_import_run_items i
    join public.catalogue_import_runs r on r.id=i.run_id
    where r.logical_run_id='integration-changing-source'
      and i.upstream_item_id='page:A'
  ),
  'item removed during verification pass must remain durably accounted as excluded'
);
select pg_temp.assert_true(
  (
    select count(*)=3
    from public.catalogue_import_run_items i
    join public.catalogue_import_runs r on r.id=i.run_id
    where r.logical_run_id='integration-changing-source'
  ),
  'manifest must retain all discovered items including removed/excluded items'
);

-- Exact/probable/conflict/new plus repeated staging of the same logical chunk.
select public.catalogue_get_or_create_import_run(
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000001',
  'integration-dedupe',1
);
select public.catalogue_upsert_import_manifest_items(
  (select id from public.catalogue_import_runs where logical_run_id='integration-dedupe'),
  jsonb_build_array(
    jsonb_build_object(
      'upstreamItemId','variant:exact','sourceUrl','https://integration.invalid/exact',
      'itemKind','variant','discoveryStatus','ready',
      'normalizedData',jsonb_build_object(
        'id','import-exact','category','motors','manufacturer','P0 Integration Manufacturer',
        'model','Exact Motor','variant','1750KV','display_name','Exact Motor 1750KV',
        'manufacturer_sku','EXACT-SKU','mpn','EXACT-MPN',
        'source_external_product_id','variant:exact','source_url','https://integration.invalid/exact'
      )
    ),
    jsonb_build_object(
      'upstreamItemId','variant:probable','sourceUrl','https://integration.invalid/probable',
      'itemKind','variant','discoveryStatus','ready',
      'normalizedData',jsonb_build_object(
        'id','import-probable','category','motors','manufacturer','P0 Integration Manufacturer',
        'model','Family Motor','variant','1950KV','display_name','Family Motor 1950KV',
        'manufacturer_sku','FAMILY-NEW','mpn','FAMILY-MPN-NEW',
        'source_external_product_id','variant:probable','source_url','https://integration.invalid/probable'
      )
    ),
    jsonb_build_object(
      'upstreamItemId','variant:conflict','sourceUrl','https://integration.invalid/conflict',
      'itemKind','variant','discoveryStatus','ready',
      'normalizedData',jsonb_build_object(
        'id','import-conflict','category','motors','manufacturer','P0 Integration Manufacturer',
        'model','Conflict Incoming','variant','C','display_name','Conflict Incoming',
        'manufacturer_sku','SHARED-CONFLICT',
        'source_external_product_id','variant:conflict','source_url','https://integration.invalid/conflict'
      )
    ),
    jsonb_build_object(
      'upstreamItemId','variant:new','sourceUrl','https://integration.invalid/new',
      'itemKind','variant','discoveryStatus','ready',
      'normalizedData',jsonb_build_object(
        'id','import-new','category','motors','manufacturer','P0 Integration Manufacturer',
        'model','Brand New Motor','variant','2200KV','display_name','Brand New Motor 2200KV',
        'manufacturer_sku','NEW-SKU',
        'source_external_product_id','variant:new','source_url','https://integration.invalid/new'
      )
    )
  ),
  1,null,jsonb_build_object('pass',1,'insertedInPass',4),true
);

select public.catalogue_stage_import_run_chunk(
  (select id from public.catalogue_import_runs where logical_run_id='integration-dedupe'),
  'dedupe-chunk',
  jsonb_build_array(
    jsonb_build_object('upstreamItemId','variant:exact','outcome','ready','sourceUrl','https://integration.invalid/exact','normalizedData',(select normalized_data from public.catalogue_import_run_items i join public.catalogue_import_runs r on r.id=i.run_id where r.logical_run_id='integration-dedupe' and i.upstream_item_id='variant:exact'),'errors','[]'::jsonb),
    jsonb_build_object('upstreamItemId','variant:probable','outcome','ready','sourceUrl','https://integration.invalid/probable','normalizedData',(select normalized_data from public.catalogue_import_run_items i join public.catalogue_import_runs r on r.id=i.run_id where r.logical_run_id='integration-dedupe' and i.upstream_item_id='variant:probable'),'errors','[]'::jsonb),
    jsonb_build_object('upstreamItemId','variant:conflict','outcome','ready','sourceUrl','https://integration.invalid/conflict','normalizedData',(select normalized_data from public.catalogue_import_run_items i join public.catalogue_import_runs r on r.id=i.run_id where r.logical_run_id='integration-dedupe' and i.upstream_item_id='variant:conflict'),'errors','[]'::jsonb),
    jsonb_build_object('upstreamItemId','variant:new','outcome','ready','sourceUrl','https://integration.invalid/new','normalizedData',(select normalized_data from public.catalogue_import_run_items i join public.catalogue_import_runs r on r.id=i.run_id where r.logical_run_id='integration-dedupe' and i.upstream_item_id='variant:new'),'errors','[]'::jsonb)
  )
);
select public.catalogue_stage_import_run_chunk(
  (select id from public.catalogue_import_runs where logical_run_id='integration-dedupe'),
  'dedupe-chunk',
  jsonb_build_array(
    jsonb_build_object('upstreamItemId','variant:exact','outcome','ready','sourceUrl','https://integration.invalid/exact','normalizedData',(select normalized_data from public.catalogue_import_run_items i join public.catalogue_import_runs r on r.id=i.run_id where r.logical_run_id='integration-dedupe' and i.upstream_item_id='variant:exact'),'errors','[]'::jsonb),
    jsonb_build_object('upstreamItemId','variant:probable','outcome','ready','sourceUrl','https://integration.invalid/probable','normalizedData',(select normalized_data from public.catalogue_import_run_items i join public.catalogue_import_runs r on r.id=i.run_id where r.logical_run_id='integration-dedupe' and i.upstream_item_id='variant:probable'),'errors','[]'::jsonb),
    jsonb_build_object('upstreamItemId','variant:conflict','outcome','ready','sourceUrl','https://integration.invalid/conflict','normalizedData',(select normalized_data from public.catalogue_import_run_items i join public.catalogue_import_runs r on r.id=i.run_id where r.logical_run_id='integration-dedupe' and i.upstream_item_id='variant:conflict'),'errors','[]'::jsonb),
    jsonb_build_object('upstreamItemId','variant:new','outcome','ready','sourceUrl','https://integration.invalid/new','normalizedData',(select normalized_data from public.catalogue_import_run_items i join public.catalogue_import_runs r on r.id=i.run_id where r.logical_run_id='integration-dedupe' and i.upstream_item_id='variant:new'),'errors','[]'::jsonb)
  )
);
select pg_temp.assert_true(
  (
    select count(*)=4
    from public.catalogue_import_rows ir
    join public.catalogue_import_runs r on r.id=ir.import_run_id
    where r.logical_run_id='integration-dedupe'
  ),
  'repeated execution of same chunk must not duplicate staging rows'
);

select public.catalogue_run_import_dedupe(
  (select b.id from public.catalogue_import_batches b
   join public.catalogue_import_runs r on r.id=b.import_run_id
   where r.logical_run_id='integration-dedupe' and b.chunk_key='dedupe-chunk')
);
select pg_temp.assert_true(
  (select dedupe_status='exact_match' from public.catalogue_import_rows ir
   join public.catalogue_import_runs r on r.id=ir.import_run_id
   where r.logical_run_id='integration-dedupe' and ir.upstream_item_id='variant:exact'),
  'exact identity expected'
);
select pg_temp.assert_true(
  (select dedupe_status='probable_match' from public.catalogue_import_rows ir
   join public.catalogue_import_runs r on r.id=ir.import_run_id
   where r.logical_run_id='integration-dedupe' and ir.upstream_item_id='variant:probable'),
  'model-family probable match expected'
);
select pg_temp.assert_true(
  (select dedupe_status='conflict' from public.catalogue_import_rows ir
   join public.catalogue_import_runs r on r.id=ir.import_run_id
   where r.logical_run_id='integration-dedupe' and ir.upstream_item_id='variant:conflict'),
  'conflicting identity expected'
);
select pg_temp.assert_true(
  (select dedupe_status='new' from public.catalogue_import_rows ir
   join public.catalogue_import_runs r on r.id=ir.import_run_id
   where r.logical_run_id='integration-dedupe' and ir.upstream_item_id='variant:new'),
  'new identity expected'
);

-- Interrupted chunk insertion must be atomic.
do $$
declare
  v_run_id uuid;
  v_batches_before integer;
  v_rows_before integer;
  v_batches_after integer;
  v_rows_after integer;
  v_failed boolean:=false;
begin
  v_run_id := (
    public.catalogue_get_or_create_import_run(
      '10000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000001',
      'integration-interrupted-chunk',1
    )->>'runId'
  )::uuid;
  perform public.catalogue_upsert_import_manifest_items(
    v_run_id,
    jsonb_build_array(
      jsonb_build_object('upstreamItemId','variant:one','sourceUrl','https://integration.invalid/one','itemKind','variant','discoveryStatus','ready','normalizedData',jsonb_build_object('id','interrupt-one','category','motors','manufacturer','P0 Integration Manufacturer','model','Interrupt One','variant','A','display_name','Interrupt One','manufacturer_sku','INT-1','source_external_product_id','variant:one','source_url','https://integration.invalid/one')),
      jsonb_build_object('upstreamItemId','variant:two','sourceUrl','https://integration.invalid/two','itemKind','variant','discoveryStatus','ready','normalizedData',jsonb_build_object('id','interrupt-two','category','motors','manufacturer','P0 Integration Manufacturer','model','Interrupt Two','variant','B','display_name','Interrupt Two','manufacturer_sku','INT-2','source_external_product_id','variant:two','source_url','https://integration.invalid/two'))
    ),
    1,null,jsonb_build_object('pass',1,'insertedInPass',2),true
  );
  select count(*) into v_batches_before from public.catalogue_import_batches where import_run_id=v_run_id;
  select count(*) into v_rows_before from public.catalogue_import_rows where import_run_id=v_run_id;

  begin
    perform public.catalogue_stage_import_run_chunk(
      v_run_id,'interrupted',
      jsonb_build_array(
        jsonb_build_object('upstreamItemId','variant:one','outcome','ready','sourceUrl','https://integration.invalid/one','normalizedData',(select normalized_data from public.catalogue_import_run_items where run_id=v_run_id and upstream_item_id='variant:one'),'errors','[]'::jsonb),
        jsonb_build_object('upstreamItemId','variant:two','outcome','unsupported','sourceUrl','https://integration.invalid/two','errors','[]'::jsonb)
      )
    );
  exception when others then
    v_failed:=true;
  end;

  select count(*) into v_batches_after from public.catalogue_import_batches where import_run_id=v_run_id;
  select count(*) into v_rows_after from public.catalogue_import_rows where import_run_id=v_run_id;
  perform pg_temp.assert_true(v_failed,'invalid chunk must fail');
  perform pg_temp.assert_true(
    v_batches_before=v_batches_after and v_rows_before=v_rows_after,
    'failed chunk must roll back all staging writes'
  );
end
$$;

-- Simulated dedupe failure: transactional batch processing must roll back.
create or replace function pg_temp.fail_dedupe_update()
returns trigger language plpgsql as $$
begin
  if new.dedupe_status is distinct from old.dedupe_status then
    raise exception 'simulated dedupe failure';
  end if;
  return new;
end
$$;

do $$
declare
  v_run_id uuid;
  v_batch_id uuid;
  v_failed boolean:=false;
begin
  v_run_id := (
    public.catalogue_get_or_create_import_run(
      '10000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000001',
      'integration-dedupe-failure',1
    )->>'runId'
  )::uuid;
  perform public.catalogue_upsert_import_manifest_items(
    v_run_id,
    jsonb_build_array(
      jsonb_build_object('upstreamItemId','variant:dedupe-fail','sourceUrl','https://integration.invalid/dedupe-fail','itemKind','variant','discoveryStatus','ready','normalizedData',jsonb_build_object('id','dedupe-fail','category','motors','manufacturer','P0 Integration Manufacturer','model','Dedupe Fail','variant','A','display_name','Dedupe Fail','manufacturer_sku','DF-1','source_external_product_id','variant:dedupe-fail','source_url','https://integration.invalid/dedupe-fail'))
    ),
    1,null,jsonb_build_object('pass',1,'insertedInPass',1),true
  );
  v_batch_id := (
    public.catalogue_stage_import_run_chunk(
      v_run_id,'dedupe-failure',
      jsonb_build_array(
        jsonb_build_object('upstreamItemId','variant:dedupe-fail','outcome','ready','sourceUrl','https://integration.invalid/dedupe-fail','normalizedData',(select normalized_data from public.catalogue_import_run_items where run_id=v_run_id and upstream_item_id='variant:dedupe-fail'),'errors','[]'::jsonb)
      )
    )->>'batchId'
  )::uuid;

  create trigger p0_fail_dedupe before update on public.catalogue_import_rows
    for each row execute function pg_temp.fail_dedupe_update();
  begin
    perform public.catalogue_process_import_batch(v_batch_id,false,'integration test');
  exception when others then
    v_failed:=true;
  end;
  drop trigger p0_fail_dedupe on public.catalogue_import_rows;

  perform pg_temp.assert_true(v_failed,'simulated dedupe failure must escape process RPC');
  perform pg_temp.assert_true(
    (select status='validated' and dedupe_status='unresolved'
     from public.catalogue_import_rows where batch_id=v_batch_id),
    'dedupe failure must roll back row state'
  );
end
$$;

-- Simulated exact source-link failure must also roll back.
create or replace function pg_temp.fail_source_link()
returns trigger language plpgsql as $$
begin
  raise exception 'simulated source-link failure';
end
$$;

do $$
declare
  v_run_id uuid;
  v_batch_id uuid;
  v_failed boolean:=false;
begin
  v_run_id := (
    public.catalogue_get_or_create_import_run(
      '10000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000001',
      'integration-link-failure',1
    )->>'runId'
  )::uuid;
  perform public.catalogue_upsert_import_manifest_items(
    v_run_id,
    jsonb_build_array(
      jsonb_build_object('upstreamItemId','variant:link-fail','sourceUrl','https://integration.invalid/link-fail','itemKind','variant','discoveryStatus','ready','normalizedData',jsonb_build_object('id','link-fail','category','motors','manufacturer','P0 Integration Manufacturer','model','Exact Motor','variant','1750KV','display_name','Exact Motor 1750KV','manufacturer_sku','EXACT-SKU','source_external_product_id','variant:link-fail','source_url','https://integration.invalid/link-fail'))
    ),
    1,null,jsonb_build_object('pass',1,'insertedInPass',1),true
  );
  v_batch_id := (
    public.catalogue_stage_import_run_chunk(
      v_run_id,'link-failure',
      jsonb_build_array(
        jsonb_build_object('upstreamItemId','variant:link-fail','outcome','ready','sourceUrl','https://integration.invalid/link-fail','normalizedData',(select normalized_data from public.catalogue_import_run_items where run_id=v_run_id and upstream_item_id='variant:link-fail'),'errors','[]'::jsonb)
      )
    )->>'batchId'
  )::uuid;

  create trigger p0_fail_source_link before insert on public.catalogue_product_sources
    for each row execute function pg_temp.fail_source_link();
  begin
    perform public.catalogue_process_import_batch(v_batch_id,false,'integration test');
  exception when others then
    v_failed:=true;
  end;
  drop trigger p0_fail_source_link on public.catalogue_product_sources;

  perform pg_temp.assert_true(v_failed,'source-link failure must escape process RPC');
  perform pg_temp.assert_true(
    (select status='validated' from public.catalogue_import_rows where batch_id=v_batch_id),
    'source-link failure must roll back imported status'
  );
end
$$;

-- Candidate/evidence failure after partial work must roll back the entire
-- processing RPC, not leave the first candidate behind.
do $$
declare
  v_run_id uuid;
  v_batch_id uuid;
  v_failed boolean:=false;
begin
  v_run_id := (
    public.catalogue_get_or_create_import_run(
      '10000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000001',
      'integration-candidate-rollback',1
    )->>'runId'
  )::uuid;
  perform public.catalogue_upsert_import_manifest_items(
    v_run_id,
    jsonb_build_array(
      jsonb_build_object('upstreamItemId','variant:candidate-ok','sourceUrl','https://integration.invalid/candidate-ok','itemKind','variant','discoveryStatus','ready','normalizedData',jsonb_build_object('id','candidate-ok','category','motors','manufacturer','P0 Integration Manufacturer','model','Candidate OK','variant','A','display_name','Candidate OK','manufacturer_sku','CAND-OK','source_external_product_id','variant:candidate-ok','source_url','https://integration.invalid/candidate-ok')),
      jsonb_build_object('upstreamItemId','variant:candidate-bad','sourceUrl','http://integration.invalid/candidate-bad','itemKind','variant','discoveryStatus','ready','normalizedData',jsonb_build_object('id','candidate-bad','category','motors','manufacturer','P0 Integration Manufacturer','model','Candidate Bad','variant','B','display_name','Candidate Bad','manufacturer_sku','CAND-BAD','source_external_product_id','variant:candidate-bad','source_url','http://integration.invalid/candidate-bad'))
    ),
    1,null,jsonb_build_object('pass',1,'insertedInPass',2),true
  );
  v_batch_id := (
    public.catalogue_stage_import_run_chunk(
      v_run_id,'candidate-rollback',
      jsonb_build_array(
        jsonb_build_object('upstreamItemId','variant:candidate-ok','outcome','ready','sourceUrl','https://integration.invalid/candidate-ok','normalizedData',(select normalized_data from public.catalogue_import_run_items where run_id=v_run_id and upstream_item_id='variant:candidate-ok'),'errors','[]'::jsonb),
        jsonb_build_object('upstreamItemId','variant:candidate-bad','outcome','ready','sourceUrl','http://integration.invalid/candidate-bad','normalizedData',(select normalized_data from public.catalogue_import_run_items where run_id=v_run_id and upstream_item_id='variant:candidate-bad'),'errors','[]'::jsonb)
      )
    )->>'batchId'
  )::uuid;

  begin
    perform public.catalogue_process_import_batch(v_batch_id,true,'integration test');
  exception when others then
    v_failed:=true;
  end;

  perform pg_temp.assert_true(v_failed,'invalid evidence source must fail transactional processing');
  perform pg_temp.assert_true(
    not exists(select 1 from public.catalogue_products where id in ('candidate-ok','candidate-bad')),
    'partial candidate creation must roll back completely'
  );
end
$$;

-- A successful new candidate remains behind existing publication gates.
do $$
declare
  v_run_id uuid;
  v_batch_id uuid;
  v_blocked boolean:=false;
begin
  v_run_id := (
    public.catalogue_get_or_create_import_run(
      '10000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000001',
      'integration-publication-gate',1
    )->>'runId'
  )::uuid;
  perform public.catalogue_upsert_import_manifest_items(
    v_run_id,
    jsonb_build_array(
      jsonb_build_object('upstreamItemId','variant:gate','sourceUrl','https://integration.invalid/gate','itemKind','variant','discoveryStatus','ready','normalizedData',jsonb_build_object('id','candidate-gate','category','motors','manufacturer','P0 Integration Manufacturer','model','Gate Candidate','variant','A','display_name','Gate Candidate','manufacturer_sku','GATE-1','source_external_product_id','variant:gate','source_url','https://integration.invalid/gate'))
    ),
    1,null,jsonb_build_object('pass',1,'insertedInPass',1),true
  );
  v_batch_id := (
    public.catalogue_stage_import_run_chunk(
      v_run_id,'publication-gate',
      jsonb_build_array(
        jsonb_build_object('upstreamItemId','variant:gate','outcome','ready','sourceUrl','https://integration.invalid/gate','normalizedData',(select normalized_data from public.catalogue_import_run_items where run_id=v_run_id and upstream_item_id='variant:gate'),'errors','[]'::jsonb)
      )
    )->>'batchId'
  )::uuid;

  perform public.catalogue_process_import_batch(v_batch_id,true,'integration test');
  perform pg_temp.assert_true(
    (select record_class='candidate' and selectable=false
     from public.catalogue_products where id='candidate-gate'),
    'new import must remain a non-selectable candidate'
  );

  begin
    perform public.catalogue_publish_product(
      'candidate-gate','integration test','must remain blocked'
    );
  exception when others then
    v_blocked:=true;
  end;
  perform pg_temp.assert_true(v_blocked,'publication gate must reject unreviewed imported candidate');
end
$$;


-- Multiple distinct chunks within one run remain independently idempotent.
do $p0$
declare
  v_run_id uuid;
begin
  v_run_id := (
    public.catalogue_get_or_create_import_run(
      '10000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000001',
      'integration-multi-chunk',1
    )->>'runId'
  )::uuid;
  perform public.catalogue_upsert_import_manifest_items(
    v_run_id,
    jsonb_build_array(
      jsonb_build_object('upstreamItemId','variant:chunk-a','sourceUrl','https://integration.invalid/chunk-a','itemKind','variant','discoveryStatus','ready','normalizedData',jsonb_build_object('id','chunk-a','category','motors','manufacturer','P0 Integration Manufacturer','model','Chunk A','variant','A','display_name','Chunk A','manufacturer_sku','CHUNK-A','source_external_product_id','variant:chunk-a','source_url','https://integration.invalid/chunk-a')),
      jsonb_build_object('upstreamItemId','variant:chunk-b','sourceUrl','https://integration.invalid/chunk-b','itemKind','variant','discoveryStatus','ready','normalizedData',jsonb_build_object('id','chunk-b','category','motors','manufacturer','P0 Integration Manufacturer','model','Chunk B','variant','B','display_name','Chunk B','manufacturer_sku','CHUNK-B','source_external_product_id','variant:chunk-b','source_url','https://integration.invalid/chunk-b'))
    ),
    1,null,jsonb_build_object('pass',1,'insertedInPass',2),true
  );

  perform public.catalogue_stage_import_run_chunk(
    v_run_id,'chunk-a',
    jsonb_build_array(
      jsonb_build_object('upstreamItemId','variant:chunk-a','outcome','ready','sourceUrl','https://integration.invalid/chunk-a','normalizedData',(select normalized_data from public.catalogue_import_run_items where run_id=v_run_id and upstream_item_id='variant:chunk-a'),'errors','[]'::jsonb)
    )
  );
  perform public.catalogue_stage_import_run_chunk(
    v_run_id,'chunk-b',
    jsonb_build_array(
      jsonb_build_object('upstreamItemId','variant:chunk-b','outcome','ready','sourceUrl','https://integration.invalid/chunk-b','normalizedData',(select normalized_data from public.catalogue_import_run_items where run_id=v_run_id and upstream_item_id='variant:chunk-b'),'errors','[]'::jsonb)
    )
  );

  perform pg_temp.assert_true(
    (select count(*)=2 from public.catalogue_import_batches where import_run_id=v_run_id),
    'one logical run must support multiple durable chunks'
  );
  perform pg_temp.assert_true(
    (select count(*)=2 from public.catalogue_import_rows where import_run_id=v_run_id),
    'multiple chunks must retain one staging row per manifest item'
  );
end
$p0$;

-- Every non-success discovery/processing outcome remains durably visible.
do $p0$
declare
  v_run_id uuid;
begin
  v_run_id := (
    public.catalogue_get_or_create_import_run(
      '10000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000001',
      'integration-error-manifest',1
    )->>'runId'
  )::uuid;
  perform public.catalogue_upsert_import_manifest_items(
    v_run_id,
    jsonb_build_array(
      jsonb_build_object('upstreamItemId','page:fetch','sourceUrl','https://integration.invalid/fetch','itemKind','product_page','discoveryStatus','discovered'),
      jsonb_build_object('upstreamItemId','page:parse','sourceUrl','https://integration.invalid/parse','itemKind','product_page','discoveryStatus','discovered'),
      jsonb_build_object('upstreamItemId','page:excluded','sourceUrl','https://integration.invalid/excluded','itemKind','product_page','discoveryStatus','excluded','errors',jsonb_build_array('Excluded by adapter rule.'))
    ),
    1,null,jsonb_build_object('pass',1,'insertedInPass',3),true
  );
  perform public.catalogue_stage_import_run_chunk(
    v_run_id,'errors',
    jsonb_build_array(
      jsonb_build_object('upstreamItemId','page:fetch','outcome','fetch_failed','sourceUrl','https://integration.invalid/fetch','errors',jsonb_build_array('simulated fetch failure'),'lastError','simulated fetch failure'),
      jsonb_build_object('upstreamItemId','page:parse','outcome','parse_failed','sourceUrl','https://integration.invalid/parse','errors',jsonb_build_array('simulated parse failure'),'lastError','simulated parse failure'),
      jsonb_build_object('upstreamItemId','page:excluded','outcome','excluded','sourceUrl','https://integration.invalid/excluded','errors',jsonb_build_array('Excluded by adapter rule.'))
    )
  );
  perform public.catalogue_refresh_import_run_state(v_run_id);

  perform pg_temp.assert_true(
    (select count(*)=3 from public.catalogue_import_run_items where run_id=v_run_id),
    'failed, parse-error and excluded discoveries must all remain in the manifest'
  );
  perform pg_temp.assert_true(
    (select failed_count=2 and excluded_count=1 and status='resumable'
     from public.catalogue_import_runs where id=v_run_id),
    'run accounting must derive failed and excluded counts from durable item state'
  );
end
$p0$;

-- Claimed items can be released immediately after an uncertain staging failure.
do $p0$
declare
  v_run_id uuid;
  v_claim jsonb;
  v_item_id bigint;
  v_released jsonb;
begin
  v_run_id := (
    public.catalogue_get_or_create_import_run(
      '10000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000001',
      'integration-claim-release',1
    )->>'runId'
  )::uuid;
  perform public.catalogue_upsert_import_manifest_items(
    v_run_id,
    jsonb_build_array(
      jsonb_build_object('upstreamItemId','variant:claim','sourceUrl','https://integration.invalid/claim','itemKind','variant','discoveryStatus','ready','normalizedData',jsonb_build_object('id','claim-item','category','motors','manufacturer','P0 Integration Manufacturer','model','Claim Item','variant','A','display_name','Claim Item','manufacturer_sku','CLAIM-1','source_external_product_id','variant:claim','source_url','https://integration.invalid/claim'))
    ),
    1,null,jsonb_build_object('pass',1,'insertedInPass',1),true
  );
  v_claim := public.catalogue_claim_import_run_items(v_run_id,1,3,false);
  v_item_id := ((v_claim->'items'->0->>'id')::bigint);
  perform pg_temp.assert_true(v_item_id is not null,'claim must return a durable item id');

  v_released := public.catalogue_release_import_run_claims(
    v_run_id,array[v_item_id],'simulated staging transport failure'
  );
  perform pg_temp.assert_true(
    (v_released->>'releasedCount')::integer=1,
    'uncertain staging failure must release an uncommitted processing claim'
  );
  perform pg_temp.assert_true(
    (select processing_status='failed' and attempt_count=1
     from public.catalogue_import_run_items where id=v_item_id),
    'released claim must be retryable and count the failed attempt'
  );

  v_claim := public.catalogue_claim_import_run_items(v_run_id,1,3,false);
  perform pg_temp.assert_true(
    jsonb_array_length(v_claim->'items')=1,
    'failed claim below max attempts must be immediately reclaimable'
  );
end
$p0$;

-- Finalization before discovery is frozen is forbidden.
do $p0$
declare
  v_run_id uuid;
  v_blocked boolean:=false;
begin
  v_run_id := (
    public.catalogue_get_or_create_import_run(
      '10000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000001',
      'integration-incomplete-finalize',1
    )->>'runId'
  )::uuid;
  begin
    perform public.catalogue_finalize_import_run(v_run_id,false);
  exception when others then
    v_blocked:=true;
  end;
  perform pg_temp.assert_true(
    v_blocked,
    'run cannot be finalized before its discovery manifest is complete'
  );
end
$p0$;

-- Final accounting is derived from durable item states.
select public.catalogue_refresh_import_run_state(
  (select id from public.catalogue_import_runs where logical_run_id='integration-changing-source')
);
select pg_temp.assert_true(
  (
    select discovered_count=3
       and excluded_count=1
       and failed_count=0
    from public.catalogue_import_runs
    where logical_run_id='integration-changing-source'
  ),
  'durable run counters must agree with manifest item states'
);

rollback;
