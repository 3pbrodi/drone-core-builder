\set ON_ERROR_STOP on
set statement_timeout='25min';
insert into public.catalogue_sources(id,name,kind,base_url,verification_status) values('66000000-0000-0000-0000-000000000001','TEST SYNTHETIC ONLY','manufacturer','https://synthetic.invalid','verified') on conflict(id) do nothing;
insert into public.catalogue_source_adapters(id,source_id,adapter_key,adapter_type,version,active,max_batch_size,config) values('66000000-0000-0000-0000-000000000002','66000000-0000-0000-0000-000000000001','step6-synthetic','manufacturer',1,true,250,'{}') on conflict(id) do nothing;
insert into public.catalogue_manufacturers(id,name,verification_status) values('66000000-0000-0000-0000-000000000003','TEST SYNTHETIC MANUFACTURER','verified') on conflict(id) do nothing;
do $load$
declare
 v_n int:=current_setting('step6.size')::int;
 v_run uuid; v_batch uuid; v_response jsonb; v_manifest jsonb; v_chunk jsonb;
 v_family int; v_chunk_size int; v_offset int; v_created int:=0;
 v_before bigint; v_before_identity bigint; v_before_specs bigint;
 v_start timestamptz:=clock_timestamp();
begin
 if v_n not in (10,100,1000,5000,10000) then raise exception 'invalid test size'; end if;
 if not has_schema_privilege('service_role','catalogue_internal','USAGE') or has_schema_privilege('anon','catalogue_internal','USAGE') or has_schema_privilege('authenticated','catalogue_internal','USAGE') then raise exception 'private ACL regression'; end if;
 select count(*) into v_before from public.catalogue_products;
 select count(*) into v_before_identity from public.catalogue_identity_evidence;
 select count(*) into v_before_specs from public.catalogue_spec_evidence;
 v_family:=case when v_n=10 then 10 when v_n=100 then 25 else 50 end;
 v_chunk_size:=case when v_n=10 then 10 when v_n=100 then 25 when v_n=1000 then 50 when v_n=5000 then 100 else 250 end;
 v_response:=public.catalogue_get_or_create_import_run('66000000-0000-0000-0000-000000000002','66000000-0000-0000-0000-000000000001','step6-test-synthetic-'||v_n,1);
 v_run:=(v_response->>'runId')::uuid;
 select jsonb_agg(jsonb_build_object(
  'upstreamItemId','synthetic:'||v_n||':'||g.i,
  'upstreamParentProductId','synthetic:family:'||v_n||':'||((g.i-1)/v_family),
  'upstreamVariantId','variant:'||g.i,
  'sourceUrl','https://synthetic.invalid/'||v_n||'/'||g.i,
  'itemKind','variant','discoveryStatus','ready',
  'normalizedData',jsonb_build_object(
    'id','test-synthetic-'||v_n||'-'||g.i,'category','propellers',
    'manufacturer','TEST SYNTHETIC MANUFACTURER',
    'model','TEST/SYNTHETIC Family '||v_n||'-'||((g.i-1)/v_family),
    'variant','Variant '||((g.i-1)%v_family+1),
    'display_name','TEST/SYNTHETIC Prop '||v_n||'-'||g.i,
    'manufacturer_sku','TEST-SKU-'||v_n||'-'||g.i,
    'mpn',case when g.i%11=0 then null else 'TEST-MPN-'||v_n||'-'||g.i end,
    'propeller_diameter_inches',case when g.i%2=0 then 6 else 5 end,
    'source_external_product_id','synthetic:'||v_n||':'||g.i,
    'source_external_parent_product_id','synthetic:family:'||v_n||':'||((g.i-1)/v_family),
    'source_external_variant_id','variant:'||g.i,
    'source_url','https://synthetic.invalid/'||v_n||'/'||g.i
  )) order by g.i) into v_manifest from generate_series(1,v_n) g(i);
 perform public.catalogue_upsert_import_manifest_items(v_run,v_manifest,1,null,jsonb_build_object('pass',1,'insertedInPass',v_n),true);
 if (select count(*) from public.catalogue_import_run_items where run_id=v_run)<>v_n then raise exception 'manifest count mismatch'; end if;
 for v_offset in 0..((v_n-1)/v_chunk_size) loop
  select jsonb_agg(jsonb_build_object('upstreamItemId',i.upstream_item_id,'outcome','ready',
    'sourceUrl',i.source_url,'normalizedData',i.normalized_data,
    'rawData',jsonb_build_object('testSynthetic',true),
    'errors','[]'::jsonb) order by i.discovery_ordinal)
  into v_chunk from public.catalogue_import_run_items i where i.run_id=v_run
   and i.discovery_ordinal>v_offset*v_chunk_size and i.discovery_ordinal<=(v_offset+1)*v_chunk_size;
  v_response:=public.catalogue_stage_import_run_chunk(v_run,'chunk-'||v_offset,v_chunk);
  v_batch:=(v_response->>'batchId')::uuid;
  v_response:=public.catalogue_process_import_batch(v_batch,true,'TEST SYNTHETIC');
  v_created:=v_created+coalesce((v_response->>'candidatesCreated')::int,0);
  if v_offset%10=0 then raise notice 'STEP6_PROGRESS %',jsonb_build_object('n',v_n,'chunk',v_offset,'created',v_created,'seconds',extract(epoch from clock_timestamp()-v_start));end if;
 end loop;
 perform public.catalogue_finalize_import_run(v_run,false);
 if v_created<>v_n or (select count(*) from public.catalogue_products)<>v_before+v_n
 or (select count(*) from public.catalogue_identity_evidence)<>v_before_identity+v_n
 or (select count(*) from public.catalogue_spec_evidence)<>v_before_specs+v_n
 or (select count(*) from public.catalogue_products where selectable)<>0
 or (select count(*) from public.catalogue_offers)<>0 then raise exception 'product, evidence or publication assertion failed at %',v_n; end if;
 if (select count(*) from public.catalogue_import_run_items where run_id=v_run and processing_status='done')<>v_n then raise exception 'manifest incomplete';end if;
 if v_n=100 then
  v_response:=public.catalogue_get_or_create_import_run('66000000-0000-0000-0000-000000000002','66000000-0000-0000-0000-000000000001','step6-test-synthetic-100',1);
  if (v_response->>'runId')::uuid<>v_run then raise exception 'same logical run replay failed';end if;
 end if;
 raise notice 'STEP6_LEVEL_RESULT %',jsonb_build_object(
  'n',v_n,'chunkSize',v_chunk_size,'created',v_created,
  'seconds',round(extract(epoch from clock_timestamp()-v_start)::numeric,3),
  'products',(select count(*) from public.catalogue_products),
  'candidates',(select count(*) from public.catalogue_products where record_class='candidate'),
  'identityEvidence',(select count(*) from public.catalogue_identity_evidence),
  'specEvidence',(select count(*) from public.catalogue_spec_evidence),
  'manifestItems',(select count(*) from public.catalogue_import_run_items),
  'rows',(select count(*) from public.catalogue_import_rows),
  'batches',(select count(*) from public.catalogue_import_batches),
  'runs',(select count(*) from public.catalogue_import_runs),
  'databaseBytes',pg_database_size(current_database()));
end
$load$;
